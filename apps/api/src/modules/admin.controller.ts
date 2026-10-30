import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common'; import { ApiTags } from '@nestjs/swagger'; import { PrismaService } from '../prisma.service'; import { AuthGuard, CurrentUser, Perm, StaffGuard } from '../common/guards'; import { assertProviderUrl, encryptSecret } from '../common/core'; import { PaymentsService } from './payments.service';
@ApiTags('admin') @Controller('admin') @UseGuards(AuthGuard, StaffGuard) export class AdminController { constructor(private p:PrismaService, private payments:PaymentsService){}
 private async audit(u:any,action:string,entity:string,entityId:string,metadata?:any){ await this.p.auditLog.create({data:{actorId:u.id,action,entity,entityId,metadata}}); }
 @Get('dashboard') @Perm('merchant:read') async dash(){ const [byStatus,txns,success,pendingWebhooks,dead]=await Promise.all([this.p.merchantProfile.groupBy({by:['status'],_count:true}),this.p.transaction.count(),this.p.transaction.count({where:{status:'SUCCESS'}}),this.p.webhookDelivery.count({where:{status:'PENDING'}}),this.p.webhookDelivery.count({where:{status:'DEAD_LETTER'}})]); const attempts=await this.p.transactionAttempt.findMany({orderBy:{createdAt:'desc'},take:200}); const lat=attempts.filter(a=>a.latencyMs).reduce((a,x)=>a+(x.latencyMs||0),0)/Math.max(1,attempts.filter(a=>a.latencyMs).length); return {onboarding:byStatus.map(s=>({status:s.status,count:s._count})),transactions:txns,successRate:txns?Math.round(success/txns*100):null,avgProviderLatencyMs:Math.round(lat),alerts:[...(dead?[{level:'critical',message:`${dead} webhook deliveries in dead-letter — replay or fix endpoints`}]:[]),...(pendingWebhooks>50?[{level:'warning',message:`${pendingWebhooks} webhook deliveries pending`}]:[])]}; }
 @Get('merchants') @Perm('merchant:read') async merchants(@Query('status') s?:string){ return this.p.merchantProfile.findMany({where:s?{status:s as any}:{},include:{org:{include:{memberships:{include:{user:{select:{email:true}}}}}}},orderBy:{updatedAt:'desc'}}).then(r=>r.map(m=>({...m,panEnc:undefined}))); }
 @Get('merchants/:id') @Perm('merchant:read') async one(@Param('id') id:string){ const m=await this.p.merchantProfile.findUniqueOrThrow({where:{id},include:{directors:true,owners:true,bankAccounts:true,documents:{include:{reviews:true}},application:{include:{reviewRequests:true,approvalHistory:{orderBy:{createdAt:'desc'}}}},productAccess:{include:{product:true}},pricing:true}}); return {...m,panEnc:undefined,bankAccounts:m.bankAccounts.map(b=>({...b,accountNoEnc:undefined}))}; }
 @Post('merchants/:id/review') @Perm('merchant:review') async review(@CurrentUser() u:any,@Param('id') id:string,@Body() b:any){ const m=await this.p.merchantProfile.findUniqueOrThrow({where:{id},include:{application:true}}); const map:any={APPROVE:'APPROVED',REJECT:'REJECTED',CLARIFY:'CLARIFICATION_REQUIRED',SUSPEND:'SUSPENDED',UNDER_REVIEW:'UNDER_REVIEW'}; const to=map[b.action]; if(!to) throw new BadRequestException('action must be APPROVE|REJECT|CLARIFY|UNDER_REVIEW|SUSPEND');
  if(b.action==='APPROVE'){ const unverified=await this.p.document.count({where:{merchantId:id,status:{not:'VERIFIED'}}}); /* approval allowed but docs stay unverified unless reviewed — surfaced in UI */ }
  const data:any={status:to}; if(b.action==='APPROVE'&&b.activateProduction) data.productionEnabled=true; if(b.action==='SUSPEND') data.productionEnabled=false; await this.p.merchantProfile.update({where:{id},data});
  if(b.action==='CLARIFY'){ if(!m.application) throw new BadRequestException('Merchant has not submitted an application'); await this.p.reviewRequest.create({data:{applicationId:m.application.id,field:b.field||'general',message:b.message||'Please clarify',createdBy:u.id}}); }
  await this.p.approvalHistory.create({data:{applicationId:m.application?.id,entity:'Merchant',entityId:id,action:b.action,fromStatus:m.status,toStatus:to,actorId:u.id,note:b.note}}); await this.audit(u,`MERCHANT_${b.action}`,'Merchant',id,{note:b.note,activateProduction:!!b.activateProduction}); return {status:to,productionEnabled:data.productionEnabled??m.productionEnabled}; }
 @Post('documents/:id/review') @Perm('document:review') async docReview(@CurrentUser() u:any,@Param('id') id:string,@Body() b:any){ if(!['VERIFIED','REJECTED'].includes(b.decision)) throw new BadRequestException('decision must be VERIFIED or REJECTED — only a reviewer can verify a document'); const d=await this.p.document.update({where:{id},data:{status:b.decision}}); await this.p.documentReview.create({data:{documentId:id,reviewerId:u.id,decision:b.decision,note:b.note}}); await this.audit(u,'DOCUMENT_'+b.decision,'Document',id); return d; }
 /** Platform-wide per-API throughput: total Pay-in / Payout through each integrated provider. */
 @Get('daily-trend') @Perm('txn:read') async dailyTrend(@Query('days') daysQ?:string){
  const days=Math.min(60,Math.max(7,Number(daysQ||14))); const start=new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-(days-1));
  const txns=await this.p.transaction.findMany({where:{createdAt:{gte:start}},select:{kind:true,status:true,amountPaise:true,createdAt:true,providerId:true}});
  const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const out:any[]=[]; for(let i=0;i<days;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const key=fmt(d); const dayTx=txns.filter(t=>fmt(new Date(t.createdAt))===key); const sum=(kind:string)=>dayTx.filter(t=>t.kind===kind&&t.status==='SUCCESS').reduce((a,t)=>a+Number(t.amountPaise),0);
   out.push({date:key,label:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),payinPaise:sum('PAYIN'),payoutPaise:sum('PAYOUT'),count:dayTx.length,success:dayTx.filter(t=>t.status==='SUCCESS').length,failed:dayTx.filter(t=>t.status==='FAILED').length}); }
  return {days,points:out,totalPayinPaise:out.reduce((a,p)=>a+p.payinPaise,0),totalPayoutPaise:out.reduce((a,p)=>a+p.payoutPaise,0)};
 }
 @Get('provider-stats') @Perm('txn:read') async providerStats(@Query('kind') kindQ?:string){ const kind=kindQ==='PAYOUT'?'PAYOUT':'PAYIN'; const dayStart=new Date(); dayStart.setHours(0,0,0,0);
  const rows=await this.p.transaction.groupBy({by:['providerId','status'],where:{kind:kind as any},_count:{_all:true},_sum:{amountPaise:true}});
  const todayRows=await this.p.transaction.groupBy({by:['providerId'],where:{kind:kind as any,status:'SUCCESS',createdAt:{gte:dayStart}},_sum:{amountPaise:true},_count:{_all:true}});
  const providerIds=[...new Set(rows.map(r=>r.providerId).filter(Boolean))] as string[]; const providers=await this.p.provider.findMany({where:{id:{in:providerIds}}}); const pmap=new Map(providers.map(p=>[p.id,p])); const tmap=new Map(todayRows.map(r=>[r.providerId,r]));
  const perProvider=providerIds.map(pid=>{ const rs=rows.filter(r=>r.providerId===pid); const sum=(st:string)=>rs.filter(r=>r.status===st).reduce((a,r)=>a+Number(r._sum.amountPaise||0),0); const cnt=(st:string)=>rs.filter(r=>r.status===st).reduce((a,r)=>a+r._count._all,0); const success=cnt('SUCCESS'),failed=cnt('FAILED'),pending=cnt('PENDING')+cnt('PROCESSING')+cnt('UNKNOWN'); const p:any=pmap.get(pid); const today:any=tmap.get(pid); return {providerId:pid,providerName:p?.name||'Unknown API',providerCode:p?.code||'—',isMock:!!p?.isMock,merchantCount:0,totalAmountPaise:sum('SUCCESS'),totalCount:success+failed+pending,successCount:success,failedCount:failed,pendingCount:pending,successRate:(success+failed)?Math.round(success/(success+failed)*100):null,todayAmountPaise:Number(today?._sum?.amountPaise||0),todayCount:(today?today._count._all:0)}; }).sort((a,b)=>b.totalAmountPaise-a.totalAmountPaise);
  const sumAll=(k:string)=>perProvider.reduce((a,r:any)=>a+r[k],0); return {kind,totalAmountPaise:sumAll('totalAmountPaise'),totalCount:sumAll('totalCount'),successCount:sumAll('successCount'),failedCount:sumAll('failedCount'),pendingCount:sumAll('pendingCount'),todayAmountPaise:sumAll('todayAmountPaise'),todayCount:sumAll('todayCount'),perProvider}; }
 @Get('transactions') @Perm('txn:read') async txns(@Query() q:any){
  const r=await this.p.transaction.findMany({where:{...(q.merchantId?{merchantId:q.merchantId}:{}),...(q.kind?{kind:q.kind}:{}),...(q.status?{status:q.status}:{}),...(q.providerId?{providerId:q.providerId}:{}),...(q.q?{merchantRef:{contains:q.q}}:{})},orderBy:{createdAt:'desc'},take:500});
  const pids=[...new Set(r.map(t=>t.providerId).filter(Boolean))] as string[];
  const mids=[...new Set(r.map(t=>t.merchantId).filter(Boolean))] as string[];
  const provs=pids.length?await this.p.provider.findMany({where:{id:{in:pids}},select:{id:true,name:true,code:true,isMock:true}}):[];
  const merchs=mids.length?await this.p.merchantProfile.findMany({where:{id:{in:mids}},select:{id:true,businessName:true}}):[];
  const pmap=new Map(provs.map(p=>[p.id,p])); const mmap=new Map(merchs.map(m=>[m.id,m]));
  return r.map(t=>{ const pv:any=t.providerId?pmap.get(t.providerId):null; const m:any=mmap.get(t.merchantId); return {...t,amountPaise:Number(t.amountPaise),feePaise:Number(t.feePaise),apiName:pv?.name||'Unknown API',apiCode:pv?.code||'—',apiIsMock:!!pv?.isMock,memberName:m?.businessName||'—'}; });
 }
 @Get('audit') @Perm('audit:read') async auditLogs(){ return this.p.auditLog.findMany({orderBy:{createdAt:'desc'},take:200}); }
 /** API-wise request / response logs (provider attempts + txn payload). */
 @Get('api-logs') @Perm('txn:read') async apiLogs(@Query() q:any){
  const where:any={};
  if(q.providerId) where.providerId=q.providerId;
  if(q.kind==='PAYIN'||q.kind==='PAYOUT') where.kind=q.kind;
  if(q.status) where.status=q.status;
  const txns=await this.p.transaction.findMany({where,orderBy:{createdAt:'desc'},take:Math.min(300,Math.max(20,Number(q.limit)||150)),include:{attempts:{orderBy:{createdAt:'desc'},take:1}}});
  const pids=[...new Set(txns.map(t=>t.providerId).filter(Boolean))] as string[];
  const provs=pids.length?await this.p.provider.findMany({where:{id:{in:pids}},select:{id:true,name:true,code:true,isMock:true,baseUrl:true}}):[];
  const pmap=new Map(provs.map(p=>[p.id,p]));
  const items=txns.map(t=>{
    const pv:any=t.providerId?pmap.get(t.providerId):null;
    const a:any=t.attempts?.[0];
    const cust:any=t.customer||{};
    const request=t.kind==='PAYOUT'
      ?{merchantRef:t.merchantRef,amountPaise:Number(t.amountPaise),beneficiary:{name:cust.name||cust.holderName,account:cust.account,ifsc:cust.ifsc},method:(t.metadata as any)?.method||'Bank Transfer'}
      :{merchantRef:t.merchantRef,amountPaise:Number(t.amountPaise),customer:{name:cust.name||cust.holderName,email:cust.email,phone:cust.phone},method:(t.metadata as any)?.method||'API'};
    const response=a?.rawResponse||{status:t.status,providerRef:t.providerRef||a?.providerRef||null,utr:t.utr||null,message:t.failureReason||null};
    return {
      id:a?.id||t.id, transactionId:t.id, kind:t.kind, status:t.status, env:t.env,
      merchantRef:t.merchantRef, amountPaise:Number(t.amountPaise), feePaise:Number(t.feePaise),
      providerId:t.providerId, apiName:pv?.name||'Unknown API', apiCode:pv?.code||'—', apiIsMock:!!pv?.isMock,
      providerRef:t.providerRef||a?.providerRef||null, utr:t.utr||null, latencyMs:a?.latencyMs??null,
      endpoint:t.kind==='PAYOUT'?'POST /payouts':'POST /payins',
      baseUrl:pv?.baseUrl||null,
      request, response,
      createdAt:a?.createdAt||t.createdAt, txnCreatedAt:t.createdAt,
    };
  });
  const apis=provs.map(p=>({id:p.id,name:p.name,code:p.code,isMock:p.isMock}));
  const counts={ALL:items.length,SUCCESS:items.filter(i=>i.status==='SUCCESS').length,PENDING:items.filter(i=>['PENDING','PROCESSING','UNKNOWN'].includes(i.status)).length,FAILED:items.filter(i=>i.status==='FAILED').length};
  return {items,apis,counts};
 }
 // providers / products / pricing
 @Get('providers') @Perm('merchant:read') async providers(){ return (await this.p.provider.findMany({include:{capabilities:true,keys:{where:{revokedAt:null},orderBy:{priority:'asc'}}}})).map((p:any)=>({...p,credentialsEnc:undefined,hasCredentials:!!p.credentialsEnc||p.keys.length>0,keys:p.keys.map((k:any)=>({...k,apiKeyEnc:undefined,secretEnc:undefined,masked:`••••••••${k.keyLast4}`}))})); }
 // ---- Multiple API keys per provider ----
 @Post('providers/:id/keys') @Perm('provider:write') async addKey(@CurrentUser() u:any,@Param('id') id:string,@Body() b:any){ if(!b.apiKey) throw new BadRequestException('API key is required'); const count=await this.p.providerCredential.count({where:{providerId:id}}); const k=await this.p.providerCredential.create({data:{providerId:id,label:b.label||`Key ${count+1}`,apiKeyEnc:encryptSecret(String(b.apiKey)),secretEnc:b.apiSecret?encryptSecret(String(b.apiSecret)):null,keyLast4:String(b.apiKey).slice(-4),priority:b.priority||count+1}}); await this.audit(u,'PROVIDER_KEY_ADD','Provider',id); return {...k,apiKeyEnc:undefined,secretEnc:undefined,masked:`••••••••${k.keyLast4}`}; }
 @Post('providers/:id/keys/:keyId/toggle') @Perm('provider:write') async toggleKey(@Param('id') id:string,@Param('keyId') keyId:string){ const k=await this.p.providerCredential.findFirstOrThrow({where:{id:keyId,providerId:id}}); return this.p.providerCredential.update({where:{id:keyId},data:{isActive:!k.isActive}}).then((r:any)=>({...r,apiKeyEnc:undefined,secretEnc:undefined,masked:`••••••••${r.keyLast4}`})); }
 @Post('providers/:id/keys/:keyId/revoke') @Perm('provider:write') async revokeKey(@Param('id') id:string,@Param('keyId') keyId:string){ await this.p.providerCredential.updateMany({where:{id:keyId,providerId:id},data:{revokedAt:new Date(),isActive:false}}); return {revoked:true}; }
 // ---- Amount-band routing: multiple active APIs, each with Min–Max (₹), change anytime ----
 private rupeeToPaise(v:any){ if(v===null||v===undefined||v==='') return null; const n=Number(v); if(!Number.isFinite(n)||n<0) throw new BadRequestException('Amount must be a non-negative number (rupees)'); return BigInt(Math.round(n*100)); }
 private viewRule(r:any){ return {...r, minAmountPaise:r.minAmountPaise==null?null:Number(r.minAmountPaise), maxAmountPaise:r.maxAmountPaise==null?null:Number(r.maxAmountPaise), minRupees:r.minAmountPaise==null?null:Number(r.minAmountPaise)/100, maxRupees:r.maxAmountPaise==null?null:Number(r.maxAmountPaise)/100}; }
 private circuitView(p:any){ const open=p.circuitOpenUntil&&new Date(p.circuitOpenUntil)>new Date(); const secs=open?Math.max(0,Math.ceil((new Date(p.circuitOpenUntil).getTime()-Date.now())/1000)):0; return {healthFailures:p.healthFailures||0,circuitOpenUntil:p.circuitOpenUntil||null,circuitOpen:!!open,circuitCooldownSec:secs}; }
 @Get('api-switch') async apiSwitch(){
  const rules=await this.p.routingRule.findMany({where:{merchantId:null},orderBy:[{productCode:'asc'},{priority:'asc'}],include:{provider:{select:{id:true,name:true,code:true,isMock:true,kind:true,healthFailures:true,circuitOpenUntil:true}}}});
  const providers=await this.p.provider.findMany({where:{isActive:true},select:{id:true,name:true,code:true,isMock:true,kind:true,healthFailures:true,circuitOpenUntil:true}});
  const byProduct:any={PAYIN:[],PAYOUT:[]};
  for(const r of rules){ if(byProduct[r.productCode]) byProduct[r.productCode].push({...this.viewRule(r),provider:r.provider?{...r.provider,...this.circuitView(r.provider)}:r.provider}); }
  const active:any={}; for(const pc of ['PAYIN','PAYOUT']){ const first=byProduct[pc].find((x:any)=>x.isActive); if(first) active[pc]=first; }
  return {routes:byProduct, active, providers:providers.map((p:any)=>({...p,...this.circuitView(p)})), circuit:{threshold:Number(process.env.CIRCUIT_FAILURE_THRESHOLD||3),cooldownSec:Number(process.env.CIRCUIT_COOLDOWN_SEC||300)}};
 }
 /** Activate (or update) an API for a product with optional Min–Max range in rupees. Does NOT turn other APIs off. */
 @Post('api-switch') @Perm('provider:write') async doSwitch(@CurrentUser() u:any,@Body() b:any){
  if(!['PAYIN','PAYOUT'].includes(b.productCode)) throw new BadRequestException('productCode must be PAYIN or PAYOUT');
  const prov=await this.p.provider.findUnique({where:{id:b.providerId}}); if(!prov||!prov.isActive) throw new BadRequestException('Select an active provider');
  const minP=this.rupeeToPaise(b.minRupees); const maxP=this.rupeeToPaise(b.maxRupees);
  if(minP!=null&&maxP!=null&&minP>maxP) throw new BadRequestException('Min amount cannot be greater than Max amount');
  const priority=Number.isFinite(Number(b.priority))?Math.max(1,Math.floor(Number(b.priority))):1;
  const ex=await this.p.routingRule.findFirst({where:{productCode:b.productCode,merchantId:null,providerId:b.providerId}});
  const data={isActive:true,priority,minAmountPaise:minP,maxAmountPaise:maxP};
  const rule=ex?await this.p.routingRule.update({where:{id:ex.id},data,include:{provider:{select:{id:true,name:true,code:true,isMock:true}}}}):await this.p.routingRule.create({data:{productCode:b.productCode,providerId:b.providerId,...data},include:{provider:{select:{id:true,name:true,code:true,isMock:true}}}});
  await this.audit(u,'API_ROUTE_ACTIVATE_'+b.productCode,'RoutingRule',rule.id);
  return {switched:true,productCode:b.productCode,route:this.viewRule(rule),provider:{id:prov.id,name:prov.name,code:prov.code}};
 }
 @Post('api-switch/:id/deactivate') @Perm('provider:write') async deactivateRoute(@CurrentUser() u:any,@Param('id') id:string){
  const r=await this.p.routingRule.findUnique({where:{id}}); if(!r) throw new BadRequestException('Route not found');
  const up=await this.p.routingRule.update({where:{id},data:{isActive:false},include:{provider:{select:{id:true,name:true,code:true,isMock:true}}}});
  await this.audit(u,'API_ROUTE_DEACTIVATE','RoutingRule',id); return {deactivated:true,route:this.viewRule(up)};
 }
 /** Change Min–Max / priority anytime without re-activating. Amounts in rupees. */
 @Post('api-switch/:id/range') @Perm('provider:write') async updateRange(@CurrentUser() u:any,@Param('id') id:string,@Body() b:any){
  const r=await this.p.routingRule.findUnique({where:{id}}); if(!r) throw new BadRequestException('Route not found');
  const data:any={};
  if('minRupees' in b) data.minAmountPaise=this.rupeeToPaise(b.minRupees);
  if('maxRupees' in b) data.maxAmountPaise=this.rupeeToPaise(b.maxRupees);
  if('priority' in b&&Number.isFinite(Number(b.priority))) data.priority=Math.max(1,Math.floor(Number(b.priority)));
  if('isActive' in b) data.isActive=!!b.isActive;
  const minP=data.minAmountPaise!==undefined?data.minAmountPaise:r.minAmountPaise;
  const maxP=data.maxAmountPaise!==undefined?data.maxAmountPaise:r.maxAmountPaise;
  if(minP!=null&&maxP!=null&&minP>maxP) throw new BadRequestException('Min amount cannot be greater than Max amount');
  const up=await this.p.routingRule.update({where:{id},data,include:{provider:{select:{id:true,name:true,code:true,isMock:true}}}});
  await this.audit(u,'API_ROUTE_RANGE','RoutingRule',id); return {updated:true,route:this.viewRule(up)};
 }
 /** Preview: for this amount (rupees), which API would be called? (skips open circuits) */
 @Get('api-switch/preview') async preview(@Query() q:any){
  const { pickRouteByAmount, isCircuitOpen }=await import('../common/core');
  const productCode=q.productCode==='PAYOUT'?'PAYOUT':'PAYIN';
  const amountPaise=Math.round(Number(q.amountRupees||0)*100);
  const rules=await this.p.routingRule.findMany({where:{productCode,merchantId:null,isActive:true},orderBy:{priority:'asc'},include:{provider:{select:{id:true,name:true,code:true,isMock:true,circuitOpenUntil:true}}}});
  const skip=new Set(rules.filter(r=>isCircuitOpen(r.provider)).map(r=>r.providerId));
  const mapped=rules.map(r=>({...this.viewRule(r),providerId:r.providerId}));
  const hit=pickRouteByAmount(mapped, amountPaise, skip);
  const full=hit?rules.find(r=>r.id===hit.id):null;
  return {productCode,amountRupees:amountPaise/100,amountPaise,matched:!!full,route:full?this.viewRule(full):null,provider:full?.provider||null,skippedCircuit:skip.size};
 }
 /** Manual circuit reset — force provider healthy for new traffic again. */
 @Post('providers/:id/circuit-reset') @Perm('provider:write') async resetCircuit(@CurrentUser() u:any,@Param('id') id:string){
  const prov=await this.p.provider.findUnique({where:{id}}); if(!prov) throw new BadRequestException('Provider not found');
  const up=await this.p.provider.update({where:{id},data:{healthFailures:0,circuitOpenUntil:null}});
  await this.audit(u,'CIRCUIT_RESET','Provider',id); return {reset:true,provider:{id:up.id,code:up.code,name:up.name},...this.circuitView(up)};
 }
 @Post('providers') @Perm('provider:write') async addProvider(@CurrentUser() u:any,@Body() b:any){ const approved=(process.env.PROVIDER_ALLOWED_HOSTS||'').split(',').filter(Boolean); if(!b.code||!b.name) throw new BadRequestException('Code and Name are required'); if(!b.isMock) assertProviderUrl(b.baseUrl,approved); const kind=['PG','WALLET','BANK','CUSTOM'].includes(b.kind)?b.kind:'PG'; const prov=await this.p.provider.create({data:{code:String(b.code).toUpperCase(),name:b.name,baseUrl:b.isMock?'https://mockpay.internal':b.baseUrl,kind,config:b.config||{},isMock:!!b.isMock,timeoutMs:b.timeoutMs||15000,credentialsEnc:b.credentials?encryptSecret(JSON.stringify(b.credentials)):null}});
  // services se capabilities: jo tick kiya wahi chalega — backend code deploy ki zaroorat nahi
  const svc=b.services||{}; const caps:any[]=[]; const wantPayin=svc.payin!==false, wantPayout=!!svc.payout||svc.payin===undefined, wantRefund=svc.refund!==false;
  const has=(op:string,pc:string)=>(b.capabilities||[]).some((c:any)=>c.operation===op&&c.productCode===pc);
  if(b.capabilities?.length) caps.push(...b.capabilities); else { if(wantPayin) caps.push({operation:'createPayin',productCode:'PAYIN'}); if(wantPayout) caps.push({operation:'createPayout',productCode:'PAYOUT'}); if(wantRefund) caps.push({operation:'createRefund',productCode:'PAYIN'}); }
  if(caps.length) await this.p.providerCapability.createMany({data:caps.map((c:any)=>({providerId:prov.id,operation:c.operation,productCode:c.productCode})),skipDuplicates:true}); await this.audit(u,'PROVIDER_CREATE','Provider',prov.id); return {...prov,credentialsEnc:undefined}; }
 /** Connection test: koi payment nahi banta — sirf host reachable hai ya nahi + kitni der lagi. */
 @Post('providers/:id/test') @Perm('provider:write') async testProvider(@Param('id') id:string){ const prov=await this.p.provider.findUnique({where:{id}}); if(!prov) throw new BadRequestException('Provider not found'); if(prov.isMock) return {ok:true,httpStatus:200,ms:1,note:'This is a mock provider — always ready. Run a test payment directly.'}; const { GenericHttpAdapter, activeProviderCreds, cfgOf }=await import('./providers'); const creds=await activeProviderCreds(this.p,prov.id); const a=new GenericHttpAdapter(prov.baseUrl,creds||{},cfgOf(prov),prov.timeoutMs); return a.testConnection(); }
 /** Live pay-in / payout against a chosen API (admin console). Forces that provider; uses Trust Setu sandbox. */
 @Post('test-api') @Perm('provider:write') async testApi(@CurrentUser() u:any,@Body() b:any){
  const kind=String(b.kind||'').toUpperCase()==='PAYOUT'?'PAYOUT':'PAYIN';
  if(!b.providerId) throw new BadRequestException('Select an API');
  const amountRupees=Number(b.amountRupees); if(!Number.isFinite(amountRupees)||amountRupees<=0) throw new BadRequestException('Enter a valid amount (₹)');
  const amountPaise=Math.round(amountRupees*100);
  if(kind==='PAYOUT'){ if(!b.account) throw new BadRequestException('Account number required'); if(!b.ifsc||String(b.ifsc).length<4) throw new BadRequestException('IFSC required'); }
  const prov=await this.p.provider.findUnique({where:{id:b.providerId}}); if(!prov||!prov.isActive) throw new BadRequestException('API not found or inactive');
  const merchant=await this.p.merchantProfile.findFirst({where:{businessName:'Trust Setu'}})||await this.p.merchantProfile.findFirst({where:{status:'APPROVED'},orderBy:{createdAt:'asc'}});
  if(!merchant) throw new BadRequestException('No merchant available for test — seed Trust Setu first');
  const idem='admin-test-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  const merchantRef=(kind==='PAYIN'?'admin_pi_':'admin_po_')+Date.now();
  const request=kind==='PAYIN'
    ?{merchantRef,amountPaise,amountRupees,customer:{name:'Test Customer',email:'test@syntrix.local'},method:'UPI'}
    :{merchantRef,amountPaise,amountRupees,beneficiary:{name:b.name||'Test Beneficiary',account:String(b.account),ifsc:String(b.ifsc).toUpperCase()},method:'Bank Transfer'};
  const started=Date.now();
  let response:any; let error:string|null=null;
  try{
    response=kind==='PAYIN'
      ?await this.payments.createPayin(merchant,'sandbox',request,idem,prov.id)
      :await this.payments.createPayout(merchant,'sandbox',request,idem,prov.id);
  }catch(e:any){ error=e?.message||String(e); }
  const ms=Date.now()-started;
  const txnStatus=response?.status||(error?'FAILED':null);
  await this.audit(u,'ADMIN_TEST_API','Provider',prov.id,{kind,amountPaise,ok:!error,ms,merchantRef,status:txnStatus,error});
  return {ok:!error,kind,ms,status:txnStatus,provider:{id:prov.id,name:prov.name,code:prov.code,isMock:prov.isMock},merchant:{id:merchant.id,name:merchant.businessName},request,response:response||null,error};
 }
 /** Admin Test API history — Success / Pending / Failed (+ rejected before txn). */
 @Get('test-api/history') @Perm('provider:write') async testHistory(@Query('bucket') bucketQ?:string){
  const bucket=String(bucketQ||'ALL').toUpperCase();
  const txns=await this.p.transaction.findMany({
    where:{OR:[{merchantRef:{startsWith:'admin_pi_'}},{merchantRef:{startsWith:'admin_po_'}}]},
    orderBy:{createdAt:'desc'}, take:150,
  });
  const pids=[...new Set(txns.map(t=>t.providerId).filter(Boolean))] as string[];
  const provs=pids.length?await this.p.provider.findMany({where:{id:{in:pids}},select:{id:true,name:true,code:true,isMock:true}}):[];
  const pmap=new Map(provs.map(p=>[p.id,p]));
  const bucketOf=(st:string)=> st==='SUCCESS'?'SUCCESS':['FAILED','REFUNDED'].includes(st)?'FAILED':['PENDING','PROCESSING','UNKNOWN'].includes(st)?'PENDING':'OTHER';
  let items=txns.map(t=>{ const pv:any=t.providerId?pmap.get(t.providerId):null; return {
    id:t.id, source:'txn' as const, kind:t.kind, status:t.status, bucket:bucketOf(t.status),
    merchantRef:t.merchantRef, amountPaise:Number(t.amountPaise), feePaise:Number(t.feePaise),
    providerRef:t.providerRef, utr:t.utr, failureReason:t.failureReason, createdAt:t.createdAt,
    apiName:pv?.name||'Unknown', apiCode:pv?.code||'—', apiIsMock:!!pv?.isMock, providerId:t.providerId,
  }; });
  // Pre-txn failures from audit (validation / insufficient balance etc.)
  const audits=await this.p.auditLog.findMany({where:{action:'ADMIN_TEST_API'},orderBy:{createdAt:'desc'},take:80});
  const knownRefs=new Set(items.map(i=>i.merchantRef));
  const failAudits=audits.filter(a=>{ const m:any=a.metadata||{}; return m.ok===false&&!(m.merchantRef&&knownRefs.has(m.merchantRef)); });
  const auditPids=[...new Set(failAudits.map(a=>a.entityId).filter(Boolean))] as string[];
  const auditProvs=auditPids.length?await this.p.provider.findMany({where:{id:{in:auditPids}},select:{id:true,name:true,code:true,isMock:true}}):[];
  const amap=new Map(auditProvs.map(p=>[p.id,p]));
  for(const a of failAudits){
    const m:any=a.metadata||{}; const pv:any=a.entityId?amap.get(a.entityId):null;
    items.push({
      id:a.id, source:'audit', kind:m.kind||'PAYIN', status:'FAILED', bucket:'FAILED',
      merchantRef:m.merchantRef||'—', amountPaise:Number(m.amountPaise||0), feePaise:0,
      providerRef:null, utr:null, failureReason:m.error||'Test failed', createdAt:a.createdAt,
      apiName:pv?.name||'Unknown', apiCode:pv?.code||'—', apiIsMock:!!pv?.isMock, providerId:pv?.id||a.entityId,
    } as any);
  }
  items.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  const counts={ALL:items.length,SUCCESS:items.filter(i=>i.bucket==='SUCCESS').length,PENDING:items.filter(i=>i.bucket==='PENDING').length,FAILED:items.filter(i=>i.bucket==='FAILED').length};
  if(bucket!=='ALL') items=items.filter(i=>i.bucket===bucket);
  return {counts,items:items.slice(0,100)};
 }
 @Get('products') async products(){ return this.p.apiProduct.findMany({orderBy:{code:'asc'}}); }
 @Post('products') @Perm('product:write') async addProduct(@Body() b:any){ return this.p.apiProduct.create({data:{code:b.code,name:b.name,category:b.category||'PAYMENTS',description:b.description}}); }
 @Post('merchants/:id/product-access') @Perm('product:write') async access(@CurrentUser() u:any,@Param('id') id:string,@Body() b:any){ const r=await this.p.merchantProductAccess.upsert({where:{merchantId_productId_env:{merchantId:id,productId:b.productId,env:b.env||'sandbox'}},create:{merchantId:id,productId:b.productId,env:b.env||'sandbox',status:b.status||'ENABLED'},update:{status:b.status||'ENABLED'}}); await this.audit(u,'PRODUCT_ACCESS_'+r.status,'Merchant',id); return r; }
 @Post('merchants/:id/pricing') @Perm('pricing:write') async pricing(@Param('id') id:string,@Body() b:any){ return this.p.pricingPlan.upsert({where:{merchantId_productId:{merchantId:id,productId:b.productId}},create:{merchantId:id,productId:b.productId,feeBps:b.feeBps||0,feeFlatPaise:BigInt(b.feeFlatPaise||0),settlementDays:b.settlementDays||1,dailyLimitPaise:b.dailyLimitPaise?BigInt(b.dailyLimitPaise):null,txnLimitPaise:b.txnLimitPaise?BigInt(b.txnLimitPaise):null},update:{feeBps:b.feeBps,feeFlatPaise:BigInt(b.feeFlatPaise||0),settlementDays:b.settlementDays,dailyLimitPaise:b.dailyLimitPaise?BigInt(b.dailyLimitPaise):null,txnLimitPaise:b.txnLimitPaise?BigInt(b.txnLimitPaise):null}}).then(r=>({...r,feeFlatPaise:Number(r.feeFlatPaise),dailyLimitPaise:r.dailyLimitPaise?Number(r.dailyLimitPaise):null,txnLimitPaise:r.txnLimitPaise?Number(r.txnLimitPaise):null})); }
 @Post('merchants/:id/routing') @Perm('provider:write') async routing(@Param('id') id:string,@Body() b:any){ return this.p.routingRule.create({data:{merchantId:id,productCode:b.productCode,providerId:b.providerId,priority:b.priority||1}}); }
 // maker-checker: requester != approver enforced
 @Post('pending-approvals') @UseGuards(AuthGuard) async reqApproval(@CurrentUser() u:any,@Body() b:any){ return this.p.pendingApproval.create({data:{kind:b.kind,payload:b.payload,requestedBy:u.id}}); }
 @Get('pending-approvals') @Perm('merchant:read') async listApprovals(){ return this.p.pendingApproval.findMany({where:{status:'PENDING'},orderBy:{createdAt:'desc'}}); }
 @Post('pending-approvals/:id/decide') async decide(@CurrentUser() u:any,@Param('id') id:string,@Body() b:any){ const a=await this.p.pendingApproval.findUniqueOrThrow({where:{id}}); if(a.requestedBy===u.id) throw new ForbiddenException('Maker-checker: the requester cannot approve their own change'); const upd=await this.p.pendingApproval.update({where:{id},data:{status:b.approve?'APPROVED':'REJECTED',approvedBy:u.id,decidedAt:new Date(),reason:b.reason}}); if(b.approve&&a.kind==='REFUND') { const {PaymentsService}=await import('./payments.service'); /* worker/API executes via payments service in app module — recorded here for audit */ } await this.audit(u,'MAKER_CHECKER_'+upd.status,'PendingApproval',id); return upd; }
 @Get('webhook-deliveries') @Perm('txn:read') async deliveries(){ return this.p.webhookDelivery.findMany({orderBy:{createdAt:'desc'},take:100,include:{event:true}}); }
}
