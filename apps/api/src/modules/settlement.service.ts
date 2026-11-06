import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LedgerService, acct } from './ledger.service';

export function settlementEligibleAt(createdAt: Date, days: number, now = new Date()) {
  const d = Math.max(0, Number(days) || 0);
  if (d === 0) return true;
  const start = new Date(createdAt);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + d);
  return now.getTime() >= start.getTime();
}

@Injectable()
export class SettlementService {
  constructor(private p: PrismaService, private ledger: LedgerService) {}

  view(b: any) {
    return {
      id: b.id,
      merchantId: b.merchantId,
      businessName: b.merchant?.businessName || '',
      settlementDays: b.settlementDays,
      status: b.status,
      amountPaise: Number(b.amountPaise || 0),
      txnCount: b.txnCount,
      requestedBy: b.requestedBy,
      approvedBy: b.approvedBy,
      reason: b.reason || '',
      postedAt: b.postedAt,
      createdAt: b.createdAt,
      items: (b.items || []).map((i: any) => ({
        id: i.id,
        transactionId: i.transactionId,
        merchantRef: i.transaction?.merchantRef,
        amountPaise: Number(i.amountPaise),
        createdAt: i.transaction?.createdAt,
      })),
      note: 'Internal ledger move from collections to payout wallet. Not a bank settlement file.',
    };
  }

  async preview(merchantId: string) {
    const m = await this.p.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!m) throw new BadRequestException('Merchant not found');
    const days = m.settlementDays ?? 1;
    const hold = Number(m.walletHoldPaise || 0);
    const collections = await this.ledger.balance(this.p, merchantId, acct(merchantId, 'COLLECTIONS'));
    const free = Math.max(0, collections - hold);
    const taken = await this.p.settlementItem.findMany({ select: { transactionId: true } });
    const takenIds = new Set(taken.map((x) => x.transactionId));
    const txns = await this.p.transaction.findMany({
      where: { merchantId, kind: 'PAYIN', status: 'SUCCESS' },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    const eligible = txns.filter((t) => !takenIds.has(t.id) && settlementEligibleAt(t.createdAt, days));
    const netPaise = eligible.map((t) => Math.max(0, Number(t.amountPaise) - Number(t.feePaise || 0)));
    let cap = free;
    const picked: { id: string; merchantRef: string; amountPaise: number; createdAt: Date }[] = [];
    eligible.forEach((t, i) => {
      const amt = netPaise[i];
      if (amt <= 0 || amt > cap) return;
      cap -= amt;
      picked.push({ id: t.id, merchantRef: t.merchantRef, amountPaise: amt, createdAt: t.createdAt });
    });
    const amountPaise = picked.reduce((a, x) => a + x.amountPaise, 0);
    return {
      merchantId,
      businessName: m.businessName,
      settlementDays: days,
      collectionsPaise: collections,
      holdPaise: hold,
      freePaise: free,
      eligibleCount: eligible.length,
      pickedCount: picked.length,
      amountPaise,
      items: picked,
      note: 'T+N uses the success calendar day. Amount is net of fees, capped by collections minus wallet hold. Ledger only — not a bank payout.',
    };
  }

  async create(merchantId: string, actorId: string) {
    const preview = await this.preview(merchantId);
    if (!preview.pickedCount) throw new BadRequestException('No eligible pay-ins to settle yet');
    const batch = await this.p.$transaction(async (tx) => {
      const row = await tx.settlementBatch.create({
        data: {
          merchantId,
          settlementDays: preview.settlementDays,
          status: 'PENDING',
          amountPaise: BigInt(preview.amountPaise),
          txnCount: preview.pickedCount,
          requestedBy: actorId,
          items: { create: preview.items.map((i) => ({ transactionId: i.id, amountPaise: BigInt(i.amountPaise) })) },
        },
        include: { items: { include: { transaction: { select: { merchantRef: true, createdAt: true } } } }, merchant: { select: { businessName: true } } },
      });
      await tx.pendingApproval.create({
        data: { kind: 'SETTLEMENT', payload: { batchId: row.id, merchantId, amountPaise: preview.amountPaise }, requestedBy: actorId },
      });
      return row;
    });
    return this.view(batch);
  }

  async list(merchantId?: string) {
    const rows = await this.p.settlementBatch.findMany({
      where: merchantId ? { merchantId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: { include: { transaction: { select: { merchantRef: true, createdAt: true } } } }, merchant: { select: { businessName: true } } },
    });
    return rows.map((r) => this.view(r));
  }

  async post(batchId: string, actorId: string, role?: string) {
    const batch = await this.p.settlementBatch.findUnique({
      where: { id: batchId },
      include: { items: true, merchant: true },
    });
    if (!batch) throw new BadRequestException('Settlement batch not found');
    if (batch.status === 'POSTED') return this.view(await this.reload(batchId));
    if (batch.status !== 'PENDING') throw new BadRequestException('This batch is not awaiting approval');
    if (batch.requestedBy === actorId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Maker-checker: the requester cannot post their own settlement');
    }
    const amt = Number(batch.amountPaise);
    if (amt <= 0) throw new BadRequestException('Batch has no amount');
    await this.p.$transaction(async (tx) => {
      const hold = Number(batch.merchant.walletHoldPaise || 0);
      const collections = await this.ledger.balance(tx, batch.merchantId, acct(batch.merchantId, 'COLLECTIONS'));
      const free = collections - hold;
      if (amt > free) throw new BadRequestException(`Only ₹${(Math.max(0, free) / 100).toFixed(2)} is free after wallet hold`);
      await this.ledger.post(tx, `settlement:${batch.id}`, 'T+N settlement collections → payout wallet', [
        { account: acct(batch.merchantId, 'COLLECTIONS'), merchantId: batch.merchantId, kind: 'COLLECTIONS', debit: amt, credit: 0 },
        { account: acct(batch.merchantId, 'PAYOUT_BALANCE'), merchantId: batch.merchantId, kind: 'PAYOUT_BALANCE', debit: 0, credit: amt },
      ]);
      await tx.settlementBatch.update({
        where: { id: batch.id },
        data: { status: 'POSTED', approvedBy: actorId, postedAt: new Date() },
      });
      await this.closeApprovals(tx, batch.id, 'APPROVED', actorId);
    });
    return this.view(await this.reload(batchId));
  }

  async reject(batchId: string, actorId: string, reason?: string) {
    const batch = await this.p.settlementBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new BadRequestException('Settlement batch not found');
    if (batch.status !== 'PENDING') throw new BadRequestException('This batch is not awaiting approval');
    await this.p.$transaction(async (tx) => {
      await tx.settlementBatch.update({ where: { id: batchId }, data: { status: 'REJECTED', approvedBy: actorId, reason: reason || 'Rejected' } });
      await tx.settlementItem.deleteMany({ where: { batchId } });
      await this.closeApprovals(tx, batchId, 'REJECTED', actorId, reason);
    });
    return this.view(await this.reload(batchId));
  }

  private async closeApprovals(tx: any, batchId: string, status: 'APPROVED' | 'REJECTED', actorId: string, reason?: string) {
    const pending = await tx.pendingApproval.findMany({ where: { kind: 'SETTLEMENT', status: 'PENDING' } });
    for (const a of pending) {
      if ((a.payload as any)?.batchId !== batchId) continue;
      await tx.pendingApproval.update({
        where: { id: a.id },
        data: { status, approvedBy: actorId, decidedAt: new Date(), reason: reason || null },
      });
    }
  }

  private async reload(id: string) {
    return this.p.settlementBatch.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { transaction: { select: { merchantRef: true, createdAt: true } } } }, merchant: { select: { businessName: true } } },
    });
  }
}
