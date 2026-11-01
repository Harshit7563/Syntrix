import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr } from '../api';

const card = 'bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)]';
const avatars = ['#111', '#f4a28c', '#9ad4b5', '#9ec5e8', '#c9b8e8', '#f0c96a'];

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const [open, setOpen] = useState<string | null>(null);
  const rows = Array.isArray(list.data) ? list.data : [];
  const current = rows.find((m: any) => m.id === open);
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant-desk'] });
  const sum = (k: string) => rows.reduce((a: number, m: any) => a + Number(m[k] || 0), 0);
  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black tracking-tight text-slate-900">Merchant</h1>
          <p className="text-[13px] text-slate-500 mt-1">{rows.length} merchant{rows.length === 1 ? '' : 's'} · charges, wallet hold, and members</p>
        </div>
        {open ? (
          <button type="button" className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700" onClick={() => setOpen(null)}>All merchants</button>
        ) : (
          <button type="button" className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-semibold" onClick={() => setOpen('new')}>Add merchant</button>
        )}
      </div>

      {!open && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat label="Pay-in wallets" value={inr(sum('payinPaise'))} tone="bg-[#fdf0ea]" />
            <Stat label="Payout wallets" value={inr(sum('payoutPaise'))} tone="bg-[#eaf7f0]" />
            <Stat label="On hold" value={inr(sum('holdPaise'))} tone="bg-[#eef0f6]" />
          </div>
          {list.isLoading && <div className="h-28 rounded-[22px] bg-slate-200/50 animate-pulse" />}
          {!list.isLoading && !rows.length && <div className={`${card} py-16 text-center text-[13px] text-slate-400`}>No merchants yet. Add the first one.</div>}
          <div className="grid gap-3">
            {rows.map((m: any, i: number) => (
              <article key={m.id} className={`${card} p-4 flex flex-col lg:flex-row lg:items-center gap-4`}>
                <div className="flex items-center gap-3 min-w-0 lg:w-[240px]">
                  <span className="w-11 h-11 rounded-2xl text-white grid place-items-center text-[15px] font-extrabold shrink-0" style={{ background: avatars[i % avatars.length] }}>{(m.businessName || '?').charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{m.businessName || 'Unnamed'}</p>
                    <p className="text-[12px] text-slate-400 truncate">{m.email || 'No email'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 flex-1">
                  <Mini k="Pay-in charge" v={`${m.payinChargePercent}%`} />
                  <Mini k="Payout charge" v={`${m.payoutChargePercent}%`} />
                  <Mini k="Pay-in wallet" v={inr(m.payinPaise)} />
                  <Mini k="Payout wallet" v={inr(m.payoutPaise)} />
                  <Mini k="Hold" v={inr(m.holdPaise)} />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{m.active ? 'Active' : 'Inactive'}</span>
                  <button type="button" className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold" onClick={() => setOpen(m.id)}>Edit</button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {open === 'new' && <CreateMerchant onDone={id => { refresh(); setOpen(id); }} />}
      {current && <Editor key={current.id} merchant={current} onSaved={refresh} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 inline-block rounded-2xl px-3 py-1.5 text-[18px] font-black tnum text-slate-900 ${tone}`}>{value}</p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f8fa] px-3 py-2">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{k}</p>
      <p className="text-[14px] font-bold tnum text-slate-900 mt-0.5">{v}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function CreateMerchant({ onDone }: { onDone: (id: string) => void }) {
  const [form, setForm] = useState({ businessName: '', email: '', payinChargePercent: '2', payoutChargePercent: '2', holdRupees: '0', active: true });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk', { method: 'POST', body: form }),
    onSuccess: (r: any) => onDone(r.id),
    onError: (e: any) => setErr(e.message || 'Could not add merchant'),
  });
  return (
    <form className={`${card} p-5 space-y-4`} onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <h2 className="font-bold text-slate-900">New merchant</h2>
      <MerchantFields form={form} setForm={setForm} />
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
      <button className="h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Create merchant'}</button>
    </form>
  );
}

function MerchantFields({ form, setForm }: { form: any; setForm: (v: any) => void }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      <Field label="Name"><input className="input !rounded-xl" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></Field>
      <Field label="Email"><input className="input !rounded-xl" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="API charge pay-in %"><input className="input !rounded-xl tnum" type="number" min={0} max={100} step="0.01" value={form.payinChargePercent} onChange={e => setForm({ ...form, payinChargePercent: e.target.value })} /></Field>
      <Field label="API charge payout %"><input className="input !rounded-xl tnum" type="number" min={0} max={100} step="0.01" value={form.payoutChargePercent} onChange={e => setForm({ ...form, payoutChargePercent: e.target.value })} /></Field>
      <Field label="Wallet hold ₹"><input className="input !rounded-xl tnum" type="number" min={0} step="0.01" value={form.holdRupees} onChange={e => setForm({ ...form, holdRupees: e.target.value })} /></Field>
      <div className="flex items-end pb-1">
        <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`h-11 px-4 rounded-xl text-[13px] font-bold ${form.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{form.active ? 'Active' : 'Inactive'}</button>
      </div>
    </div>
  );
}

function Editor({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  return (
    <div className="space-y-4">
      <ProfileBlock merchant={merchant} onSaved={onSaved} />
      <WalletBlock merchant={merchant} onSaved={onSaved} />
      <div className="grid xl:grid-cols-2 gap-4">
        <ApiBlock merchantId={merchant.id} />
        <MemberBlock merchantId={merchant.id} onChange={onSaved} />
      </div>
    </div>
  );
}

function ProfileBlock({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: merchant.businessName || '',
    email: merchant.email || '',
    payinChargePercent: String(merchant.payinChargePercent ?? 0),
    payoutChargePercent: String(merchant.payoutChargePercent ?? 0),
    holdRupees: String((merchant.holdPaise || 0) / 100),
    active: !!merchant.active,
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/profile', { method: 'POST', body: form }),
    onSuccess: () => { setErr(''); setOk('Saved'); onSaved(); setTimeout(() => setOk(''), 1600); },
    onError: (e: any) => setErr(e.message || 'Could not save'),
  });
  return (
    <form className={`${card} p-5 space-y-4`} onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900">Details</h2>
        <div className="flex items-center gap-3">
          {ok && <span className="text-[12px] font-semibold text-emerald-700">{ok}</span>}
          <button className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <MerchantFields form={form} setForm={setForm} />
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
    </form>
  );
}

function WalletBlock({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [move, setMove] = useState({ amountRupees: '', direction: 'TO_PAYOUT' });
  const [err, setErr] = useState('');
  const moveAmt = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/wallet/move', { method: 'POST', body: { amountRupees: Number(move.amountRupees), direction: move.direction } }),
    onSuccess: () => { setErr(''); setMove({ ...move, amountRupees: '' }); onSaved(); },
    onError: (e: any) => setErr(e.message || 'Could not move amount'),
  });
  const cards = [
    ['Pay-in wallet', inr(merchant.payinPaise), 'bg-[#fdf0ea]'],
    ['Payout wallet', inr(merchant.payoutPaise), 'bg-[#eaf7f0]'],
    ['On hold', inr(merchant.holdPaise), 'bg-[#eef0f6]'],
    ['Free to move', inr(merchant.freePayinPaise), 'bg-white'],
  ];
  return (
    <section className={`${card} p-5 space-y-4`}>
      <h2 className="font-bold text-slate-900">Wallet</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([label, value, tone]) => (
          <div key={label} className={`rounded-2xl border border-slate-100 px-4 py-3 ${tone}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-[20px] font-black tnum text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); moveAmt.mutate(); }}>
        <Field label="Amount ₹"><input className="input !rounded-xl tnum w-36" type="number" min={0} step="0.01" value={move.amountRupees} onChange={e => setMove({ ...move, amountRupees: e.target.value })} required /></Field>
        <Field label="Move"><select className="input !rounded-xl" value={move.direction} onChange={e => setMove({ ...move, direction: e.target.value })}><option value="TO_PAYOUT">Pay-in → Payout</option><option value="TO_PAYIN">Payout → Pay-in</option></select></Field>
        <button className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={moveAmt.isPending}>{moveAmt.isPending ? 'Moving…' : 'Move'}</button>
      </form>
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
    <section className={`${card} p-5 space-y-3`}>
      <div>
        <h2 className="font-bold text-slate-900">Members</h2>
        <p className="text-[12.5px] text-slate-400 mt-0.5">A pay-in or payout needs one of these member ids.</p>
      </div>
      <form className="grid sm:grid-cols-2 gap-2" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <input className="input !rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="input !rounded-xl tnum" placeholder="Mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
        <input className="input !rounded-xl sm:col-span-2" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <button className="h-10 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold sm:col-span-2 disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add member'}</button>
        {err && <p className="sm:col-span-2 text-[12.5px] text-rose-600">{err}</p>}
      </form>
      <div className="space-y-2">
        {rows.map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-[#f7f8fa] px-3 py-2.5">
            <span className="w-8 h-8 rounded-xl bg-slate-900 text-white grid place-items-center text-[12px] font-bold shrink-0">{m.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-900 truncate">{m.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{m.mobile}{m.email ? ' · ' + m.email : ''}</p>
            </div>
            <button type="button" disabled={toggle.isPending} onClick={() => toggle.mutate(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${m.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>{m.status === 'ACTIVE' ? 'Active' : 'Inactive'}</button>
          </div>
        ))}
        {!rows.length && <p className="text-[12.5px] text-slate-400 py-4 text-center">{q.isLoading ? 'Loading…' : 'No members yet.'}</p>}
      </div>
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
    <section className={`${card} p-5 space-y-3`}>
      <div>
        <h2 className="font-bold text-slate-900">APIs</h2>
        <p className="text-[12.5px] text-slate-400 mt-0.5">{data.mode === 'merchant' ? 'Only the ones switched on here are used.' : 'Platform switch is used until you set one here.'}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {(['PAYIN', 'PAYOUT'] as const).map(pc => (
          <div key={pc}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{pc === 'PAYIN' ? 'Pay-in' : 'Payout'}</p>
            {(data.providers || []).map((p: any) => {
              const active = on(pc, p.id);
              return (
                <button key={p.id + pc} type="button" disabled={set.isPending} onClick={() => set.mutate({ productCode: pc, providerId: p.id, active: !active })} className="w-full flex items-center justify-between rounded-2xl bg-[#f7f8fa] px-3 py-2.5 mb-2 text-left">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{String(p.name || '').split(' (')[0]}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-400'}`}>{active ? 'On' : 'Off'}</span>
                </button>
              );
            })}
            {!data.providers?.length && <p className="text-[12.5px] text-slate-400">No API connected.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
