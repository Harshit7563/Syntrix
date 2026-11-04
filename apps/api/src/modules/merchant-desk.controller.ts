import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuthGuard, Perm, StaffGuard } from '../common/guards';
import { encryptSecret, decryptSecret } from '../common/core';
import { LedgerService, acct } from './ledger.service';

function rupees(v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Amount must be a non-negative number (rupees)');
  return BigInt(Math.round(n * 100));
}

function chargeBps(v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestException('API charge must be between 0 and 100 percent');
  return Math.round(n * 100);
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

  private async chargePercents(m: any) {
    let payin = m.payinChargeBps == null ? null : m.payinChargeBps / 100;
    let payout = m.payoutChargeBps == null ? null : m.payoutChargeBps / 100;
    if (payin == null || payout == null) {
      const plans = await this.p.pricingPlan.findMany({ where: { merchantId: m.id }, include: { product: { select: { code: true } } } });
      for (const plan of plans) {
        if (plan.product.code === 'PAYIN' && payin == null) payin = plan.feeBps / 100;
        if (plan.product.code === 'PAYOUT' && payout == null) payout = plan.feeBps / 100;
      }
    }
    return { payinChargePercent: payin ?? 0, payoutChargePercent: payout ?? 0 };
  }

  private async withOrg(m: any) {
    if (m?.org?.memberships) return m;
    const org = await this.p.organization.findUnique({ where: { id: m.orgId }, include: this.orgLoginInclude() });
    return { ...m, org };
  }

  private async ensureLogin(orgId: string, merchantId: string, b: any, fallbackEmail?: string | null) {
    const email = String(b.email || fallbackEmail || '').trim().toLowerCase();
    const mobile = String(b.mobile || b.phone || '').replace(/\D/g, '').slice(-10);
    const password = String(b.password || '');
    if (!email.includes('@')) throw new BadRequestException('Email is required for member login');
    if (password.length < 8) throw new BadRequestException('Login password must be at least 8 characters');
    const taken = await this.p.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    const membership = await this.p.membership.findFirst({ where: { orgId, role: 'MERCHANT_OWNER' } });
    if (taken && (!membership || taken.id !== membership.userId)) throw new BadRequestException('This email already has a login');
    if (membership) {
      await this.p.user.update({
        where: { id: membership.userId },
        data: { email, ...(mobile.length === 10 ? { phone: mobile } : {}), passwordHash: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 }, isActive: true },
      });
      await this.p.session.updateMany({ where: { userId: membership.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    } else {
      const u = await this.p.user.create({ data: { email, phone: mobile.length === 10 ? mobile : null, passwordHash: await bcrypt.hash(password, 12), isActive: true } });
      await this.p.membership.create({ data: { userId: u.id, orgId, role: 'MERCHANT_OWNER' } });
    }
    await this.p.merchantProfile.update({ where: { id: merchantId }, data: { loginPasswordEnc: encryptSecret(password) } });
  }

  private async viewMerchant(m: any, wallet: { payinPaise: number; payoutPaise: number; holdPaise: number; freePayinPaise: number }) {
    m = await this.withOrg(m);
    const owner = (m.org?.memberships || []).find((x: any) => x.role === 'MERCHANT_OWNER') || (m.org?.memberships || [])[0];
    const login = owner?.user;
    let loginPassword = '';
    if (m.loginPasswordEnc) { try { loginPassword = decryptSecret(m.loginPasswordEnc); } catch { loginPassword = ''; } }
    return {
      id: m.id,
      businessName: m.businessName || '',
      email: m.email || '',
      entityType: m.entityType || '',
      website: m.website || '',
      gst: m.gst || '',
      status: m.status,
      active: m.status === 'APPROVED',
      sandboxEnabled: m.sandboxEnabled,
      productionEnabled: m.productionEnabled,
      memberCount: m._count?.members ?? 0,
      hasLogin: !!login,
      loginEmail: login?.email || '',
      loginPhone: login?.phone || '',
      loginActive: login ? !!login.isActive : false,
      loginPassword,
      ...(await this.chargePercents(m)),
      ...wallet,
    };
  }

  private orgLoginInclude() {
    return { memberships: { include: { user: { select: { id: true, email: true, phone: true, isActive: true } } } } };
  }

  @Get()
  @Perm('merchant:read')
  async list() {
    const rows = await this.p.merchantProfile.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { members: true } }, org: { include: this.orgLoginInclude() } } });
    const out = [];
    for (const m of rows) out.push(await this.viewMerchant(m, await this.walletOf(m.id, Number(m.walletHoldPaise || 0))));
    return out;
  }

  @Post()
  @Perm('merchant:write')
  async create(@Body() b: any) {
    const name = String(b.businessName || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    if (name.length < 2) throw new BadRequestException('Merchant name is required');
    if (!email.includes('@')) throw new BadRequestException('Email is required for member login');
    if (String(b.password || '').length < 8) throw new BadRequestException('Login password must be at least 8 characters');
    if (await this.p.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) throw new BadRequestException('This email already has a login');
    const active = b.active !== false;
    const org = await this.p.organization.create({ data: { name, type: 'MERCHANT' } });
    const row = await this.p.merchantProfile.create({
      data: {
        orgId: org.id,
        businessName: name,
        email: email || null,
        payinChargeBps: chargeBps(b.payinChargePercent ?? 0),
        payoutChargeBps: chargeBps(b.payoutChargePercent ?? 0),
        walletHoldPaise: rupees(b.holdRupees ?? 0) ?? 0n,
        status: (active ? 'APPROVED' : 'SUSPENDED') as any,
        sandboxEnabled: true,
        productionEnabled: true,
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
    const mobile = String(b.mobile || '').replace(/\D/g, '').slice(-10);
    if (mobile.length !== 10) throw new BadRequestException('A 10-digit mobile is required so this member can transact');
    await this.p.portalMember.create({
      data: { merchantId: row.id, name, mobile, email: email || null, status: 'ACTIVE' },
    });
    await this.ensureLogin(org.id, row.id, { ...b, email, mobile }, email);
    const memberCount = 1;
    return await this.viewMerchant({ ...row, _count: { members: memberCount } }, await this.walletOf(row.id, Number(row.walletHoldPaise || 0)));
  }

  @Post(':merchantId/profile')
  @Perm('merchant:write')
  async saveProfile(@Param('merchantId') merchantId: string, @Body() b: any) {
    const m = await this.merchant(merchantId);
    const name = String(b.businessName || '').trim();
    const email = String(b.email || '').trim();
    if (name.length < 2) throw new BadRequestException('Merchant name is required');
    if (email && !email.includes('@')) throw new BadRequestException('Email is not valid');
    const row = await this.p.merchantProfile.update({
      where: { id: m.id },
      data: {
        businessName: name,
        email: email || null,
        payinChargeBps: chargeBps(b.payinChargePercent ?? 0),
        payoutChargeBps: chargeBps(b.payoutChargePercent ?? 0),
        walletHoldPaise: rupees(b.holdRupees ?? 0) ?? 0n,
        status: (b.active === false ? 'SUSPENDED' : 'APPROVED') as any,
      },
    });
    await this.p.organization.update({ where: { id: m.orgId }, data: { name } });
    return await this.viewMerchant(row, await this.walletOf(row.id, Number(row.walletHoldPaise || 0)));
  }

  @Post(':merchantId/login')
  @Perm('merchant:write')
  async setLogin(@Param('merchantId') merchantId: string, @Body() b: any) {
    const m = await this.merchant(merchantId);
    await this.ensureLogin(m.orgId, m.id, b, m.email);
    if (String(b.email || '').includes('@')) {
      await this.p.merchantProfile.update({ where: { id: m.id }, data: { email: String(b.email).trim().toLowerCase() } });
    }
    const fresh = await this.p.merchantProfile.findUniqueOrThrow({ where: { id: m.id }, include: { _count: { select: { members: true } }, org: { include: this.orgLoginInclude() } } });
    return this.viewMerchant(fresh, await this.walletOf(fresh.id, Number(fresh.walletHoldPaise || 0)));
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
    const platform = await this.p.routingRule.findMany({ where: { merchantId: null, isActive: true, productCode: { in: ['PAYIN', 'PAYOUT'] } } });
    const nameOf = (id?: string | null) => {
      const p = providers.find(x => x.id === id);
      return p ? String(p.name || '').split(' (')[0] : '';
    };
    const using = (pc: 'PAYIN' | 'PAYOUT') => {
      const own = rules.find(r => r.productCode === pc && r.isActive);
      if (own) return { productCode: pc, providerId: own.providerId, name: nameOf(own.providerId), source: 'member' as const };
      const plat = platform.find(r => r.productCode === pc);
      if (plat) return { productCode: pc, providerId: plat.providerId, name: nameOf(plat.providerId), source: 'platform' as const };
      return { productCode: pc, providerId: null, name: '', source: 'none' as const };
    };
    return {
      mode: rules.some(r => r.isActive) ? 'merchant' : 'platform',
      using: { PAYIN: using('PAYIN'), PAYOUT: using('PAYOUT') },
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
    if (!active) {
      if (ex) await this.p.routingRule.delete({ where: { id: ex.id } });
      const leftover = await this.p.routingRule.count({ where: { merchantId, productCode, isActive: true } });
      if (!leftover) await this.p.routingRule.deleteMany({ where: { merchantId, productCode } });
      return { productCode, providerId: prov.id, isActive: false };
    }
    const rule = ex
      ? await this.p.routingRule.update({ where: { id: ex.id }, data: { isActive: true, priority: 1 } })
      : await this.p.routingRule.create({ data: { merchantId, productCode, providerId: prov.id, isActive: true, priority: 1 } });
    await this.p.routingRule.updateMany({ where: { merchantId, productCode, id: { not: rule.id } }, data: { isActive: false } });
    return { id: rule.id, productCode, providerId: prov.id, isActive: true };
  }
}
