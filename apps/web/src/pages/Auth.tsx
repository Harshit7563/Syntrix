import {useState} from 'react';import {useNavigate} from 'react-router-dom';import {api} from '../api';

const msFont={fontFamily:"'Segoe UI',SegoeUI,'Helvetica Neue',Helvetica,Arial,sans-serif"} as const;
const msInput="w-full bg-transparent border-0 border-b border-[#8a8886] focus:border-b-2 focus:border-[#0067c0] outline-none px-0 py-2 text-[15px] text-[#1b1b1b] placeholder:text-[#707070] transition-colors";
const msBtn="bg-[#0067c0] hover:bg-[#005da6] active:bg-[#005494] text-white text-[15px] font-semibold px-8 py-[7px] min-w-[118px] transition-colors disabled:opacity-60";

export function Login(){ const nav=useNavigate(); const [f,setF]=useState({email:'',password:''}); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
 const submit=async(e?:any)=>{ e?.preventDefault(); setErr(''); setBusy(true); try{ await api('/auth/login',{method:'POST',body:f}); nav('/app'); }catch(ex:any){ setErr(ex.message||'Could not sign in'); setBusy(false); } };
 const admin=async()=>{ setErr(''); setBusy(true); try{ await api('/auth/login',{method:'POST',body:{}}); nav('/app'); }catch(ex:any){ setErr(ex.message||'Could not open admin'); setBusy(false); } };
 return <AuthShell>
  <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-[#1b1b1b]">Member sign in</h1>
  <p className="text-sm text-[#605e5c] mt-1.5">Email ya mobile, aur password.</p>
  {err&&<Alert>{err}</Alert>}
  <form onSubmit={submit} className="mt-6 space-y-5">
   <input className={msInput} autoFocus autoComplete="username" value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="Email or mobile"/>
   <input className={msInput} type="password" autoComplete="current-password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Password"/>
   <div className="flex justify-end pt-2"><button className={msBtn} disabled={busy}>{busy?'Signing in…':'Sign in'}</button></div>
  </form>
  <button type="button" onClick={admin} disabled={busy} className="mt-6 text-[13px] text-[#605e5c] hover:text-[#1b1b1b]">Open admin without password</button>
 </AuthShell>; }

export const Alert=({children}:{children:any})=><div className="mt-4 bg-[#fde7e9] border border-[#f1707b]/40 text-[#a4262c] text-[13px] px-3.5 py-2.5 flex gap-2"><span className="shrink-0">⚠</span><span>{children}</span></div>;

const AuthShell=({children}:{children:any})=><div style={msFont} className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden bg-[#f5f7fb]">
 <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 60% 50% at 15% 10%,rgba(0,103,192,.14),transparent),radial-gradient(ellipse 55% 45% at 88% 22%,rgba(0,120,215,.12),transparent),radial-gradient(ellipse 60% 55% at 78% 92%,rgba(92,45,145,.08),transparent),radial-gradient(ellipse 50% 40% at 10% 88%,rgba(0,103,192,.08),transparent)'}}/>
 <div className="relative w-full max-w-[440px] bg-white rounded-[20px] shadow-[0_1.6px_3.6px_rgba(0,0,0,.11),0_0.3px_0.9px_rgba(0,0,0,.07)] px-8 py-9 sm:px-11 sm:py-10">
  <div className="mb-7 flex justify-center"><img src="/logo.png" alt="SyntrixAPI" className="h-9 w-auto object-contain"/></div>
  {children}
 </div>
</div>;
