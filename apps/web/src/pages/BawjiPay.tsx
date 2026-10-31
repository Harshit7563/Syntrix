import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, inr } from '../api';

export function BawjiPay() {
  const { ref = '' } = useParams();
  const [row, setRow] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const load = async () => {
    try { setRow(await api('/pay/bawji/' + encodeURIComponent(ref))); setErr(''); }
    catch (e: any) { setErr(e.message || 'Payment not found'); }
  };
  useEffect(() => { if (ref) load(); }, [ref]);
  useEffect(() => {
    const link = row?.payUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!link) return;
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [row?.payUrl]);
  const pay = async () => {
    setBusy(true);
    try { setRow(await api('/pay/bawji/' + encodeURIComponent(ref) + '/confirm', { method: 'POST', body: {} })); setErr(''); }
    catch (e: any) { setErr(e.message || 'Could not mark this test payment'); }
    setBusy(false);
  };
  return <div className="min-h-screen bg-[#f4f6f8] text-slate-900 grid place-items-center p-4">
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <p className="text-[12px] font-bold tracking-wide text-slate-400 uppercase">Bawji Raj · Test</p>
      <h1 className="text-[22px] font-bold mt-1">Pay-in</h1>
      <p className="text-[13px] text-slate-500 mt-1">Yeh test page hai. QR scan karne se bank account se paisa nahi katega.</p>
      {err && <p className="mt-4 text-[13px] text-rose-600">{err}</p>}
      {row && <>
        <p className="mt-5 text-[32px] font-bold tnum">{inr(row.amountPaise)}</p>
        <p className="text-[12px] font-mono text-slate-400 break-all">{row.merchantRef}</p>
        <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${row.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.status}</p>
        {qr && row.status !== 'SUCCESS' && <img src={qr} alt="Test QR" className="mt-5 w-[220px] h-[220px] rounded-2xl border border-slate-100"/>}
        {row.status === 'SUCCESS'
          ? <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-[13px] font-semibold text-emerald-800">Test payment marked paid.</p>
              <p className="text-[12px] text-emerald-700 mt-1">UTR {row.utr || '—'}. Bank ko koi paisa nahi gaya.</p>
            </div>
          : <button type="button" disabled={busy} onClick={pay} className="mt-5 h-11 px-5 rounded-xl bg-slate-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy ? 'Marking…' : 'Mark as paid'}</button>}
      </>}
    </div>
  </div>;
}
