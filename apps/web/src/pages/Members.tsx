import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, inr } from '../api';

const avatars = ['#111827', '#f4a28c', '#34d399', '#60a5fa', '#a78bfa', '#fbbf24'];
type Tab = 'wallet' | 'charges' | 'apis' | 'members';

export function MerchantDesk() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['merchant-desk'], queryFn: () => api('/merchant-desk') });
  const members = useQuery({ queryKey: ['portal-members'], queryFn: () => api('/members') });
  const sw = useQuery({ queryKey: ['apiswitch'], queryFn: () => api('/admin/api-switch') });
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('wallet');
  const [q, setQ] = useState('');
  const rows = Array.isArray(list.data) ? list.data : [];
  const current = rows.find((m: any) => m.id === open);
  const apisQ = useQuery({ queryKey: ['merch-apis', current?.id || 'none'], queryFn: () => api('/merchant-desk/' + current.id + '/apis'), enabled: !!current?.id });
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant-desk'] });
  const sum = (k: string) => rows.reduce((a: number, m: any) => a + Number(m[k] || 0), 0);
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((m: any) => `${m.businessName || ''} ${m.email || ''}`.toLowerCase().includes(needle)) : rows;
  const memberCount = (id: string) => (Array.isArray(members.data) ? members.data : []).filter((m: any) => m.merchantId === id).length;
  useEffect(() => { if (!open && rows[0]?.id) setOpen(rows[0].id); }, [rows, open]);

  const focus = current;
  const payin = focus ? Number(focus.payinPaise || 0) : sum('payinPaise');
  const payout = focus ? Number(focus.payoutPaise || 0) : sum('payoutPaise');
  const liveApi = (pc: 'PAYIN' | 'PAYOUT') => {
    const providers = apisQ.data?.providers || [];
    const rule = (apisQ.data?.rules || []).find((r: any) => r.productCode === pc && r.isActive);
    const own = rule && providers.find((p: any) => p.id === rule.providerId);
    if (own) return String(own.name || own.code).split(' (')[0];
    const plat = sw.data?.active?.[pc]?.provider;
    if (plat?.name) return String(plat.name).split(' (')[0];
    if (providers[0]) return String(providers[0].name).split(' (')[0];
    return 'No API';
  };

  return (
    <div className="w-full h-[calc(100vh-150px)] min-h-[560px] flex flex-col gap-3">
      <div className="shrink-0 grid md:grid-cols-2 gap-3">
        <AtmCard kind="PAYIN" apiName={liveApi('PAYIN')} charge={focus ? focus.payinChargePercent ?? 0 : '—'} balance={inr(payin)} onClick={() => focus && setTab('wallet')} />
        <AtmCard kind="PAYOUT" apiName={liveApi('PAYOUT')} charge={focus ? focus.payoutChargePercent ?? 0 : '—'} balance={inr(payout)} onClick={() => focus && setTab('wallet')} />
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] overflow-hidden flex">
        <aside className="w-[300px] shrink-0 border-r border-slate-100 flex flex-col min-h-0">
          <div className="shrink-0 p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[13px] font-bold text-slate-900">Merchants <span className="text-slate-400 font-semibold">{rows.length}</span></p>
              <button type="button" onClick={() => setOpen('new')} className="h-8 px-3 rounded-full bg-slate-900 text-white text-[12px] font-semibold hover:bg-black">Add</button>
            </div>
            <div className="flex items-center rounded-full border border-slate-200 bg-[#f7f8fa] pl-3">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              <input className="w-full bg-transparent px-2.5 py-2 text-[13px] outline-none" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {list.isLoading && <p className="px-4 py-6 text-[13px] text-slate-400">Loading…</p>}
            {!list.isLoading && !shown.length && <p className="px-4 py-8 text-center text-[13px] text-slate-400">{rows.length ? 'No match.' : 'No merchants yet.'}</p>}
            {shown.map((m: any) => {
              const i = rows.indexOf(m);
              const on = open === m.id;
              return (
                <button key={m.id} type="button" onClick={() => { setOpen(m.id); setTab('wallet'); }} className={`w-full text-left px-3 py-3 border-b border-slate-50 flex items-start gap-3 transition ${on ? 'bg-[#f4f6f8]' : 'hover:bg-[#fafbfd]'}`}>
                  <span className="w-9 h-9 rounded-xl text-white grid place-items-center text-[13px] font-extrabold shrink-0 mt-0.5" style={{ background: avatars[Math.max(0, i) % avatars.length] }}>{(m.businessName || '?').charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-slate-900 truncate">{m.businessName || 'Unnamed'}</span>
                      <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${m.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </span>
                    <span className="block text-[11.5px] text-slate-400 truncate">{m.email || 'No email'} · {memberCount(m.id)} member{memberCount(m.id) === 1 ? '' : 's'}</span>
                    <span className="mt-1.5 flex gap-1.5">
                      <span className="rounded-full bg-[#fdf0ea] px-2 py-0.5 text-[10.5px] font-bold text-slate-700 tnum">{inr(m.payinPaise)}</span>
                      <span className="rounded-full bg-[#eaf7f0] px-2 py-0.5 text-[10.5px] font-bold text-slate-700 tnum">{inr(m.payoutPaise)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          {open === 'new' && <CreateMerchant onDone={id => { refresh(); setOpen(id); setTab('wallet'); }} onCancel={() => setOpen(rows[0]?.id || null)} />}
          {current && <Workspace key={current.id} merchant={current} color={avatars[Math.max(0, rows.indexOf(current)) % avatars.length]} tab={tab} setTab={setTab} onSaved={refresh} />}
          {!open && !list.isLoading && <div className="flex-1 grid place-items-center text-[13px] text-slate-400">Select a merchant</div>}
        </section>
      </div>
    </div>
  );
}

function Chip() {
  return (
    <span className="relative block w-11 h-8 rounded-[6px] overflow-hidden shadow-inner" style={{ background: 'linear-gradient(135deg,#f8e7a2,#e0b43a 48%,#fff4c4)' }}>
      <span className="absolute left-0 right-0 top-[38%] h-px bg-black/25" />
      <span className="absolute left-0 right-0 top-[62%] h-px bg-black/20" />
      <span className="absolute top-0 bottom-0 left-[32%] w-px bg-black/20" />
      <span className="absolute top-0 bottom-0 left-[68%] w-px bg-black/15" />
    </span>
  );
}

function AtmCard({ kind, apiName, charge, balance, onClick }: { kind: 'PAYIN' | 'PAYOUT'; apiName: string; charge: string | number; balance: string; onClick: () => void }) {
  const payin = kind === 'PAYIN';
  return (
    <button type="button" onClick={onClick} className="group relative w-full overflow-hidden rounded-[22px] text-left text-white shadow-[0_16px_36px_rgba(15,23,42,.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,23,42,.28)]" style={{ background: payin ? 'linear-gradient(128deg,#18181b 0%,#3f3f46 38%,#09090b 72%,#27272a 100%)' : 'linear-gradient(128deg,#052e24 0%,#0f766e 40%,#042f2e 74%,#134e4a 100%)', minHeight: 188 }}>
      <span className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <span className="pointer-events-none absolute -left-8 bottom-0 h-24 w-40 rounded-full bg-white/5 blur-2xl" />
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition duration-700 group-hover:translate-x-[420%] group-hover:opacity-100" />
      <span className="relative flex min-h-[188px] flex-col p-5">
        <span className="flex items-start justify-between">
          <span>
            <span className="block text-[10px] font-bold tracking-[.28em] text-white/45">SYNTRIX</span>
            <span className="mt-1 block text-[15px] font-semibold">{payin ? 'Pay-in' : 'Payout'}</span>
          </span>
          <span className="flex items-center gap-3">
            <Chip />
            <svg className="h-6 w-6 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8.5 8.5a5 5 0 0 1 7 0"/><path d="M6 6a8.5 8.5 0 0 1 12 0"/><path d="M11 12.5h2"/></svg>
          </span>
        </span>
        <span className="mt-6 block text-[30px] font-bold leading-none tracking-tight tnum">{balance}</span>
        <span className="mt-1 block text-[11px] font-semibold tracking-wide text-white/45">Total balance</span>
        <span className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="min-w-0">
            <span className="block text-[10px] font-bold tracking-[.18em] text-white/40">API</span>
            <span className="block truncate text-[16px] font-bold">{apiName}</span>
          </span>
          <span className="text-right">
            <span className="block text-[10px] font-bold tracking-[.18em] text-white/40">CHARGE</span>
            <span className="block text-[16px] font-bold tnum">{charge}{charge === '—' ? '' : '%'}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: [Tab, string][] = [['wallet', 'Wallet'], ['charges', 'Charges'], ['apis', 'APIs'], ['members', 'Members']];
  return (
    <div className="shrink-0 flex gap-1 px-5 border-b border-slate-100">
      {items.map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={`relative px-3.5 pb-3 pt-1 text-[14px] whitespace-nowrap transition ${tab === k ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium hover:text-slate-700'}`}>
          {l}
          {tab === k && <span className="absolute inset-x-2 bottom-0 h-[2px] bg-slate-900 rounded-full" />}
        </button>
      ))}
    </div>
  );
}

function Workspace({ merchant, color, tab, setTab, onSaved }: { merchant: any; color: string; tab: Tab; setTab: (t: Tab) => void; onSaved: () => void }) {
  return (
    <>
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl text-white grid place-items-center text-[16px] font-extrabold shrink-0" style={{ background: color }}>{(merchant.businessName || '?').charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-slate-900 truncate">{merchant.businessName || 'Unnamed'}</p>
          <p className="text-[12.5px] text-slate-400 truncate">{merchant.email || 'No email'} · Pay-in {merchant.payinChargePercent ?? 0}% · Payout {merchant.payoutChargePercent ?? 0}%</p>
        </div>
        <ActiveToggle merchant={merchant} onSaved={onSaved} />
      </div>
      <Tabs tab={tab} setTab={setTab} />
      <div className="flex-1 min-h-0 overflow-auto p-5">
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
    <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={`h-9 px-3 rounded-full text-[12.5px] font-bold transition ${merchant.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
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
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">New merchant</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Name, charges and hold. You can add members after this.</p>
        </div>
        <button type="button" onClick={onCancel} className="h-9 px-3 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600">Cancel</button>
      </div>
      <MerchantFields form={form} setForm={setForm} />
      {err && <p className="text-[12.5px] text-rose-600 mt-3">{err}</p>}
      <button className="mt-5 h-10 px-5 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Create merchant'}</button>
    </form>
  );
}

function MerchantFields({ form, setForm }: { form: any; setForm: (v: any) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
      <Field label="Name"><input className="input" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></Field>
      <Field label="Email"><input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="API charge pay-in %"><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payinChargePercent} onChange={e => setForm({ ...form, payinChargePercent: e.target.value })} /></Field>
      <Field label="API charge payout %"><input className="input tnum" type="number" min={0} max={100} step="0.01" value={form.payoutChargePercent} onChange={e => setForm({ ...form, payoutChargePercent: e.target.value })} /></Field>
      <Field label="Wallet hold ₹"><input className="input tnum" type="number" min={0} step="0.01" value={form.holdRupees} onChange={e => setForm({ ...form, holdRupees: e.target.value })} /></Field>
      <div className="flex items-end">
        <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`h-11 px-4 rounded-2xl text-[13px] font-bold ${form.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{form.active ? 'Active' : 'Inactive'}</button>
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
    <form className="max-w-3xl" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-slate-500">Name, email, API percent and how much pay-in stays on hold.</p>
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
  const payin = Number(merchant.payinPaise || 0);
  const payout = Number(merchant.payoutPaise || 0);
  const total = payin + payout;
  const payinPct = total ? Math.round((payin / total) * 100) : 50;
  const cards = [
    ['Pay-in', inr(merchant.payinPaise), 'bg-[#fdf0ea]'],
    ['Payout', inr(merchant.payoutPaise), 'bg-[#eaf7f0]'],
    ['Hold', inr(merchant.holdPaise), 'bg-[#e8f1fa]'],
    ['Free', inr(merchant.freePayinPaise), 'bg-[#f3eefb]'],
  ];
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <div className="h-3 rounded-full overflow-hidden flex bg-slate-100">
          <div className="h-full bg-[#f4a28c]" style={{ width: payinPct + '%' }} />
          <div className="h-full bg-[#86d7b0]" style={{ width: (100 - payinPct) + '%' }} />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] font-semibold text-slate-400">
          <span>Pay-in {payinPct}%</span>
          <span>Payout {100 - payinPct}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map(([label, value, tone]) => (
          <div key={label} className={`rounded-2xl px-3.5 py-3 ${tone}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-[18px] font-black tnum text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>
      <form className="rounded-[20px] bg-[#f7f8fa] p-4" onSubmit={e => { e.preventDefault(); moveAmt.mutate(); }}>
        <p className="text-[13px] font-bold text-slate-900 mb-3">Move money</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Amount ₹">
            <input className="input tnum w-40" type="number" min={0} step="0.01" value={move.amountRupees} onChange={e => setMove({ ...move, amountRupees: e.target.value })} required />
          </Field>
          <div className="flex rounded-full bg-white p-1 border border-slate-200">
            <button type="button" onClick={() => setMove({ ...move, direction: 'TO_PAYOUT' })} className={`h-9 px-3 rounded-full text-[12.5px] font-semibold ${move.direction === 'TO_PAYOUT' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Pay-in → Payout</button>
            <button type="button" onClick={() => setMove({ ...move, direction: 'TO_PAYIN' })} className={`h-9 px-3 rounded-full text-[12.5px] font-semibold ${move.direction === 'TO_PAYIN' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Payout → Pay-in</button>
          </div>
          <button className="h-11 px-5 rounded-full bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-60" disabled={moveAmt.isPending}>{moveAmt.isPending ? 'Moving…' : 'Move'}</button>
        </div>
        <p className="text-[12px] text-slate-400 mt-3">Hold stays inside pay-in. You can move only the free amount.</p>
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
    <div className="max-w-3xl">
      <form className="flex flex-wrap items-center gap-2 mb-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <input className="input !w-40" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="input !w-36 tnum" placeholder="Mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
        <input className="input !w-48" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <button className="h-10 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add member'}</button>
      </form>
      {err && <p className="text-[12.5px] text-rose-600 mb-3">{err}</p>}
      <div className="rounded-[16px] border border-slate-100 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-slate-400 border-b border-slate-100">
              <th className="pl-4 py-2.5 font-medium">Name</th>
              <th className="py-2.5 font-medium">Mobile</th>
              <th className="py-2.5 font-medium">Email</th>
              <th className="py-2.5 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id} className="border-b border-slate-50 last:border-0">
                <td className="pl-4 py-3 font-semibold text-slate-900">{m.name}</td>
                <td className="py-3 tnum text-slate-600">{m.mobile}</td>
                <td className="py-3 text-slate-500">{m.email || '—'}</td>
                <td className="py-3 pr-4">
                  <button type="button" disabled={toggle.isPending} onClick={() => toggle.mutate(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${m.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{m.status === 'ACTIVE' ? 'Active' : 'Inactive'}</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={4} className="py-10 text-center text-[13px] text-slate-400">{q.isLoading ? 'Loading…' : 'No members yet. A pay-in needs one.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
    <div className="max-w-3xl">
      <p className="text-[13px] text-slate-500 mb-4">{data.mode === 'merchant' ? 'Only the APIs switched on here are used for this merchant.' : 'Platform switch is used until you turn one on here.'}</p>
      {!data.providers?.length && <p className="text-[13px] text-slate-400 py-8 text-center">{q.isLoading ? 'Loading…' : 'No API is connected yet.'}</p>}
      {!!data.providers?.length && <div className="grid md:grid-cols-2 gap-4">
        {(['PAYIN', 'PAYOUT'] as const).map(pc => (
          <div key={pc} className="rounded-[16px] border border-slate-100 overflow-hidden">
            <p className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100">{pc === 'PAYIN' ? 'Pay-in' : 'Payout'}</p>
            {(data.providers || []).map((p: any) => {
              const active = on(pc, p.id);
              return (
                <button key={p.id + pc} type="button" disabled={set.isPending} onClick={() => set.mutate({ productCode: pc, providerId: p.id, active: !active })} className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 text-left hover:bg-[#fafbfd]">
                  <span className="text-[13.5px] font-semibold text-slate-900 truncate">{String(p.name || '').split(' (')[0]}</span>
                  <span className={`relative w-10 h-6 rounded-full transition ${active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${active ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>}
    </div>
  );
}
