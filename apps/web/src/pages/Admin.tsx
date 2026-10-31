import {useState} from 'react';import * as XLSX from 'xlsx';import jsPDF from 'jspdf';import autoTable from 'jspdf-autotable';import {useQuery,useQueryClient} from '@tanstack/react-query';import {api,inr,Status} from '../api';import {Alert} from './Auth';
const useQ=(k:string,url:string)=>useQuery({queryKey:[k],queryFn:()=>api(url),retry:false});
const StatusPill=({s}:{s:string})=>{ const map:any={SUCCESS:['Captured','bg-emerald-50 text-emerald-600','bg-emerald-500'],FAILED:['Failed','bg-red-50 text-red-500','bg-red-500'],PENDING:['Created','bg-slate-100 text-slate-500','bg-slate-400'],PROCESSING:['Processing','bg-amber-50 text-amber-600','bg-amber-500'],UNKNOWN:['Unknown','bg-purple-50 text-purple-600','bg-purple-500'],REFUNDED:['Refunded','bg-indigo-50 text-indigo-600','bg-indigo-500'],PARTIALLY_REFUNDED:['Partial refund','bg-indigo-50 text-indigo-600','bg-indigo-400']}; const [label,cls,dot]=map[s]||[s,'bg-slate-100 text-slate-500','bg-slate-400']; return <span className={`inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-[3px] text-[11.5px] font-semibold ${cls}`}><span className={`w-1.5 h-1.5 rounded-full ${dot}`}/>{label}</span>; };
/** Height-based bar chart — avoids overlapping capsule stacks. */
function TrendBars({points,valueKey,fmt,height=180,barClass='bg-slate-900'}:{points:any[];valueKey:string;fmt:(n:number)=>string;height?:number;barClass?:string}){
  const pts=points.length?points:Array.from({length:7},(_,i)=>({label:'—',date:'e'+i,[valueKey]:0}));
  const max=Math.max(1,...pts.map((p:any)=>Number(p[valueKey])||0));
  const peakIdx=pts.reduce((best,p,i)=> (Number(p[valueKey])||0)>(Number(pts[best][valueKey])||0)?i:best,0);
  return <div className="flex items-end gap-1.5 overflow-hidden" style={{height}}>
    {pts.map((p:any,i:number)=>{
      const val=Number(p[valueKey])||0;
      const pct=val?Math.max(6,Math.round((val/max)*100)):2;
      const hi=i===peakIdx&&val>0;
      return <div key={p.date||i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group relative">
        <div className="absolute bottom-[calc(100%-0.25rem)] left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[10.5px] font-semibold px-2 py-1 shadow-lg">
          {p.label||'—'} · {fmt(val)}
        </div>
        {hi&&<span className="mb-1 text-[10px] font-bold text-slate-900 tnum leading-none">{fmt(val)}</span>}
        <div className={`w-full max-w-[28px] rounded-t-lg transition ${hi?barClass:'bg-slate-200 group-hover:bg-slate-400'}`} style={{height:pct+'%'}}/>
        <span className="mt-2 text-[9.5px] text-slate-400 truncate w-full text-center leading-none">{(p.label||'').split(' ')[0]}</span>
      </div>;
    })}
  </div>;
}
export function AdminDashboard(){
  const dash=useQ('adash','/admin/dashboard');
  const payin=useQuery({queryKey:['adpstats','PAYIN'],queryFn:()=>api('/admin/provider-stats?kind=PAYIN'),refetchInterval:20000,retry:false});
  const payout=useQuery({queryKey:['adpstats','PAYOUT'],queryFn:()=>api('/admin/provider-stats?kind=PAYOUT'),refetchInterval:20000,retry:false});
  const trend=useQuery({queryKey:['apitrend','home',14],queryFn:()=>api('/admin/daily-trend?days=14'),retry:false});
  if(dash.error) return <Alert>{(dash.error as Error).message}</Alert>;
  if(dash.isLoading||!dash.data||!payin.data||!payout.data) return <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">{[1,2,3,4,5].map(i=><div key={i} className="h-[108px] rounded-[22px] bg-slate-200/50 animate-pulse"/>)}</div>;
  const d=dash.data, pi=payin.data, po=payout.data;
  const fmt=(paise:number)=>{ const n=Number(paise||0)/100; if(n>=10000000) return (n/10000000).toFixed(1)+'Cr'; if(n>=100000) return (n/100000).toFixed(1)+'L'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toLocaleString('en-IN'); };
  const pts:any[]=trend.data?.points||[];
  const apis:any[]=(pi.perProvider||[]).slice(0,5);
  const avatars=['#111','#f4a28c','#9ad4b5','#9ec5e8','#c9b8e8'];
  const totalPi=Number(pi.totalAmountPaise||0);
  return <div>
    {d.alerts?.map((a:any,i:number)=><div key={i} className="mb-3 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-2.5 text-[13px] text-amber-800">⚠ {a.message}</div>)}
    <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-4">Analytics Overview</h1>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
      <div className="kpi-peach"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{fmt(pi.totalAmountPaise)}</p><span className="text-[11px] font-semibold text-emerald-700">↑ Collection</span></div><p className="text-[12.5px] font-semibold mt-3">Total Collection</p><p className="text-[11px] text-slate-500">{inr(pi.totalAmountPaise)}</p></div>
      <div className="kpi-mint"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{fmt(po.totalAmountPaise)}</p><span className="text-[11px] font-semibold text-emerald-700">↑ Payout</span></div><p className="text-[12.5px] font-semibold mt-3">Total Payout</p><p className="text-[11px] text-slate-500">{inr(po.totalAmountPaise)}</p></div>
      <div className="kpi-sky"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{(d.transactions||0).toLocaleString('en-IN')}</p><span className="text-[11px] font-semibold text-slate-600">txns</span></div><p className="text-[12.5px] font-semibold mt-3">Transactions</p><p className="text-[11px] text-slate-500">platform wide</p></div>
      <div className="kpi-lilac"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{d.avgProviderLatencyMs||0}</p><span className="text-[11px] font-semibold text-slate-600">ms</span></div><p className="text-[12.5px] font-semibold mt-3">Avg latency</p><p className="text-[11px] text-slate-500">provider round-trip</p></div>
      <div className="kpi-ink"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{d.successRate==null?'—':d.successRate+'%'}</p><span className="text-[11px] font-semibold text-emerald-400">SR</span></div><p className="text-[12.5px] font-semibold mt-3 text-white/80">Success rate</p><p className="text-[11px] text-white/45">captured / attempted</p></div>
    </div>
    <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 mb-5">
      <div className="panel">
        <div className="flex items-center mb-4"><h2 className="text-[15px] font-bold text-slate-900">Collection trend</h2><span className="ml-auto text-[11.5px] font-semibold text-slate-400">Last 14 days</span></div>
        <TrendBars points={pts} valueKey="payinPaise" fmt={fmt} height={180}/>
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
          <div><p className="text-[18px] font-bold tnum">{pi.successCount||0}</p><p className="text-[11.5px] text-slate-400">Pay-in OK</p></div>
          <div><p className="text-[18px] font-bold tnum">{po.successCount||0}</p><p className="text-[11.5px] text-slate-400">Payout OK</p></div>
          <div><p className="text-[18px] font-bold tnum text-emerald-600">+{d.successRate??0}%</p><p className="text-[11.5px] text-slate-400">Success</p></div>
        </div>
      </div>
      <div className="panel">
        <h2 className="text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase mb-4">Top APIs</h2>
        {!apis.length&&<p className="text-[13px] text-slate-400 py-8 text-center">No API volume yet</p>}
        {apis.map((r:any,i:number)=>{
          const name=(r.providerName||'').split(' (')[0];
          const share=totalPi?Math.round(Number(r.totalAmountPaise)/totalPi*1000)/10:0;
          return <div key={r.providerId||i} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
            <span className="w-10 h-10 rounded-full grid place-items-center text-[11px] font-extrabold text-white" style={{background:avatars[i%avatars.length]}}>{(r.providerCode||'API').slice(0,2)}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 text-[13.5px] truncate">{name}</p><p className="text-[11.5px] text-slate-400">{share}% share · {r.successRate}% SR</p></div>
            <p className="font-bold text-emerald-600 tnum text-[13px]">+{inr(r.totalAmountPaise)}</p>
          </div>;
        })}
        <a href="/app/reports" className="mt-3 inline-flex text-[13px] font-semibold text-slate-900 hover:underline">Full API report →</a>
      </div>
    </div>
    {d.onboarding?.length>0&&<div className="panel"><h2 className="text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase mb-3">Onboarding</h2><div className="flex flex-wrap gap-2">{d.onboarding.map((o:any)=><div key={o.status} className="bg-[#f7f8fa] rounded-2xl px-4 py-3 flex items-center gap-2"><Status s={o.status}/><b className="text-slate-800">{o.count}</b></div>)}</div></div>}
  </div>;
}
export function AdminMerchants(){ const {data}=useQ('amerch','/admin/merchants'); const [sel,setSel]=useState(''); const detail=useQ('amerch1','/admin/merchants/'+sel); const qc=useQueryClient(); const act=async(action:string,extra:any={})=>{ await api(`/admin/merchants/${sel}/review`,{method:'POST',body:{action,...extra}}); qc.invalidateQueries(); }; if(sel&&detail.data){ const m=detail.data; return <div className="space-y-4"><button className="btn-ghost" onClick={()=>setSel('')}>← All merchants</button><div className="card"><div className="flex justify-between"><div><h3 className="font-bold text-lg">{m.businessName}</h3><p className="text-sm text-slate-500">{m.entityType} · {m.businessModel} · completion {m.completion}%</p></div><Status s={m.status}/></div><div className="grid sm:grid-cols-2 gap-3 text-sm mt-4"><p>Projected annual: <b>{inr(Number(m.projectedAnnualVolumePaise||0))}</b></p><p>Actual historical turnover: <b>{inr(Number(m.actualAnnualTurnoverPaise||0))}</b></p><p>Production: <b>{m.productionEnabled?'APPROVED':'not approved'}</b></p><p>GST: {m.gst||'—'} · CIN: {m.cin||'—'}</p></div><h4 className="font-bold mt-5 mb-2">Documents (verified only by a reviewer)</h4>{m.documents?.map((d:any)=><div key={d.id} className="flex justify-between border rounded-xl px-3 py-2 mb-2 text-sm"><span>{d.kind} — {d.fileName}</span><span className="flex gap-2"><Status s={d.status}/><button className="text-emerald-600 font-semibold" onClick={async()=>{await api(`/admin/documents/${d.id}/review`,{method:'POST',body:{decision:'VERIFIED'}});qc.invalidateQueries();}}>Verify</button><button className="text-red-600 font-semibold" onClick={async()=>{await api(`/admin/documents/${d.id}/review`,{method:'POST',body:{decision:'REJECTED'}});qc.invalidateQueries();}}>Reject</button></span></div>)||<p className="text-sm text-slate-500">No documents uploaded.</p>}<div className="flex flex-wrap gap-2 mt-5"><button className="btn" onClick={()=>act('APPROVE')}>Approve (sandbox)</button><button className="btn" onClick={()=>act('APPROVE',{activateProduction:true})}>Approve + production</button><button className="btn-ghost" onClick={()=>{const message=prompt('What should the merchant clarify?'); if(message) act('CLARIFY',{message,field:'general'});}}>Request clarification</button><button className="btn-ghost" onClick={()=>act('UNDER_REVIEW')}>Under review</button><button className="btn-ghost !text-red-600" onClick={()=>act('REJECT')}>Reject</button><button className="btn-ghost !text-red-600" onClick={()=>act('SUSPEND')}>Suspend</button></div><h4 className="font-bold mt-6 mb-2">Approval history / internal notes</h4>{m.application?.approvalHistory?.map((h:any)=><p key={h.id} className="text-sm border-b py-2">{h.action} → {h.toStatus||''} <span className="text-slate-400">{new Date(h.createdAt).toLocaleString()}</span> {h.note||''}</p>)}</div></div>; }
 return <div className="card"><h3 className="font-bold mb-4">Merchants</h3>{!data?.length&&<p className="text-sm text-slate-500">No merchants yet.</p>}{data?.map((m:any)=><button key={m.id} onClick={()=>setSel(m.id)} className="w-full text-left flex justify-between border rounded-xl px-4 py-3 mb-2 hover:bg-slate-50"><span><b>{m.businessName||'Unnamed'}</b><span className="block text-xs text-slate-500">{m.org?.memberships?.[0]?.user?.email} · {m.completion}% complete</span></span><Status s={m.status}/></button>)}</div>; }
function StatBox({label,value,sub,accent}:{label:string,value:any,sub?:string,accent:string}){ return <div className="bg-slate-50/80 rounded-xl py-3 px-2 text-center border border-slate-100"><p className={`text-[10px] font-bold tracking-widest ${accent}`}>{label}</p><p className="font-bold text-slate-900 text-[15px] mt-1 truncate">{value}</p>{sub&&<p className="text-[10.5px] text-slate-400 mt-0.5">{sub}</p>}</div>; }

function StepHead({n,title,sub,color}:{n:number,title:string,sub:string,color:string}){ return <div className="flex items-center gap-3 mb-3"><span className={`w-7 h-7 rounded-full ${color} text-white flex items-center justify-center text-[13px] font-extrabold shrink-0 shadow-sm`}>{n}</span><div><h3 className="font-bold text-[15px] text-slate-900 leading-tight">{title}</h3><p className="text-xs text-slate-400">{sub}</p></div></div>; }

function ApiSwitch(){
  const {data,refetch}=useQ('apiswitch','/admin/api-switch');
  const payin=useQ('adpstatsPAYIN','/admin/provider-stats?kind=PAYIN');
  const payout=useQ('adpstatsPAYOUT','/admin/provider-stats?kind=PAYOUT');
  const [msg,setMsg]=useState('');
  const [previewAmt,setPreviewAmt]=useState('500');
  const [previewPc,setPreviewPc]=useState<'PAYIN'|'PAYOUT'>('PAYIN');
  const [preview,setPreview]=useState<any>(null);
  const [draft,setDraft]=useState<Record<string,{min:string;max:string}>>({});
  const [busy,setBusy]=useState('');
  if(!data) return <div className="grid md:grid-cols-2 gap-3">{[1,2].map(i=><div key={i} className="h-48 rounded-[22px] bg-slate-200/50 animate-pulse"/>)}</div>;

  const flash=(t:string)=>{ setMsg(t); setTimeout(()=>setMsg(''),2800); };
  const routeFor=(pid:string,pc:'PAYIN'|'PAYOUT')=>((data.routes?.[pc]||[]) as any[]).find((r:any)=>r.providerId===pid);
  const stat=(kind:'PAYIN'|'PAYOUT',pid:string)=>(kind==='PAYIN'?payin:payout).data?.perProvider?.find((r:any)=>r.providerId===pid);
  const draftKey=(pid:string,pc:string)=>`${pid}:${pc}`;
  const getRange=(pid:string,pc:'PAYIN'|'PAYOUT')=>{
    const k=draftKey(pid,pc); if(draft[k]) return draft[k];
    const r=routeFor(pid,pc);
    return {min:r?.minRupees??'',max:r?.maxRupees??''};
  };
  const setRange=(pid:string,pc:'PAYIN'|'PAYOUT',patch:Partial<{min:string;max:string}>)=>{
    const cur=getRange(pid,pc); setDraft({...draft,[draftKey(pid,pc)]:{...cur,...patch}});
  };
  const toggle=async(pid:string,pc:'PAYIN'|'PAYOUT')=>{
    const r=routeFor(pid,pc); const key=`tog-${pid}-${pc}`; setBusy(key);
    try{
      if(r?.isActive){ await api(`/admin/api-switch/${r.id}/deactivate`,{method:'POST',body:{}}); flash('Off'); }
      else if(r){ await api(`/admin/api-switch/${r.id}/range`,{method:'POST',body:{isActive:true}}); flash('On'); }
      else {
        const rg=getRange(pid,pc);
        await api('/admin/api-switch',{method:'POST',body:{productCode:pc,providerId:pid,minRupees:rg.min===''?null:Number(rg.min),maxRupees:rg.max===''?null:Number(rg.max),priority:1}});
        flash('On');
      }
      refetch();
    }catch(e:any){ flash(e.message); }
    finally{ setBusy(''); }
  };
  const saveRange=async(pid:string,pc:'PAYIN'|'PAYOUT')=>{
    const rg=getRange(pid,pc); const r=routeFor(pid,pc); const key=`save-${pid}-${pc}`; setBusy(key);
    try{
      if(r){
        await api(`/admin/api-switch/${r.id}/range`,{method:'POST',body:{minRupees:rg.min===''?null:Number(rg.min),maxRupees:rg.max===''?null:Number(rg.max)}});
      } else {
        await api('/admin/api-switch',{method:'POST',body:{productCode:pc,providerId:pid,minRupees:rg.min===''?null:Number(rg.min),maxRupees:rg.max===''?null:Number(rg.max),priority:1}});
      }
      const next={...draft}; delete next[draftKey(pid,pc)]; setDraft(next);
      flash('Range saved'); refetch();
    }catch(e:any){ flash(e.message); }
    finally{ setBusy(''); }
  };
  const check=async()=>{ try{ setPreview(await api(`/admin/api-switch/preview?productCode=${previewPc}&amountRupees=${encodeURIComponent(previewAmt)}`)); }catch(e:any){ flash(e.message); } };
  const providers:any[]=data.providers||[];
  const fmtShort=(paise:number)=>{ const n=Number(paise||0)/100; if(n>=10000000) return (n/10000000).toFixed(1)+'Cr'; if(n>=100000) return (n/100000).toFixed(1)+'L'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toLocaleString('en-IN'); };

  const resetCircuit=async(pid:string)=>{ setBusy('circ-'+pid); try{ await api(`/admin/providers/${pid}/circuit-reset`,{method:'POST',body:{}}); flash('Circuit reset'); refetch(); }catch(e:any){ flash(e.message); } finally{ setBusy(''); } };
  const avatars=['#111','#f4a28c','#9ad4b5','#9ec5e8','#c9b8e8','#f0c96a'];
  const SideCard=({pr,pc,idx}:{pr:any;pc:'PAYIN'|'PAYOUT';idx:number})=>{
    const isPayin=pc==='PAYIN';
    const st=stat(pc,pr.id);
    const r=routeFor(pr.id,pc);
    const on=!!r?.isActive;
    const rg=getRange(pr.id,pc);
    const dirty=!!draft[draftKey(pr.id,pc)];
    const circ=!!pr.circuitOpen;
    const sc=st?.successCount||0, fl=st?.failedCount||0;
    const rate=(sc+fl)?Math.round(sc/(sc+fl)*100):null;
    return <div className={`bg-white rounded-[22px] border shadow-[0_1px_2px_rgba(15,23,42,.03)] p-4 flex flex-col ${circ?'border-amber-300':'border-slate-200/70'}`}>
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl text-white grid place-items-center text-[14px] font-extrabold shrink-0" style={{background:avatars[idx%avatars.length]}}>{(pr.name||'?').charAt(0)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 text-[14.5px] truncate">{(pr.name||'').split(' (')[0]}</p>
          <p className="text-[11.5px] text-slate-400 mt-0.5">{isPayin?'Collection':'Payout'} · {pr.code}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${pr.isMock?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>{pr.isMock?'Sandbox':'Live'}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${circ?'bg-amber-100 text-amber-800':on?'bg-slate-900 text-white':'bg-slate-100 text-slate-500'}`}>{circ?'Circuit':on?'On':'Off'}</span>
          </div>
        </div>
        <button type="button" disabled={busy===`tog-${pr.id}-${pc}`} title={on?'Turn off':'Turn on'} onClick={()=>toggle(pr.id,pc)}
          className={`relative w-11 rounded-full shrink-0 transition mt-1 ${on&&!circ?'bg-emerald-500':circ?'bg-amber-500':'bg-slate-300'} disabled:opacity-60`} style={{height:24}}>
          <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition ${on?'left-[22px]':'left-0.5'}`}/>
        </button>
      </div>
      {circ&&<div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
        <span className="text-[11.5px] font-semibold text-amber-800 flex-1">Circuit open — new traffic skips this API.</span>
        <button className="text-[11.5px] font-bold text-amber-900 underline shrink-0" disabled={busy==='circ-'+pr.id} onClick={()=>resetCircuit(pr.id)}>Reset</button>
      </div>}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-2xl bg-[#fdf0ea] px-2.5 py-2"><p className="text-[15px] font-bold tnum text-slate-900 leading-none">{fmtShort(st?.totalAmountPaise||0)}</p><p className="text-[10.5px] font-semibold text-slate-500 mt-1">Total</p></div>
        <div className="rounded-2xl bg-[#eaf7f0] px-2.5 py-2"><p className="text-[15px] font-bold tnum text-slate-900 leading-none">{fmtShort(st?.todayAmountPaise||0)}</p><p className="text-[10.5px] font-semibold text-slate-500 mt-1">Today</p></div>
        <div className="rounded-2xl bg-[#eef0f6] px-2.5 py-2"><p className={`text-[15px] font-bold tnum leading-none ${rate==null?'text-slate-400':rate>=80?'text-emerald-600':'text-amber-600'}`}>{rate==null?'—':rate+'%'}</p><p className="text-[10.5px] font-semibold text-slate-500 mt-1">Success</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Start ₹</label>
          <input className="mt-1 w-full rounded-xl border border-slate-200 bg-[#f7f8fa] px-2.5 py-2 text-[13px] font-semibold tnum outline-none focus:border-slate-400 focus:bg-white" type="number" min={0} placeholder="0" value={rg.min} onChange={e=>setRange(pr.id,pc,{min:e.target.value})}/>
        </div>
        <div>
          <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">End ₹</label>
          <input className="mt-1 w-full rounded-xl border border-slate-200 bg-[#f7f8fa] px-2.5 py-2 text-[13px] font-semibold tnum outline-none focus:border-slate-400 focus:bg-white" type="number" min={0} placeholder="No max" value={rg.max} onChange={e=>setRange(pr.id,pc,{max:e.target.value})}/>
        </div>
      </div>
      <button type="button" disabled={busy===`save-${pr.id}-${pc}`||!dirty} onClick={()=>saveRange(pr.id,pc)}
        className={`mt-3 w-full h-9 rounded-xl text-[12.5px] font-semibold border transition ${dirty?'bg-slate-900 border-slate-900 text-white hover:bg-black':'border-slate-200 bg-white text-slate-700'}`}>
        {busy===`save-${pr.id}-${pc}`?'Saving…':dirty?'Save range':'Range saved'}
      </button>
    </div>;
  };

  const Col=({pc,title,sub}:{pc:'PAYIN'|'PAYOUT';title:string;sub:string})=>(
    <div className="min-w-0">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h3 className="text-[16px] font-bold text-slate-900">{title}</h3>
          <p className="text-[12.5px] text-slate-400">{sub}</p>
        </div>
        <span className="text-[12.5px] font-semibold text-slate-500">{providers.filter(p=>routeFor(p.id,pc)?.isActive).length} on</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {!providers.length&&<div className="sm:col-span-2 rounded-[22px] border border-dashed border-slate-200 bg-white py-12 text-center text-[13px] text-slate-400">No API yet — add one below.</div>}
        {providers.map((pr:any,i:number)=><SideCard key={pr.id+pc} pr={pr} pc={pc} idx={i}/>)}
      </div>
    </div>
  );

  return <div className="space-y-6">
    <div className="grid lg:grid-cols-2 gap-6">
      <Col pc="PAYIN" title="Pay-in" sub="Collection routing & ranges"/>
      <Col pc="PAYOUT" title="Payout" sub="Disbursement routing & ranges"/>
    </div>

    <div className="bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] px-4 py-3.5 flex flex-wrap items-center gap-2.5">
      <span className="text-[12.5px] font-semibold text-slate-600">Test amount</span>
      <div className="flex rounded-xl bg-[#f7f8fa] p-0.5">
        {([['PAYIN','Pay-in'],['PAYOUT','Payout']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>{setPreviewPc(k);setPreview(null);}} className={`px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold ${previewPc===k?'bg-slate-900 text-white':'text-slate-500'}`}>{l}</button>
        ))}
      </div>
      <div className="flex items-center rounded-xl border border-slate-200 bg-[#f7f8fa] overflow-hidden">
        <span className="pl-2.5 text-slate-400 text-[13px]">₹</span>
        <input className="w-[100px] px-1.5 py-1.5 text-[13px] outline-none bg-transparent" type="number" min={0} value={previewAmt} onChange={e=>setPreviewAmt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&check()}/>
      </div>
      <button className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black" onClick={check}>Check</button>
      {preview&&<span className={`text-[13px] font-semibold ${preview.matched?'text-emerald-700':'text-red-600'}`}>{preview.matched?`→ ${preview.provider?.name?.split(' (')[0]}`:'→ No match'}</span>}
      {msg&&<span className="ml-auto text-[12px] text-emerald-700 font-medium">{msg}</span>}
    </div>
  </div>;
}

function ProviderKeys({prov,refresh}:{prov:any,refresh:()=>void}){ const [f,setF]=useState({label:'',apiKey:'',apiSecret:''}); const [msg,setMsg]=useState('');
 const add=async()=>{ if(!f.apiKey) return setMsg('Enter an API key'); try{ await api(`/admin/providers/${prov.id}/keys`,{method:'POST',body:f}); setF({label:'',apiKey:'',apiSecret:''}); setMsg('Key added ✓'); refresh(); }catch(e:any){ setMsg(e.message); } };
 return <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
  {(prov.keys||[]).map((k:any)=>(
    <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2.5 text-[12.5px]">
      <b className="text-slate-900">{k.label||'Key'}</b>
      <code className="text-slate-400 font-mono text-[11px]">{k.masked}</code>
      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${k.isActive?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-500'}`}>{k.isActive?'In use':'Off'}</span>
      <span className="ml-auto flex gap-3">
        <button className="font-semibold text-slate-700 hover:underline" onClick={async()=>{ await api(`/admin/providers/${prov.id}/keys/${k.id}/toggle`,{method:'POST',body:{}}); refresh(); }}>{k.isActive?'Turn off':'Use'}</button>
        <button className="font-semibold text-rose-600 hover:underline" onClick={async()=>{ await api(`/admin/providers/${prov.id}/keys/${k.id}/revoke`,{method:'POST',body:{}}); refresh(); }}>Remove</button>
      </span>
    </div>
  ))}
  {!prov.keys?.length&&<p className="text-[12.5px] text-slate-400">No key yet — paste below.</p>}
  <div className="grid sm:grid-cols-[1fr_1.3fr_1.3fr_auto] gap-2">
    <input className="input !py-2 !rounded-xl" placeholder="Label" value={f.label} onChange={e=>setF({...f,label:e.target.value})}/>
    <input className="input !py-2 !rounded-xl" placeholder="API key" value={f.apiKey} onChange={e=>setF({...f,apiKey:e.target.value})}/>
    <input className="input !py-2 !rounded-xl" type="password" placeholder="Secret (optional)" value={f.apiSecret} onChange={e=>setF({...f,apiSecret:e.target.value})}/>
    <button className="btn !py-2 !rounded-xl whitespace-nowrap" onClick={add}>Add key</button>
  </div>
  {msg&&<p className="text-[12px] text-slate-600">{msg}</p>}
 </div>; }

const KIND_META:any={PG:{l:'Gateway',d:'Collect payments'},WALLET:{l:'Wallet',d:'Wallet payouts'},BANK:{l:'Bank',d:'Bank transfers'},CUSTOM:{l:'Custom',d:'Any REST API'}};
export function AdminProviders(){ const {data}=useQ('aprov','/admin/providers'); const payinStats=useQ('adpstatsPAYIN','/admin/provider-stats?kind=PAYIN'); const payoutStats=useQ('adpstatsPAYOUT','/admin/provider-stats?kind=PAYOUT'); const qc=useQueryClient(); const [openKeys,setOpenKeys]=useState<string>(''); const [showAdd,setShowAdd]=useState(false); const [msg,setMsg]=useState(''); const [testRes,setTestRes]=useState<any>({});
 const [f,setF]=useState<any>({kind:'PG',name:'',code:'',baseUrl:'',isMock:false,services:{payin:true,payout:true,refund:true},authType:'BEARER',apiKeyHeader:'x-api-key',amountUnit:'paise',payinPath:'/payins',payoutPath:'/payouts',payinStatusPath:'/payins/status',payoutStatusPath:'/payouts/status',refundPath:'/refunds',apiKey:'',apiSecret:'',keyLabel:'Primary'});
 const applyPreset=(preset:string)=>{ if(preset==='rupees') setF({...f,amountUnit:'rupees'}); else if(preset==='payout-only') setF({...f,services:{payin:false,payout:true,refund:false}}); else if(preset==='payin-only') setF({...f,services:{payin:true,payout:false,refund:true}}); else setF({...f,amountUnit:'paise',services:{payin:true,payout:true,refund:true}}); };
 const statFor=(stats:any,id:string)=>stats.data?.perProvider?.find((r:any)=>r.providerId===id);
 const combined=(id:string)=>{ const a=statFor(payinStats,id), b=statFor(payoutStats,id); if(!a&&!b) return null; const sc=(a?.successCount||0)+(b?.successCount||0), fl=(a?.failedCount||0)+(b?.failedCount||0); return {total:(a?.totalAmountPaise||0)+(b?.totalAmountPaise||0), today:(a?.todayAmountPaise||0)+(b?.todayAmountPaise||0), rate:(sc+fl)?Math.round(sc/(sc+fl)*100):null}; };
 const addProvider=async()=>{ const code=(f.code||f.name).toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,20); if(!f.name) return setMsg('Enter a name for this API'); if(!f.isMock&&!f.baseUrl) return setMsg('Enter the Base URL (or tick Mock for a test API)'); try{ const prov=await api('/admin/providers',{method:'POST',body:{code,name:f.name,baseUrl:f.baseUrl,kind:f.kind,isMock:f.isMock,services:f.services,config:{authType:f.authType,apiKeyHeader:f.apiKeyHeader,amountUnit:f.amountUnit,payinPath:f.payinPath,payoutPath:f.payoutPath,payinStatusPath:f.payinStatusPath,payoutStatusPath:f.payoutStatusPath,refundPath:f.refundPath}}}); if(f.apiKey) await api(`/admin/providers/${prov.id}/keys`,{method:'POST',body:{label:f.keyLabel||'Primary',apiKey:f.apiKey,apiSecret:f.apiSecret||undefined}}); setMsg(`Done ✓ ${f.name} connected.`); setShowAdd(false); qc.invalidateQueries({queryKey:['aprov']}); qc.invalidateQueries({queryKey:['apiswitch']}); }catch(e:any){ setMsg(e.message); } };
 const testConn=async(id:string)=>{ setTestRes({...testRes,[id]:{note:'Testing…'}}); try{ const r=await api(`/admin/providers/${id}/test`,{method:'POST',body:{}}); setTestRes({...testRes,[id]:r}); }catch(e:any){ setTestRes({...testRes,[id]:{ok:false,note:e.message}}); } };
 const avatars=['#111','#f4a28c','#9ad4b5','#9ec5e8','#c9b8e8','#f0c96a'];

 return <div className="space-y-8 w-full">
  <div className="flex flex-wrap items-end justify-between gap-3">
    <h2 className="text-[22px] font-bold text-slate-900 tracking-tight">APIs Management</h2>
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] font-semibold text-slate-500">{data?.length||0} connected</span>
      <a href="/app/test-api" className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 text-[12.5px] font-semibold hover:bg-slate-50 inline-flex items-center">Test API</a>
      <button type="button" className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black" onClick={()=>setShowAdd(true)}>+ Add API</button>
    </div>
  </div>

  <section><ApiSwitch/></section>

  <section>
    <h3 className="text-[16px] font-bold text-slate-900 mb-3">Connected APIs</h3>
    {!data?.length&&<div className="rounded-[22px] border border-dashed border-slate-200 bg-white py-12 text-center text-[13px] text-slate-400">No API yet — add one below.</div>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {data?.map((p:any,i:number)=>{
        const st=combined(p.id); const activeKey=(p.keys||[]).find((k:any)=>k.isActive); const open=openKeys===p.id; const tr=testRes[p.id];
        return <div key={p.id} className="bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-4 flex flex-col">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl text-white grid place-items-center text-[14px] font-extrabold shrink-0" style={{background:avatars[i%avatars.length]}}>{(p.name||'?').charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 text-[14.5px] truncate">{p.name.split(' (')[0]}</p>
              <p className="text-[11.5px] text-slate-400 mt-0.5">{KIND_META[p.kind||'PG']?.l} · {p.code}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${p.isMock?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>{p.isMock?'Sandbox':'Live'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${p.isActive?'bg-slate-900 text-white':'bg-slate-100 text-slate-500'}`}>{p.isActive?'On':'Off'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-2xl bg-[#fdf0ea] px-2.5 py-2"><p className="text-[15px] font-bold tnum text-slate-900 leading-none">{st?inr(st.total).replace('₹',''):'0'}</p><p className="text-[10.5px] font-semibold text-slate-500 mt-1">Total</p></div>
            <div className="rounded-2xl bg-[#eaf7f0] px-2.5 py-2"><p className="text-[15px] font-bold tnum text-slate-900 leading-none">{st?inr(st.today).replace('₹',''):'0'}</p><p className="text-[10.5px] font-semibold text-slate-500 mt-1">Today</p></div>
            <div className="rounded-2xl bg-[#eef0f6] px-2.5 py-2"><p className={`text-[15px] font-bold tnum leading-none ${st?.rate==null?'text-slate-400':st.rate>=80?'text-emerald-600':'text-amber-600'}`}>{st?.rate==null?'—':st.rate+'%'}</p><p className="text-[10.5px] font-semibold text-slate-500 mt-1">Success</p></div>
          </div>
          <p className="text-[11.5px] text-slate-400 mt-2.5 truncate">{activeKey?<>Key <code className="font-mono text-slate-600">{activeKey.masked}</code></>:'No key attached'}</p>
          {tr&&<p className={`mt-2 text-[11.5px] rounded-xl px-2.5 py-1.5 ${tr.ok?'bg-emerald-50 text-emerald-800':'bg-rose-50 text-rose-700'}`}>{tr.ok?'Connected':'Failed'}{tr.ms?` · ${tr.ms}ms`:''}{tr.note?` · ${tr.note}`:''}</p>}
          <div className="flex gap-2 mt-3">
            <button className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50" onClick={()=>testConn(p.id)}>Test</button>
            <button className={`flex-1 h-9 rounded-xl text-[12.5px] font-semibold ${open?'bg-slate-900 text-white':'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} onClick={()=>setOpenKeys(open?'':p.id)}>Keys ({p.keys?.length||0})</button>
          </div>
          {open&&<ProviderKeys prov={p} refresh={()=>qc.invalidateQueries({queryKey:['aprov']})}/>}
        </div>;
      })}
    </div>
  </section>

  <section>
    <h3 className="text-[16px] font-bold text-slate-900 mb-3">Add API</h3>
    {!showAdd?(
      <button type="button" onClick={()=>setShowAdd(true)} className="w-full rounded-[22px] border border-dashed border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 transition px-5 py-8 text-center">
        <p className="text-[15px] font-bold text-slate-800">Add a new API</p>
        <p className="text-[12.5px] text-slate-400 mt-1">Gateway, wallet or bank — connect without code changes</p>
      </button>
    ):(
      <div className="bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5 space-y-5">
        <div>
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-slate-400 mb-2">Type</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(KIND_META).map(([k,v]:any)=>(
              <button key={k} type="button" onClick={()=>setF({...f,kind:k})} className={`text-left rounded-2xl px-3.5 py-3 border transition ${f.kind===k?'border-slate-900 bg-slate-900 text-white':'border-slate-200 bg-[#f7f8fa] hover:border-slate-300'}`}>
                <span className={`block text-[13px] font-bold ${f.kind===k?'text-white':'text-slate-900'}`}>{v.l}</span>
                <span className={`block text-[11px] mt-0.5 ${f.kind===k?'text-white/60':'text-slate-400'}`}>{v.d}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-slate-400 mb-2">Details</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label">API name</label><input className="input !rounded-xl" placeholder="e.g. Cashfree" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></div>
            <div><label className="label">Base URL</label><input className="input !rounded-xl" placeholder="https://api.provider.com" value={f.baseUrl} onChange={e=>setF({...f,baseUrl:e.target.value})}/></div>
            <div><label className="label">Template</label><select className="input !rounded-xl" onChange={e=>applyPreset(e.target.value)}><option value="generic">Generic REST</option><option value="rupees">Amount in rupees</option><option value="payout-only">Payout only</option><option value="payin-only">Pay-in only</option></select></div>
          </div>
          <div className="mt-3">
            <button type="button" onClick={()=>setF({...f,isMock:!f.isMock})} className={`h-9 px-4 rounded-xl text-[12.5px] font-semibold border transition ${f.isMock?'bg-amber-50 border-amber-300 text-amber-800':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{f.isMock?'Sandbox / mock · On':'Sandbox / mock · Off'}</button>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-slate-400 mb-2">API key</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label">Label</label><input className="input !rounded-xl" value={f.keyLabel} onChange={e=>setF({...f,keyLabel:e.target.value})}/></div>
            <div><label className="label">Key</label><input className="input !rounded-xl" placeholder="From provider" value={f.apiKey} onChange={e=>setF({...f,apiKey:e.target.value})}/></div>
            <div><label className="label">Secret</label><input className="input !rounded-xl" type="password" value={f.apiSecret} onChange={e=>setF({...f,apiSecret:e.target.value})}/></div>
          </div>
        </div>
        <details className="rounded-2xl bg-[#f7f8fa] border border-slate-100 px-4 py-3">
          <summary className="text-[13px] font-bold text-slate-700 cursor-pointer">Advanced endpoints & auth</summary>
          <div className="grid sm:grid-cols-3 gap-3 mt-3">
            <div><label className="label">Auth</label><select className="input !rounded-xl" value={f.authType} onChange={e=>setF({...f,authType:e.target.value})}><option value="BEARER">Bearer</option><option value="API_KEY_HEADER">API key header</option><option value="BASIC">Basic</option><option value="NONE">None</option></select></div>
            {f.authType==='API_KEY_HEADER'&&<div><label className="label">Header name</label><input className="input !rounded-xl" value={f.apiKeyHeader} onChange={e=>setF({...f,apiKeyHeader:e.target.value})}/></div>}
            <div><label className="label">Amount unit</label><select className="input !rounded-xl" value={f.amountUnit} onChange={e=>setF({...f,amountUnit:e.target.value})}><option value="paise">Paise</option><option value="rupees">Rupees</option></select></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {[['payinPath','Pay-in path'],['payoutPath','Payout path'],['payinStatusPath','Pay-in status'],['payoutStatusPath','Payout status'],['refundPath','Refund path']].map(([k,l])=>(
              <div key={k}><label className="label">{l}</label><input className="input !rounded-xl font-mono !text-[12px]" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></div>
            ))}
          </div>
        </details>
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn !px-6 !rounded-xl" onClick={addProvider}>Add API</button>
          <button className="btn-ghost !rounded-xl" onClick={()=>{setShowAdd(false);setMsg('');}}>Cancel</button>
        </div>
      </div>
    )}
    {msg&&<p className="mt-3 text-[13px] rounded-2xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-700">{msg}</p>}
  </section>
 </div>; }
/** Reports-style pastel KPI boxes for Transactions / Pay-in / Payouts. */
function SoftStatCards({kind,apiSel='',onApiSel}:{kind?:string;apiSel?:string;onApiSel?:(v:string)=>void}){
  const payin=useQuery({queryKey:['adpstats','PAYIN'],queryFn:()=>api('/admin/provider-stats?kind=PAYIN'),refetchInterval:20000,retry:false});
  const payout=useQuery({queryKey:['adpstats','PAYOUT'],queryFn:()=>api('/admin/provider-stats?kind=PAYOUT'),refetchInterval:20000,retry:false});
  const sw=useQ('apiswitch','/admin/api-switch');
  const providers=useQuery({queryKey:['providers'],queryFn:()=>api('/admin/providers'),retry:false});
  if(payin.isLoading||payout.isLoading) return <div className="mb-5"><div className="h-7 w-48 rounded-lg bg-slate-200/60 animate-pulse mb-4"/><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{[1,2,3,4,5].map(i=><div key={i} className="h-[108px] rounded-[22px] bg-slate-200/60 animate-pulse"/>)}</div></div>;
  const pi=payin.data||{}, po=payout.data||{};
  const activeIn=sw.data?.active?.PAYIN?.provider, activeOut=sw.data?.active?.PAYOUT?.provider;
  const fmt=(paise:number)=>{ const n=Number(paise||0)/100; if(n>=10000000) return (n/10000000).toFixed(1)+'Cr'; if(n>=100000) return (n/100000).toFixed(1)+'L'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toLocaleString('en-IN'); };
  const raw=kind==='PAYOUT'?po:kind==='PAYIN'?pi:null;
  const pickSrc=(s:any)=>{
    if(!s) return null;
    if(!apiSel) return s;
    const hit=(s.perProvider||[]).find((x:any)=>(x.providerName||'')===apiSel);
    return hit||{totalAmountPaise:0,totalCount:0,successCount:0,failedCount:0,pendingCount:0,todayAmountPaise:0,todayCount:0};
  };
  const src=pickSrc(raw);
  const srOf=(s:any)=>{ const ok=s.successCount||0, fl=s.failedCount||0; return (ok+fl)?Math.round(ok/(ok+fl)*100):null; };
  const title=kind==='PAYIN'?'Collection overview':kind==='PAYOUT'?'Payouts overview':'Transactions overview';
  const routeName=(p:any)=>p?(p.name||'').split(' (')[0]:'No route';
  const apiOptions=(()=>{
    const fromProv=(providers.data||[]).map((p:any)=>p.name).filter(Boolean);
    const fromStats=[...(pi.perProvider||[]),...(po.perProvider||[])].map((x:any)=>x.providerName).filter(Boolean);
    return [...new Set([...fromProv,...fromStats])].sort((a,b)=>a.localeCompare(b));
  })();
  const ApiSelect=kind&&onApiSel?(
    <span className="relative inline-flex shrink-0">
      <select
        className="appearance-none rounded-full border border-slate-200 bg-white pl-3.5 pr-9 py-2 text-[13px] font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400 focus:border-slate-500 shadow-sm"
        value={apiSel}
        onChange={e=>onApiSel(e.target.value)}
        aria-label="Filter by API"
      >
        <option value="">All APIs</option>
        {apiOptions.map((n:string)=><option key={n} value={n}>{n.split(' (')[0]}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </span>
  ):null;
  if(kind&&src){
    const sr=srOf(src);
    return <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">{title}</h1>
        <div className="ml-auto">{ApiSelect}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="kpi-peach"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{fmt(src.totalAmountPaise)}</p><span className="text-[11px] font-semibold text-emerald-700">↑ {src.successCount||0} ok</span></div><p className="text-[12.5px] font-semibold mt-3">{kind==='PAYIN'?'Total Collection':'Total Payout'}</p><p className="text-[11px] text-slate-500">{inr(src.totalAmountPaise||0)}</p></div>
        <div className="kpi-mint"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{fmt(src.todayAmountPaise)}</p><span className="text-[11px] font-semibold text-emerald-700">↑ {src.todayCount||0} txns</span></div><p className="text-[12.5px] font-semibold mt-3">Today</p><p className="text-[11px] text-slate-500">{inr(src.todayAmountPaise||0)}</p></div>
        <div className="kpi-sky"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{src.totalCount||0}</p><span className="text-[11px] font-semibold text-slate-600">{src.pendingCount||0} pending</span></div><p className="text-[12.5px] font-semibold mt-3">Transactions</p><p className="text-[11px] text-slate-500">{src.totalCount||0} total</p></div>
        <div className="kpi-lilac"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{src.pendingCount||0}</p><span className={`text-[11px] font-semibold ${src.pendingCount?'text-rose-600':'text-emerald-700'}`}>{src.pendingCount?'↓ waiting':'↑ clear'}</span></div><p className="text-[12.5px] font-semibold mt-3">Pending</p><p className="text-[11px] text-slate-500">{src.failedCount||0} failed</p></div>
        <div className="kpi-ink"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{sr==null?'—':sr+'%'}</p><span className="text-[11px] font-semibold text-emerald-400">↑ {sr==null?'no txns':sr>=90?'healthy':sr>=70?'ok':'low'}</span></div><p className="text-[12.5px] font-semibold mt-3 text-white/80">Success rate</p><p className="text-[11px] text-white/45 truncate">{apiSel?apiSel.split(' (')[0]:routeName(kind==='PAYIN'?activeIn:activeOut)}</p></div>
      </div>
    </div>;
  }
  const combinedSr=Math.round(((pi.successCount||0)+(po.successCount||0))/Math.max(1,(pi.successCount||0)+(po.successCount||0)+(pi.failedCount||0)+(po.failedCount||0))*100);
  return <div className="mb-5">
    <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-4">{title}</h1>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <div className="kpi-peach"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{fmt(pi.totalAmountPaise)}</p><span className="text-[11px] font-semibold text-emerald-700">↑ {pi.successCount||0} ok</span></div><p className="text-[12.5px] font-semibold mt-3">Total Collection</p><p className="text-[11px] text-slate-500">{inr(pi.totalAmountPaise||0)}</p></div>
      <div className="kpi-mint"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{fmt(po.totalAmountPaise)}</p><span className="text-[11px] font-semibold text-emerald-700">↑ {po.successCount||0} sent</span></div><p className="text-[12.5px] font-semibold mt-3">Total Payout</p><p className="text-[11px] text-slate-500">{inr(po.totalAmountPaise||0)}</p></div>
      <div className="kpi-sky"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{(pi.totalCount||0)+(po.totalCount||0)}</p><span className="text-[11px] font-semibold text-slate-600">{(pi.pendingCount||0)+(po.pendingCount||0)} pending</span></div><p className="text-[12.5px] font-semibold mt-3">Transactions</p><p className="text-[11px] text-slate-500">Pay-in {pi.totalCount||0} · Payout {po.totalCount||0}</p></div>
      <div className="kpi-lilac"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{(pi.pendingCount||0)+(po.pendingCount||0)}</p><span className={`text-[11px] font-semibold ${((pi.pendingCount||0)+(po.pendingCount||0))?'text-rose-600':'text-emerald-700'}`}>{((pi.pendingCount||0)+(po.pendingCount||0))?'↓ waiting':'↑ clear'}</span></div><p className="text-[12.5px] font-semibold mt-3">Pending</p><p className="text-[11px] text-slate-500">In {pi.pendingCount||0} · Out {po.pendingCount||0}</p></div>
      <div className="kpi-ink"><div className="flex justify-between"><p className="text-[28px] font-bold tnum leading-none">{combinedSr}%</p><span className="text-[11px] font-semibold text-emerald-400">↑ SR</span></div><p className="text-[12.5px] font-semibold mt-3 text-white/80">Success rate</p><p className="text-[11px] text-white/45">Fail {(pi.failedCount||0)+(po.failedCount||0)}</p></div>
    </div>
  </div>;
}

const AttachBadge=({s}:{s:string})=>{
  if(s==='SUCCESS') return <span className="inline-flex rounded-full bg-[#d8f5e6] text-[#1a9e5c] px-2.5 py-[3px] text-[11.5px] font-semibold">Attached</span>;
  if(s==='FAILED') return <span className="inline-flex rounded-full bg-[#eceef1] text-slate-500 px-2.5 py-[3px] text-[11.5px] font-semibold">Missing</span>;
  if(s==='REFUNDED'||s==='PARTIALLY_REFUNDED') return <span className="inline-flex rounded-full bg-indigo-50 text-indigo-600 px-2.5 py-[3px] text-[11.5px] font-semibold">Refunded</span>;
  if(s==='PENDING'||s==='PROCESSING'||s==='UNKNOWN') return <span className="inline-flex rounded-full bg-amber-50 text-amber-700 px-2.5 py-[3px] text-[11.5px] font-semibold">Pending</span>;
  return <span className="text-slate-300">—</span>;
};
const PayinStatus=({s}:{s:string})=>{
  if(s==='SUCCESS') return <span className="inline-flex rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-[3px] text-[11.5px] font-semibold">Success</span>;
  if(s==='FAILED') return <span className="inline-flex rounded-full bg-rose-50 text-rose-600 px-2.5 py-[3px] text-[11.5px] font-semibold">Failed</span>;
  return <span className="inline-flex rounded-full bg-amber-50 text-amber-700 px-2.5 py-[3px] text-[11.5px] font-semibold">Pending</span>;
};
const TxIcon=({kind}:{kind:string})=>(
  <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${kind==='PAYOUT'?'bg-[#eef0f3] text-slate-600':'bg-[#e8f0ff] text-[#2b5cff]'}`}>
    {kind==='PAYOUT'
      ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8"/><path d="M12 14v2"/></svg>
      : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M8 14h3"/></svg>}
  </span>
);
const MethodChip=({name}:{name:string})=>{
  const n=(name||'API').split(' (')[0];
  const initials=n.slice(0,2).toUpperCase();
  return <span className="inline-flex items-center gap-2 text-[13px] text-slate-600">
    <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 grid place-items-center text-[9px] font-extrabold text-slate-500">{initials}</span>
    {n}
  </span>;
};
const signedAmt=(paise:number,kind:string,status?:string)=>{
  const n=Number(paise)/100;
  const abs=n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(status==='FAILED') return {cls:'text-slate-400',txt:abs};
  if(kind==='PAYOUT'||kind==='REFUND') return {cls:'text-[#e5484d]',txt:`−${abs}`};
  return {cls:'text-[#1a9e5c]',txt:`+${abs}`};
};
const totalPaiseOf=(t:any)=>{ if(t.status==='FAILED') return Number(t.amountPaise)||0; const meta:any=t.metadata||{}; if(meta.totalAmountPaise!=null) return Number(meta.totalAmountPaise); return (Number(t.amountPaise)||0)+(Number(t.feePaise)||0); };

/** Screenshot-style transactions desk. */
export function AdminTxns({kind}:{kind?:string}={}){
  const {data,error,isLoading,refetch,isFetching}=useQuery({queryKey:['atx',kind||'ALL'],queryFn:()=>api('/admin/transactions'+(kind?`?kind=${kind}`:'')),refetchInterval:15000,retry:false});
  const [typeBtn,setTypeBtn]=useState<'ALL'|'PAYIN'|'PAYOUT'>(kind==='PAYIN'?'PAYIN':kind==='PAYOUT'?'PAYOUT':'ALL');
  const [statusTab,setStatusTab]=useState('ALL');
  const [q,setQ]=useState(''); const [from,setFrom]=useState(''); const [to,setTo]=useState('');
  const [apiSel,setApiSel]=useState(''); const [showFilters,setShowFilters]=useState(false);
  const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(12);
  const [showDl,setShowDl]=useState(false); const [sel,setSel]=useState<any>(null);

  const exportRows=(list:any[])=>list.map((t:any)=>{ const c=t.customer||{}; return {'Payment ID':t.id,'Type':t.kind,'Merchant Ref':t.merchantRef,'API':(t.apiName||'').split(' (')[0],'Bank RRN / UTR':t.utr||'','Customer':c.name||c.holderName||'','Email':c.email||'','Created On':new Date(t.createdAt).toLocaleString('en-IN'),'Amount (INR)':Number(t.amountPaise)/100,'Fee (INR)':Number(t.feePaise)/100,'Status':t.status}; });
  const downloadExcel=(list:any[])=>{ const ws=XLSX.utils.json_to_sheet(exportRows(list)); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Transactions'); XLSX.writeFile(wb,`syntrix-txns-${new Date().toISOString().slice(0,10)}.xlsx`); };
  const downloadPdf=(list:any[])=>{ const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'}); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('SyntrixAPI — Transactions',40,38); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text(`Generated ${new Date().toLocaleString('en-IN')} · ${list.length} rows`,40,54); const rows=exportRows(list).map(r=>[r['Payment ID'].slice(0,12)+'…',r.Type,r.API,r['Bank RRN / UTR']||'—',r['Created On'],'₹'+Number(r['Amount (INR)']).toLocaleString('en-IN'),r.Status]); autoTable(doc,{startY:66,head:[['Payment ID','Type','API','UTR','Created','Amount','Status']],body:rows,styles:{fontSize:7.5,cellPadding:5},headStyles:{fillColor:[15,23,42],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}}); doc.save(`syntrix-txns-${new Date().toISOString().slice(0,10)}.pdf`); };

  if(error) return <Alert>{(error as Error).message}</Alert>;
  if(isLoading||!data) return <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 rounded-2xl bg-slate-200/70 animate-pulse"/>)}</div>;

  const rows:any[]=data||[];
  const afterType=rows.filter(t=>!kind&&typeBtn!=='ALL'?t.kind===typeBtn:true);
  const cust=(t:any)=>t.customer||{};
  const apis=[...new Set(rows.map((t:any)=>t.apiName).filter(Boolean))];
  const filtered=afterType.filter((t:any)=>{
    if(statusTab==='FAILED'&&t.status!=='FAILED') return false;
    if(statusTab==='CAPTURED'&&t.status!=='SUCCESS') return false;
    if(statusTab==='CREATED'&&!['PENDING','PROCESSING','UNKNOWN'].includes(t.status)) return false;
    if(apiSel&&(t.apiName||'')!==apiSel) return false;
    if(from&&new Date(t.createdAt)<new Date(from)) return false;
    if(to&&new Date(t.createdAt)>new Date(to+'T23:59:59')) return false;
    if(q){ const needle=q.toLowerCase(); if(!`${t.id} ${t.merchantRef} ${t.utr||''} ${t.providerRef||''} ${cust(t).name||''} ${t.apiName||''}`.toLowerCase().includes(needle)) return false; }
    return true;
  });
  const sorted=[...filtered].sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt));
  const pages=Math.max(1,Math.ceil(sorted.length/pageSize)); const pageRows=sorted.slice((page-1)*pageSize,page*pageSize);
  const clear=()=>{ setQ(''); setFrom(''); setTo(''); setApiSel(''); setStatusTab('ALL'); if(!kind) setTypeBtn('ALL'); setPage(1); };
  const tabs=kind
    ? ([['ALL','Overview'],['CAPTURED','Captured'],['CREATED','Pending'],['FAILED','Failed']] as const)
    : ([['ALL','Overview'],['PAYIN','Pay-in'],['PAYOUT','Payout'],['FAILED','Failed']] as const);
  const onTab=(k:string)=>{ if(!kind){ if(k==='FAILED') setStatusTab('FAILED'); else if(k==='PAYIN'||k==='PAYOUT'||k==='ALL'){ setTypeBtn(k as any); setStatusTab('ALL'); } } else setStatusTab(k); setPage(1); };
  const tabActive=(k:string)=> kind?statusTab===k:(k==='FAILED'?statusTab==='FAILED':statusTab!=='FAILED'&&typeBtn===k);
  /** Transactions page: same layouts as Pay-in / Payout pages (Overview defaults to payout columns). */
  const tableKind=kind||(typeBtn==='PAYIN'?'PAYIN':'PAYOUT');
  return <div className="w-full h-[calc(100vh-150px)] min-h-[520px] flex flex-col">
    <div className="shrink-0"><SoftStatCards kind={kind} apiSel={apiSel} onApiSel={v=>{setApiSel(v);setPage(1);}}/></div>

    {/* Tabs + actions */}
    <div className="flex flex-wrap items-end gap-3 mb-1 border-b border-slate-200/80 shrink-0">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(([k,l])=>(
          <button key={k} onClick={()=>onTab(k)} className={`relative px-3.5 pb-3 pt-1 text-[14px] whitespace-nowrap transition ${tabActive(k)?'text-slate-900 font-semibold':'text-slate-400 font-medium hover:text-slate-700'}`}>
            {l}
            {tabActive(k)&&<span className="absolute inset-x-2 bottom-0 h-[2px] bg-slate-900 rounded-full"/>}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 pb-2">
        <button onClick={()=>setShowFilters(v=>!v)} className={`h-9 px-3.5 rounded-full border text-[13px] font-semibold transition ${showFilters?'border-slate-900 bg-slate-900 text-white':'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Filters</button>
        <button onClick={()=>setShowDl(true)} className="h-9 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition shadow-sm">Export</button>
      </div>
    </div>

    {/* Search / filters drawer strip */}
    <div className={`flex flex-wrap items-center gap-2 py-3 shrink-0 ${showFilters?'':'hidden'}`}>
      <div className="flex items-center rounded-full border border-slate-200 bg-white overflow-hidden focus-within:border-slate-400 pl-3">
        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input className="w-[220px] px-2.5 py-2 text-[13px] outline-none" placeholder="Search ID, UTR, customer…" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/>
      </div>
      <input type="date" className="rounded-full border border-slate-200 px-3 py-2 text-[12.5px] outline-none bg-white" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}}/>
      <input type="date" className="rounded-full border border-slate-200 px-3 py-2 text-[12.5px] outline-none bg-white" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}}/>
      <select className="rounded-full border border-slate-200 pl-3 pr-8 py-2 text-[12.5px] font-semibold text-slate-600 outline-none bg-white" value={apiSel} onChange={e=>{setApiSel(e.target.value);setPage(1);}}>
        <option value="">All APIs</option>{apis.map((o:any)=><option key={o} value={o}>{o}</option>)}
      </select>
      {(q||from||to||apiSel)&&<button className="text-[12.5px] font-semibold text-red-500 hover:underline" onClick={clear}>Reset</button>}
      <span className="ml-auto text-[12px] text-slate-400 flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${isFetching?'bg-amber-400':'bg-emerald-500'}`}/>{isFetching?'Refreshing…':'Live'} · <button className="font-semibold text-slate-600 hover:underline" onClick={()=>refetch()}>Refresh</button></span>
    </div>

    {/* Table — fills remaining space from overview down to page bottom */}
    <div className="bg-white rounded-[16px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] overflow-hidden flex-1 min-h-0 flex flex-col">
      {!filtered.length?(
        <div className="flex-1 grid place-items-center py-16 text-center">
          <div>
            <p className="font-semibold text-slate-700">No transactions</p>
            <p className="text-[13px] text-slate-400 mt-1">Try another filter or clear search.</p>
            <button className="mt-3 text-[13px] font-semibold text-slate-900 underline" onClick={clear}>Clear filters</button>
          </div>
        </div>
      ):(
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-[13.5px]">
            <thead className="sticky top-0 bg-white z-[1]">
              <tr className="text-left text-[12px] text-slate-400 border-b border-slate-100">
                {tableKind==='PAYOUT'?(
                  <>
                    <th className="pl-5 py-3 pr-3 font-medium whitespace-nowrap">Initiated At</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Transaction ID</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Reference ID</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Beneficiary</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Bank Details</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Mobile</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">UTR Number</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Amount</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Total Amount</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Opening Balance</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Closing Balance</th>
                    <th className="py-3 pr-3 font-medium whitespace-nowrap">Mode</th>
                    <th className="py-3 pr-5 font-medium whitespace-nowrap">Status</th>
                  </>
                ):tableKind==='PAYIN'?(
                  <>
                    <th className="pl-5 py-3 pr-3 font-medium">Member</th>
                    <th className="py-3 pr-3 font-medium">Amount</th>
                    <th className="py-3 pr-3 font-medium">Customer detail</th>
                    <th className="py-3 pr-3 font-medium">Payment ID</th>
                    <th className="py-3 pr-3 font-medium">Bank RRN</th>
                    <th className="py-3 pr-3 font-medium">Created on</th>
                    <th className="py-3 pr-5 font-medium">Status</th>
                  </>
                ):(
                  <>
                    <th className="pl-5 py-3 pr-3 font-medium">Transaction</th>
                    <th className="py-3 pr-3 font-medium">Method</th>
                    <th className="py-3 pr-3 font-medium">Date</th>
                    <th className="py-3 pr-3 font-medium">Status</th>
                    <th className="py-3 pr-5 font-medium text-right">Amount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t:any)=>{
                const c=cust(t); const label=c.name||c.holderName||t.merchantRef||(t.kind==='PAYIN'?'Pay-in':'Payout');
                const amt=signedAmt(t.amountPaise,t.kind,t.status);
                const custLine=c.name||c.holderName||c.email||null;
                const meta:any=t.metadata||{};
                const totalPaise=totalPaiseOf(t);
                const openBal=meta.openingBalancePaise!=null?Number(meta.openingBalancePaise):null;
                const closeBal=meta.closingBalancePaise!=null?Number(meta.closingBalancePaise):null;
                const mode=meta.mode||meta.method||'IMPS';
                if(tableKind==='PAYOUT') return (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-[#fafbfd] transition cursor-pointer" onClick={()=>setSel(t)}>
                    <td className="pl-5 py-3.5 pr-3 text-slate-500 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})}</td>
                    <td className="py-3.5 pr-3 font-mono text-[12px] text-slate-700 whitespace-nowrap" title={t.id}>{t.id.slice(0,10)}…{t.id.slice(-4)}</td>
                    <td className="py-3.5 pr-3 font-mono text-[12px] text-slate-600 whitespace-nowrap" title={t.merchantRef}>{t.merchantRef}</td>
                    <td className="py-3.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">{c.name||c.holderName||'—'}</td>
                    <td className="py-3.5 pr-3 text-slate-600 whitespace-nowrap">
                      {c.account||c.ifsc?(
                        <span className="block">
                          <span className="block font-mono text-[12px] text-slate-800">{c.account||'—'}</span>
                          <span className="block text-[11.5px] text-slate-400">{c.ifsc||''}</span>
                        </span>
                      ):<span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3.5 pr-3 text-slate-600 whitespace-nowrap tnum">{c.phone||c.mobile||'—'}</td>
                    <td className="py-3.5 pr-3 font-mono text-[12px] text-slate-500 whitespace-nowrap">{t.utr||'—'}</td>
                    <td className={`py-3.5 pr-3 font-semibold tnum whitespace-nowrap ${amt.cls}`}>{amt.txt}</td>
                    <td className="py-3.5 pr-3 font-semibold tnum text-slate-900 whitespace-nowrap">{inr(totalPaise)}</td>
                    <td className="py-3.5 pr-3 tnum text-slate-600 whitespace-nowrap">{openBal!=null?inr(openBal):'—'}</td>
                    <td className="py-3.5 pr-3 tnum text-slate-600 whitespace-nowrap">{closeBal!=null?inr(closeBal):'—'}</td>
                    <td className="py-3.5 pr-3 text-slate-600 whitespace-nowrap"><span className="inline-flex rounded-md bg-slate-100 px-2 py-[2px] text-[11.5px] font-semibold">{mode}</span></td>
                    <td className="py-3.5 pr-5"><PayinStatus s={t.status}/></td>
                  </tr>
                );
                if(tableKind==='PAYIN') return (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-[#fafbfd] transition cursor-pointer" onClick={()=>setSel(t)}>
                    <td className="pl-5 py-3.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">Trust Setu</td>
                    <td className={`py-3.5 pr-3 font-semibold tnum whitespace-nowrap ${amt.cls}`}>{amt.txt}</td>
                    <td className="py-3.5 pr-3 min-w-0">
                      {custLine?(
                        <span className="block min-w-0">
                          <span className="block font-semibold text-slate-900 truncate max-w-[180px]">{custLine}</span>
                          <span className="block text-[11.5px] text-slate-400 truncate max-w-[180px]">{c.email||c.phone||''}</span>
                        </span>
                      ):<span className="text-slate-300 text-[12.5px]">—</span>}
                    </td>
                    <td className="py-3.5 pr-3 font-mono text-[12px] text-slate-700 whitespace-nowrap" title={t.id}>{t.id.slice(0,10)}…{t.id.slice(-4)}</td>
                    <td className="py-3.5 pr-3 font-mono text-[12px] text-slate-500 whitespace-nowrap">{t.utr||'—'}</td>
                    <td className="py-3.5 pr-3 text-slate-500 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})}</td>
                    <td className="py-3.5 pr-5"><PayinStatus s={t.status}/></td>
                  </tr>
                );
                return (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-[#fafbfd] transition group">
                    <td className="pl-5 py-3.5 pr-3 cursor-pointer" onClick={()=>setSel(t)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <TxIcon kind={t.kind}/>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate max-w-[220px]">{label}</p>
                          <p className="text-[11.5px] text-slate-400 font-mono truncate">{t.id.slice(0,14)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-3 cursor-pointer" onClick={()=>setSel(t)}><MethodChip name={t.apiName||'API'}/></td>
                    <td className="py-3.5 pr-3 text-slate-500 whitespace-nowrap cursor-pointer" onClick={()=>setSel(t)}>{new Date(t.createdAt).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'})}</td>
                    <td className="py-3.5 pr-3 cursor-pointer" onClick={()=>setSel(t)}><AttachBadge s={t.status}/></td>
                    <td className={`py-3.5 pr-5 text-right font-semibold tnum whitespace-nowrap cursor-pointer ${amt.cls}`} onClick={()=>setSel(t)}>{amt.txt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-slate-50 shrink-0">
        <p className="text-[12px] text-slate-400">{filtered.length?(page-1)*pageSize+1:0}–{Math.min(page*pageSize,filtered.length)} of {filtered.length}</p>
        <select className="rounded-lg border border-slate-200 px-2 py-1 text-[12px] text-slate-500 outline-none bg-white" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[12,25,50].map(n=><option key={n} value={n}>{n} / page</option>)}</select>
        <div className="flex items-center gap-1.5 ml-auto">
          <button disabled={page<=1} onClick={()=>setPage(page-1)} className="px-3 py-1.5 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600 disabled:opacity-35 hover:bg-slate-50">Prev</button>
          <span className="text-[12.5px] font-semibold text-slate-500 px-1">{page}/{pages}</span>
          <button disabled={page>=pages} onClick={()=>setPage(page+1)} className="px-3 py-1.5 rounded-full border border-slate-200 text-[12.5px] font-semibold text-slate-600 disabled:opacity-35 hover:bg-slate-50">Next</button>
        </div>
      </div>
    </div>

    {sel&&<div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]" onClick={()=>setSel(null)}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[400px] bg-white shadow-2xl overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between z-10">
          <div><h3 className="font-bold text-slate-900 text-[16px]">Transaction</h3><p className="font-mono text-[11px] text-slate-400 mt-0.5 break-all">{sel.id}</p></div>
          <button className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500" onClick={()=>setSel(null)}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className={`text-[28px] font-bold tnum ${signedAmt(sel.amountPaise,sel.kind,sel.status).cls}`}>{signedAmt(sel.amountPaise,sel.kind,sel.status).txt} <span className="text-[13px] text-slate-400 font-semibold">INR</span></p>
            <AttachBadge s={sel.status}/>
          </div>
          <div className="rounded-2xl bg-[#f6f7f9] p-4 space-y-2.5 text-[13px]">
            {(sel.kind==='PAYOUT'?[
              ['Initiated At',new Date(sel.createdAt).toLocaleString('en-IN')],
              ['Transaction ID',sel.id],
              ['Reference ID',sel.merchantRef],
              ['Beneficiary',sel.customer?.name||sel.customer?.holderName||'—'],
              ['Bank Details',[sel.customer?.account,sel.customer?.ifsc].filter(Boolean).join(' · ')||'—'],
              ['Mobile',sel.customer?.phone||sel.customer?.mobile||'—'],
              ['UTR Number',sel.utr||'—'],
              ['Amount',inr(sel.amountPaise)],
              ['Total Amount',inr(totalPaiseOf(sel))],
              ['Opening Balance',sel.metadata?.openingBalancePaise!=null?inr(Number(sel.metadata.openingBalancePaise)):'—'],
              ['Closing Balance',sel.metadata?.closingBalancePaise!=null?inr(Number(sel.metadata.closingBalancePaise)):'—'],
              ['Mode',sel.metadata?.mode||sel.metadata?.method||'IMPS'],
              ['Status',sel.status],
              ['API',(sel.apiName||'—').split(' (')[0]],
            ]:[
              ['Type',sel.kind==='PAYIN'?'Pay-in':sel.kind],
              ['API',(sel.apiName||'—').split(' (')[0]],
              ['Merchant Ref',sel.merchantRef],
              ['UTR',sel.utr||'—'],
              ['Customer',sel.customer?.name||'—'],
              ['Created',new Date(sel.createdAt).toLocaleString('en-IN')],
            ]).map(([k,v]:any)=>(
              <div key={k} className="flex justify-between gap-3"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-700 text-right break-all">{v}</span></div>
            ))}
          </div>
          <button className="w-full h-10 rounded-full border border-slate-200 text-[13px] font-semibold hover:bg-slate-50" onClick={()=>navigator.clipboard?.writeText(sel.id)}>Copy Payment ID</button>
        </div>
      </div>
    </div>}

    {showDl&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 backdrop-blur-[2px] p-4" onClick={()=>setShowDl(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[360px] p-6" onClick={e=>e.stopPropagation()}>
        <h3 className="font-bold text-slate-900 text-[16px]">Export</h3>
        <p className="text-[13px] text-slate-500 mt-1"><b>{filtered.length}</b> rows with current filters.</p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={()=>{downloadExcel(filtered);setShowDl(false);}} className="rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition p-4 text-left"><span className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center font-extrabold text-[12px]">XLS</span><span className="block font-bold text-slate-800 mt-2">Excel</span></button>
          <button onClick={()=>{downloadPdf(filtered);setShowDl(false);}} className="rounded-2xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition p-4 text-left"><span className="w-10 h-10 rounded-xl bg-red-500 text-white grid place-items-center font-extrabold text-[12px]">PDF</span><span className="block font-bold text-slate-800 mt-2">PDF</span></button>
        </div>
        <button className="w-full mt-4 h-10 rounded-full border border-slate-200 text-[13px] font-semibold" onClick={()=>setShowDl(false)}>Cancel</button>
      </div>
    </div>}
  </div>;
}
/** OsTørk-style per-API collection / payout analytics. */
export function AdminApiReport({endpoint}:{endpoint?:string}={}){
  const base=endpoint||'/admin/provider-stats';
  const isMerchant=base.startsWith('/merchant');
  const trendEp=isMerchant?'/merchant/daily-trend':'/admin/daily-trend';
  const txnEp=isMerchant?'/merchant/transactions':'/admin/transactions';
  const [kind,setKind]=useState<'PAYIN'|'PAYOUT'>('PAYIN');
  const [days,setDays]=useState(14);
  const [showDl,setShowDl]=useState(false);
  const [q,setQ]=useState('');
  const [apiId,setApiId]=useState('');
  const [txnKind,setTxnKind]=useState<'ALL'|'PAYIN'|'PAYOUT'>('ALL');
  const {data,error,isLoading,refetch,isFetching}=useQuery({queryKey:['apireport',base,kind],queryFn:()=>api(`${base}?kind=${kind}`),refetchInterval:20000,retry:false});
  const otherKind=kind==='PAYIN'?'PAYOUT':'PAYIN';
  const other=useQuery({queryKey:['apireport',base,otherKind],queryFn:()=>api(`${base}?kind=${otherKind}`),refetchInterval:20000,retry:false});
  const trend=useQuery({queryKey:['apitrend',trendEp,days],queryFn:()=>api(`${trendEp}?days=${days}`),retry:false});
  const apiTxns=useQuery({queryKey:['apireport-txns',txnEp,apiId],queryFn:()=>api(`${txnEp}?providerId=${apiId}`),enabled:!!apiId,refetchInterval:15000,retry:false});
  const sw=useQ('apiswitch','/admin/api-switch');
  const activeId=sw.data?.active?.[kind]?.providerId||sw.data?.active?.[kind]?.provider?.id;

  const exportRows=(list:any[],total:number)=>list.map((r:any,i:number)=>({Rank:i+1,API:(r.providerName||'').split(' (')[0],Code:r.providerCode,Type:kind==='PAYIN'?'Collection':'Payout','Total (INR)':Number(r.totalAmountPaise)/100,'Today (INR)':Number(r.todayAmountPaise)/100,Transactions:r.totalCount,Success:r.successCount,Failed:r.failedCount,Pending:r.pendingCount,'Success %':r.successRate,'Share %':total?Math.round(Number(r.totalAmountPaise)/total*1000)/10:0}));
  const downloadExcel=(list:any[],total:number)=>{ const ws=XLSX.utils.json_to_sheet(exportRows(list,total)); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,kind==='PAYIN'?'Collection':'Payout'); XLSX.writeFile(wb,`syntrix-api-report-${kind.toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`); };
  const downloadPdf=(list:any[],total:number)=>{ const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'}); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(`SyntrixAPI — Per-API ${kind==='PAYIN'?'Collection':'Payout'} Report`,40,38); const body=exportRows(list,total).map(r=>[r.Rank,r.API,r.Code,'₹'+Number(r['Total (INR)']).toLocaleString('en-IN'),String(r.Transactions),String(r.Success),r['Success %']+'%',r['Share %']+'%']); autoTable(doc,{startY:56,head:[['#','API','Code','Total','Txns','OK','SR%','Share']],body,styles:{fontSize:8,cellPadding:5},headStyles:{fillColor:[15,23,42],textColor:255}}); doc.save(`syntrix-api-report-${kind.toLowerCase()}-${new Date().toISOString().slice(0,10)}.pdf`); };

  if(error) return <Alert>{(error as Error).message}</Alert>;
  if(isLoading||!data) return <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-24 rounded-[22px] bg-slate-200/60 animate-pulse"/>)}</div>;

  const allApisMap=new Map<string,any>();
  for(const r of [...(data.perProvider||[]),...(other.data?.perProvider||[])]){
    if(!r.providerId) continue;
    const prev=allApisMap.get(r.providerId);
    if(!prev||Number(r.totalAmountPaise)>Number(prev.totalAmountPaise)) allApisMap.set(r.providerId,r);
  }
  const apiOptions=[...allApisMap.values()].sort((a,b)=>Number(b.totalAmountPaise)-Number(a.totalAmountPaise));
  const selectedRow=(data.perProvider||[]).find((r:any)=>r.providerId===apiId);
  const selectedOther=(other.data?.perProvider||[]).find((r:any)=>r.providerId===apiId);
  const rows:any[]=(data.perProvider||[]).filter((r:any)=>!q||`${r.providerName} ${r.providerCode}`.toLowerCase().includes(q.toLowerCase()));
  const scope=apiId&&selectedRow?selectedRow:data;
  const total=Number(scope.totalAmountPaise||0);
  const label=kind==='PAYIN'?'Collection':'Payout';
  const selectedName=apiId?(allApisMap.get(apiId)?.providerName||'API').split(' (')[0]:'';
  const sr=((scope.successCount||0)+(scope.failedCount||0))?Math.round((scope.successCount||0)/((scope.successCount||0)+(scope.failedCount||0))*100):null;
  const pts:any[]=trend.data?.points||[];
  const trendKey=kind==='PAYIN'?'payinPaise':'payoutPaise';
  const chartApis=rows.slice(0,8);
  const maxApi=Math.max(1,...chartApis.map((r:any)=>Number(r.totalAmountPaise)||0));
  const okShare=scope.totalCount?Math.round((scope.successCount||0)/scope.totalCount*100):0;
  const failShare=scope.totalCount?Math.round((scope.failedCount||0)/scope.totalCount*100):0;
  const pendShare=Math.max(0,100-okShare-failShare);
  const fmtShort=(paise:number)=>{ const n=Number(paise)/100; if(n>=10000000) return (n/10000000).toFixed(1)+'Cr'; if(n>=100000) return (n/100000).toFixed(1)+'L'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toLocaleString('en-IN'); };
  const avatars=['#111','#f4a28c','#9ad4b5','#9ec5e8','#c9b8e8','#f0c96a'];
  const txnRows:any[]=((apiTxns.data||[]) as any[]).filter(t=>txnKind==='ALL'?true:t.kind===txnKind);
  const txnPayin=txnRows.filter(t=>t.kind==='PAYIN');
  const txnPayout=txnRows.filter(t=>t.kind==='PAYOUT');

  return <div className="w-full">
    {/* Top nav tabs */}
    <div className="flex flex-wrap items-center gap-1 mb-6">
      {([['PAYIN','Collection'],['PAYOUT','Payout']] as const).map(([k,l])=>(
        <button key={k} onClick={()=>setKind(k)} className={`px-3.5 py-2 rounded-xl text-[12.5px] font-bold tracking-[.04em] uppercase transition ${kind===k?'bg-white text-slate-900 shadow-sm border border-slate-200/80':'text-slate-400 hover:text-slate-700'}`}>
          {kind===k&&<span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-900 mr-1.5 align-middle"/>}{l}
        </button>
      ))}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none cursor-pointer" value={apiId} onChange={e=>{setApiId(e.target.value);setTxnKind('ALL');}}>
          <option value="">All APIs</option>
          {apiOptions.map((r:any)=><option key={r.providerId} value={r.providerId}>{(r.providerName||'').split(' (')[0]} ({r.providerCode})</option>)}
        </select>
        <button onClick={()=>refetch()} className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50">{isFetching?'…':'Refresh'}</button>
        <button onClick={()=>setShowDl(true)} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black">Export +</button>
      </div>
    </div>

    <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-4">{apiId?`${selectedName} · ${label}`:'Analytics Overview'}</h1>

    {/* Pastel KPI strip */}
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
      {[
        {l:`Total ${label}`,v:fmtShort(total),full:inr(total),chg:`${scope.successCount||0} ok`,up:true,bg:'bg-[#f8d5c8]',fg:'text-slate-900'},
        {l:'Today',v:fmtShort(scope.todayAmountPaise||0),full:inr(scope.todayAmountPaise||0),chg:`${scope.todayCount||0} txns`,up:true,bg:'bg-[#d8f0e2]',fg:'text-slate-900'},
        {l:'Transactions',v:String(scope.totalCount||0),full:`${scope.totalCount||0} total`,chg:`${scope.pendingCount||0} pending`,up:(scope.pendingCount||0)<5,bg:'bg-[#d6e8f7]',fg:'text-slate-900'},
        {l:apiId?'Other side':`APIs live`,v:apiId?fmtShort(selectedOther?.totalAmountPaise||0):String(rows.length),full:apiId?`${otherKind==='PAYIN'?'Collection':'Payout'} · ${selectedOther?.totalCount||0} txns`:`${rows.length} providers`,chg:apiId?`${selectedOther?.successCount||0} ok`:(activeId?'1 routing':'none'),up:apiId?true:!!activeId,bg:'bg-[#e4daf5]',fg:'text-slate-900'},
        {l:'Success rate',v:sr+'%',full:`Fail ${scope.failedCount||0}`,chg:sr>=90?'healthy':sr>=70?'ok':'low',up:sr>=90,bg:'bg-slate-900',fg:'text-white'},
      ].map(c=>(
        <div key={c.l} className={`${c.bg} ${c.fg} rounded-[22px] px-4 py-4 min-h-[108px] flex flex-col justify-between`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[28px] leading-none font-bold tnum tracking-tight`}>{c.v}</p>
            <span className={`text-[11px] font-semibold whitespace-nowrap ${c.bg==='bg-slate-900'?(c.up?'text-emerald-400':'text-rose-300'):(c.up?'text-emerald-700':'text-rose-600')}`}>{c.up?'↑':'↓'} {c.chg}</span>
          </div>
          <div>
            <p className={`text-[12.5px] font-semibold mt-3 ${c.bg==='bg-slate-900'?'text-white/80':'text-slate-700'}`}>{c.l}</p>
            <p className={`text-[11px] mt-0.5 truncate ${c.bg==='bg-slate-900'?'text-white/45':'text-slate-500'}`}>{c.full}</p>
          </div>
        </div>
      ))}
    </div>

    {/* Charts row */}
    <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 mb-5">
      {/* Stacked capsule bars — daily trend */}
      <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="text-[15px] font-bold text-slate-900">API volume trend</h2>
          <div className="ml-auto flex rounded-full bg-slate-100 p-0.5">
            {[7,14,30].map(d=><button key={d} onClick={()=>setDays(d)} className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold ${days===d?'bg-white shadow text-slate-900':'text-slate-500'}`}>{d}D</button>)}
          </div>
        </div>
        <TrendBars points={pts} valueKey={trendKey} fmt={fmtShort} height={200}/>
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><p className="text-[18px] font-bold tnum text-slate-900">{data.successCount||0}</p><p className="text-[11.5px] text-slate-400">Successful</p></div>
          <div><p className="text-[18px] font-bold tnum text-slate-900">{data.failedCount||0}</p><p className="text-[11.5px] text-slate-400">Failed</p></div>
          <div><p className="text-[18px] font-bold tnum text-slate-900">{rows.length}</p><p className="text-[11.5px] text-slate-400">APIs</p></div>
          <div><p className="text-[18px] font-bold tnum text-emerald-600">{sr==null?'—':`+${sr}%`}</p><p className="text-[11.5px] text-slate-400">Success rate</p></div>
        </div>
      </div>

      {/* Scatter + share */}
      <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5 flex flex-col">
        <h2 className="text-[15px] font-bold text-slate-900 mb-1">API performance map</h2>
        <p className="text-[11.5px] text-slate-400 mb-3">Volume vs success rate</p>
        <div className="relative flex-1 min-h-[160px] rounded-2xl bg-[#f7f8fa] border border-slate-100 overflow-hidden">
          <div className="absolute inset-0 opacity-40" style={{backgroundImage:'linear-gradient(#e5e7eb 1px,transparent 1px),linear-gradient(90deg,#e5e7eb 1px,transparent 1px)',backgroundSize:'20% 25%'}}/>
          {chartApis.map((r:any,i:number)=>{
            const x=8+Math.min(84,(Number(r.totalAmountPaise)/maxApi)*84);
            const y=12+Math.min(70,(100-(r.successRate||0))*0.7);
            return <div key={r.providerId||i} title={`${(r.providerName||'').split(' (')[0]} · ${inr(r.totalAmountPaise)} · ${r.successRate}%`}
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 cursor-default"
              style={{left:`${x}%`,top:`${y}%`,background:i%2? '#f4a28c':'#7eb6e8'}}/>;
          })}
          {!chartApis.length&&<p className="absolute inset-0 grid place-items-center text-[12px] text-slate-400">No API data</p>}
          <span className="absolute left-2 bottom-1.5 text-[9px] text-slate-400">low volume</span>
          <span className="absolute right-2 bottom-1.5 text-[9px] text-slate-400">high volume</span>
        </div>
        <div className="mt-4 h-2.5 rounded-full overflow-hidden flex bg-slate-100">
          <div className="bg-slate-900 h-full" style={{width:okShare+'%'}}/>
          <div className="bg-slate-500 h-full" style={{width:failShare+'%'}}/>
          <div className="bg-slate-300 h-full" style={{width:pendShare+'%'}}/>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
          <div><b className="tnum text-slate-900">{(data.successCount||0).toLocaleString('en-IN')}</b><span className="text-slate-400"> Success</span><span className="text-emerald-600 font-semibold ml-1">+{okShare}%</span></div>
          <div><b className="tnum text-slate-900">{(data.failedCount||0).toLocaleString('en-IN')}</b><span className="text-slate-400"> Failed</span><span className="text-rose-500 font-semibold ml-1">−{failShare}%</span></div>
          <div><b className="tnum text-slate-900">{(data.pendingCount||0).toLocaleString('en-IN')}</b><span className="text-slate-400"> Pending</span></div>
          <div><b className="tnum text-emerald-600">{sr==null?'—':`+${sr}%`}</b><span className="text-slate-400"> Net SR</span></div>
        </div>
      </div>
    </div>

    {/* Top performers + share list */}
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
      <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase">Top APIs</h2>
          <div className="ml-auto flex items-center rounded-full border border-slate-200 bg-[#f7f8fa] overflow-hidden pl-2.5">
            <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input className="w-[140px] bg-transparent px-2 py-1.5 text-[12.5px] outline-none" placeholder="Search API" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
        </div>
        {!rows.length?(
          <p className="py-10 text-center text-[13px] text-slate-400">No API transactions for {label.toLowerCase()} yet.</p>
        ):rows.slice(0,8).map((r:any,i:number)=>{
          const name=(r.providerName||'Unknown').split(' (')[0];
          const isActive=activeId&&r.providerId===activeId;
          const isSel=apiId===r.providerId;
          return (
            <button key={r.providerId||i} type="button" onClick={()=>{setApiId(isSel?'':r.providerId);setTxnKind('ALL');}} className={`w-full flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 text-left rounded-xl px-1 -mx-1 transition ${isSel?'bg-slate-50 ring-1 ring-slate-200':''}`}>
              <span className="w-10 h-10 rounded-full grid place-items-center text-[11px] font-extrabold text-white shrink-0" style={{background:avatars[i%avatars.length]}}>{(r.providerCode||'API').slice(0,2)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 text-[13.5px] truncate">{name}{isActive&&<span className="ml-1.5 text-[10px] text-emerald-600 font-bold">ROUTING</span>}{isSel&&<span className="ml-1.5 text-[10px] text-slate-500 font-bold">SELECTED</span>}</p>
                <p className="text-[11.5px] text-slate-400">{r.providerCode} · {r.successCount} ok / {r.failedCount} fail</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900 tnum text-[14px]">{r.totalCount.toLocaleString('en-IN')}</p>
                <p className="text-[12px] font-semibold text-emerald-600 tnum">+{inr(r.totalAmountPaise)}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5">
        <h2 className="text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase mb-4">By API share</h2>
        <div className="space-y-3.5">
          {rows.slice(0,6).map((r:any,i:number)=>{
            const name=(r.providerName||'Unknown').split(' (')[0];
            const share=total?Math.round(Number(r.totalAmountPaise)/total*1000)/10:0;
            return (
              <div key={r.providerId||i}>
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span className="font-semibold text-slate-800 truncate pr-2">{name}</span>
                  <span className="text-slate-500 tnum shrink-0">{share}% · {inr(r.totalAmountPaise)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{width:Math.max(3,share)+'%',background:avatars[i%avatars.length]}}/>
                </div>
              </div>
            );
          })}
          {!rows.length&&<p className="text-[13px] text-slate-400 py-8 text-center">No share data</p>}
        </div>
        {rows.length>0&&(
          <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between text-[12.5px]">
            <span className="text-slate-400">{apiId?'Selected API total':'All APIs total'}</span>
            <span className="font-bold text-slate-900 tnum">{inr(total)}</span>
          </div>
        )}
      </div>
    </div>

    {/* Selected API — pay-in + payout transactions */}
    {apiId&&(
      <div className="mt-5 bg-white rounded-[24px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{selectedName} transactions</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Collection <b className="text-slate-700">{txnPayin.length}</b>
              <span className="mx-1.5">·</span>
              Payout <b className="text-slate-700">{txnPayout.length}</b>
              <span className="mx-1.5">·</span>
              Captured <b className="text-emerald-600 tnum">{inr(txnRows.filter(t=>t.status==='SUCCESS'&&t.kind==='PAYIN').reduce((a,t)=>a+Number(t.amountPaise),0))}</b>
              <span className="mx-1.5">·</span>
              Paid out <b className="text-rose-600 tnum">{inr(txnRows.filter(t=>t.status==='SUCCESS'&&t.kind==='PAYOUT').reduce((a,t)=>a+Number(t.amountPaise),0))}</b>
            </p>
          </div>
          <div className="ml-auto flex rounded-full bg-slate-100 p-0.5">
            {([['ALL','All'],['PAYIN','Collection'],['PAYOUT','Payout']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTxnKind(k)} className={`px-3 py-1 rounded-full text-[11.5px] font-bold transition ${txnKind===k?'bg-white shadow text-slate-900':'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <button className="text-[12.5px] font-semibold text-slate-500 hover:text-slate-800" onClick={()=>setApiId('')}>Clear</button>
        </div>
        {apiTxns.isLoading?(
          <div className="p-5 space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
        ):!txnRows.length?(
          <p className="py-12 text-center text-[13px] text-slate-400">No {txnKind==='ALL'?'':' '+txnKind.toLowerCase()} transactions for this API yet.</p>
        ):(
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  {['Type','Status','Reference','UTR','Amount','Fee','Date'].map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {txnRows.slice(0,100).map((t:any)=>{
                  const pay=t.kind==='PAYOUT'||t.kind==='REFUND';
                  return (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.kind==='PAYIN'?'bg-sky-50 text-sky-700':'bg-violet-50 text-violet-700'}`}>{t.kind==='PAYIN'?'Collection':'Payout'}</span></td>
                      <td className="px-5 py-3"><StatusPill s={t.status}/></td>
                      <td className="px-5 py-3 font-mono text-[12px] text-slate-600">{t.merchantRef||t.id.slice(0,14)}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{t.utr||'—'}</td>
                      <td className={`px-5 py-3 font-bold tnum ${pay?'text-rose-600':'text-emerald-600'}`}>{pay?'−':'+'}{inr(t.amountPaise)}</td>
                      <td className="px-5 py-3 tnum text-slate-500">{inr(t.feePaise)}</td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

    {showDl&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 backdrop-blur-[2px] p-4" onClick={()=>setShowDl(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[360px] p-6" onClick={e=>e.stopPropagation()}>
        <h3 className="font-bold text-slate-900 text-[16px]">Export API Report</h3>
        <p className="text-[13px] text-slate-500 mt-1">{label} · <b>{rows.length}</b> APIs</p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={()=>{downloadExcel(rows,total);setShowDl(false);}} className="rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition p-4 text-left"><span className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center font-extrabold text-[12px]">XLS</span><span className="block font-bold text-slate-800 mt-2">Excel</span></button>
          <button onClick={()=>{downloadPdf(rows,total);setShowDl(false);}} className="rounded-2xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition p-4 text-left"><span className="w-10 h-10 rounded-xl bg-red-500 text-white grid place-items-center font-extrabold text-[12px]">PDF</span><span className="block font-bold text-slate-800 mt-2">PDF</span></button>
        </div>
        <button className="w-full mt-4 h-10 rounded-full border border-slate-200 text-[13px] font-semibold" onClick={()=>setShowDl(false)}>Cancel</button>
      </div>
    </div>}
  </div>;
}
export function AdminApprovals(){ const {data}=useQ('aappr','/admin/pending-approvals'); const qc=useQueryClient(); return <div className="card"><h3 className="font-bold mb-3">Maker-checker queue</h3><p className="text-sm text-slate-500 mb-3">Sensitive changes, large refunds and payouts need a second approver — the requester cannot approve their own item.</p>{!data?.length&&<p className="text-sm text-slate-500">Nothing awaiting a checker.</p>}{data?.map((a:any)=><div key={a.id} className="flex justify-between border rounded-xl px-4 py-3 mb-2 text-sm"><span><b>{a.kind}</b> · {JSON.stringify(a.payload).slice(0,120)}</span><span className="flex gap-2"><button className="text-emerald-600 font-semibold" onClick={async()=>{await api(`/admin/pending-approvals/${a.id}/decide`,{method:'POST',body:{approve:true}});qc.invalidateQueries();}}>Approve</button><button className="text-red-600 font-semibold" onClick={async()=>{await api(`/admin/pending-approvals/${a.id}/decide`,{method:'POST',body:{approve:false}});qc.invalidateQueries();}}>Reject</button></span></div>)}</div>; }
export function AdminRecon(){ const runs=useQ('arecon','/admin/reconciliation'); const qc=useQueryClient(); return <div className="card"><div className="flex justify-between mb-3"><h3 className="font-bold">Reconciliation</h3><button className="btn" onClick={async()=>{await api('/admin/reconcile',{method:'POST',body:{}});qc.invalidateQueries({queryKey:['arecon']});}}>Run reconciliation</button></div>{runs.data?.map((r:any)=><div key={r.id} className="border rounded-xl px-4 py-3 mb-2 text-sm"><b>{r.status}</b> · {new Date(r.startedAt).toLocaleString()} · {r.items?.length||0} items checked</div>)}{!runs.data?.length&&<p className="text-sm text-slate-500">No runs yet. Reconciliation resolves UNKNOWN transactions by checking provider status — it never re-creates a payout.</p>}</div>; }
export function AdminAudit(){ const {data}=useQ('aaudit','/admin/audit'); return <div className="card"><h3 className="font-bold mb-3">Audit trail</h3>{data?.map((a:any)=><p key={a.id} className="text-sm border-b py-2"><b>{a.action}</b> · {a.entity} {a.entityId?.slice(0,8)} <span className="text-slate-400">{new Date(a.createdAt).toLocaleString()}</span></p>)}</div>; }

export function AdminTestApi(){
  const {data:providers}=useQ('aprov','/admin/providers');
  const qc=useQueryClient();
  const [bucket,setBucket]=useState('ALL');
  const hist=useQuery({queryKey:['testapihist',bucket],queryFn:()=>api('/admin/test-api/history?bucket='+bucket),refetchInterval:12000,retry:false});
  const [tc,setTc]=useState<any>({providerId:'',kind:'PAYIN',amountRupees:'100',customerName:'Test Customer',email:'test@gmail.com',mobile:'9876543210',account:'1234567890',ifsc:'HDFC0000001',name:'Test Beneficiary'});
  const [busy,setBusy]=useState(false);
  const [out,setOut]=useState<any>(null);
  const [sel,setSel]=useState<any>(null);
  const run=async()=>{ const pid=tc.providerId||providers?.[0]?.id; if(!pid) return setOut({ok:false,error:'Select an API'}); setBusy(true); setOut({note:'Calling…'}); try{ const r=await api('/admin/test-api',{method:'POST',body:{providerId:pid,kind:tc.kind,amountRupees:Number(tc.amountRupees),customerName:tc.customerName,email:tc.email,mobile:tc.mobile,account:tc.account,ifsc:tc.ifsc,name:tc.name}}); setOut(r); qc.invalidateQueries({queryKey:['testapihist']}); qc.invalidateQueries({queryKey:['adpstatsPAYIN']}); qc.invalidateQueries({queryKey:['adpstatsPAYOUT']}); }catch(e:any){ setOut({ok:false,error:e.message}); qc.invalidateQueries({queryKey:['testapihist']}); } setBusy(false); };
  const counts=hist.data?.counts||{ALL:0,SUCCESS:0,PENDING:0,FAILED:0};
  const items:any[]=hist.data?.items||[];
  const bucketCls:any={SUCCESS:'bg-emerald-50 text-emerald-700',PENDING:'bg-amber-50 text-amber-700',FAILED:'bg-rose-50 text-rose-700'};
  return <div className="space-y-6 w-full max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Test API</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Run Pay-in / Payout against a chosen API · history below</p>
      </div>
    </div>

    <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
      <section className="bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5 space-y-4">
        <h2 className="text-[15px] font-bold text-slate-900">Console</h2>
        <div>
          <label className="label">API</label>
          <select className="input !rounded-xl" value={tc.providerId||providers?.[0]?.id||''} onChange={e=>setTc({...tc,providerId:e.target.value})}>
            <option value="">Select API…</option>
            {(providers||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name.split(' (')[0]} ({p.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <div className="flex rounded-xl bg-[#f7f8fa] p-0.5 h-[42px]">
            {([['PAYIN','Pay-in'],['PAYOUT','Payout']] as const).map(([k,l])=>(
              <button key={k} type="button" onClick={()=>setTc({...tc,kind:k})} className={`flex-1 rounded-[10px] text-[12.5px] font-bold ${tc.kind===k?'bg-slate-900 text-white':'text-slate-500'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Amount (₹)</label>
          <input className="input !rounded-xl tnum" type="number" min={1} step="0.01" value={tc.amountRupees} onChange={e=>setTc({...tc,amountRupees:e.target.value})}/>
        </div>
        {tc.kind==='PAYIN'&&(
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Customer name</label><input className="input !rounded-xl" value={tc.customerName} onChange={e=>setTc({...tc,customerName:e.target.value})}/></div>
            <div><label className="label">Mobile</label><input className="input !rounded-xl tnum" inputMode="numeric" maxLength={10} value={tc.mobile} onChange={e=>setTc({...tc,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/></div>
            <div className="sm:col-span-2"><label className="label">Email</label><input className="input !rounded-xl" value={tc.email} onChange={e=>setTc({...tc,email:e.target.value})}/></div>
          </div>
        )}
        {tc.kind==='PAYOUT'&&(
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Account number</label><input className="input !rounded-xl font-mono" value={tc.account} onChange={e=>setTc({...tc,account:e.target.value})}/></div>
            <div><label className="label">IFSC</label><input className="input !rounded-xl font-mono uppercase" value={tc.ifsc} onChange={e=>setTc({...tc,ifsc:e.target.value.toUpperCase()})}/></div>
            <div><label className="label">Beneficiary name</label><input className="input !rounded-xl" value={tc.name} onChange={e=>setTc({...tc,name:e.target.value})}/></div>
            <div><label className="label">Mobile</label><input className="input !rounded-xl tnum" inputMode="numeric" maxLength={10} value={tc.mobile} onChange={e=>setTc({...tc,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/></div>
          </div>
        )}
        <button type="button" disabled={busy} className="btn !px-6 !rounded-xl disabled:opacity-60" onClick={run}>{busy?'Running…':'Submit test'}</button>
      </section>

      <section className="bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] p-5 flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-slate-900">Response</h2>
          <div className="flex items-center gap-2">
            {out?.ms!=null&&<span className="text-[11px] text-slate-400">{out.ms}ms</span>}
            {out?.ok===true&&<span className="text-[11px] font-bold text-emerald-600">OK</span>}
            {out?.ok===false&&<span className="text-[11px] font-bold text-rose-600">FAILED</span>}
            {out&&<button type="button" className="text-[12px] font-semibold text-slate-500 hover:underline" onClick={()=>setOut(null)}>Clear</button>}
          </div>
        </div>
        {out?.response&&(
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Status</p><p className="font-bold text-[13px] mt-0.5">{out.response.status||out.status||'—'}</p></div>
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Amount</p><p className="font-bold tnum text-[13px] mt-0.5">{out.response.amountPaise!=null?inr(out.response.amountPaise):'—'}</p></div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 col-span-2">
              <p className="text-[10px] font-bold uppercase text-emerald-700/70">UTR / Bank RRN</p>
              <p className="font-mono font-bold text-[14px] text-emerald-800 mt-0.5 break-all">{out.response.utr||'— not returned'}</p>
            </div>
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 col-span-2"><p className="text-[10px] font-bold uppercase text-slate-400">Provider ref</p><p className="font-mono text-[12px] text-slate-700 mt-0.5 break-all">{out.response.providerRef||'—'}</p></div>
            {(out.response.upiLink||out.response.paymentLink)&&<div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 col-span-2"><p className="text-[10px] font-bold uppercase text-sky-700/70">UPI link</p><p className="font-mono text-[12px] text-sky-900 mt-0.5 break-all">{out.response.upiLink||out.response.paymentLink}</p></div>}
            {out.response.failureReason&&<div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 col-span-2"><p className="text-[10px] font-bold uppercase text-rose-700/70">Reason</p><p className="text-[13px] text-rose-800 mt-0.5">{out.response.failureReason}</p></div>}
          </div>
        )}
        <div className="flex-1 rounded-2xl bg-[#0b1220] text-slate-100 p-4 overflow-auto min-h-[180px]">
          {!out&&<p className="text-[12.5px] text-slate-500 font-mono">Ready — submit a test to see full details.</p>}
          {out&&<pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-all">{JSON.stringify(out,null,2)}</pre>}
        </div>
      </section>
    </div>

    <section className="bg-white rounded-[22px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
        <h2 className="text-[15px] font-bold text-slate-900 mr-2">Test history</h2>
        {([['ALL','All'],['SUCCESS','Success'],['PENDING','Pending'],['FAILED','Failed']] as const).map(([k,l])=>(
          <button key={k} type="button" onClick={()=>setBucket(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${bucket===k?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {l} <span className="opacity-70 ml-1">{counts[k]??0}</span>
          </button>
        ))}
      </div>
      {!items.length&&<p className="px-5 py-10 text-center text-[13px] text-slate-400">No tests yet — run one from the console above.</p>}
      <div className="divide-y divide-slate-50">
        {items.map((r:any)=>(
          <button key={r.id} type="button" onClick={()=>setSel(r)} className="w-full text-left px-5 py-3.5 hover:bg-slate-50/80 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${bucketCls[r.bucket]||'bg-slate-100 text-slate-600'}`}>{r.bucket==='SUCCESS'?'Success':r.bucket==='PENDING'?'Pending':'Failed'}</span>
            <span className="text-[12.5px] font-semibold text-slate-800">{r.kind==='PAYIN'?'Pay-in':'Payout'}</span>
            <span className="text-[12.5px] text-slate-600 truncate">{(r.apiName||'').split(' (')[0]}</span>
            <span className="tnum text-[13px] font-bold text-slate-900">{inr(r.amountPaise)}</span>
            <span className="text-[11.5px] font-mono text-emerald-700 truncate" title="UTR">{r.utr||'—'}</span>
            <span className="text-[11.5px] text-slate-400 font-mono truncate">{r.merchantRef}</span>
            <span className="ml-auto text-[11.5px] text-slate-400">{new Date(r.createdAt).toLocaleString('en-IN')}</span>
          </button>
        ))}
      </div>
    </section>

    {sel&&(
      <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4" onClick={()=>setSel(null)}>
        <div className="bg-white rounded-[22px] w-full max-w-lg p-5 shadow-xl max-h-[80vh] overflow-auto" onClick={e=>e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-slate-900">Test detail</h3>
              <p className="text-[12px] text-slate-400 mt-0.5">{sel.merchantRef}</p>
            </div>
            <button type="button" className="text-[13px] font-semibold text-slate-500" onClick={()=>setSel(null)}>Close</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px] mb-4">
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2"><p className="text-[10.5px] font-bold text-slate-400 uppercase">Status</p><p className="font-bold mt-0.5">{sel.status}</p></div>
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2"><p className="text-[10.5px] font-bold text-slate-400 uppercase">Amount</p><p className="font-bold tnum mt-0.5">{inr(sel.amountPaise)}</p></div>
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2"><p className="text-[10.5px] font-bold text-slate-400 uppercase">API</p><p className="font-bold mt-0.5 truncate">{sel.apiName}</p></div>
            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2"><p className="text-[10.5px] font-bold text-slate-400 uppercase">Type</p><p className="font-bold mt-0.5">{sel.kind}</p></div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 col-span-2"><p className="text-[10.5px] font-bold text-emerald-700/70 uppercase">UTR / Bank RRN</p><p className="font-mono font-bold text-[14px] text-emerald-800 mt-0.5 break-all">{sel.utr||'—'}</p></div>
          </div>
          {sel.failureReason&&<p className="text-[13px] text-rose-600 mb-3">{sel.failureReason}</p>}
          <pre className="rounded-2xl bg-[#0b1220] text-slate-100 p-4 text-[11.5px] font-mono overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(sel,null,2)}</pre>
        </div>
      </div>
    )}
  </div>;
}

/** API-wise request / response logs. */
export function AdminApiLogs(){
  const [apiId,setApiId]=useState('');
  const [kind,setKind]=useState('');
  const [bucket,setBucket]=useState('ALL');
  const [sel,setSel]=useState<any>(null);
  const [q,setQ]=useState('');
  const qs=new URLSearchParams();
  if(apiId) qs.set('providerId',apiId);
  if(kind) qs.set('kind',kind);
  const me=useQuery({queryKey:['me'],queryFn:()=>api('/auth/me'),retry:false});
  const staff=!!me.data?.role&&['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS'].includes(me.data.role);
  const logs=useQuery({queryKey:['apilogs',apiId,kind,staff],queryFn:()=>api((staff?'/admin/api-logs?':'/merchant/api-logs?')+qs.toString()),refetchInterval:15000,retry:false,enabled:me.isSuccess});
  const providers=useQuery({queryKey:['providers'],queryFn:()=>api('/admin/providers'),retry:false,enabled:staff});
  if(logs.error) return <Alert>{(logs.error as Error).message}</Alert>;
  if(logs.isLoading||!logs.data) return <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 rounded-2xl bg-slate-200/70 animate-pulse"/>)}</div>;
  const items:any[]=(logs.data.items||[]).filter((r:any)=>{
    if(bucket==='SUCCESS'&&r.status!=='SUCCESS') return false;
    if(bucket==='FAILED'&&r.status!=='FAILED') return false;
    if(bucket==='PENDING'&&!['PENDING','PROCESSING','UNKNOWN'].includes(r.status)) return false;
    if(q){ const n=q.toLowerCase(); if(!`${r.merchantRef} ${r.transactionId} ${r.providerRef||''} ${r.utr||''} ${r.apiName}`.toLowerCase().includes(n)) return false; }
    return true;
  });
  const counts=logs.data.counts||{ALL:0,SUCCESS:0,PENDING:0,FAILED:0};
  const stCls=(s:string)=>s==='SUCCESS'?'bg-emerald-50 text-emerald-700':s==='FAILED'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700';
  const stLabel=(s:string)=>s==='SUCCESS'?'Success':s==='FAILED'?'Failed':'Pending';
  const apiList:any[]=providers.data?.length?providers.data:(logs.data.apis||[]);
  return <div className="w-full h-[calc(100vh-150px)] min-h-[520px] flex flex-col">
    <div className="shrink-0 flex flex-wrap items-center gap-3 mb-4">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">API Logs</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Request · response · latency — filter by API</p>
      </div>
      <span className="relative inline-flex ml-auto shrink-0">
        <select className="appearance-none rounded-full border border-slate-200 bg-white pl-3.5 pr-9 py-2 text-[13px] font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400 shadow-sm" value={apiId} onChange={e=>setApiId(e.target.value)}>
          <option value="">All APIs</option>
          {apiList.map((p:any)=><option key={p.id} value={p.id}>{(p.name||'').split(' (')[0]} ({p.code})</option>)}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </span>
    </div>

    <div className="shrink-0 flex flex-wrap items-center gap-2 mb-3">
      {([['ALL','All'],['SUCCESS','Success'],['PENDING','Pending'],['FAILED','Failed']] as const).map(([k,l])=>(
        <button key={k} type="button" onClick={()=>setBucket(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${bucket===k?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {l} <span className="opacity-70 ml-1">{counts[k]??0}</span>
        </button>
      ))}
      <div className="flex rounded-full bg-slate-100 p-0.5 ml-1">
        {([['','All types'],['PAYIN','Pay-in'],['PAYOUT','Payout']] as const).map(([k,l])=>(
          <button key={k||'all'} type="button" onClick={()=>setKind(k)} className={`px-3 py-1 rounded-full text-[11.5px] font-bold transition ${kind===k?'bg-white shadow text-slate-900':'text-slate-500'}`}>{l}</button>
        ))}
      </div>
      <div className="ml-auto flex items-center rounded-full border border-slate-200 bg-white overflow-hidden pl-3 focus-within:border-slate-400">
        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input className="w-[200px] px-2.5 py-2 text-[13px] outline-none" placeholder="Search ref, UTR, id…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
    </div>

    <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] overflow-hidden flex flex-col">
      {!items.length?(
        <div className="flex-1 grid place-items-center text-center py-16">
          <div>
            <p className="font-semibold text-slate-700">No logs</p>
            <p className="text-[13px] text-slate-400 mt-1">Try another API or clear filters.</p>
          </div>
        </div>
      ):(
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-[1]">
              <tr className="text-left text-[12px] text-slate-400 border-b border-slate-100">
                <th className="pl-5 py-3 pr-3 font-medium">Time</th>
                <th className="py-3 pr-3 font-medium">API</th>
                <th className="py-3 pr-3 font-medium">Type</th>
                <th className="py-3 pr-3 font-medium">Endpoint</th>
                <th className="py-3 pr-3 font-medium">Amount</th>
                <th className="py-3 pr-3 font-medium">Latency</th>
                <th className="py-3 pr-5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r:any)=>(
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-[#fafbfd] transition cursor-pointer" onClick={()=>setSel(r)}>
                  <td className="pl-5 py-3.5 pr-3 text-slate-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})}</td>
                  <td className="py-3.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">{(r.apiName||'').split(' (')[0]}</td>
                  <td className="py-3.5 pr-3 text-slate-600">{r.kind==='PAYIN'?'Pay-in':'Payout'}</td>
                  <td className="py-3.5 pr-3 font-mono text-[12px] text-slate-500 whitespace-nowrap">{r.endpoint}</td>
                  <td className="py-3.5 pr-3 font-semibold tnum text-slate-900 whitespace-nowrap">{inr(r.amountPaise)}</td>
                  <td className="py-3.5 pr-3 text-slate-500 tnum whitespace-nowrap">{r.latencyMs!=null?`${r.latencyMs} ms`:'—'}</td>
                  <td className="py-3.5 pr-5"><span className={`inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${stCls(r.status)}`}>{stLabel(r.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="shrink-0 px-5 py-3 border-t border-slate-50 text-[12px] text-slate-400">{items.length} log{items.length===1?'':'s'} shown</div>
    </div>

    {sel&&<div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]" onClick={()=>setSel(null)}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <h3 className="font-bold text-slate-900 text-[16px]">Log detail</h3>
            <p className="font-mono text-[11px] text-slate-400 mt-0.5 break-all">{sel.transactionId}</p>
          </div>
          <button className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500" onClick={()=>setSel(null)}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${stCls(sel.status)}`}>{stLabel(sel.status)}</span>
            <span className="inline-flex rounded-full bg-slate-100 text-slate-600 px-2.5 py-[3px] text-[11.5px] font-semibold">{sel.kind==='PAYIN'?'Pay-in':'Payout'}</span>
            <span className="inline-flex rounded-full bg-slate-100 text-slate-600 px-2.5 py-[3px] text-[11.5px] font-semibold">{(sel.apiName||'').split(' (')[0]}</span>
          </div>
          <div className="rounded-2xl bg-[#f6f7f9] p-4 space-y-2.5 text-[13px]">
            {[['Endpoint',sel.endpoint],['Merchant ref',sel.merchantRef],['Provider ref',sel.providerRef||'—'],['UTR',sel.utr||'—'],['Latency',sel.latencyMs!=null?`${sel.latencyMs} ms`:'—'],['Amount',inr(sel.amountPaise)],['Created',new Date(sel.createdAt).toLocaleString('en-IN')]].map(([k,v]:any)=>(
              <div key={k} className="flex justify-between gap-3"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-700 text-right break-all">{v}</span></div>
            ))}
          </div>
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-slate-400 mb-2">Request</h4>
            <pre className="rounded-2xl bg-[#0b1220] text-emerald-100 p-4 text-[11.5px] font-mono overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(sel.request,null,2)}</pre>
          </div>
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-slate-400 mb-2">Response</h4>
            <pre className="rounded-2xl bg-[#0b1220] text-sky-100 p-4 text-[11.5px] font-mono overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(sel.response,null,2)}</pre>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
