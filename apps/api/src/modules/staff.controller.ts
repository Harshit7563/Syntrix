import { BadRequestException, Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser, StaffGuard } from '../common/guards';

const ASSIGNABLE = ['SUPPORT', 'COMPLIANCE', 'OPERATIONS', 'ACCOUNTS'] as const;

@ApiTags('admin-staff')
@Controller('admin')
@UseGuards(AuthGuard, StaffGuard)
export class StaffAdminController {
  constructor(private p: PrismaService) {}

  @Post('staff')
  async create(@CurrentUser() u: any, @Body() b: any) {
    if (u.role !== 'SUPER_ADMIN') throw new ForbiddenException('Only Super Admin can create staff');
    const role = String(b.role || 'SUPPORT');
    if (!(ASSIGNABLE as readonly string[]).includes(role)) throw new BadRequestException('role must be SUPPORT, COMPLIANCE, OPERATIONS, or ACCOUNTS');
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!email.includes('@') || password.length < 10) throw new BadRequestException('Email and a 10+ character password are required');
    const mine = await this.p.membership.findFirst({ where: { userId: u.id, role: 'SUPER_ADMIN' } });
    if (!mine) throw new ForbiddenException('No platform org');
    if (await this.p.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) throw new BadRequestException('An account with this email already exists');
    const user = await this.p.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } });
    await this.p.membership.create({ data: { userId: user.id, orgId: mine.orgId, role: role as any } });
    await this.p.auditLog.create({ data: { actorId: u.id, action: 'STAFF_CREATE', entity: 'User', entityId: user.id, metadata: { role } } });
    return { id: user.id, email: user.email, role, note: 'New staff must enroll authenticator before other admin APIs' };
  }
}
