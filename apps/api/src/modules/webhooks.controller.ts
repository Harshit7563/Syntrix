import { Body, Controller, Param, Post, Req, BadRequestException } from '@nestjs/common'; import { ApiTags } from '@nestjs/swagger'; import { PrismaService } from '../prisma.service'; import { adapterFor } from './providers'; import { nextStatus } from '../common/core';
/** Incoming provider webhooks: persist FIRST, ack only after durable storage. Duplicate (providerEventId) and out-of-order events are safe. */
@ApiTags('provider-webhooks') @Controller('webhooks/provider') export class ProviderWebhookController { constructor(private p:PrismaService){}
 @Post(':code') async handle(@Param('code') code:string,@Body() body:any,@Req() req:any){ const provider=await this.p.provider.findUnique({where:{code}}); if(!provider) throw new BadRequestException('Unknown provider');
  const adapter=adapterFor(provider); const raw=JSON.stringify(body); if(provider.isMock===false && !adapter.verifyWebhook(raw,req.headers)) throw new BadRequestException('Invalid webhook signature'); // replay protection: provider event id uniqueness below
  const n=adapter.normalizeWebhook(body); if(!n.providerEventId) throw new BadRequestException('Webhook must carry a provider event id');
  const txn=await this.p.transaction.findFirst({where:{providerRef:n.providerRef}}); if(!txn) return {received:true,ignored:'transaction not found'}; // still ack after lookup persistence decision
  try{ await this.p.webhookEvent.create({data:{merchantId:txn.merchantId,env:txn.env,type:`provider.${String(n.status).toLowerCase()}`,payload:body,providerEventId:`${code}:${n.providerEventId}`}}); }
  catch(e:any){ if(e.code==='P2002') return {received:true,duplicate:true}; throw e; } // duplicate webhook → safe no-op
  const ns=nextStatus(txn.status as any,n.status); if(ns!==txn.status) await this.p.transaction.update({where:{id:txn.id},data:{status:ns}}); // out-of-order safe via state machine
  return {received:true,status:ns}; } }
