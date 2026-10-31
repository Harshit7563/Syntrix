import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'; import { PrismaClient } from '@prisma/client'; import * as bcrypt from 'bcryptjs'; import * as crypto from 'crypto';
@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(){
    if(!process.env.DATABASE_URL) return;
    for(let i=0;i<10;i++){
      try{ await this.$connect(); await this.retireSeededDemoPasswords(); return; }
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
  async onModuleDestroy(){ await this.$disconnect(); }
}
