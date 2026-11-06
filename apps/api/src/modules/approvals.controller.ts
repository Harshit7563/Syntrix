import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard, CurrentUser, Perm, StaffGuard } from '../common/guards';
import { PrismaService } from '../prisma.service';
import { PaymentsService } from './payments.service';
import { SettlementService } from './settlement.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard, StaffGuard)
export class ApprovalsExecController {
  constructor(private p: PrismaService, private payments: PaymentsService, private settlements: SettlementService) {}

  @Get('approvals')
  @Perm('merchant:read')
  async list() {
    const rows = await this.p.pendingApproval.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    return rows.map((a) => ({ ...a, payload: a.payload }));
  }

  @Post('approvals/:id/decide')
  @Perm('payout:approve')
  async decide(@CurrentUser() u: any, @Param('id') id: string, @Body() b: any) {
    const a = await this.p.pendingApproval.findUnique({ where: { id } });
    if (!a) throw new BadRequestException('Approval not found');
    if (a.requestedBy === u.id && !(u.role === 'SUPER_ADMIN' && a.kind === 'SETTLEMENT')) {
      throw new ForbiddenException('Maker-checker: the requester cannot approve their own change');
    }
    if (a.status !== 'PENDING') throw new BadRequestException('This approval was already decided');
    const approve = !!b.approve;
    if (!approve) {
      return this.p.pendingApproval.update({
        where: { id },
        data: { status: 'REJECTED', approvedBy: u.id, decidedAt: new Date(), reason: b.reason || 'Rejected' },
      });
    }
    const payload: any = a.payload || {};
    if (a.kind === 'REFUND') {
      const result = await this.payments.executeApprovedRefund(payload);
      const upd = await this.p.pendingApproval.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: u.id, decidedAt: new Date(), reason: b.reason || null },
      });
      await this.p.auditLog.create({ data: { actorId: u.id, action: 'MAKER_CHECKER_APPROVED', entity: 'PendingApproval', entityId: id } });
      return { ...upd, result };
    }
    if (a.kind === 'SETTLEMENT' && payload.batchId) {
      const result = await this.settlements.post(payload.batchId, u.id, u.role);
      const upd = await this.p.pendingApproval.findUnique({ where: { id } });
      return { ...upd, result };
    }
    return this.p.pendingApproval.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: u.id, decidedAt: new Date(), reason: b.reason || null },
    });
  }
}
