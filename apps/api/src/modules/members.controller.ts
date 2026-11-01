import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { AuthGuard, Perm, StaffGuard } from '../common/guards';

function mobileOf(raw: unknown) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

@ApiTags('members')
@Controller('members')
@UseGuards(AuthGuard, StaffGuard)
export class MembersController {
  constructor(private p: PrismaService) {}

  private async merchantId(explicit?: string) {
    if (explicit) {
      const m = await this.p.merchantProfile.findUnique({ where: { id: explicit }, select: { id: true } });
      if (!m) throw new BadRequestException('Merchant not found');
      return m.id;
    }
    const m = await this.p.merchantProfile.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!m) throw new BadRequestException('No merchant exists yet');
    return m.id;
  }

  @Get()
  @Perm('merchant:read')
  async list() {
    const rows = await this.p.portalMember.findMany({ orderBy: { createdAt: 'desc' }, include: { merchant: { select: { businessName: true } } } });
    return rows.map(r => ({ id: r.id, merchantId: r.merchantId, merchantName: r.merchant.businessName, name: r.name, mobile: r.mobile, email: r.email, status: r.status, createdAt: r.createdAt }));
  }

  @Post()
  @Perm('merchant:write')
  async create(@Body() b: any) {
    const name = String(b.name || '').trim();
    const mobile = mobileOf(b.mobile);
    const email = String(b.email || '').trim();
    if (name.length < 2) throw new BadRequestException('Member name is required');
    if (mobile.length !== 10) throw new BadRequestException('A 10-digit mobile number is required');
    if (email && !email.includes('@')) throw new BadRequestException('Email is not valid');
    const merchantId = await this.merchantId(b.merchantId);
    const existing = await this.p.portalMember.findUnique({ where: { merchantId_mobile: { merchantId, mobile } } });
    if (existing) throw new BadRequestException('A member with this mobile already exists');
    const row = await this.p.portalMember.create({ data: { merchantId, name, mobile, email: email || null, status: 'ACTIVE' } });
    return { id: row.id, merchantId, name: row.name, mobile: row.mobile, email: row.email, status: row.status, createdAt: row.createdAt };
  }

  @Post(':id/status')
  @Perm('merchant:write')
  async status(@Param('id') id: string, @Body() b: any) {
    const status = String(b.status || '').toUpperCase() === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
    const row = await this.p.portalMember.findUnique({ where: { id } });
    if (!row) throw new BadRequestException('Member not found');
    const upd = await this.p.portalMember.update({ where: { id }, data: { status } });
    return { id: upd.id, name: upd.name, mobile: upd.mobile, email: upd.email, status: upd.status };
  }
}
