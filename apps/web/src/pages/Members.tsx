import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr } from '../api';

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const [adding, setAdding] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [issued, setIssued] = useState<any>(null);
  const rows = Array.isArray(list.data) ? list.data : [];
  const managing = rows.find((m: any) => m.id === manageId);

  return (
    <div className="w-full h-[calc(100vh-150px)] min-h-[560px] flex flex-col">
      <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <p className="text-[16px] font-bold text-slate-900">Merchants</p>
          <span className="text-[12.5px] text-slate-400 tnum">{rows.length}</span>
          {rows.some((m: any) => m.needsCredentials) && (
            <button type="button" onClick={() => api('/merchant-desk/issue-missing-logins', { method: 'POST', body: {} }).then((r: any) => { qc.invalidateQueries({ queryKey: ['merchant-desk'] }); if (r.errors?.length) window.alert(r.errors.length + ' merchants could not be issued'); })} className="h-9 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">Issue IDs for old merchants</button>
          )}
          <button type="button" onClick={() => setAdding(true)} className="ml-auto h-9 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold">Add new merchant</button>
        </div>
        {adding && <AddMerchant onDone={(m) => { qc.invalidateQueries({ queryKey: ['merchant-desk'] }); setAdding(false); setIssued(m); }} onCancel={() => setAdding(false)} />}
        <div className="flex-1 min-h-0 overflow-auto">
          {list.isLoading && <p className="px-5 py-8 text-[13px] text-slate-400">Loading…</p>}
          {!list.isLoading && !rows.length && !adding && <p className="px-5 py-16 text-center text-[13px] text-slate-400">No merchants yet.</p>}
          {!!rows.length && (
            <table className="w-full text-[13.5px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">Merchant</th>
                  <th className="px-5 py-3 font-semibold">Member ID</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Pay-in</th>
                  <th className="px-5 py-3 font-semibold">Payout</th>
                  <th className="px-5 py-3 font-semibold">Wallet</th>
                  <th className="px-5 py-3 font-semibold">Charge</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-center">Manage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m: any) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{m.businessName || 'Unnamed'}</td>
                    <td className="px-5 py-3.5 tnum font-semibold text-slate-800">{m.memberId || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{m.loginEmail || m.email || '—'}</td>
                    <td className="px-5 py-3.5 tnum text-slate-700">{inr(m.payinPaise)}</td>
                    <td className="px-5 py-3.5 tnum text-slate-700">{inr(m.payoutPaise)}</td>
                    <td className="px-5 py-3.5 tnum font-semibold text-slate-900">{inr(Number(m.payinPaise || 0) + Number(m.payoutPaise || 0))}</td>
                    <td className="px-5 py-3.5 tnum text-slate-700">{m.payinChargePercent ?? 0}% / {m.payoutChargePercent ?? 0}%</td>
                    <td className="px-5 py-3.5"><StatusToggle merchant={m} /></td>
                    <td className="px-5 py-3.5 text-center">
                      <button type="button" onClick={() => { setAdding(false); setManageId(m.id); }} className="h-8 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {managing && <ManageMerchant merchant={managing} onClose={() => setManageId(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['merchant-desk'] })} />}
      {issued && <IssuedMerchant merchant={issued} onClose={() => setIssued(null)} />}
    </div>
  );
}

function StatusToggle({ merchant }: { merchant: any }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/profile', {
      method: 'POST',
      body: {
        businessName: merchant.businessName || 'Merchant',
        email: merchant.email || merchant.loginEmail || '',
        payinChargePercent: String(merchant.payinChargePercent ?? 0),
        payoutChargePercent: String(merchant.payoutChargePercent ?? 0),
        holdRupees: String((merchant.holdPaise || 0) / 100),
        active: !merchant.active,
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-desk'] }),
  });
  return (
    <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="inline-flex items-center gap-2" title={merchant.active ? 'Turn off' : 'Turn on'}>
      <span className={`text-[12px] font-semibold ${merchant.active ? 'text-emerald-700' : 'text-slate-400'}`}>{save.isPending ? '…' : merchant.active ? 'Active' : 'Inactive'}</span>
      <span className={`relative w-10 h-6 rounded-full ${merchant.active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow ${merchant.active ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function ManageMerchant({ merchant, onClose, onSaved }: { merchant: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: merchant.businessName || '',
    email: merchant.loginEmail || merchant.email || '',
    payinChargePercent: String(merchant.payinChargePercent ?? 0),
    payoutChargePercent: String(merchant.payoutChargePercent ?? 0),
    holdRupees: String((merchant.holdPaise || 0) / 100),
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/profile', {
      method: 'POST',
      body: {
        businessName: form.businessName,
        email: form.email,
        payinChargePercent: form.payinChargePercent,
        payoutChargePercent: form.payoutChargePercent,
        holdRupees: form.holdRupees,
        active: !!merchant.active,
      },
    }),
    onSuccess: () => { setErr(''); setOk('Saved'); onSaved(); setTimeout(onClose, 700); },
    onError: (e: any) => setErr(e.message || 'Could not save'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <form className="relative w-full max-w-lg bg-white rounded-[20px] shadow-[0_20px_50px_rgba(15,23,42,.25)] p-5 sm:p-6" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold text-slate-900">Edit · {merchant.businessName || 'Merchant'}</p>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600">Close</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="label">Member ID</span><input className="input tnum" readOnly value={merchant.memberId || '—'} /></label>
          <label className="block"><span className="label">Password</span><input className="input" readOnly value={merchant.loginPassword || '—'} /></label>
          {merchant.needsCredentials && (
            <button type="button" className="sm:col-span-2 h-10 rounded-full border border-slate-200 text-[13px] font-semibold text-slate-700" onClick={async () => {
              try {
                await api('/merchant-desk/' + merchant.id + '/issue-login', { method: 'POST', body: {} });
                setErr(''); setOk('Member ID issued'); onSaved();
              } catch (e: any) { setErr(e.message || 'Could not issue login'); }
            }}>Issue Member ID + password</button>
          )}
          <label className="block"><span className="label">Name</span><input className="input" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></label>
          <label className="block"><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label className="block"><span className="label">Pay-in %</span><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payinChargePercent} onChange={e => setForm({ ...form, payinChargePercent: e.target.value })} /></label>
          <label className="block"><span className="label">Payout %</span><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payoutChargePercent} onChange={e => setForm({ ...form, payoutChargePercent: e.target.value })} /></label>
          <label className="block"><span className="label">Hold ₹</span><input className="input tnum" type="number" min={0} step="0.01" value={form.holdRupees} onChange={e => setForm({ ...form, holdRupees: e.target.value })} /></label>
        </div>
        <Handoff merchant={merchant} />
        {err && <p className="text-[12.5px] text-rose-600 mt-3">{err}</p>}
        {ok && <p className="text-[12.5px] text-emerald-700 mt-3">{ok}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full border border-slate-200 text-[13px] font-semibold text-slate-600">Cancel</button>
          <button className="h-10 px-5 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function AddMerchant({ onDone, onCancel }: { onDone: (m: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ businessName: '', mobile: '', email: '', payinChargePercent: '2', payoutChargePercent: '2' });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk', { method: 'POST', body: { ...form, holdRupees: '0', active: true } }),
    onSuccess: (m) => onDone(m),
    onError: (e: any) => setErr(e.message || 'Could not add merchant'),
  });
  return (
    <form className="shrink-0 px-5 py-4 border-b border-slate-100 bg-[#fafbfd]" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13.5px] font-bold text-slate-900">New merchant</p>
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600">Cancel</button>
      </div>
      <p className="text-[12.5px] text-slate-400 mb-3">Member ID aur password apne aap banenge. Edit pe dikhenge.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block"><span className="label">Name</span><input className="input !w-44" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></label>
        <label className="block"><span className="label">Mobile</span><input className="input tnum !w-36" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required /></label>
        <label className="block"><span className="label">Email</span><input className="input !w-52" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
      </div>
      {err && <p className="text-[12.5px] text-rose-600 mt-2">{err}</p>}
    </form>
  );
}

function IssuedMerchant({ merchant, onClose }: { merchant: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-lg bg-white rounded-[20px] shadow-[0_20px_50px_rgba(15,23,42,.25)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <p className="text-[16px] font-bold text-slate-900">Merchant ready · {merchant.businessName}</p>
        <p className="text-[12.5px] text-slate-500 mt-1">Yeh details member ko de do. Password Edit pe bhi dikhega.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="block"><span className="label">Member ID</span><input className="input tnum" readOnly value={merchant.memberId || ''} /></label>
          <label className="block"><span className="label">Password</span><input className="input" readOnly value={merchant.loginPassword || ''} /></label>
        </div>
        <Handoff merchant={merchant} />
        <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="h-10 px-5 rounded-full bg-slate-900 text-white text-[13px] font-semibold">Done</button></div>
      </div>
    </div>
  );
}

function Handoff({ merchant }: { merchant?: any }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://syntrixapi.in';
  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-[#fafbfd] p-3 text-[12.5px] text-slate-600 space-y-1.5 leading-relaxed">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Give the merchant</p>
      <p>Login: <span className="font-semibold text-slate-800">{origin}/app/merchants/login</span>{merchant?.memberId ? ` · Member ID ${merchant.memberId}` : ''}</p>
      <p>API: <span className="font-semibold text-slate-800">{origin}/api/v1</span> with header <code className="text-[12px]">X-Api-Key</code>. Keys page pe sandbox/production key banao.</p>
      <p>IP: production payout ke liye merchant ke <span className="font-semibold text-slate-800">server ka public IP</span> Keys → Shield pe allowlist. Ye ORVIAN/bank IP nahi hai.</p>
      <p>Webhook: merchant ki apni HTTPS URL Webhooks page pe. Bank callback Syntrix pe aata hai — merchant ko <span className="font-semibold text-slate-800">{origin}/api/webhooks/provider/ORVIAN</span> mat do.</p>
      <p>Pay-in body ka <code className="text-[12px]">memberId</code> portal member ka cuid hai, Member ID (M######) nahi.</p>
    </div>
  );
}
