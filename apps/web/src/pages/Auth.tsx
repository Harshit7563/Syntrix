import {useEffect,useState} from 'react';import {useNavigate} from 'react-router-dom';import {api} from '../api';

const msFont={fontFamily:"'Segoe UI',SegoeUI,'Helvetica Neue',Helvetica,Arial,sans-serif"} as const;

export function Login(){ const nav=useNavigate(); const [err,setErr]=useState('');
 useEffect(()=>{ let live=true; api('/auth/login',{method:'POST',body:{}}).then(()=>{ if(live) nav('/app'); }).catch((e:any)=>{ if(live) setErr(e.message||'Could not open the app'); }); return ()=>{ live=false; }; },[nav]);
 return <AuthShell><h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-[#1b1b1b]">Opening admin</h1><p className="text-sm text-[#605e5c] mt-1.5">Email and password are off for now.</p>{err&&<Alert>{err}</Alert>}{!err&&<p className="text-sm text-[#8a8886] mt-6">Signing you in…</p>}</AuthShell>; }

export const Alert=({children}:{children:any})=><div className="mt-4 bg-[#fde7e9] border border-[#f1707b]/40 text-[#a4262c] text-[13px] px-3.5 py-2.5 flex gap-2"><span className="shrink-0">⚠</span><span>{children}</span></div>;

const AuthShell=({children}:{children:any})=><div style={msFont} className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden bg-[#f5f7fb]">
 <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 60% 50% at 15% 10%,rgba(0,103,192,.14),transparent),radial-gradient(ellipse 55% 45% at 88% 22%,rgba(0,120,215,.12),transparent),radial-gradient(ellipse 60% 55% at 78% 92%,rgba(92,45,145,.08),transparent),radial-gradient(ellipse 50% 40% at 10% 88%,rgba(0,103,192,.08),transparent)'}}/>
 <div className="relative w-full max-w-[440px] bg-white rounded-[20px] shadow-[0_1.6px_3.6px_rgba(0,0,0,.11),0_0.3px_0.9px_rgba(0,0,0,.07)] px-8 py-9 sm:px-11 sm:py-10">
  <div className="mb-7 flex justify-center"><img src="/logo.png" alt="SyntrixAPI" className="h-9 w-auto object-contain"/></div>
  {children}
 </div>
</div>;
