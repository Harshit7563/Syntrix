import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Status } from '../api';

export function MerchantDesk() {
  const qc = useQueryClient();
  const merchants = useQuery({ queryKey: ['amerch'], queryFn: () => api('/admin/merchants') });
  const [sel, setSel] = useState('');
  const rows = Array.isArray(merchants.data) ? merchants.data : [];
  useEffect(() => { if (!sel && rows[0]?.id) setSel(rows[0].id); }, [rows, sel]);
  const m = rows.find((x: any) => x.id === sel);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-slate-900">Merchant</h1>
        <p className="text-[13px] text-slate-500 mt-1">Members, commission slabs, and which API is on for this merchant. Pay-in and payout need a member id.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((row: any) => (
          <button key={row.id} type="button" onClick={() => setSel(row.id)} className={`rounded-2xl border px-4 py-2 text-left ${sel === row.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>
            <span className="block text-[13px] font-bold">{row.businessName || 'Unnamed'}</span>
            <span className={`block text-[11px] ${sel === row.id ? 'text-slate-300' : 'text-slate-400'}`}>{row.status}</span>
          </button>
        ))}
        {!rows.length && <p className="text-[13px] text-slate-400">{merchants.isLoading ? 'Loading…' : 'No merchant yet.'}</p>}
      </div>
      {m && <MemberBlock merchantId={m.id} onChange={() => qc.invalidateQueries({ queryKey: ['portal-members'] })} />}
      {m && <SlabBlock merchantId={m.id} />}
      {m && <ApiBlock merchantId={m.id} />}
      {m && <Status s={m.status} />}
    </div>
  );
}

function MemberBlock({ merchantId, onChange }: { merchantId: string; onChange: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['portal-members'], queryFn: () => api('/members') });
  const [form, setForm] = useState({ name: '', mobile: '', email: '' });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/members', { method: 'POST', body: { ...form, merchantId } }),
    onSuccess: () => { setForm({ name: '', mobile: '', email: '' }); setErr(''); qc.invalidateQueries({ queryKey: ['portal-members'] }); onChange(); },
    onError: (e: any) => setErr(e.message || 'Could not add member'),
  });
  const toggle = useMutation({
    mutationFn: (m: any) => api('/members/' + m.id + '/status', { method: 'POST', body: { status: m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-members'] }),
  });
  const rows = (Array.isArray(q.data) ? q.data : []).filter((m: any) => m.merchantId === merchantId);
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3">
      <h2 className="font-bold text-slate-900">Members</h2>
      <form className="grid md:grid-cols-4 gap-3 items-end" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div><label className="label">Name</label><input className="input !rounded-xl" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Mobile</label><input className="input !rounded-xl tnum" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required /></div>
        <div><label className="label">Email</label><input className="input !rounded-xl" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <button className="btn !rounded-xl" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add member'}</button>
        {err && <p className="md:col-span-4 text-[12.5px] text-rose-600">{err}</p>}
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-slate-400 text-[11px] uppercase tracking-wide"><th className="py-2">Name</th><th>Mobile</th><th>Member id</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="py-2.5 font-semibold">{m.name}</td>
                <td className="tnum">{m.mobile}</td>
                <td className="font-mono text-[11px] text-slate-500">{m.id}</td>
                <td>{m.status}</td>
                <td className="text-right"><button type="button" className="text-[12px] font-bold text-slate-600" onClick={() => toggle.mutate(m)}>{m.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="py-6 text-slate-400">{q.isLoading ? 'Loading…' : 'No members for this merchant.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SlabBlock({ merchantId }: { merchantId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['slabs', merchantId], queryFn: () => api('/merchant-desk/' + merchantId + '/slabs') });
  const [form, setForm] = useState({ productCode: 'PAYIN', minRupees: '0', maxRupees: '', feePercent: '2' });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchantId + '/slabs', { method: 'POST', body: { ...form, maxRupees: form.maxRupees === '' ? null : Number(form.maxRupees), minRupees: Number(form.minRupees), feePercent: Number(form.feePercent) } }),
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['slabs', merchantId] }); },
    onError: (e: any) => setErr(e.message || 'Could not save slab'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api('/merchant-desk/slabs/' + id + '/remove', { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slabs', merchantId] }),
  });
  const rows = Array.isArray(q.data) ? q.data : [];
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3">
      <h2 className="font-bold text-slate-900">Commission slabs</h2>
      <p className="text-[12.5px] text-slate-500">The slab that contains the amount is charged. If none matches, the merchant's existing plan is used.</p>
      <form className="grid md:grid-cols-5 gap-3 items-end" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div><label className="label">Side</label><select className="input !rounded-xl" value={form.productCode} onChange={e => setForm({ ...form, productCode: e.target.value })}><option value="PAYIN">Pay-in</option><option value="PAYOUT">Payout</option></select></div>
        <div><label className="label">From ₹</label><input className="input !rounded-xl tnum" type="number" min={0} value={form.minRupees} onChange={e => setForm({ ...form, minRupees: e.target.value })} /></div>
        <div><label className="label">To ₹</label><input className="input !rounded-xl tnum" type="number" min={0} placeholder="No max" value={form.maxRupees} onChange={e => setForm({ ...form, maxRupees: e.target.value })} /></div>
        <div><label className="label">Commission %</label><input className="input !rounded-xl tnum" type="number" min={0} max={100} step="0.01" value={form.feePercent} onChange={e => setForm({ ...form, feePercent: e.target.value })} /></div>
        <button className="btn !rounded-xl" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add slab'}</button>
        {err && <p className="md:col-span-5 text-[12.5px] text-rose-600">{err}</p>}
      </form>
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-slate-400 text-[11px] uppercase tracking-wide"><th className="py-2">Side</th><th>From</th><th>To</th><th>%</th><th></th></tr></thead>
        <tbody>
          {rows.map((s: any) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="py-2.5 font-semibold">{s.productCode === 'PAYOUT' ? 'Payout' : 'Pay-in'}</td>
              <td className="tnum">₹{s.minRupees}</td>
              <td className="tnum">{s.maxRupees == null ? 'No max' : '₹' + s.maxRupees}</td>
              <td className="tnum">{s.feePercent}%</td>
              <td className="text-right"><button type="button" className="text-[12px] font-bold text-rose-600" onClick={() => remove.mutate(s.id)}>Remove</button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="py-6 text-slate-400">{q.isLoading ? 'Loading…' : 'No slabs yet.'}</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function ApiBlock({ merchantId }: { merchantId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['merch-apis', merchantId], queryFn: () => api('/merchant-desk/' + merchantId + '/apis') });
  const set = useMutation({
    mutationFn: (b: any) => api('/merchant-desk/' + merchantId + '/apis', { method: 'POST', body: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-apis', merchantId] }),
  });
  const data = q.data || { providers: [], rules: [], mode: 'platform' };
  const on = (productCode: string, providerId: string) => !!(data.rules || []).find((r: any) => r.productCode === productCode && r.providerId === providerId && r.isActive);
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3">
      <h2 className="font-bold text-slate-900">APIs for this merchant</h2>
      <p className="text-[12.5px] text-slate-500">{data.mode === 'merchant' ? 'Only the APIs you turn on here are used.' : 'No override yet. The platform API switch is used until you turn one on or off here.'}</p>
      <div className="grid md:grid-cols-2 gap-4">
        {(['PAYIN', 'PAYOUT'] as const).map(pc => (
          <div key={pc}>
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400 mb-2">{pc === 'PAYIN' ? 'Pay-in' : 'Payout'}</p>
            {(data.providers || []).map((p: any) => {
              const active = on(pc, p.id);
              return (
                <div key={p.id + pc} className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2 mb-2">
                  <span className="text-[13px] font-semibold">{p.name}</span>
                  <button type="button" disabled={set.isPending} onClick={() => set.mutate({ productCode: pc, providerId: p.id, active: !active })} className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{active ? 'On' : 'Off'}</button>
                </div>
              );
            })}
            {!data.providers?.length && <p className="text-[12.5px] text-slate-400">No API connected.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
