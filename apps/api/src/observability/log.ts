import { redact } from '../common/core';

export function slog(level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  const line = { ts: new Date().toISOString(), level, msg, ...redact(extra) };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export function routeLabel(path: string) {
  const p = String(path || '').split('?')[0];
  return p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[a-z0-9]{21,}/gi, '/:id')
    .replace(/\/M\d{6}\b/g, '/:member')
    .slice(0, 120) || '/';
}
