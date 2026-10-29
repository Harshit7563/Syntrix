import {useEffect,useState} from 'react';import {Routes,Route,NavLink,Navigate,useNavigate,useLocation} from 'react-router-dom';import {useQuery} from '@tanstack/react-query';import {api} from './api';import {Login} from './pages/Auth';import {MerchantDashboard,Onboarding,Credentials,Catalog,Transactions,Webhooks,Billing,Playground} from './pages/Merchant';import {AdminDashboard,AdminMerchants,AdminProviders,AdminTxns,AdminApiReport,AdminApprovals,AdminRecon,AdminAudit,AdminTestApi,AdminApiLogs} from './pages/Admin';import {Settings} from './pages/Settings';

const STAFF=new Set(['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS']);
const isStaff=(role?:string)=>!!role&&STAFF.has(role);

const I={home:'M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z',txn:'M4 7h13l-3-3M20 17H7l3 3',box:'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',key:'M21 2l-2 2m-7 7H4v4H2v-4L13.5-.5a5.5 5.5 0 017 7L21 2zM16 8l3 3',hook:'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7',card:'M2 8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2zM2 10h20',doc:'M6 2h9l5 5v15H6zM14 2v6h6',chart:'M3 3v18h18M8 17V9m5 8V5m5 12v-6',shield:'M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z',gear:'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0019 12z',play:'M6 4l14 8-14 8z',users:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8'};

function RequireAuth({children}:{children:any}){
  const nav=useNavigate();
  const me=useQuery({queryKey:['me'],queryFn:()=>api('/auth/me'),retry:false});
  useEffect(()=>{ if(me.isError) nav('/login',{replace:true}); },[me.isError,nav]);
  if(me.isLoading) return <div className="min-h-screen grid place-items-center text-slate-500 text-sm">Loading…</div>;
  if(me.isError||!me.data) return null;
  return children;
}

function Icon({d,active}:{d:string,active?:boolean}){
  return <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

/** OsTørk shell — collapsible dark sidebar + full-width canvas. */
function Shell(){
  const [open,setOpen]=useState(()=>{ try{ return localStorage.getItem('sx_sidebar')!=='0'; }catch{ return true; } });
  const nav=useNavigate();
  const loc=useLocation();
  const me=useQuery({queryKey:['me'],queryFn:()=>api('/auth/me'),retry:false});
  const admin=isStaff(me.data?.role);
  const toggle=()=>{ setOpen(v=>{ const n=!v; try{ localStorage.setItem('sx_sidebar',n?'1':'0'); }catch{} return n; }); };

  const rail: [string,string,string][] = admin?[
    ['/app','Home',I.home],
    ['/app/transactions','Transactions',I.txn],
    ['/app/reports','Reports',I.chart],
    ['/app/pay-in','Pay-in',I.box],
    ['/app/payouts','Payouts',I.card],
    ['/app/providers','APIs',I.shield],
    ['/app/logs','Logs',I.doc],
    ['/app/merchants','Merchants',I.users],
    ['/app/playground','Docs',I.play],
    ['/app/settings','Settings',I.gear],
  ]:[
    ['/app','Home',I.home],
    ['/app/transactions','Transactions',I.txn],
    ['/app/reports','Reports',I.chart],
    ['/app/pay-in','Pay-in',I.box],
    ['/app/payouts','Payouts',I.card],
    ['/app/providers','APIs',I.shield],
    ['/app/logs','Logs',I.doc],
    ['/app/credentials','Keys',I.key],
    ['/app/playground','Docs',I.play],
    ['/app/settings','Settings',I.gear],
  ];

  const topTabs: [string,string][] = admin?[
    ['/app','Dashboard'],
    ['/app/pay-in','Collection'],
    ['/app/payouts','Payouts'],
    ['/app/transactions','Transactions'],
    ['/app/reports','Reports'],
    ['/app/providers','APIs'],
    ['/app/logs','Logs'],
  ]:[
    ['/app','Dashboard'],
    ['/app/pay-in','Collection'],
    ['/app/payouts','Payouts'],
    ['/app/transactions','Transactions'],
    ['/app/reports','Reports'],
    ['/app/logs','Logs'],
  ];

  const tabActive=(to:string)=> to==='/app'?loc.pathname==='/app'||loc.pathname==='/app/':loc.pathname.startsWith(to);
  const allLinks=[...rail,...(admin?[['/app/approvals','Approvals',I.shield],['/app/reconciliation','Recon',I.chart],['/app/audit','Audit',I.doc]] as [string,string,string][]:[])];

  return <RequireAuth>
  <div className="h-screen flex gap-3 p-3 sm:p-3.5 overflow-hidden bg-[#e8eaef]">
    {/* Collapsible dark sidebar */}
    <aside className={`hidden sm:flex shrink-0 flex-col py-4 bg-[#161616] rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,.18)] transition-all duration-200 ease-out ${open?'w-[220px] px-3':'w-[68px] items-center px-0'}`}>
      <div className={`mb-4 flex items-center gap-2 ${open?'px-1':'flex-col'}`}>
        <NavLink to="/app" className="w-10 h-10 rounded-2xl bg-white/10 grid place-items-center overflow-hidden shrink-0" title="SyntrixAPI">
          <img src="/logo-mark.png" alt="" className="w-6 h-6 object-contain brightness-0 invert"/>
        </NavLink>
        {open&&<div className="min-w-0 flex-1"><img src="/logo-light.png" alt="SyntrixAPI" className="h-6 w-auto object-contain opacity-95"/></div>}
        <button onClick={toggle} title={open?'Collapse sidebar':'Expand sidebar'} className={`w-8 h-8 rounded-xl grid place-items-center text-white/50 hover:text-white hover:bg-white/10 transition ${open?'':'mt-1'}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d={open?'M15 6l-6 6 6 6':'M9 6l6 6-6 6'}/></svg>
        </button>
      </div>
      <nav className={`flex-1 flex flex-col gap-1 w-full overflow-y-auto ${open?'':'items-center px-2'}`}>
        {rail.map(([to,l,ic])=>{
          const active=tabActive(to);
          return <NavLink key={to+l} to={to} end={to==='/app'} title={l}
            className={`rounded-2xl transition flex items-center gap-3 ${open?'px-3 py-2.5 w-full':'w-11 h-11 justify-center'} ${active?'bg-white text-slate-900':'text-white/55 hover:text-white hover:bg-white/10'}`}>
            <Icon d={ic} active={active}/>
            {open&&<span className="text-[13.5px] font-semibold truncate">{l}</span>}
          </NavLink>;
        })}
      </nav>
    </aside>

    {/* Full-width canvas */}
    <div className="flex-1 min-w-0 flex flex-col bg-[#f7f8fa] rounded-[28px] border border-white/80 shadow-[0_2px_20px_rgba(15,23,42,.04)] overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-0 flex flex-wrap items-center gap-1 border-b border-slate-200/60 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 mr-3 mb-3 sm:mb-0 sm:hidden">
          <img src="/logo.png" alt="SyntrixAPI" className="h-7 w-auto object-contain"/>
        </div>
        <div className="flex gap-0.5 overflow-x-auto flex-1 pb-0">
          {topTabs.map(([to,l])=>(
            <NavLink key={to} to={to} end={to==='/app'}
              className={`relative px-3.5 py-3 text-[12px] font-bold tracking-[.06em] uppercase whitespace-nowrap transition ${tabActive(to)?'text-slate-900':'text-slate-400 hover:text-slate-700'}`}>
              {tabActive(to)&&<span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-900 mr-1.5 align-middle"/>}
              {l}
              {tabActive(to)&&<span className="absolute inset-x-2 bottom-0 h-[2.5px] bg-slate-900 rounded-full"/>}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="sm:hidden px-3 pt-3">
        <select className="input !rounded-2xl" value={loc.pathname} onChange={e=>nav(e.target.value)}>
          {allLinks.map(([to,l])=><option key={to+l} value={to}>{l}</option>)}
        </select>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="w-full h-full">
          <Routes>
            <Route index element={admin?<AdminDashboard/>:<MerchantDashboard/>}/>
            <Route path="transactions" element={admin?<AdminTxns/>:<Transactions/>}/>
            <Route path="reports" element={admin?<AdminApiReport/>:<AdminApiReport endpoint="/merchant/provider-stats"/>}/>
            <Route path="pay-in" element={admin?<AdminTxns kind="PAYIN"/>:<Transactions kind="PAYIN"/>}/>
            <Route path="payouts" element={admin?<AdminTxns kind="PAYOUT"/>:<Transactions kind="PAYOUT"/>}/>
            <Route path="providers" element={<AdminProviders/>}/>
            <Route path="logs" element={<AdminApiLogs/>}/>
            <Route path="test-api" element={<AdminTestApi/>}/>
            <Route path="merchants" element={<AdminMerchants/>}/>
            <Route path="approvals" element={<AdminApprovals/>}/>
            <Route path="reconciliation" element={<AdminRecon/>}/>
            <Route path="audit" element={<AdminAudit/>}/>
            <Route path="onboarding" element={<Onboarding/>}/>
            <Route path="catalog" element={<Catalog/>}/>
            <Route path="credentials" element={<Credentials/>}/>
            <Route path="settings" element={<Settings/>}/>
            <Route path="webhooks" element={<Webhooks/>}/>
            <Route path="billing" element={<Billing/>}/>
            <Route path="playground" element={<Playground/>}/>
          </Routes>
        </div>
      </main>
    </div>
  </div>
  </RequireAuth>;
}

export default function App(){
  return <Routes>
    <Route path="/" element={<Navigate to="/login"/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/register" element={<Navigate to="/login" replace/>}/>
    <Route path="/app/*" element={<Shell/>}/>
    <Route path="/admin/*" element={<Navigate to="/app" replace/>}/>
  </Routes>;
}
