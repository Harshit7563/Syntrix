import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr, Status } from '../api';

const STATUSES = ['APPROVED', 'UNDER_REVIEW', 'SUSPENDED', 'REJECTED', 'DRAFT'];

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const [open, setOpen] = useState<string | null>(null);
  const rows = Array.isArray(list.data) ? list.data : [];
  const current = rows.find((m: any) => m.id === open);
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant-desk'] });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black tracking-tight text-slate-900">Merchant</h1>
          <p className="text-[13px] text-slate-500 mt-1">Add a merchant, edit it, choose its APIs, set commission slabs, and run the wallet.</p>
        </div>
        {open ? (
          <button type="button" className="btn-ghost !rounded-xl" onClick={() => setOpen(null)}>All merchants</button>
        ) : (
          <button type="button" className="btn !rounded-xl" onClick={() => setOpen('new')}>Add merchant</button>
        )}
      </div>
      {!open && <MerchantTable rows={rows} loading={list.isLoading} onEdit={setOpen} />}
      {open === 'new' && <CreateMerchant onDone={id => { refresh(); setOpen(id); }} />}
      {current && <Editor key={current.id} merchant={current} onSaved={refresh} />}
    </div>
  );
}

function MerchantTable({ rows, loading, onEdit }: { rows: any[]; loading: boolean; onEdit: (id: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-slate-400 text-[11px] uppercase tracking-wide">
            <th className="pl-5 py-3">Merchant</th><th>Status</th><th>Pay-in</th><th>Payout</th><th>Hold</th><th>Members</th><th className="pr-5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id} className="border-t border-slate-100">
              <td className="pl-5 py-3 font-semibold text-slate-900">{m.businessName || 'Unnamed'}</td>
              <td><Status s={m.status} /></td>
              <td className="tnum">{inr(m.payinPaise)}</td>
              <td className="tnum">{inr(m.payoutPaise)}</td>
              <td className="tnum">{inr(m.holdPaise)}</td>
              <td className="tnum">{m.memberCount}</td>
              <td className="pr-5 text-right"><button type="button" className="text-[12px] font-bold text-slate-700" onClick={() => onEdit(m.id)}>Edit</button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="px-5 py-8 text-slate-400">{loading ? 'Loading…' : 'No merchants yet.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CreateMerchant({ onDone }: { onDone: (id: string) => void }) {
  const [form, setForm] = useState({ businessName: '', gst: '', website: '', entityType: '', productionEnabled: false });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk', { method: 'POST', body: form }),
    onSuccess: (r: any) => onDone(r.id),
    onError: (e: any) => setErr(e.message || 'Could not add merchant'),
  });
  return (
    <form className="bg-white rounded-2xl border border-slate-200/80 p-4 grid md:grid-cols-4 gap-3 items-end" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div><label className="label">Name</label><input className="input !rounded-xl" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></div>
      <div><label className="label">Entity</label><input className="input !rounded-xl" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })} placeholder="Private Limited" /></div>
      <div><label className="label">GST</label><input className="input !rounded-xl" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
      <div><label className="label">Website</label><input className="input !rounded-xl" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
      <label className="md:col-span-2 flex items-center gap-2 text-[13px] font-semibold text-slate-700"><input type="checkbox" checked={form.productionEnabled} onChange={e => setForm({ ...form, productionEnabled: e.target.checked })} /> Production on</label>
      <button className="btn !rounded-xl md:col-span-2" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Create merchant'}</button>
      {err && <p className="md:col-span-4 text-[12.5px] text-rose-600">{err}</p>}
    </form>
  );
}

function Editor({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  return (
    <div className="space-y-4">
      <ProfileBlock merchant={merchant} onSaved={onSaved} />
      <WalletBlock merchant={merchant} onSaved={onSaved} />
      <ApiBlock merchantId={merchant.id} />
      <SlabBlock merchantId={merchant.id} />
      <MemberBlock merchantId={merchant.id} onChange={onSaved} />
    </div>
  );
}

function ProfileBlock({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: merchant.businessName || '',
    entityType: merchant.entityType || '',
    gst: merchant.gst || '',
    website: merchant.website || '',
    status: merchant.status || 'APPROVED',
    sandboxEnabled: !!merchant.sandboxEnabled,
    productionEnabled: !!merchant.productionEnabled,
  });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/profile', { method: 'POST', body: form }),
    onSuccess: () => { setErr(''); onSaved(); },
    onError: (e: any) => setErr(e.message || 'Could not save'),
  });
  return (
    <form className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <h2 className="font-bold text-slate-900">Merchant details</h2>
      <div className="grid md:grid-cols-4 gap-3">
        <div><label className="label">Name</label><input className="input !rounded-xl" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></div>
        <div><label className="label">Entity</label><input className="input !rounded-xl" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })} /></div>
        <div><label className="label">GST</label><input className="input !rounded-xl" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
        <div><label className="label">Website</label><input className="input !rounded-xl" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
        <div><label className="label">Status</label><select className="input !rounded-xl" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <label className="flex items-center gap-2 text-[13px] font-semibold mt-6"><input type="checkbox" checked={form.sandboxEnabled} onChange={e => setForm({ ...form, sandboxEnabled: e.target.checked })} /> Sandbox</label>
        <label className="flex items-center gap-2 text-[13px] font-semibold mt-6"><input type="checkbox" checked={form.productionEnabled} onChange={e => setForm({ ...form, productionEnabled: e.target.checked })} /> Production</label>
        <button className="btn !rounded-xl mt-5" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save merchant'}</button>
      </div>
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
    </form>
  );
}

function WalletBlock({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [hold, setHold] = useState(String((merchant.holdPaise || 0) / 100));
  const [move, setMove] = useState({ amountRupees: '', direction: 'TO_PAYOUT' });
  const [err, setErr] = useState('');
  const setHoldAmt = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/wallet/hold', { method: 'POST', body: { holdRupees: Number(hold) } }),
    onSuccess: () => { setErr(''); onSaved(); },
    onError: (e: any) => setErr(e.message || 'Could not set hold'),
  });
  const moveAmt = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/wallet/move', { method: 'POST', body: { amountRupees: Number(move.amountRupees), direction: move.direction } }),
    onSuccess: () => { setErr(''); setMove({ ...move, amountRupees: '' }); onSaved(); },
    onError: (e: any) => setErr(e.message || 'Could not move amount'),
  });
  const cards = [
    ['Pay-in wallet', inr(merchant.payinPaise), 'Collected, after fee'],
    ['Payout wallet', inr(merchant.payoutPaise), 'Ready to pay out'],
    ['On hold', inr(merchant.holdPaise), 'Stays in pay-in'],
    ['Free to move', inr(merchant.freePayinPaise), 'Pay-in minus hold'],
  ];
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-4">
      <h2 className="font-bold text-slate-900">Wallet</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-[18px] font-black tnum text-slate-900 mt-1">{value}</p>
            <p className="text-[11.5px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); setHoldAmt.mutate(); }}>
          <div><label className="label">Hold in pay-in wallet (₹)</label><input className="input !rounded-xl tnum w-40" type="number" min={0} step="0.01" value={hold} onChange={e => setHold(e.target.value)} /></div>
          <button className="btn !rounded-xl" disabled={setHoldAmt.isPending}>{setHoldAmt.isPending ? 'Saving…' : 'Set hold'}</button>
        </form>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); moveAmt.mutate(); }}>
          <div><label className="label">Move amount (₹)</label><input className="input !rounded-xl tnum w-36" type="number" min={0} step="0.01" value={move.amountRupees} onChange={e => setMove({ ...move, amountRupees: e.target.value })} required /></div>
          <div><label className="label">Direction</label><select className="input !rounded-xl" value={move.direction} onChange={e => setMove({ ...move, direction: e.target.value })}><option value="TO_PAYOUT">Pay-in → Payout</option><option value="TO_PAYIN">Payout → Pay-in</option></select></div>
          <button className="btn !rounded-xl" disabled={moveAmt.isPending}>{moveAmt.isPending ? 'Moving…' : 'Move'}</button>
        </form>
      </div>
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
    </section>
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
      <p className="text-[12.5px] text-slate-500">Pay-in and payout use this member id. A transaction cannot be created without one.</p>
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
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['slabs', merchantId] });
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchantId + '/slabs', { method: 'POST', body: { ...form, maxRupees: form.maxRupees === '' ? null : Number(form.maxRupees), minRupees: Number(form.minRupees), feePercent: Number(form.feePercent) } }),
    onSuccess: () => { setErr(''); refresh(); },
    onError: (e: any) => setErr(e.message || 'Could not save slab'),
  });
  const update = useMutation({
    mutationFn: () => api('/merchant-desk/slabs/' + edit.id, { method: 'POST', body: { ...edit, maxRupees: edit.maxRupees === '' || edit.maxRupees == null ? null : Number(edit.maxRupees), minRupees: Number(edit.minRupees), feePercent: Number(edit.feePercent) } }),
    onSuccess: () => { setEdit(null); setErr(''); refresh(); },
    onError: (e: any) => setErr(e.message || 'Could not update slab'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api('/merchant-desk/slabs/' + id + '/remove', { method: 'POST', body: {} }),
    onSuccess: () => refresh(),
  });
  const rows = Array.isArray(q.data) ? q.data : [];
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3">
      <h2 className="font-bold text-slate-900">Commission slabs</h2>
      <p className="text-[12.5px] text-slate-500">The slab that contains the amount is charged. Edit a row, or add a new range.</p>
      <form className="grid md:grid-cols-5 gap-3 items-end" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <div><label className="label">Side</label><select className="input !rounded-xl" value={form.productCode} onChange={e => setForm({ ...form, productCode: e.target.value })}><option value="PAYIN">Pay-in</option><option value="PAYOUT">Payout</option></select></div>
        <div><label className="label">From ₹</label><input className="input !rounded-xl tnum" type="number" min={0} value={form.minRupees} onChange={e => setForm({ ...form, minRupees: e.target.value })} /></div>
        <div><label className="label">To ₹</label><input className="input !rounded-xl tnum" type="number" min={0} placeholder="No max" value={form.maxRupees} onChange={e => setForm({ ...form, maxRupees: e.target.value })} /></div>
        <div><label className="label">Commission %</label><input className="input !rounded-xl tnum" type="number" min={0} max={100} step="0.01" value={form.feePercent} onChange={e => setForm({ ...form, feePercent: e.target.value })} /></div>
        <button className="btn !rounded-xl" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add slab'}</button>
      </form>
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-slate-400 text-[11px] uppercase tracking-wide"><th className="py-2">Side</th><th>From</th><th>To</th><th>%</th><th></th></tr></thead>
        <tbody>
          {rows.map((s: any) => edit?.id === s.id ? (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="py-2"><select className="input !rounded-xl !py-1" value={edit.productCode} onChange={e => setEdit({ ...edit, productCode: e.target.value })}><option value="PAYIN">Pay-in</option><option value="PAYOUT">Payout</option></select></td>
              <td><input className="input !rounded-xl !py-1 tnum w-24" type="number" min={0} value={edit.minRupees} onChange={e => setEdit({ ...edit, minRupees: e.target.value })} /></td>
              <td><input className="input !rounded-xl !py-1 tnum w-24" type="number" min={0} placeholder="No max" value={edit.maxRupees ?? ''} onChange={e => setEdit({ ...edit, maxRupees: e.target.value })} /></td>
              <td><input className="input !rounded-xl !py-1 tnum w-20" type="number" min={0} step="0.01" value={edit.feePercent} onChange={e => setEdit({ ...edit, feePercent: e.target.value })} /></td>
              <td className="text-right whitespace-nowrap"><button type="button" className="text-[12px] font-bold text-slate-900 mr-3" onClick={() => update.mutate()}>Save</button><button type="button" className="text-[12px] font-bold text-slate-400" onClick={() => setEdit(null)}>Cancel</button></td>
            </tr>
          ) : (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="py-2.5 font-semibold">{s.productCode === 'PAYOUT' ? 'Payout' : 'Pay-in'}</td>
              <td className="tnum">₹{s.minRupees}</td>
              <td className="tnum">{s.maxRupees == null ? 'No max' : '₹' + s.maxRupees}</td>
              <td className="tnum">{s.feePercent}%</td>
              <td className="text-right whitespace-nowrap"><button type="button" className="text-[12px] font-bold text-slate-700 mr-3" onClick={() => setEdit({ ...s })}>Edit</button><button type="button" className="text-[12px] font-bold text-rose-600" onClick={() => remove.mutate(s.id)}>Remove</button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="py-6 text-slate-400">{q.isLoading ? 'Loading…' : 'No slabs yet.'}</td></tr>}
        </tbody>
      </table>
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
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
      <p className="text-[12.5px] text-slate-500">{data.mode === 'merchant' ? 'Only the APIs switched on here are used for this merchant.' : 'Nothing is assigned yet. The platform API switch is used until you turn one on or off here.'}</p>
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
