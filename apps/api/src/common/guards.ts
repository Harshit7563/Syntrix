import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, HttpException, SetMetadata, createParamDecorator } from '@nestjs/common'; import { Reflector } from '@nestjs/core'; import * as jwt from 'jsonwebtoken'; import { PrismaService } from '../prisma.service'; import { sha256, safeEqualHex, ipInCidr, decryptSecret, verifyRequestSignature } from './core'; import { can, Role } from '@syntrix/shared';
export const Perm = (p: string) => SetMetadata('perm', p);
export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);
@Injectable() export class AuthGuard implements CanActivate { constructor(private prisma: PrismaService, private reflector: Reflector) {}
 async canActivate(ctx: ExecutionContext) { const req = ctx.switchToHttp().getRequest(); const token = req.cookies?.sx_access || (req.headers.authorization || '').replace('Bearer ', ''); if (!token) throw new UnauthorizedException('Login required');
  let payload: any; try { payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-32ch'); } catch { throw new UnauthorizedException('Session expired — please log in again'); }
  const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { memberships: { include: { org: { include: { merchant: true } } } } } });
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) throw new UnauthorizedException('Session revoked — please log in again');
  // Prefer platform staff membership if the user has more than one
  const staffOrder=['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS'];
  const m=[...user.memberships].sort((a,b)=>{ const ai=staffOrder.indexOf(a.role as string), bi=staffOrder.indexOf(b.role as string); if(ai===-1&&bi===-1) return 0; if(ai===-1) return 1; if(bi===-1) return -1; return ai-bi; })[0]||user.memberships[0];
  req.user = { id: user.id, email: user.email, role: (m?.role || 'MERCHANT_VIEWER') as Role, orgId: m?.orgId, merchantId: m?.org?.merchant?.id || null, mfaEnabled: user.mfaEnabled };
  if (!req.user.merchantId && staffOrder.includes(req.user.role)) {
    const rows = await this.prisma.merchantProfile.findMany({ select: { id: true, orgId: true }, take: 2 });
    if (rows.length === 1) { req.user.merchantId = rows[0].id; if (!req.user.orgId) req.user.orgId = rows[0].orgId; }
  }
  const perm = this.reflector.get<string>('perm', ctx.getHandler());
  if (perm && !can(req.user.role, perm)) throw new ForbiddenException(`Role ${req.user.role} lacks permission ${perm}`);
  return true; } }
const STAFF_ROLES=['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS'];
@Injectable() export class StaffGuard implements CanActivate {
 canActivate(ctx: ExecutionContext) { const role=ctx.switchToHttp().getRequest().user?.role; if (!STAFF_ROLES.includes(role)) throw new ForbiddenException('Staff access only'); return true; }
}
/** Tenant isolation: staff bypass only for platform roles; merchants pinned to their own merchantId. */
export function assertTenant(user: any, merchantId: string) { const staff=['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS']; if (staff.includes(user.role)) return; if (!user.merchantId || user.merchantId !== merchantId) throw new ForbiddenException('Cross-merchant access denied'); }
@Injectable() export class ApiKeyGuard implements CanActivate { constructor(private prisma: PrismaService) {}
 // in-memory velocity windows (per instance; Redis can replace this in multi-instance deploys)
 private hits=new Map<string,number[]>(); private failedAuth=new Map<string,number[]>();
 private bump(map:Map<string,number[]>, key:string, limit:number, windowMs:number){ const now=Date.now(); const arr=(map.get(key)||[]).filter(t=>now-t<windowMs); arr.push(now); map.set(key,arr); return arr.length>limit; }
 async canActivate(ctx: ExecutionContext) { const req = ctx.switchToHttp().getRequest(); const ip=(req.ip||'').replace('::ffff:','');
  const raw = req.headers['x-api-key'] as string; if (!raw?.includes('.')) { if(this.bump(this.failedAuth,'ip:'+ip,30,60000)) throw new HttpException('Too many failed API-key attempts from this IP — try again in a minute',429); throw new UnauthorizedException('Missing X-Api-Key: <keyId>.<secret>'); }
  const keyId = raw.split('.')[0]; const secret = raw.slice(keyId.length+1); const cred = await this.prisma.apiCredential.findUnique({ where: { keyId }, include: { merchant: true, allowlist: true } });
  if (!cred || cred.revokedAt || (cred.expiresAt && cred.expiresAt < new Date()) || !safeEqualHex(cred.keyHash, sha256(secret))) { if(this.bump(this.failedAuth,'ip:'+ip,30,60000)) throw new HttpException('Too many failed API-key attempts from this IP — try again in a minute',429); throw new UnauthorizedException('Invalid or revoked API key'); }
  if (!cred.merchant.sandboxEnabled && cred.env==='sandbox') throw new ForbiddenException('Sandbox disabled'); if (cred.env==='production' && !cred.merchant.productionEnabled) throw new ForbiddenException('Production not approved for this merchant yet');
  // IP allowlist — proper CIDR check; mandatory for PRODUCTION payouts
  const path:string=req.path||req.url||''; const isPayoutWrite = req.method==='POST' && path.endsWith('/v1/payouts');
  if (cred.allowlist.length) { const ok=cred.allowlist.some(a=>ipInCidr(ip,a.cidr)); if(!ok) throw new ForbiddenException(`IP ${ip} is not allowlisted for this API key`); }
  else if (isPayoutWrite && cred.env==='production' && process.env.PAYOUT_REQUIRE_IP_ALLOWLIST!=='false') throw new ForbiddenException('Payout Shield: production payouts need an IP allowlist on this API key. Add your server IP from the portal (API Keys → IP allowlist), or set PAYOUT_REQUIRE_IP_ALLOWLIST=false to opt out.');
  // Least-privilege scopes: a pay-in-only key physically cannot move money out
  const scopes:string[]=(cred as any).scopes||[]; const need = path.includes('/v1/payouts') ? 'PAYOUT' : path.includes('/v1/payins') ? 'PAYIN' : path.includes('/v1/refunds') ? 'REFUND' : null;
  if (need && scopes.length && !scopes.includes(need)) throw new ForbiddenException(`Payout Shield: this API key does not have the ${need} scope. Create/enable a ${need}-scoped key in the portal.`);
  // Signed payout requests: separate signing secret, 5-minute replay window (a leaked API key alone is not enough)
  if (isPayoutWrite && (cred as any).requireSigning) { const ts=req.headers['x-syntrix-timestamp'] as string; const sig=req.headers['x-syntrix-signature'] as string; const enc=(cred as any).signingSecretEnc; if(!enc) throw new ForbiddenException('Payout Shield: signing is ON but no signing secret exists — generate one in the portal (API Keys).'); let secretPlain=''; try{ secretPlain=decryptSecret(enc); }catch{ throw new ForbiddenException('Payout Shield: signing secret cannot be read — rotate it in the portal.'); } const rawBody=req.rawBody?req.rawBody.toString('utf8'):(req.body?JSON.stringify(req.body):''); if(!verifyRequestSignature(secretPlain, ts||'', sig||'', rawBody)) throw new ForbiddenException('Payout Shield: missing or invalid x-syntrix-signature (sign `${timestamp}.${rawBody}` with your signing secret; 5-minute window).'); }
  // Velocity limit on money-out calls per key
  if (isPayoutWrite && this.bump(this.hits,'cred:'+cred.id,60,60000)) throw new HttpException('Payout Shield: payout rate limit exceeded for this API key (60/min). Slow down — legitimate bursts can be raised by Operations.',429);
  req.merchant = cred.merchant; req.credential = cred; req.env = cred.env; await this.prisma.apiCredential.update({ where:{id:cred.id}, data:{ lastUsedAt:new Date() } }); return true; } }
