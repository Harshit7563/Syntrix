import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr } from '../api';

type Tab = 'wallet' | 'charges' | 'apis' | 'members';

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const members = useQuery({ queryKey: ['portal-members'], queryFn: () => api('/members') });
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('wallet');
  const [q, setQ] = useState('');
  const rows = Array.isArray(list.data) ? list.data : [];
  const current = rows.find((m: any) => m.id === open);
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant-desk'] });
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((m: any) => `${m.businessName || ''} ${m.email || ''}`.toLowerCase().includes(needle)) : rows;
  const memberCount = (id: string) => (Array.isArray(members.data) ? members.data : []).filter((m: any) => m.merchantId === id).length;
  useEffect(() => { if (!open && rows[0]?.id) setOpen(rows[0].id); }, [rows, open]);

  return (
    <div className="w-full h-[calc(100vh-150px)] min-h-[560px] flex flex-col">
      <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 overflow-hidden flex">
        <aside className="w-[280px] shrink-0 border-r border-slate-100 flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-bold text-slate-900">Merchants</p>
              <button type="button" onClick={() => setOpen('new')} className="h-8 px-3 rounded-full bg-slate-900 text-white text-[12px] font-semibold">Add</button>
            </div>
            <input className="w-full h-9 rounded-xl border border-slate-200 bg-[#fafafa] px-3 text-[13px] outline-none focus:bg-white focus:border-slate-400" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {list.isLoading && <p className="px-4 py-6 text-[13px] text-slate-400">Loading…</p>}
            {!list.isLoading && !shown.length && <p className="px-4 py-8 text-center text-[13px] text-slate-400">{rows.length ? 'No match.' : 'No merchants yet.'}</p>}
            {shown.map((m: any) => {
              const on = open === m.id;
              return (
                <button key={m.id} type="button" onClick={() => { setOpen(m.id); setTab('wallet'); }} className={`w-full text-left px-4 py-3 border-b border-slate-50 ${on ? 'bg-slate-50' : 'hover:bg-[#fafbfd]'}`}>
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-slate-900 truncate">{m.businessName || 'Unnamed'}</span>
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${m.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-400 truncate">{m.email || 'No email'} · {memberCount(m.id)} member{memberCount(m.id) === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          {open === 'new' && <CreateMerchant onDone={id => { refresh(); setOpen(id); setTab('wallet'); }} onCancel={() => setOpen(rows[0]?.id || null)} />}
          {current && <Workspace key={current.id} merchant={current} tab={tab} setTab={setTab} onSaved={refresh} />}
          {!open && !list.isLoading && <div className="flex-1 grid place-items-center text-[13px] text-slate-400">Select a merchant</div>}
        </section>
      </div>
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: [Tab, string][] = [['wallet', 'Wallet'], ['charges', 'Charges'], ['apis', 'APIs'], ['members', 'Members']];
  return (
    <div className="shrink-0 flex gap-1 px-6 border-b border-slate-100">
      {items.map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={`relative px-3 pb-3 pt-1 text-[13.5px] whitespace-nowrap ${tab === k ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium hover:text-slate-700'}`}>
          {l}
          {tab === k && <span className="absolute inset-x-2 bottom-0 h-[2px] bg-slate-900 rounded-full" />}
        </button>
      ))}
    </div>
  );
}

function Workspace({ merchant, tab, setTab, onSaved }: { merchant: any; tab: Tab; setTab: (t: Tab) => void; onSaved: () => void }) {
  return (
    <>
      <div className="shrink-0 px-6 pt-5 pb-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-slate-900 truncate">{merchant.businessName || 'Unnamed'}</p>
          <p className="text-[12.5px] text-slate-400 truncate">{merchant.email || 'No email'} · Pay-in {merchant.payinChargePercent ?? 0}% · Payout {merchant.payoutChargePercent ?? 0}%</p>
        </div>
        <ActiveToggle merchant={merchant} onSaved={onSaved} />
      </div>
      <Tabs tab={tab} setTab={setTab} />
      <div className="flex-1 min-h-0 overflow-auto p-6">
        {tab === 'wallet' && <WalletBlock merchant={merchant} onSaved={onSaved} />}
        {tab === 'charges' && <ProfileBlock merchant={merchant} onSaved={onSaved} />}
        {tab === 'apis' && <ApiBlock merchantId={merchant.id} />}
        {tab === 'members' && <MemberBlock merchantId={merchant.id} onChange={onSaved} />}
      </div>
    </>
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
    <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={`h-8 px-3 rounded-full text-[12px] font-semibold ${merchant.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
      {save.isPending ? '…' : merchant.active ? 'Active' : 'Inactive'}
    </button>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function CreateMerchant({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ businessName: '', email: '', payinChargePercent: '2', payoutChargePercent: '2', holdRupees: '0', active: true });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api('/merchant-desk', { method: 'POST', body: form }),
    onSuccess: (r: any) => onDone(r.id),
    onError: (e: any) => setErr(e.message || 'Could not add merchant'),
  });
  return (
    <form className="flex-1 min-h-0 overflow-auto p-6" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[17px] font-bold text-slate-900">New merchant</h2>
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600">Cancel</button>
      </div>
      <MerchantFields form={form} setForm={setForm} />
      {err && <p className="text-[12.5px] text-rose-600 mt-3">{err}</p>}
      <button className="mt-5 h-10 px-5 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Create merchant'}</button>
    </form>
  );
}

function MerchantFields({ form, setForm }: { form: any; setForm: (v: any) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
      <Field label="Name"><input className="input" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></Field>
      <Field label="Email"><input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="API charge pay-in %"><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payinChargePercent} onChange={e => setForm({ ...form, payinChargePercent: e.target.value })} /></Field>
      <Field label="API charge payout %"><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payoutChargePercent} onChange={e => setForm({ ...form, payoutChargePercent: e.target.value })} /></Field>
      <Field label="Wallet hold ₹"><input className="input tnum" type="number" min={0} step="0.01" value={form.holdRupees} onChange={e => setForm({ ...form, holdRupees: e.target.value })} /></Field>
      <div className="flex items-end">
        <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`h-10 px-4 rounded-full text-[13px] font-semibold ${form.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{form.active ? 'Active' : 'Inactive'}</button>
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
    <form className="max-w-2xl" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-slate-400">Name, charges and hold.</p>
        <div className="flex items-center gap-3">
          {ok && <span className="text-[12px] font-semibold text-emerald-700">{ok}</span>}
          <button className="h-9 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <MerchantFields form={form} setForm={setForm} />
      {err && <p className="text-[12.5px] text-rose-600 mt-3">{err}</p>}
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
  const rows = [
    ['Pay-in', inr(merchant.payinPaise)],
    ['Payout', inr(merchant.payoutPaise)],
    ['Hold', inr(merchant.holdPaise)],
    ['Free to move', inr(merchant.freePayinPaise)],
  ];
  return (
    <div className="max-w-xl">
      <dl className="divide-y divide-slate-100 border-y border-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-3">
            <dt className="text-[13px] text-slate-500">{label}</dt>
            <dd className="text-[15px] font-semibold tnum text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <form className="mt-6" onSubmit={e => { e.preventDefault(); moveAmt.mutate(); }}>
        <p className="text-[13px] font-semibold text-slate-900 mb-3">Move money</p>
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
        <p className="text-[12px] text-slate-400 mt-3">Hold stays in pay-in. Only the free amount can move.</p>
        {err && <p className="text-[12.5px] text-rose-600 mt-2">{err}</p>}
      </form>
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
    <div className="max-w-2xl">
      <form className="flex flex-wrap items-center gap-2 mb-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <input className="input !w-40" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="input !w-36 tnum" placeholder="Mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
        <input className="input !w-48" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add member'}</button>
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
                <button type="button" disabled={toggle.isPending} onClick={() => toggle.mutate(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{m.status === 'ACTIVE' ? 'Active' : 'Inactive'}</button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={4} className="py-10 text-center text-[13px] text-slate-400">{q.isLoading ? 'Loading…' : 'No members yet. A pay-in needs one.'}</td></tr>
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
  const data = q.data || { providers: [], rules: [], mode: 'platform' };
  const on = (productCode: string, providerId: string) => !!(data.rules || []).find((r: any) => r.productCode === productCode && r.providerId === providerId && r.isActive);
  return (
    <div className="max-w-xl">
      <p className="text-[13px] text-slate-400 mb-4">{data.mode === 'merchant' ? 'Only the APIs switched on here are used.' : 'Platform switch is used until you turn one on here.'}</p>
      {!data.providers?.length && <p className="text-[13px] text-slate-400 py-8 text-center">{q.isLoading ? 'Loading…' : 'No API is connected yet.'}</p>}
      {!!data.providers?.length && <div className="space-y-5">
        {(['PAYIN', 'PAYOUT'] as const).map(pc => (
          <div key={pc}>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-slate-400 mb-1">{pc === 'PAYIN' ? 'Pay-in' : 'Payout'}</p>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {(data.providers || []).map((p: any) => {
                const active = on(pc, p.id);
                return (
                  <button key={p.id + pc} type="button" disabled={set.isPending} onClick={() => set.mutate({ productCode: pc, providerId: p.id, active: !active })} className="w-full flex items-center justify-between py-3 text-left">
                    <span className="text-[13.5px] font-semibold text-slate-900 truncate">{String(p.name || '').split(' (')[0]}</span>
                    <span className={`relative w-10 h-6 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow ${active ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
