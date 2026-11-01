import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { AuthGuard, Perm, StaffGuard } from '../common/guards';

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
  constructor(private p: PrismaService) {}

  private async merchant(id: string) {
    const m = await this.p.merchantProfile.findUnique({ where: { id }, select: { id: true, businessName: true } });
    if (!m) throw new BadRequestException('Merchant not found');
    return m;
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
