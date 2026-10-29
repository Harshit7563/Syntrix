import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'; import { PrismaClient } from '@prisma/client';
@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(){
    if(!process.env.DATABASE_URL) return;
    for(let i=0;i<10;i++){
      try{ await this.$connect(); return; }
      catch(e){ console.warn(`DB connect attempt ${i+1}/10 failed`, (e as Error).message); await new Promise(r=>setTimeout(r,1500)); }
    }
    console.error('DB still unreachable after retries — API will keep trying on requests');
  }
  async onModuleDestroy(){ await this.$disconnect(); }
}
