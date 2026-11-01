import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { AuthGuard, Perm, StaffGuard } from '../common/guards';
import { LedgerService, acct } from './ledger.service';

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED'];

function rupees(v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Amount must be a non-negative number (rupees)');
  return BigInt(Math.round(n * 100));
}

function viewSlab(s: any) {
  return {
    id: s.id,
    merchantId: s.merchantId,
    productCode: s.productCode,
    minRupees: Number(s.minAmountPaise) / 100,
    maxRupees: s.maxAmountPaise == null ? null : Number(s.maxAmountPaise) / 100,
    feePercent: s.feeBps / 100,
    feeFlatRupees: Number(s.feeFlatPaise) / 100,
    isActive: s.isActive,
  };
}

@ApiTags('merchant-desk')
@Controller('merchant-desk')
@UseGuards(AuthGuard, StaffGuard)
export class MerchantDeskController {
  constructor(private p: PrismaService, private ledger: LedgerService) {}

  private async merchant(id: string) {
    const m = await this.p.merchantProfile.findUnique({ where: { id } });
    if (!m) throw new BadRequestException('Merchant not found');
    return m;
  }

  private async walletOf(id: string, holdPaise?: number) {
    const payinPaise = await this.ledger.balance(this.p, id, acct(id, 'COLLECTIONS'));
    const payoutPaise = await this.ledger.balance(this.p, id, acct(id, 'PAYOUT_BALANCE'));
    const hold = holdPaise ?? Number((await this.merchant(id)).walletHoldPaise || 0);
    return { payinPaise, payoutPaise, holdPaise: hold, freePayinPaise: Math.max(0, payinPaise - hold) };
  }

  private viewMerchant(m: any, wallet: { payinPaise: number; payoutPaise: number; holdPaise: number; freePayinPaise: number }) {
    return {
      id: m.id,
      businessName: m.businessName || '',
      entityType: m.entityType || '',
      website: m.website || '',
      gst: m.gst || '',
      status: m.status,
      sandboxEnabled: m.sandboxEnabled,
      productionEnabled: m.productionEnabled,
      memberCount: m._count?.members ?? 0,
      ...wallet,
    };
  }

  @Get()
  @Perm('merchant:read')
  async list() {
    const rows = await this.p.merchantProfile.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { members: true } } } });
    const out = [];
    for (const m of rows) out.push(this.viewMerchant(m, await this.walletOf(m.id, Number(m.walletHoldPaise || 0))));
    return out;
  }

  @Post()
  @Perm('merchant:write')
  async create(@Body() b: any) {
    const name = String(b.businessName || '').trim();
    if (name.length < 2) throw new BadRequestException('Merchant name is required');
    const status = STATUSES.includes(String(b.status || '')) ? String(b.status) : 'APPROVED';
    const org = await this.p.organization.create({ data: { name, type: 'MERCHANT' } });
    const row = await this.p.merchantProfile.create({
      data: {
        orgId: org.id,
        businessName: name,
        entityType: String(b.entityType || '').trim() || null,
        website: String(b.website || '').trim() || null,
        gst: String(b.gst || '').trim() || null,
        status: status as any,
        sandboxEnabled: b.sandboxEnabled !== false,
        productionEnabled: !!b.productionEnabled,
        completion: 40,
      },
    });
    const products = await this.p.apiProduct.findMany({ where: { code: { in: ['PAYIN', 'PAYOUT'] } } });
    for (const prod of products) {
      await this.p.merchantProductAccess.createMany({
        data: [
          { merchantId: row.id, productId: prod.id, env: 'sandbox', status: 'ENABLED' },
          { merchantId: row.id, productId: prod.id, env: 'production', status: 'ENABLED' },
        ],
        skipDuplicates: true,
      });
    }
    return this.viewMerchant({ ...row, _count: { members: 0 } }, await this.walletOf(row.id, 0));
  }

  @Post(':merchantId/profile')
  @Perm('merchant:write')
  async saveProfile(@Param('merchantId') merchantId: string, @Body() b: any) {
    const m = await this.merchant(merchantId);
    const name = String(b.businessName || '').trim();
    if (name.length < 2) throw new BadRequestException('Merchant name is required');
    if (b.status && !STATUSES.includes(String(b.status))) throw new BadRequestException('Unknown status');
    const row = await this.p.merchantProfile.update({
      where: { id: m.id },
      data: {
        businessName: name,
        entityType: String(b.entityType || '').trim() || null,
        website: String(b.website || '').trim() || null,
        gst: String(b.gst || '').trim() || null,
        ...(b.status ? { status: b.status } : {}),
        sandboxEnabled: !!b.sandboxEnabled,
        productionEnabled: !!b.productionEnabled,
      },
    });
    await this.p.organization.update({ where: { id: m.orgId }, data: { name } });
    return this.viewMerchant(row, await this.walletOf(row.id, Number(row.walletHoldPaise || 0)));
  }

  @Get(':merchantId/wallet')
  @Perm('merchant:read')
  async wallet(@Param('merchantId') merchantId: string) {
    const m = await this.merchant(merchantId);
    return this.walletOf(m.id, Number(m.walletHoldPaise || 0));
  }

  @Post(':merchantId/wallet/hold')
  @Perm('merchant:write')
  async setHold(@Param('merchantId') merchantId: string, @Body() b: any) {
    const m = await this.merchant(merchantId);
    const hold = rupees(b.holdRupees ?? 0) ?? 0n;
    const row = await this.p.merchantProfile.update({ where: { id: m.id }, data: { walletHoldPaise: hold } });
    return this.walletOf(row.id, Number(row.walletHoldPaise || 0));
  }

  @Post(':merchantId/wallet/move')
  @Perm('merchant:write')
  async move(@Param('merchantId') merchantId: string, @Body() b: any) {
    const m = await this.merchant(merchantId);
    const amt = Number(rupees(b.amountRupees));
    if (!Number.isSafeInteger(amt) || amt <= 0) throw new BadRequestException('Enter an amount greater than zero');
    const toPayout = String(b.direction || '') !== 'TO_PAYIN';
    await this.p.$transaction(async tx => {
      if (toPayout) {
        const bal = await this.ledger.balance(tx, m.id, acct(m.id, 'COLLECTIONS'));
        const free = bal - Number(m.walletHoldPaise || 0);
        if (amt > free) throw new BadRequestException(`Only ₹${(Math.max(0, free) / 100).toFixed(2)} can move. ₹${(Number(m.walletHoldPaise || 0) / 100).toFixed(2)} stays on hold in the pay-in wallet.`);
        await this.ledger.post(tx, `desk-to-payout:${m.id}:${Date.now()}`, 'Pay-in wallet → payout wallet', [
          { account: acct(m.id, 'COLLECTIONS'), merchantId: m.id, kind: 'COLLECTIONS', debit: amt, credit: 0 },
          { account: acct(m.id, 'PAYOUT_BALANCE'), merchantId: m.id, kind: 'PAYOUT_BALANCE', debit: 0, credit: amt },
        ]);
      } else {
        const bal = await this.ledger.balance(tx, m.id, acct(m.id, 'PAYOUT_BALANCE'));
        if (amt > bal) throw new BadRequestException(`Payout wallet has only ₹${(bal / 100).toFixed(2)}`);
        await this.ledger.post(tx, `desk-to-payin:${m.id}:${Date.now()}`, 'Payout wallet → pay-in wallet', [
          { account: acct(m.id, 'PAYOUT_BALANCE'), merchantId: m.id, kind: 'PAYOUT_BALANCE', debit: amt, credit: 0 },
          { account: acct(m.id, 'COLLECTIONS'), merchantId: m.id, kind: 'COLLECTIONS', debit: 0, credit: amt },
        ]);
      }
    });
    return this.walletOf(m.id);
  }

  @Get(':merchantId/slabs')
  @Perm('merchant:read')
  async slabs(@Param('merchantId') merchantId: string) {
    await this.merchant(merchantId);
    const rows = await this.p.commissionSlab.findMany({ where: { merchantId }, orderBy: [{ productCode: 'asc' }, { minAmountPaise: 'asc' }] });
    return rows.map(viewSlab);
  }

  @Post(':merchantId/slabs')
  @Perm('pricing:write')
  async addSlab(@Param('merchantId') merchantId: string, @Body() b: any) {
    await this.merchant(merchantId);
    const productCode = String(b.productCode || '').toUpperCase() === 'PAYOUT' ? 'PAYOUT' : 'PAYIN';
    const minP = rupees(b.minRupees ?? 0) ?? 0n;
    const maxP = rupees(b.maxRupees);
    if (maxP != null && minP > maxP) throw new BadRequestException('From amount cannot be greater than To amount');
    const percent = Number(b.feePercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new BadRequestException('Commission percent must be between 0 and 100');
    const flat = rupees(b.feeFlatRupees ?? 0) ?? 0n;
    const row = await this.p.commissionSlab.create({
      data: { merchantId, productCode, minAmountPaise: minP, maxAmountPaise: maxP, feeBps: Math.round(percent * 100), feeFlatPaise: flat, isActive: true },
    });
    return viewSlab(row);
  }

  @Post('slabs/:id')
  @Perm('pricing:write')
  async editSlab(@Param('id') id: string, @Body() b: any) {
    const existing = await this.p.commissionSlab.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Slab not found');
    const productCode = String(b.productCode || existing.productCode).toUpperCase() === 'PAYOUT' ? 'PAYOUT' : 'PAYIN';
    const minP = rupees(b.minRupees ?? Number(existing.minAmountPaise) / 100) ?? 0n;
    const maxP = b.maxRupees === '' || b.maxRupees === null ? null : rupees(b.maxRupees);
    if (maxP != null && minP > maxP) throw new BadRequestException('From amount cannot be greater than To amount');
    const percent = Number(b.feePercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new BadRequestException('Commission percent must be between 0 and 100');
    const row = await this.p.commissionSlab.update({
      where: { id },
      data: { productCode, minAmountPaise: minP, maxAmountPaise: maxP, feeBps: Math.round(percent * 100) },
    });
    return viewSlab(row);
  }

  @Post('slabs/:id/remove')
  @Perm('pricing:write')
  async removeSlab(@Param('id') id: string) {
    const row = await this.p.commissionSlab.findUnique({ where: { id } });
    if (!row) throw new BadRequestException('Slab not found');
    await this.p.commissionSlab.delete({ where: { id } });
    return { removed: true };
  }

  @Get(':merchantId/apis')
  @Perm('merchant:read')
  async apis(@Param('merchantId') merchantId: string) {
    await this.merchant(merchantId);
    const providers = await this.p.provider.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true, isMock: true }, orderBy: { name: 'asc' } });
    const rules = await this.p.routingRule.findMany({ where: { merchantId, productCode: { in: ['PAYIN', 'PAYOUT'] } } });
    return {
      mode: rules.length ? 'merchant' : 'platform',
      providers,
      rules: rules.map(r => ({ id: r.id, productCode: r.productCode, providerId: r.providerId, isActive: r.isActive })),
    };
  }

  @Post(':merchantId/apis')
  @Perm('provider:write')
  async setApi(@Param('merchantId') merchantId: string, @Body() b: any) {
    await this.merchant(merchantId);
    const productCode = String(b.productCode || '').toUpperCase() === 'PAYOUT' ? 'PAYOUT' : 'PAYIN';
    const prov = await this.p.provider.findUnique({ where: { id: b.providerId } });
    if (!prov || !prov.isActive) throw new BadRequestException('Select an active API');
    const active = !!b.active;
    const ex = await this.p.routingRule.findFirst({ where: { merchantId, productCode, providerId: prov.id } });
    const rule = ex
      ? await this.p.routingRule.update({ where: { id: ex.id }, data: { isActive: active } })
      : await this.p.routingRule.create({ data: { merchantId, productCode, providerId: prov.id, isActive: active, priority: 1 } });
    return { id: rule.id, productCode, providerId: prov.id, isActive: rule.isActive };
  }
}
