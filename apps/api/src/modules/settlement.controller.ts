import { Body, Controller, Get, Param, Post, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard, CurrentUser, Perm, StaffGuard } from '../common/guards';
import { PrismaService } from '../prisma.service';
import { SettlementService } from './settlement.service';

@ApiTags('admin')
@Controller('admin/settlements')
@UseGuards(AuthGuard, StaffGuard)
export class AdminSettlementsController {
  constructor(private s: SettlementService, private p: PrismaService) {}

  @Get()
  @Perm('txn:read')
  list(@Query('merchantId') merchantId?: string) {
    return this.s.list(merchantId || undefined);
  }

  @Get('preview')
  @Perm('txn:read')
  preview(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw new BadRequestException('merchantId is required');
    return this.s.preview(merchantId);
  }

  @Post()
  @Perm('payout:approve')
  create(@CurrentUser() u: any, @Body() b: any) {
    if (!b.merchantId) throw new BadRequestException('merchantId is required');
    return this.s.create(String(b.merchantId), u.id);
  }

  @Post(':id/post')
  @Perm('payout:approve')
  post(@CurrentUser() u: any, @Param('id') id: string) {
    return this.s.post(id, u.id, u.role);
  }

  @Post(':id/reject')
  @Perm('payout:approve')
  reject(@CurrentUser() u: any, @Param('id') id: string, @Body() b: any) {
    return this.s.reject(id, u.id, b?.reason);
  }

  @Post('merchants/:id/days')
  @Perm('pricing:write')
  async days(@Param('id') id: string, @Body() b: any) {
    const d = Number(b.settlementDays);
    if (![0, 1, 2, 3].includes(d)) throw new BadRequestException('settlementDays must be 0, 1, 2 or 3');
    await this.p.merchantProfile.update({ where: { id }, data: { settlementDays: d } });
    return { merchantId: id, settlementDays: d };
  }
}

@ApiTags('merchant')
@Controller('merchant/settlements')
@UseGuards(AuthGuard)
export class MerchantSettlementsController {
  constructor(private s: SettlementService) {}
  @Get()
  list(@CurrentUser() u: any) {
    if (!u.merchantId) throw new ForbiddenException('This login is not linked to a merchant');
    return this.s.list(u.merchantId);
  }
}
