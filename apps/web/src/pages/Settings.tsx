import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../api';
import {Alert} from './Auth';

const STAFF=new Set(['SUPER_ADMIN','COMPLIANCE','OPERATIONS','ACCOUNTS']);

const Copy=({v}:{v:string})=>{
  const [c,setC]=useState(false);
  return <button title="Copy" className="ml-1.5 w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 grid place-items-center text-[12px] transition" onClick={async()=>{ try{ await navigator.clipboard.writeText(v); setC(true); setTimeout(()=>setC(false),1200);}catch{} }}>{c?'✓':'⧉'}</button>;
};

export function Settings(){
  const qc=useQueryClient();
  const me=useQuery({queryKey:['me-set'],queryFn:()=>api('/auth/me')});
  const onb=useQuery({queryKey:['set-onb'],queryFn:()=>api('/merchant/onboarding'),retry:false,enabled:!!me.data&&!STAFF.has(me.data.role)});
  const [msg,setMsg]=useState('');
  const [mfaSecret,setMfaSecret]=useState('');
  const [code,setCode]=useState('');

  const u:any=me.data||{};
  const staff=STAFF.has(u.role);
  const business=staff?'Syntrix Platform':(onb.data?.businessName||u.email?.split('@')[0]||'Merchant');
  const initial=(business||'M').charAt(0).toUpperCase();
  const roleLabel=(u.role||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,(c:string)=>c.toUpperCase());

  const editPhone=async()=>{ const phone=prompt('Phone number (+91 …)',u.phone||''); if(!phone) return; try{ await api('/auth/profile',{method:'POST',body:{phone}}); setMsg('Phone updated ✓'); qc.invalidateQueries({queryKey:['me-set']}); }catch(e:any){ setMsg(e.message); } };
  const editPassword=async()=>{ const currentPassword=prompt('Current password'); if(!currentPassword) return; const newPassword=prompt('New password (10+ characters)'); if(!newPassword) return; try{ const r=await api('/auth/change-password',{method:'POST',body:{currentPassword,newPassword}}); setMsg(r.message); setTimeout(()=>location.href='/login',1500); }catch(e:any){ setMsg(e.message); } };
  const setupMfa=async()=>{ if(u.mfaEnabled){ setMsg('MFA is already enabled'); return; } const r=await api('/auth/mfa/setup',{method:'POST',body:{}}); setMfaSecret(r.secret); setMsg('Add this secret to your authenticator app, then verify the code'); };
  const verifyMfa=async()=>{ try{ await api('/auth/mfa/verify',{method:'POST',body:{totp:code}}); setMsg('MFA enabled ✓'); setMfaSecret(''); qc.invalidateQueries({queryKey:['me-set']}); }catch(e:any){ setMsg(e.message); } };
  const setPin=async()=>{ const currentPassword=prompt('Current password'); if(!currentPassword) return; const pin=prompt('New 4-digit PIN'); if(!pin) return; const pin2=prompt('Enter the PIN again (confirm)'); if(pin!==pin2){ setMsg('The two PINs do not match'); return; } try{ const r=await api('/auth/pin/set',{method:'POST',body:{currentPassword,pin}}); setMsg(r.message+' ✓'); qc.invalidateQueries({queryKey:['me-set']}); }catch(e:any){ setMsg(e.message); } };
  const removePin=async()=>{ const currentPassword=prompt('Current password (to remove the PIN)'); if(!currentPassword) return; try{ const r=await api('/auth/pin/remove',{method:'POST',body:{currentPassword}}); setMsg(r.message); qc.invalidateQueries({queryKey:['me-set']}); }catch(e:any){ setMsg(e.message); } };

  if(me.isLoading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[1,2,3].map(i=><div key={i} className="h-28 rounded-[22px] bg-slate-200/50 animate-pulse"/>)}</div>;

  return <div className="w-full">
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Your profile</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Account, security, and sign-in controls</p>
      </div>
      <button className="ml-auto h-10 px-4 rounded-2xl bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition" onClick={async()=>{ await api('/auth/logout',{method:'POST',body:{}}); location.href='/login'; }}>Sign out</button>
    </div>

    {msg&&<div className="mb-4"><Alert>{msg}</Alert></div>}

    {/* Identity strip */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
      <div className="kpi-peach md:col-span-2 flex flex-row items-center gap-4 !min-h-0 py-5">
        <div className="w-16 h-16 rounded-2xl bg-white/80 shadow-sm grid place-items-center text-[26px] font-bold text-slate-700 shrink-0">{initial}</div>
        <div className="min-w-0">
          <p className="text-[20px] font-bold text-slate-900 truncate">{business}</p>
          <p className="text-[13px] text-slate-600 mt-0.5">{roleLabel}</p>
          {staff
            ? <span className="inline-flex mt-2 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1">Platform admin · full control</span>
            : <span className="inline-flex mt-2 rounded-full bg-white/70 text-slate-600 text-[11px] font-bold px-2.5 py-1">Merchant account</span>}
        </div>
      </div>
      <div className="kpi-ink !min-h-0 py-5 justify-center">
        <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Account ID</p>
        <p className="text-[15px] font-bold font-mono mt-1.5 break-all flex items-center">acc_{u.orgId||'—'}{u.orgId&&<Copy v={'acc_'+u.orgId}/>}</p>
        {!staff&&u.merchantId&&<>
          <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase mt-3">Merchant ID</p>
          <p className="text-[13px] font-bold font-mono mt-1 break-all flex items-center">{u.merchantId}<Copy v={u.merchantId}/></p>
        </>}
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-4">
      {/* Account details */}
      <div className="panel">
        <h2 className="text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase mb-4">Account details</h2>
        <div className="space-y-3">
          {[
            {l:'Login email',v:u.email||'—',action:null},
            {l:'Phone number',v:u.phone||'Not set',action:editPhone,actionLabel:'Edit'},
            {l:'Password',v:'•••••••••••',action:editPassword,actionLabel:'Change'},
          ].map(row=>(
            <div key={row.l} className="flex items-center gap-3 rounded-2xl bg-[#f7f8fa] px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-slate-400">{row.l}</p>
                <p className="text-[14px] font-semibold text-slate-900 mt-0.5 truncate">{row.v}</p>
              </div>
              {row.action&&<button onClick={row.action} className="shrink-0 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">{row.actionLabel}</button>}
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="panel">
        <h2 className="text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase mb-4">Security & sign-in</h2>

        <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3.5 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-slate-900">Authenticator MFA</p>
              <p className="text-[12.5px] text-slate-500 mt-0.5">{u.mfaEnabled?'Enabled — codes required at login':'Currently off — recommended for admins'}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold ${u.mfaEnabled?'bg-[#d8f5e6] text-[#1a9e5c]':'bg-slate-200 text-slate-500'}`}>{u.mfaEnabled?'On':'Off'}</span>
          </div>
          {!u.mfaEnabled&&<button onClick={setupMfa} className="mt-3 h-9 px-3.5 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black">Enable MFA</button>}
          {mfaSecret&&(
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <code className="bg-white rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-mono">{mfaSecret}</code>
              <input className="input !w-[120px] !py-2 !rounded-xl" placeholder="6-digit" value={code} onChange={e=>setCode(e.target.value)}/>
              <button className="btn !py-2 !rounded-xl" onClick={verifyMfa}>Verify</button>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3.5 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-slate-900">Login PIN</p>
              <p className="text-[12.5px] text-slate-500 mt-0.5">{u.pinSet?'Set ✓ — asked after password':'Not set — password-only login'}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold ${u.pinSet?'bg-[#d8f5e6] text-[#1a9e5c]':'bg-slate-200 text-slate-500'}`}>{u.pinSet?'Set':'Off'}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={setPin} className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">{u.pinSet?'Change PIN':'Set PIN'}</button>
            {u.pinSet&&<button onClick={removePin} className="h-9 px-3.5 rounded-xl text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50">Remove</button>}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5">
          <p className="text-[14px] font-semibold text-slate-900">Sessions</p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">Sign out everywhere if a device is lost or shared.</p>
          <button className="mt-3 h-9 px-3.5 rounded-xl border border-rose-200 bg-white text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50" onClick={async()=>{ await api('/auth/revoke-all',{method:'POST',body:{}}); setMsg('All sessions revoked — please log in again'); setTimeout(()=>location.href='/login',1200); }}>Revoke all sessions</button>
        </div>
      </div>
    </div>
  </div>;
}
