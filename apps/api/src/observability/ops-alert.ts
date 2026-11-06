import { throttleOnce } from '../common/redis';

export async function opsAlert(title: string, detail: Record<string, unknown> = {}) {
  const url = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!url) return;
  const body = JSON.stringify({ text: title, ts: new Date().toISOString(), ...detail });
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: ctrl.signal });
  } catch {
    /* webhook down must not crash worker */
  }
}

export async function maybeOpsAlert(throttleKey: string, title: string, detail: Record<string, unknown>) {
  const ok = await throttleOnce('alert:' + throttleKey, 600);
  if (!ok) return;
  await opsAlert(title, detail);
}
