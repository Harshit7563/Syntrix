export type Env='sandbox'|'production';
export type TxnStatus='PENDING'|'PROCESSING'|'SUCCESS'|'FAILED'|'UNKNOWN'|'REFUNDED'|'PARTIALLY_REFUNDED';
export type OnboardingStatus='DRAFT'|'SUBMITTED'|'UNDER_REVIEW'|'CLARIFICATION_REQUIRED'|'APPROVED'|'REJECTED'|'SUSPENDED';
export const ROLES=['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS','MERCHANT_OWNER','MERCHANT_DEVELOPER','MERCHANT_VIEWER'] as const;
export type Role=typeof ROLES[number];
/** Canonical API shapes — independent of any upstream provider. Money is integer paise. */
export interface CanonicalPayinRequest{merchantRef:string;amountPaise:number;currency:'INR';customer:{name?:string;email?:string;phone?:string};method?:string;returnUrl?:string;metadata?:Record<string,string>}
export interface CanonicalResult{status:TxnStatus;providerRef?:string;utr?:string;message?:string;raw?:unknown}
export const PERMISSIONS:Record<Role,string[]>={SUPER_ADMIN:['*'],COMPLIANCE:['merchant:review','merchant:read','document:review','audit:read'],OPERATIONS:['merchant:read','provider:write','product:write','txn:read','recon:run','webhook:replay'],ACCOUNTS:['pricing:write','invoice:write','txn:read','recon:run','payout:approve'],MERCHANT_OWNER:['merchant:write','credential:write','webhook:write','txn:read','billing:read','product:request'],MERCHANT_DEVELOPER:['credential:write','webhook:write','txn:read','product:request'],MERCHANT_VIEWER:['txn:read','billing:read']};
export function can(role:Role,perm:string){const p=PERMISSIONS[role]||[];return p.includes('*')||p.includes(perm)}
