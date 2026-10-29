import {useState,useRef} from 'react';import {useNavigate} from 'react-router-dom';import {api} from '../api';

const msFont={fontFamily:"'Segoe UI',SegoeUI,'Helvetica Neue',Helvetica,Arial,sans-serif"} as const;
const msInput="w-full bg-transparent border-0 border-b border-[#8a8886] focus:border-b-2 focus:border-[#0067c0] outline-none px-0 py-2 text-[15px] text-[#1b1b1b] placeholder:text-[#707070] transition-colors";
const msBtn="bg-[#0067c0] hover:bg-[#005da6] active:bg-[#005494] text-white text-[15px] font-semibold px-8 py-[7px] min-w-[118px] transition-colors disabled:opacity-60";
const msLink="text-[#0067c0] hover:underline cursor-pointer";

export function Login(){ const nav=useNavigate(); const [step,setStep]=useState<'email'|'password'|'pin'>('email'); const [f,setF]=useState({email:'Harshit0728@gmail.com',password:'',totp:'',pin:''}); const [err,setErr]=useState(''); const [mfa,setMfa]=useState(false); const [busy,setBusy]=useState(false); const [show,setShow]=useState(false); const pinRefs=useRef<(HTMLInputElement|null)[]>([]);
 const next=(e?:any)=>{ e?.preventDefault(); if(!f.email.includes('@')) return setErr('Enter a valid email address.'); setErr(''); setStep('password'); };
 /** Ek hi portal: pehle wala panel (ab admin). Login ke baad hamesha /app */
 const submit=async(e:any,body?:any)=>{ e?.preventDefault(); setErr(''); setBusy(true); try{ const r=await api('/auth/login',{method:'POST',body:body||f}); if(r.pinRequired){ setStep('pin'); setBusy(false); return; } if(r.mfaRequired){ setMfa(true); setStep('password'); setBusy(false); return; } nav('/app'); }catch(e:any){ setErr(e.message); setBusy(false); } };
 const setPinValue=(pin:string)=>{ setF({...f,pin}); if(pin.length===4) submit(undefined,{...f,pin}); };
 const onPinBox=(i:number,v:string)=>{ const d=v.replace(/\D/g,''); if(!d) return; const pin=(f.pin.slice(0,i)+d+f.pin.slice(i+1)).slice(0,4); if(i<3) pinRefs.current[i+1]?.focus(); setPinValue(pin); };
 const onPinKey=(i:number,e:any)=>{ if(e.key==='Backspace'){ e.preventDefault(); if(f.pin[i]){ setF({...f,pin:f.pin.slice(0,i)+f.pin.slice(i+1)}); } else if(i>0){ pinRefs.current[i-1]?.focus(); setF({...f,pin:f.pin.slice(0,i-1)+f.pin.slice(i)}); } } if(e.key==='Enter'&&f.pin.length===4) submit(e); };

 if(step==='email') return <AuthShell><h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-[#1b1b1b]">Admin sign in</h1><p className="text-sm text-[#605e5c] mt-1.5">to continue to <span className="font-semibold text-[#1b1b1b]">SyntrixAPI</span> platform</p>{err&&<Alert>{err}</Alert>}
  <form onSubmit={next} className="mt-6"><input className={msInput} type="email" autoFocus autoComplete="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="Email address"/></form>
  <p className="text-[13.5px] text-[#3b3a39] mt-6">Merchant account? <a className={msLink+" font-semibold"} href="/register">Create one</a></p>
  <div className="flex justify-end mt-9"><button className={msBtn} onClick={next}>Next</button></div></AuthShell>;

 if(step==='pin') return <AuthShell>
  <button onClick={()=>{setStep('password');setErr('');setF({...f,pin:''});}} className="flex items-center gap-1 text-[13px] text-[#605e5c] hover:text-[#1b1b1b] mb-4"><span className="text-base leading-none">←</span> Back</button>
  <div className="inline-flex items-center gap-2 bg-[#f3f2f1] rounded-full pl-1 pr-3 py-1 mb-5 max-w-full"><span className="w-6 h-6 rounded-full bg-[#0067c0] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{f.email.charAt(0).toUpperCase()}</span><span className="text-[13px] text-[#1b1b1b] truncate">{f.email}</span></div>
  <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-[#1b1b1b]">Enter your PIN</h1><p className="text-sm text-[#605e5c] mt-1.5">Password verified — now enter your 4-digit PIN.</p>{err&&<Alert>{err}</Alert>}
  <form onSubmit={e=>submit(e)} className="mt-7"><div className="flex justify-center gap-3">{[0,1,2,3].map(i=><input key={i} ref={(el:any)=>{pinRefs.current[i]=el;}} autoFocus={i===0} inputMode="numeric" autoComplete={i===0?'one-time-code':'off'} type="password" className={`w-[52px] h-[56px] text-center text-[22px] font-bold rounded-xl border-2 outline-none transition bg-white text-[#1b1b1b] ${f.pin[i]?'border-[#0067c0] bg-[#f0f6ff]':'border-[#d2d0ce]'} focus:border-[#0067c0] focus:ring-4 focus:ring-[#0067c0]/15`} maxLength={1} value={f.pin[i]||''} onChange={e=>onPinBox(i,e.target.value)} onKeyDown={e=>onPinKey(i,e)} onFocus={e=>e.target.select()}/>)}</div><p className="text-[12px] text-[#8a8886] text-center mt-4">{busy?'Verifying…':'Signs you in automatically · 5 wrong tries = 15-min lock'}</p><div className="flex justify-center mt-6"><button className={msBtn+" !px-10"} disabled={busy||f.pin.length!==4}>Verify PIN</button></div></form></AuthShell>;

 return <AuthShell>
  <button onClick={()=>{setStep('email');setErr('');}} className="flex items-center gap-1 text-[13px] text-[#605e5c] hover:text-[#1b1b1b] mb-4"><span className="text-base leading-none">←</span> Back</button>
  <div className="inline-flex items-center gap-2 bg-[#f3f2f1] rounded-full pl-1 pr-3 py-1 mb-5 max-w-full"><span className="w-6 h-6 rounded-full bg-[#0067c0] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{f.email.charAt(0).toUpperCase()}</span><span className="text-[13px] text-[#1b1b1b] truncate">{f.email}</span></div>
  <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-[#1b1b1b]">Enter password</h1>{err&&<Alert>{err}</Alert>}
  <form onSubmit={submit} className="mt-5 space-y-5">
   <div><input type={show?'text':'password'} autoFocus autoComplete="current-password" className={msInput} value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Password"/><label className="flex items-center gap-2 mt-3 text-[13px] text-[#1b1b1b] cursor-pointer select-none"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} className="w-4 h-4 accent-[#0067c0]"/>Show password</label></div>
   {mfa&&<div><input className={msInput+" tracking-[.3em] font-mono"} inputMode="numeric" maxLength={6} value={f.totp} onChange={e=>setF({...f,totp:e.target.value})} placeholder="Authenticator code (MFA)"/></div>}
   <p className="text-[13px]"><span className={msLink} onClick={()=>setErr('Demo environment: use password Demo@12345, or ask your admin to reset it from Settings.')}>Forgot password?</span></p>
   <div className="flex justify-end pt-1"><button className={msBtn} disabled={busy}>{busy?'Signing in…':'Sign in'}</button></div>
  </form></AuthShell>; }

export function Register(){ const nav=useNavigate(); const [f,setF]=useState({email:'',password:'',businessName:''}); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false); const [show,setShow]=useState(false); const submit=async(e:any)=>{ e.preventDefault(); setErr(''); setBusy(true); try{ await api('/auth/register',{method:'POST',body:f}); nav('/app/onboarding'); }catch(e:any){ setErr(e.message); setBusy(false); } };
 return <AuthShell><h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight text-[#1b1b1b]">Create account</h1><p className="text-sm text-[#605e5c] mt-1.5">Sandbox access is instant. Production needs compliance approval.</p>{err&&<Alert>{err}</Alert>}
 <form onSubmit={submit} className="mt-6 space-y-5">
  <input className={msInput} value={f.businessName} onChange={e=>setF({...f,businessName:e.target.value})} placeholder="Business name"/>
  <input className={msInput} type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="Work email"/>
  <div><input type={show?'text':'password'} className={msInput} value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Password (10+ characters)"/><label className="flex items-center gap-2 mt-3 text-[13px] text-[#1b1b1b] cursor-pointer select-none"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} className="w-4 h-4 accent-[#0067c0]"/>Show password</label>{f.password&&<div className="flex gap-1 mt-3">{[1,2,3,4].map(i=><span key={i} className={`h-1 flex-1 ${f.password.length>=i*3?'bg-[#107c41]':'bg-[#edebe9]'}`}/>)}</div>}</div>
  <div className="flex justify-end pt-1"><button className={msBtn} disabled={busy}>{busy?'Creating…':'Next'}</button></div>
 </form>
 <p className="text-[13px] text-[#1b1b1b] mt-7">Already have an account? <a className={msLink} href="/login">Sign in</a></p></AuthShell>; }

export const Alert=({children}:{children:any})=><div className="mt-4 bg-[#fde7e9] border border-[#f1707b]/40 text-[#a4262c] text-[13px] px-3.5 py-2.5 flex gap-2"><span className="shrink-0">⚠</span><span>{children}</span></div>;

const AuthShell=({children}:{children:any})=><div style={msFont} className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden bg-[#f5f7fb]">
 <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 60% 50% at 15% 10%,rgba(0,103,192,.14),transparent),radial-gradient(ellipse 55% 45% at 88% 22%,rgba(0,120,215,.12),transparent),radial-gradient(ellipse 60% 55% at 78% 92%,rgba(92,45,145,.08),transparent),radial-gradient(ellipse 50% 40% at 10% 88%,rgba(0,103,192,.08),transparent)'}}/>
 <div className="relative w-full max-w-[440px] bg-white rounded-[20px] shadow-[0_1.6px_3.6px_rgba(0,0,0,.11),0_0.3px_0.9px_rgba(0,0,0,.07)] px-8 py-9 sm:px-11 sm:py-10">
  <div className="mb-7 flex justify-center"><img src="/logo.png" alt="SyntrixAPI" className="h-9 w-auto object-contain"/></div>
  {children}
 </div>
</div>;
