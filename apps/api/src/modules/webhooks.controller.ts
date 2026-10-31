import { Body, Controller, Get, Param, Post, Req, BadRequestException } from '@nestjs/common'; import { ApiTags } from '@nestjs/swagger'; import { PrismaService } from '../prisma.service'; import { adapterFor } from './providers'; import { nextStatus } from '../common/core'; import { PaymentsService } from './payments.service';
/** Incoming provider webhooks. ORVIAN pay-in is POST JSON. ORVIAN payout is GET query params. Money status is confirmed with ORVIAN's status API, not the callback body alone. */
@ApiTags('provider-webhooks') @Controller('webhooks/provider') export class ProviderWebhookController { constructor(private p:PrismaService, private payments:PaymentsService){}
 @Post(':code') post(@Param('code') code:string,@Body() body:any,@Req() req:any){ return this.handle(code, body, req); }
 @Get(':code') get(@Param('code') code:string,@Req() req:any){ return this.handle(code, req.query||{}, req); }
 private async handle(code:string, body:any, req:any){ const provider=await this.p.provider.findUnique({where:{code}})||await this.p.provider.findUnique({where:{code:code.toUpperCase()}}); if(!provider) throw new BadRequestException('Unknown provider');
  if(provider.code==='ORVIAN'){
    const ref=String(body?.transaction_id||body?.reference||body?.txn_id||body?.order_id||'').trim();
    if(!ref) return {received:true,ignored:'missing reference'};
    const txn=await this.p.transaction.findFirst({where:{OR:[{merchantRef:ref},{providerRef:ref}]}});
    if(!txn) return {received:true,ignored:'transaction not found'};
    await this.payments.reconcileTxn(txn);
    return {received:true};
  }
  const adapter=adapterFor(provider); const raw=JSON.stringify(body); if(!adapter.verifyWebhook(raw,req.headers||{})) throw new BadRequestException('Invalid webhook signature');
  const n=adapter.normalizeWebhook(body); if(!n.providerEventId) throw new BadRequestException('Webhook must carry a provider event id');
  const txn=await this.p.transaction.findFirst({where:{providerRef:n.providerRef}}); if(!txn) return {received:true,ignored:'transaction not found'};
  try{ await this.p.webhookEvent.create({data:{merchantId:txn.merchantId,env:txn.env,type:`provider.${String(n.status).toLowerCase()}`,payload:body,providerEventId:`${code}:${n.providerEventId}`}}); }
  catch(e:any){ if(e.code==='P2002') return {received:true,duplicate:true}; throw e; }
  const ns=nextStatus(txn.status as any,n.status); if(ns!==txn.status) await this.p.transaction.update({where:{id:txn.id},data:{status:ns}});
  return {received:true,status:ns}; }
}
