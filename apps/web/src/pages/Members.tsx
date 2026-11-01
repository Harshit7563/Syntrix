import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function Members() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['portal-members'], queryFn: () => api('/members') });
  const [form, setForm] = useState({ name: '', mobile: '', email: '' });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/members', { method: 'POST', body: form }),
    onSuccess: () => { setForm({ name: '', mobile: '', email: '' }); setErr(''); qc.invalidateQueries({ queryKey: ['portal-members'] }); },
    onError: (e: any) => setErr(e.message || 'Could not add member'),
  });
  const toggle = useMutation({
    mutationFn: (m: any) => api('/members/' + m.id + '/status', { method: 'POST', body: { status: m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-members'] }),
  });
  const rows = Array.isArray(q.data) ? q.data : [];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-slate-900">Members</h1>
        <p className="text-[13px] text-slate-500 mt-1">People linked to pay-in and payout. The pay-in list shows this name.</p>
      </div>
      <form className="bg-white rounded-2xl border border-slate-200/80 p-4 grid md:grid-cols-4 gap-3 items-end" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div><label className="label">Name</label><input className="input !rounded-xl" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Mobile</label><input className="input !rounded-xl tnum" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required /></div>
        <div><label className="label">Email</label><input className="input !rounded-xl" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <button className="btn !rounded-xl" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add member'}</button>
        {err && <p className="md:col-span-4 text-[12.5px] text-rose-600">{err}</p>}
      </form>
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-slate-400 text-[11px] uppercase tracking-wide"><th className="pl-5 py-3">Name</th><th className="py-3">Mobile</th><th className="py-3">Email</th><th className="py-3">Status</th><th className="py-3 pr-5"></th></tr></thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="pl-5 py-3 font-semibold text-slate-900">{m.name}</td>
                <td className="py-3 tnum">{m.mobile}</td>
                <td className="py-3 text-slate-500">{m.email || '—'}</td>
                <td className="py-3">{m.status}</td>
                <td className="py-3 pr-5 text-right"><button type="button" className="text-[12px] font-bold text-slate-600" onClick={() => toggle.mutate(m)}>{m.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-5 py-8 text-slate-400">{q.isLoading ? 'Loading…' : 'No members yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
