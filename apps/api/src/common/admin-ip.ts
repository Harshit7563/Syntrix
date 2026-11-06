import { ipInCidr } from './core';

export function adminAllowlist(): string[] {
  return String(process.env.ADMIN_IP_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Empty allowlist = not enforced (avoids locking the owner out). */
export function adminIpAllowed(ip: string): boolean {
  const list = adminAllowlist();
  if (!list.length) return true;
  const clean = String(ip || '').replace(/^::ffff:/, '');
  if (!clean || clean === 'unknown') return false;
  return list.some((cidr) => ipInCidr(clean, cidr));
}
