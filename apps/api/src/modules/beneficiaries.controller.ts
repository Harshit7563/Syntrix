import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard, AuthGuard, CurrentUser, Perm, StaffGuard } from '../common/guards';
import { BeneficiariesService } from './beneficiaries.service';

@ApiTags('Public API (merchant)')
@ApiSecurity('apiKey')
@Controller('v1/beneficiaries')
@UseGuards(ApiKeyGuard)
export class V1BeneficiariesController {
  constructor(private s: BeneficiariesService) {}
  @Get() list(@Req() r: any) { return this.s.list(r.merchant.id); }
  @Post() create(@Req() r: any, @Body() b: any) { return this.s.create(r.merchant.id, b); }
  @Get(':id') one(@Req() r: any, @Param('id') id: string) { return this.s.get(r.merchant.id, id, false); }
  @Post(':id/disable') disable(@Req() r: any, @Param('id') id: string) { return this.s.disable(r.merchant.id, id); }
}

@ApiTags('merchant')
@Controller('merchant/beneficiaries')
@UseGuards(AuthGuard)
export class MerchantBeneficiariesController {
  constructor(private s: BeneficiariesService) {}
  private mid(u: any) {
    if (!u.merchantId) throw new ForbiddenException('This login is not linked to a merchant');
    return u.merchantId;
  }
  @Get() list(@CurrentUser() u: any) { return this.s.list(this.mid(u)); }
  @Post() @Perm('merchant:write') create(@CurrentUser() u: any, @Body() b: any) { return this.s.create(this.mid(u), b); }
  @Get(':id') one(@CurrentUser() u: any, @Param('id') id: string) { return this.s.get(this.mid(u), id, true); }
  @Post(':id/disable') @Perm('merchant:write') disable(@CurrentUser() u: any, @Param('id') id: string) { return this.s.disable(this.mid(u), id); }
}

@ApiTags('admin')
@Controller('admin/beneficiaries')
@UseGuards(AuthGuard, StaffGuard)
export class AdminBeneficiariesController {
  constructor(private s: BeneficiariesService) {}
  @Post(':id/verify')
  @Perm('merchant:review')
  mark(@Param('id') id: string, @Body() b: any) {
    return this.s.markVerified(id, b.verified !== false);
  }
}
