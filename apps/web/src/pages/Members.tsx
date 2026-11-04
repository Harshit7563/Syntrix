import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr } from '../api';

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const [adding, setAdding] = useState(false);
  const rows = Array.isArray(list.data) ? list.data : [];

  return (
    <div className="w-full h-[calc(100vh-150px)] min-h-[560px] flex flex-col">
      <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <p className="text-[16px] font-bold text-slate-900">Merchants</p>
          <span className="text-[12.5px] text-slate-400 tnum">{rows.length}</span>
          <button type="button" onClick={() => setAdding(true)} className="ml-auto h-9 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold">Add new merchant</button>
        </div>
        {adding && <AddMerchant onDone={() => { qc.invalidateQueries({ queryKey: ['merchant-desk'] }); setAdding(false); }} onCancel={() => setAdding(false)} />}
        <div className="flex-1 min-h-0 overflow-auto">
          {list.isLoading && <p className="px-5 py-8 text-[13px] text-slate-400">Loading…</p>}
          {!list.isLoading && !rows.length && !adding && <p className="px-5 py-16 text-center text-[13px] text-slate-400">No merchants yet.</p>}
          {!!rows.length && (
            <table className="w-full text-[13.5px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">Merchant</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Pay-in</th>
                  <th className="px-5 py-3 font-semibold">Payout</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m: any) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{m.businessName || 'Unnamed'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{m.loginEmail || m.email || '—'}</td>
                    <td className="px-5 py-3.5 tnum text-slate-700">{inr(m.payinPaise)}</td>
                    <td className="px-5 py-3.5 tnum text-slate-700">{inr(m.payoutPaise)}</td>
                    <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{m.active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function AddMerchant({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ businessName: '', mobile: '', email: '', password: '', payinChargePercent: '2', payoutChargePercent: '2' });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk', { method: 'POST', body: { ...form, holdRupees: '0', active: true } }),
    onSuccess: () => onDone(),
    onError: (e: any) => setErr(e.message || 'Could not add merchant'),
  });
  return (
    <form className="shrink-0 px-5 py-4 border-b border-slate-100 bg-[#fafbfd]" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13.5px] font-bold text-slate-900">New merchant</p>
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600">Cancel</button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block"><span className="label">Name</span><input className="input !w-44" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></label>
        <label className="block"><span className="label">Mobile</span><input className="input tnum !w-36" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required /></label>
        <label className="block"><span className="label">Email</span><input className="input !w-52" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="block"><span className="label">Password</span><input className="input !w-40" type="text" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
        <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
      </div>
      {err && <p className="text-[12.5px] text-rose-600 mt-2">{err}</p>}
    </form>
  );
}
