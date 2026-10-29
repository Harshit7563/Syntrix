import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'; import { ApiTags } from '@nestjs/swagger'; import { PrismaService } from '../prisma.service'; import { AuthGuard, Perm } from '../common/guards'; import { JobsService } from './jobs.service';
@ApiTags('admin-recon') @Controller('admin') @UseGuards(AuthGuard) export class ReconController { constructor(private p:PrismaService, private jobs:JobsService){}
 @Post('reconcile') @Perm('recon:run') async run(@Body() b:any){ return this.jobs.reconcile(b.providerId); }
 @Get('reconciliation') @Perm('recon:run') async runs(){ return this.p.reconciliationRun.findMany({orderBy:{startedAt:'desc'},take:20,include:{items:{take:50}}}).then(rs=>rs.map(r=>({...r,items:r.items.map(i=>({...i,expectedPaise:Number(i.expectedPaise),actualPaise:i.actualPaise?Number(i.actualPaise):null}))}))); }
}
