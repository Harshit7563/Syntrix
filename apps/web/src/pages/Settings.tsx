import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import QRCode from 'qrcode';
import {api} from '../api';
import {Alert} from './Auth';

const STAFF=new Set(['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS']);

const Copy=({v}:{v:string})=>{
  const [c,setC]=useState(false);
  return <button type="button" title="Copy" className="ml-1 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 grid place-items-center text-[12px] transition" onClick={async()=>{ try{ await navigator.clipboard.writeText(v); setC(true); setTimeout(()=>setC(false),1200);}catch{} }}>{c?'✓':'⧉'}</button>;
};

export function Settings(){
  const qc=useQueryClient();
  const me=useQuery({queryKey:['me-set'],queryFn:()=>api('/auth/me')});
  const onb=useQuery({queryKey:['set-onb'],queryFn:()=>api('/merchant/onboarding'),retry:false,enabled:!!me.data&&!STAFF.has(me.data.role)});
  const [msg,setMsg]=useState('');
  const [mfaSecret,setMfaSecret]=useState('');
  const [mfaQr,setMfaQr]=useState('');
  const [code,setCode]=useState('');
  const [edit,setEdit]=useState<'phone'|'password'|null>(null);
  const [phone,setPhone]=useState('');
  const [curPw,setCurPw]=useState('');
  const [newPw,setNewPw]=useState('');
  const [busy,setBusy]=useState('');

  const u:any=me.data||{};
  const staff=STAFF.has(u.role);
  const business=staff?'Syntrix Platform':(onb.data?.businessName||u.email?.split('@')[0]||'Merchant');
  const initial=(business||'M').charAt(0).toUpperCase();
  const roleLabel=(u.role||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,(c:string)=>c.toUpperCase());
  const accId=u.orgId?('acc_'+u.orgId):'—';

  const savePhone=async()=>{
    if(!phone.trim()) return setMsg('Enter a phone number');
    setBusy('phone');
    try{ await api('/auth/profile',{method:'POST',body:{phone:phone.trim()}}); setMsg('Phone updated'); setEdit(null); qc.invalidateQueries({queryKey:['me-set']}); }
    catch(e:any){ setMsg(e.message); }
    finally{ setBusy(''); }
  };
  const savePassword=async()=>{
    if(!curPw||!newPw) return setMsg('Enter both passwords');
    setBusy('pw');
    try{ const r=await api('/auth/change-password',{method:'POST',body:{currentPassword:curPw,newPassword:newPw}}); setMsg(r.message); setTimeout(()=>location.href=staff?'/root/7563':'/app/merchants/login',1500); }
    catch(e:any){ setMsg(e.message); }
    finally{ setBusy(''); }
  };
  const setupMfa=async()=>{ if(u.mfaEnabled){ setMsg('Authenticator is already on'); return; } const r=await api('/auth/mfa/setup',{method:'POST',body:{}}); setMfaSecret(r.secret); setMfaQr(await QRCode.toDataURL(r.otpauth,{width:280,margin:1,errorCorrectionLevel:'M',color:{dark:'#111111',light:'#ffffff'}})); setMsg('Scan the QR with Google Authenticator or Microsoft Authenticator, then enter the 6-digit code'); };
  const verifyMfa=async()=>{ try{ await api('/auth/mfa/verify',{method:'POST',body:{totp:code}}); setMsg('Authenticator is on. Next sign-in will ask for the code.'); setMfaSecret(''); setMfaQr(''); qc.invalidateQueries({queryKey:['me-set']}); }catch(e:any){ setMsg(e.message); } };
  if(me.isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2].map(i=><div key={i} className="h-40 rounded-[16px] bg-slate-200/50 animate-pulse"/>)}</div>;

  return <div className="w-full h-[calc(100vh-150px)] min-h-[560px] flex flex-col gap-4">
    <div className="shrink-0 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Account, security, and sign-in</p>
      </div>
      <button type="button" className="h-9 px-4 rounded-full border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 hover:bg-slate-50" onClick={async()=>{ await api('/auth/logout',{method:'POST',body:{}}); location.href=staff?'/root/7563':'/app/merchants/login'; }}>Sign out</button>
    </div>

    {msg&&<div className="shrink-0"><Alert>{msg}</Alert></div>}

    <div className="flex-1 min-h-0 bg-white rounded-[16px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.03)] overflow-hidden flex flex-col">
      <header className="shrink-0 px-6 py-5 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-slate-900 text-white grid place-items-center text-[18px] font-bold shrink-0">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-slate-900 truncate">{business}</p>
          <p className="text-[12.5px] text-slate-400 mt-0.5">{roleLabel} · {staff?'Platform admin':'Merchant account'}</p>
        </div>
        <div className="text-right min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[.16em] text-slate-400">Account ID</p>
          <p className="mt-1 font-mono text-[13px] font-semibold text-slate-800 flex items-center justify-end">{accId}{u.orgId&&<Copy v={accId}/>}</p>
          {!staff&&u.merchantId&&<p className="mt-1 font-mono text-[11.5px] text-slate-400 flex items-center justify-end">{u.merchantId}<Copy v={u.merchantId}/></p>}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 min-h-full">
          <section className="p-6">
            <h2 className="text-[11px] font-bold tracking-[.16em] uppercase text-slate-400 mb-1">Account</h2>
            <p className="text-[13px] text-slate-400 mb-5">Login details for this profile.</p>
            <dl className="divide-y divide-slate-100 border-t border-slate-100">
              <Row label="Login email" value={u.email||'—'}/>
              <Row label="Phone number" value={u.phone||'Not set'} action="Edit" onAction={()=>{ setPhone(u.phone||''); setEdit(v=>v==='phone'?null:'phone'); }}/>
              <Row label="Password" value="••••••••••" action="Change" onAction={()=>{ setCurPw(''); setNewPw(''); setEdit('password'); }}/>
            </dl>
            {edit==='phone'&&(
              <form className="mt-4 rounded-2xl border border-slate-200 bg-[#fafafa] p-4" onSubmit={e=>{ e.preventDefault(); savePhone(); }}>
                <label className="label">Phone number</label>
                <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 …" autoFocus/>
                <div className="mt-3 flex gap-2">
                  <button type="submit" disabled={busy==='phone'} className="h-9 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60">{busy==='phone'?'Saving…':'Save'}</button>
                  <button type="button" className="h-9 px-4 rounded-full border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600" onClick={()=>setEdit(null)}>Cancel</button>
                </div>
              </form>
            )}
            {edit==='password'&&(
              <form className="mt-4 rounded-2xl border border-slate-200 bg-[#fafafa] p-4 space-y-3" onSubmit={e=>{ e.preventDefault(); savePassword(); }}>
                <div><label className="label">Current password</label><input className="input" type="password" value={curPw} onChange={e=>setCurPw(e.target.value)} autoComplete="current-password"/></div>
                <div><label className="label">New password</label><input className="input" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} autoComplete="new-password" placeholder="10+ characters"/></div>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy==='pw'} className="h-9 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60">{busy==='pw'?'Saving…':'Update password'}</button>
                  <button type="button" className="h-9 px-4 rounded-full border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600" onClick={()=>setEdit(null)}>Cancel</button>
                </div>
              </form>
            )}
          </section>

          <section className="p-6">
            <h2 className="text-[11px] font-bold tracking-[.16em] uppercase text-slate-400 mb-1">Security</h2>
            <p className="text-[13px] text-slate-400 mb-5">How this account signs in.</p>

            <div className="border-t border-slate-100 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900">Authenticator</p>
                <p className="text-[12.5px] text-slate-500 mt-0.5">{u.mfaEnabled?'On — login asks for a 6-digit code after the password':'Off — add Google Authenticator or Microsoft Authenticator'}</p>
              </div>
              <span className={`shrink-0 mt-0.5 rounded-full px-2.5 py-[3px] text-[11px] font-bold ${u.mfaEnabled?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{u.mfaEnabled?'On':'Off'}</span>
            </div>
            {!u.mfaEnabled&&!mfaSecret&&<button type="button" onClick={setupMfa} className="h-9 px-4 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black">Set up authenticator</button>}
            {mfaSecret&&(
              <div className="mt-1 mb-5">
                {mfaQr&&<img src={mfaQr} alt="Authenticator QR code" width={168} height={168} className="bg-white rounded-xl border border-slate-200 p-2"/>}
                <p className="text-[12.5px] text-slate-500 mt-2">Scan this QR. If the camera cannot read it, enter the key below.</p>
                <code className="mt-2 inline-block bg-[#fafafa] rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-mono">{mfaSecret}</code>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <input className="input !w-[140px] !rounded-xl" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/>
                  <button type="button" className="h-10 px-4 rounded-full bg-slate-900 text-white text-[13px] font-semibold" onClick={verifyMfa}>Verify</button>
                </div>
              </div>
            )}

            <SessionsList onMsg={setMsg} staff={staff}/>
          </section>
        </div>
      </div>
    </div>
  </div>;
}

function SessionsList({onMsg,staff}:{onMsg:(m:string)=>void;staff:boolean}){
  const out=staff?'/root/7563':'/app/merchants/login';
  const qc=useQueryClient();
  const q=useQuery({queryKey:['auth-sessions'],queryFn:()=>api('/auth/sessions')});
  const [busy,setBusy]=useState('');
  const rows:any[]=Array.isArray(q.data)?q.data:[];
  const kick=async(id:string,current:boolean)=>{
    setBusy(id);
    try{
      const r=await api('/auth/sessions/'+id+'/logout',{method:'POST',body:{}});
      if(r.current||current){ onMsg('Signed out'); setTimeout(()=>location.href=out,600); return; }
      onMsg('Logged out');
      qc.invalidateQueries({queryKey:['auth-sessions']});
    }catch(e:any){ onMsg(e.message); }
    finally{ setBusy(''); }
  };
  const when=(d:string)=>{ try{ return new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }catch{ return '—'; } };
  return <div className="border-t border-slate-100 pt-4 mt-2">
    <p className="text-[14px] font-semibold text-slate-900">Sessions</p>
    <p className="text-[12.5px] text-slate-500 mt-0.5">Where this account is signed in.</p>
    <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
      {q.isLoading&&<p className="py-4 text-[13px] text-slate-400">Loading…</p>}
      {!q.isLoading&&!rows.length&&<p className="py-4 text-[13px] text-slate-400">No active sessions.</p>}
      {rows.map(s=>(
        <div key={s.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-slate-900 truncate">{s.device}{s.current&&<span className="ml-2 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-bold px-2 py-0.5">This device</span>}</p>
            <p className="text-[12px] text-slate-400 mt-0.5 truncate">{s.ip} · signed in {when(s.signedInAt)}</p>
          </div>
          <button type="button" disabled={busy===s.id} onClick={()=>kick(s.id,!!s.current)} className="shrink-0 h-8 px-3 rounded-full border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy===s.id?'…':'Log out'}</button>
        </div>
      ))}
    </div>
    {rows.length>1&&<button type="button" className="mt-3 h-9 px-4 rounded-full border border-rose-200 bg-white text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50" onClick={async()=>{ await api('/auth/revoke-all',{method:'POST',body:{}}); onMsg('All sessions revoked — please log in again'); setTimeout(()=>location.href=out,1200); }}>Revoke all sessions</button>}
  </div>;
}

function Row({label,value,action,onAction}:{label:string;value:string;action?:string;onAction?:()=>void}){
  return <div className="flex items-center gap-4 py-3.5">
    <dt className="w-32 shrink-0 text-[12.5px] font-medium text-slate-400">{label}</dt>
    <dd className="min-w-0 flex-1 text-[14px] font-semibold text-slate-900 truncate">{value}</dd>
    {action&&<button type="button" onClick={onAction} className="shrink-0 h-8 px-3 rounded-full border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50">{action}</button>}
  </div>;
}
