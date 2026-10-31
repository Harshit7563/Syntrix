import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

/** Public test checkout. Only Bawji Raj transactions can be opened or marked paid here. */
@ApiTags('bawji')
@Controller('pay/bawji')
export class BawjiPayController {
  constructor(private payments: PaymentsService) {}
  @Get(':ref') view(@Param('ref') ref: string) { return this.payments.bawjiPayView(decodeURIComponent(ref)); }
  @Post(':ref/confirm') confirm(@Param('ref') ref: string) { return this.payments.confirmBawjiPay(decodeURIComponent(ref)); }
}
