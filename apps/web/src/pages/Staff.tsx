import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../api';
import {Alert} from './Auth';

export function AdminStaff(){
  const qc=useQueryClient();
  const list=useQuery({queryKey:['staff'],queryFn:()=>api('/admin/staff'),retry:false});
  const [f,setF]=useState({email:'',password:'',role:'SUPPORT'});
  const [msg,setMsg]=useState('');
  const save=useMutation({
    mutationFn:()=>api('/admin/staff',{method:'POST',body:f}),
    onSuccess:(r:any)=>{ setMsg(`Created ${r.email} as ${r.role}. They must enroll authenticator.`); setF({email:'',password:'',role:'SUPPORT'}); qc.invalidateQueries({queryKey:['staff']}); },
    onError:(e:any)=>setMsg(e.message||'Could not create staff'),
  });
  if(list.error) return <Alert>{(list.error as Error).message}</Alert>;
  return <div className="space-y-4">
    <div className="card">
      <h3 className="font-bold mb-1">Staff</h3>
      <p className="text-sm text-slate-500 mb-3">SUPPORT cannot approve payouts. New staff must set authenticator before other admin APIs.</p>
      <form className="flex flex-wrap gap-2 items-end" onSubmit={e=>{e.preventDefault(); save.mutate();}}>
        <label className="block"><span className="label">Email</span><input className="input" type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
        <label className="block"><span className="label">Password (10+)</span><input className="input" type="password" minLength={10} required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label>
        <label className="block"><span className="label">Role</span>
          <select className="input" value={f.role} onChange={e=>setF({...f,role:e.target.value})}>
            <option value="SUPPORT">SUPPORT</option>
            <option value="OPERATIONS">OPERATIONS</option>
            <option value="ACCOUNTS">ACCOUNTS</option>
            <option value="COMPLIANCE">COMPLIANCE</option>
          </select>
        </label>
        <button className="btn" disabled={save.isPending}>Create</button>
      </form>
      {msg&&<p className="text-[12.5px] text-slate-600 mt-2">{msg}</p>}
    </div>
    <div className="card">
      {(list.data||[]).map((s:any)=><p key={s.id} className="text-sm border-b py-2"><b>{s.email}</b> · {s.role} · MFA {s.mfaEnabled?'on':'off'}</p>)}
      {!list.data?.length&&<p className="text-sm text-slate-500">No staff rows yet.</p>}
    </div>
  </div>;
}
