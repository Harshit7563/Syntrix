import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'; import { PrismaClient } from '@prisma/client'; import * as bcrypt from 'bcryptjs'; import * as crypto from 'crypto';
@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(){
    if(!process.env.DATABASE_URL) return;
    for(let i=0;i<10;i++){
      try{ await this.$connect(); await this.retireSeededDemoPasswords(); await this.ensureOrvian(); return; }
      catch(e){ console.warn(`DB connect attempt ${i+1}/10 failed`, (e as Error).message); await new Promise(r=>setTimeout(r,1500)); }
    }
    console.error('DB still unreachable after retries — API will keep trying on requests');
  }
  /** Production only: a published seed password must not keep matching. The replacement is random and is not logged. */
  private async retireSeededDemoPasswords(){
    if(process.env.NODE_ENV!=='production') return;
    const users=await this.user.findMany({select:{id:true,passwordHash:true}});
    let n=0;
    for(const u of users){ if(!(await bcrypt.compare('Demo@12345',u.passwordHash))) continue; const next=crypto.randomBytes(32).toString('hex'); await this.user.update({where:{id:u.id},data:{passwordHash:await bcrypt.hash(next,12),tokenVersion:{increment:1}}}); await this.session.updateMany({where:{userId:u.id,revokedAt:null},data:{revokedAt:new Date()}}); n++; }
    if(n) console.warn(`Retired the seeded demo password on ${n} account(s). Those accounts need a new password before they can sign in.`);
  }
  /** When ORVIAN keys are in the environment, route pay-in and payout there and turn MockPay off. */
  private async ensureOrvian(){
    const authKey=process.env.ORVIAN_AUTH_KEY||''; const authSecret=process.env.ORVIAN_AUTH_SECRET||'';
    if(!authKey||!authSecret) return;
    const {encryptSecret}=require('./common/core');
    const baseUrl=(process.env.ORVIAN_BASE_URL||'https://orviansystem.com').replace(/\/$/,'');
    const prov=await this.provider.upsert({where:{code:'ORVIAN'},create:{code:'ORVIAN',name:'ORVIAN',baseUrl,kind:'PG',isMock:false,isActive:true,timeoutMs:20000},update:{name:'ORVIAN',baseUrl,isMock:false,isActive:true}});
    for(const cap of [{operation:'createPayin',productCode:'PAYIN'},{operation:'createPayout',productCode:'PAYOUT'}]){
      await this.providerCapability.upsert({where:{providerId_operation_productCode:{providerId:prov.id,operation:cap.operation,productCode:cap.productCode}},create:{providerId:prov.id,...cap},update:{}});
    }
    const key=await this.providerCredential.findFirst({where:{providerId:prov.id,revokedAt:null}});
    const data={apiKeyEnc:encryptSecret(authKey),secretEnc:encryptSecret(authSecret),keyLast4:authKey.slice(-4),isActive:true,label:'ORVIAN'};
    if(key) await this.providerCredential.update({where:{id:key.id},data}); else await this.providerCredential.create({data:{providerId:prov.id,priority:1,...data}});
    const mock=await this.provider.findUnique({where:{code:'MOCKPAY'}});
    if(mock){ await this.provider.update({where:{id:mock.id},data:{isActive:false}}); await this.routingRule.updateMany({where:{providerId:mock.id},data:{isActive:false}}); }
    for(const productCode of ['PAYIN','PAYOUT']){
      const rule=await this.routingRule.findFirst({where:{providerId:prov.id,productCode,merchantId:null}});
      if(rule) await this.routingRule.update({where:{id:rule.id},data:{isActive:true,priority:1}});
      else await this.routingRule.create({data:{productCode,providerId:prov.id,priority:1,isActive:true}});
    }
    console.log('ORVIAN is the pay-in and payout provider. MockPay is off.');
  }
  async onModuleDestroy(){ await this.$disconnect(); }
}
