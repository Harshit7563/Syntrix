import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr } from '../api';

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const rows = Array.isArray(list.data) ? list.data : [];
  const current = rows.find((m: any) => m.id === open);
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant-desk'] });
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((m: any) => `${m.businessName || ''} ${m.email || ''}`.toLowerCase().includes(needle)) : rows;
  useEffect(() => { if (!open && rows[0]?.id) setOpen(rows[0].id); }, [rows, open]);

  return (
    <div className="w-full h-[calc(100vh-150px)] min-h-[560px] flex flex-col">
      <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 overflow-hidden flex">
        <aside className="w-[280px] shrink-0 border-r border-slate-100 flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[15px] font-bold text-slate-900">Members</p>
              <button type="button" onClick={() => setOpen('new')} className="h-8 px-3 rounded-full bg-slate-900 text-white text-[12px] font-semibold">Give</button>
            </div>
            <p className="text-[12px] text-slate-400 mb-3">API yahan se do. Member transaction karega.</p>
            <input className="w-full h-9 rounded-xl border border-slate-200 bg-[#fafafa] px-3 text-[13px] outline-none focus:bg-white focus:border-slate-400" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {list.isLoading && <p className="px-4 py-6 text-[13px] text-slate-400">Loading…</p>}
            {!list.isLoading && !shown.length && <p className="px-4 py-8 text-center text-[13px] text-slate-400">{rows.length ? 'No match.' : 'No members yet.'}</p>}
            {shown.map((m: any) => {
              const on = open === m.id;
              const n = Number(m.memberCount || 0);
              const ready = m.active && n > 0;
              return (
                <button key={m.id} type="button" onClick={() => setOpen(m.id)} className={`w-full text-left px-4 py-3 border-b border-slate-50 ${on ? 'bg-slate-50' : 'hover:bg-[#fafbfd]'}`}>
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-slate-900 truncate">{m.businessName || 'Unnamed'}</span>
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${ready ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-400 truncate">{ready ? 'Can transact' : m.active ? 'Add a person' : 'Inactive'} · {inr(m.payinPaise)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          {open === 'new' && <GiveMember onDone={id => { refresh(); setOpen(id); }} onCancel={() => setOpen(rows[0]?.id || null)} />}
          {current && <Workspace key={current.id} merchant={current} onSaved={refresh} />}
          {!open && !list.isLoading && <div className="flex-1 grid place-items-center text-[13px] text-slate-400">Select a member</div>}
        </section>
      </div>
    </div>
  );
}

function Workspace({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const n = Number(merchant.memberCount || 0);
  const ready = merchant.active && n > 0;
  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="px-6 pt-5 pb-4 flex items-start gap-3 border-b border-slate-100">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-slate-900 truncate">{merchant.businessName || 'Unnamed'}</p>
          <p className="text-[12.5px] text-slate-400 truncate mt-0.5">{merchant.email || 'No email'} · Charge pay-in {merchant.payinChargePercent ?? 0}% · payout {merchant.payoutChargePercent ?? 0}%</p>
        </div>
        <span className={`h-8 px-3 rounded-full text-[12px] font-semibold grid place-items-center ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{ready ? 'Ready' : 'Not ready'}</span>
        <ActiveToggle merchant={merchant} onSaved={onSaved} />
      </div>

      <div className="p-6 space-y-8 max-w-3xl">
        <div className="grid grid-cols-3 gap-3">
          <Money label="Pay-in wallet" value={inr(merchant.payinPaise)} />
          <Money label="Payout wallet" value={inr(merchant.payoutPaise)} />
          <Money label="Hold" value={inr(merchant.holdPaise)} />
        </div>

        <section>
          <Head title="1. Login" sub="Member isse https://syntrixapi.in/login pe aayega." />
          <LoginBlock merchant={merchant} onSaved={onSaved} />
        </section>

        <section>
          <Head title="2. Charge" sub="Jo % is member se katna hai." />
          <ChargeForm merchant={merchant} onSaved={onSaved} />
        </section>

        <section>
          <Head title="3. API" sub="Pehle APIs page pe integrate karo. Yahan is member ko do." />
          <ApiBlock merchantId={merchant.id} />
        </section>

        <section>
          <Head title="4. Who transacts" sub="Pay-in / payout isi naam pe chalegi." />
          <MemberBlock merchantId={merchant.id} onChange={onSaved} />
        </section>

        <section>
          <Head title="Move money" sub="Hold pay-in me rehta hai. Free amount payout me ja sakta hai." />
          <MoveMoney merchant={merchant} onSaved={onSaved} />
        </section>

        <p className="text-[12.5px] text-slate-400">Transaction <Link className="font-semibold text-slate-700 underline" to="/app/pay-in">Pay-in</Link> aur <Link className="font-semibold text-slate-700 underline" to="/app/payouts">Payouts</Link> pe karo — member select karke.</p>
      </div>
    </div>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <p className="text-[13.5px] font-bold text-slate-900">{title}</p>
      <p className="text-[12.5px] text-slate-400">{sub}</p>
    </div>
  );
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fafbfd] border border-slate-100 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-[16px] font-bold tnum text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function ActiveToggle({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/profile', {
      method: 'POST',
      body: {
        businessName: merchant.businessName || '',
        email: merchant.email || '',
        payinChargePercent: String(merchant.payinChargePercent ?? 0),
        payoutChargePercent: String(merchant.payoutChargePercent ?? 0),
        holdRupees: String((merchant.holdPaise || 0) / 100),
        active: !merchant.active,
      },
    }),
    onSuccess: onSaved,
  });
  return (
    <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={`h-8 px-3 rounded-full text-[12px] font-semibold ${merchant.active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
      {save.isPending ? '…' : merchant.active ? 'On' : 'Off'}
    </button>
  );
}

function GiveMember({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ businessName: '', mobile: '', email: '', password: '', payinChargePercent: '2', payoutChargePercent: '2' });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk', { method: 'POST', body: { ...form, holdRupees: '0', active: true } }),
    onSuccess: (r: any) => onDone(r.id),
    onError: (e: any) => setErr(e.message || 'Could not add member'),
  });
  return (
    <form className="flex-1 min-h-0 overflow-auto p-6" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[17px] font-bold text-slate-900">Give a member</h2>
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600">Cancel</button>
      </div>
      <p className="text-[13px] text-slate-400 mb-5 max-w-xl">Email + password se member login karega. Charge set karo. Platform API unke transactions pe lag jaayegi.</p>
      <div className="grid md:grid-cols-2 gap-4 max-w-xl">
        <Field label="Name"><input className="input" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></Field>
        <Field label="Mobile"><input className="input tnum" inputMode="numeric" maxLength={10} placeholder="10 digits" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required /></Field>
        <Field label="Login email"><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></Field>
        <Field label="Login password"><input className="input" type="text" minLength={8} placeholder="Min 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pay-in %"><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payinChargePercent} onChange={e => setForm({ ...form, payinChargePercent: e.target.value })} /></Field>
          <Field label="Payout %"><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payoutChargePercent} onChange={e => setForm({ ...form, payoutChargePercent: e.target.value })} /></Field>
        </div>
      </div>
      {err && <p className="text-[12.5px] text-rose-600 mt-3">{err}</p>}
      <button className="mt-5 h-10 px-5 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Give member'}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function LoginBlock({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [form, setForm] = useState({ email: merchant.loginEmail || merchant.email || '', password: '', mobile: merchant.loginPhone || '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/login', { method: 'POST', body: form }),
    onSuccess: () => { setErr(''); setOk(merchant.hasLogin ? 'Password updated' : 'Login created'); setForm({ ...form, password: '' }); onSaved(); setTimeout(() => setOk(''), 1800); },
    onError: (e: any) => setErr(e.message || 'Could not save login'),
  });
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      {merchant.hasLogin && <p className="w-full text-[13px] text-slate-600">Login: <span className="font-semibold text-slate-900">{merchant.loginEmail}</span>{merchant.loginPhone ? ` · ${merchant.loginPhone}` : ''} · syntrixapi.in/login</p>}
      <Field label="Email"><input className="input !w-52" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></Field>
      <Field label="Mobile"><input className="input tnum !w-36" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field>
      <Field label={merchant.hasLogin ? 'New password' : 'Password'}><input className="input !w-44" type="text" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></Field>
      <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : merchant.hasLogin ? 'Reset password' : 'Create login'}</button>
      {ok && <span className="text-[12px] font-semibold text-emerald-700 pb-2">{ok}</span>}
      {err && <p className="w-full text-[12.5px] text-rose-600">{err}</p>}
    </form>
  );
}

function ChargeForm({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: merchant.businessName || '',
    email: merchant.email || '',
    payinChargePercent: String(merchant.payinChargePercent ?? 0),
    payoutChargePercent: String(merchant.payoutChargePercent ?? 0),
    holdRupees: String((merchant.holdPaise || 0) / 100),
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/profile', { method: 'POST', body: { ...form, active: !!merchant.active } }),
    onSuccess: () => { setErr(''); setOk('Saved'); onSaved(); setTimeout(() => setOk(''), 1600); },
    onError: (e: any) => setErr(e.message || 'Could not save'),
  });
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <Field label="Name"><input className="input !w-44" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} /></Field>
      <Field label="Email"><input className="input !w-52" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Pay-in %"><input className="input tnum !w-24" type="number" min={0} max={100} step="0.01" value={form.payinChargePercent} onChange={e => setForm({ ...form, payinChargePercent: e.target.value })} /></Field>
      <Field label="Payout %"><input className="input tnum !w-24" type="number" min={0} max={100} step="0.01" value={form.payoutChargePercent} onChange={e => setForm({ ...form, payoutChargePercent: e.target.value })} /></Field>
      <Field label="Hold ₹"><input className="input tnum !w-28" type="number" min={0} step="0.01" value={form.holdRupees} onChange={e => setForm({ ...form, holdRupees: e.target.value })} /></Field>
      <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
      {ok && <span className="text-[12px] font-semibold text-emerald-700 pb-2">{ok}</span>}
      {err && <p className="w-full text-[12.5px] text-rose-600">{err}</p>}
    </form>
  );
}

function MoveMoney({ merchant, onSaved }: { merchant: any; onSaved: () => void }) {
  const [move, setMove] = useState({ amountRupees: '', direction: 'TO_PAYOUT' });
  const [err, setErr] = useState('');
  const moveAmt = useMutation({
    mutationFn: () => api('/merchant-desk/' + merchant.id + '/wallet/move', { method: 'POST', body: { amountRupees: Number(move.amountRupees), direction: move.direction } }),
    onSuccess: () => { setErr(''); setMove({ ...move, amountRupees: '' }); onSaved(); },
    onError: (e: any) => setErr(e.message || 'Could not move amount'),
  });
  return (
    <form onSubmit={e => { e.preventDefault(); moveAmt.mutate(); }}>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Amount ₹">
          <input className="input tnum w-40" type="number" min={0} step="0.01" value={move.amountRupees} onChange={e => setMove({ ...move, amountRupees: e.target.value })} required />
        </Field>
        <select className="input !w-auto" value={move.direction} onChange={e => setMove({ ...move, direction: e.target.value })}>
          <option value="TO_PAYOUT">Pay-in → Payout</option>
          <option value="TO_PAYIN">Payout → Pay-in</option>
        </select>
        <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={moveAmt.isPending}>{moveAmt.isPending ? 'Moving…' : 'Move'}</button>
      </div>
      <p className="text-[12px] text-slate-400 mt-2">Free to move {inr(merchant.freePayinPaise)}</p>
      {err && <p className="text-[12.5px] text-rose-600 mt-2">{err}</p>}
    </form>
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
    onError: (e: any) => setErr(e.message || 'Could not add'),
  });
  const toggle = useMutation({
    mutationFn: (m: any) => api('/members/' + m.id + '/status', { method: 'POST', body: { status: m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-members'] }),
  });
  const rows = (Array.isArray(q.data) ? q.data : []).filter((m: any) => m.merchantId === merchantId);
  return (
    <div>
      <form className="flex flex-wrap items-center gap-2 mb-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <input className="input !w-40" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="input !w-36 tnum" placeholder="Mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
        <input className="input !w-48" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add person'}</button>
      </form>
      {err && <p className="text-[12.5px] text-rose-600 mb-3">{err}</p>}
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="text-left text-[12px] text-slate-400 border-b border-slate-100">
            <th className="py-2.5 font-medium">Name</th>
            <th className="py-2.5 font-medium">Mobile</th>
            <th className="py-2.5 font-medium">Email</th>
            <th className="py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m: any) => (
            <tr key={m.id} className="border-b border-slate-50 last:border-0">
              <td className="py-3 font-semibold text-slate-900">{m.name}</td>
              <td className="py-3 tnum text-slate-600">{m.mobile}</td>
              <td className="py-3 text-slate-500">{m.email || '—'}</td>
              <td className="py-3">
                <button type="button" disabled={toggle.isPending} onClick={() => toggle.mutate(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{m.status === 'ACTIVE' ? 'Can transact' : 'Stopped'}</button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={4} className="py-8 text-center text-[13px] text-slate-400">{q.isLoading ? 'Loading…' : 'Is member ke naam pe koi person nahi. Upar se add karo.'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ApiBlock({ merchantId }: { merchantId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['merch-apis', merchantId], queryFn: () => api('/merchant-desk/' + merchantId + '/apis') });
  const set = useMutation({
    mutationFn: (b: any) => api('/merchant-desk/' + merchantId + '/apis', { method: 'POST', body: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-apis', merchantId] }),
  });
  const data = q.data || { providers: [], using: {}, mode: 'platform' };
  const providers: any[] = data.providers || [];
  return (
    <div>
      {!providers.length && <p className="text-[13px] text-slate-400 py-4">{q.isLoading ? 'Loading…' : 'Pehle APIs page pe ORVIAN connect karo.'}</p>}
      {!!providers.length && (['PAYIN', 'PAYOUT'] as const).map(pc => {
        const live = data.using?.[pc] || {};
        const pid = live.providerId || '';
        const on = !!live.providerId;
        return (
          <div key={pc} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-slate-900">{pc === 'PAYIN' ? 'Pay-in' : 'Payout'}</p>
              <p className="text-[12px] text-slate-400 truncate">{on ? `${live.name} · ${live.source === 'member' ? 'Given to this member' : 'From platform'}` : 'No API on this product'}</p>
            </div>
            {providers.length > 1 ? (
              <select className="input !w-auto !py-1.5 !rounded-xl text-[12.5px]" disabled={set.isPending} value={pid} onChange={e => set.mutate({ productCode: pc, providerId: e.target.value, active: true })}>
                {!pid && <option value="">Select API</option>}
                {providers.map((p: any) => <option key={p.id} value={p.id}>{String(p.name || '').split(' (')[0]}</option>)}
              </select>
            ) : (
              <span className={`text-[12px] font-semibold ${on ? 'text-emerald-700' : 'text-slate-400'}`}>{on ? 'On' : 'Off'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
