import {useState} from 'react';
import type {Home} from '../../cloud/familyTypes';
import {roleLabel} from '../../cloud/v32Client';
import {Actions,Field,Modal} from '../../ui';
type Action='renameFamily'|'rotateInvite'|'setMyDisplayName'|'leaveFamily'|'removeMember';
export default function FamilySettings({home,uid,busy,error,onAction}:{home:Home;uid:string;busy:boolean;error:string;onAction:(action:Action,value:string)=>Promise<boolean>}){
 const [action,setAction]=useState<Action|null>(null),[value,setValue]=useState(''),[target,setTarget]=useState('');const owner=home.family.ownerUid===uid;
 const open=(a:Action,v='')=>{setAction(a);setValue(v);};
 return <section className="panel"><h2>家庭详情与成员</h2><p>家庭名称：{home.family.name}</p><p>我的家庭称呼：{home.family.displayName||'未设置'}</p><p>我的角色：{roleLabel(home.family.effectiveRole??home.family.role)}</p><Actions>{owner&&<><button className="btn secondary" disabled={busy} onClick={()=>open('renameFamily',home.family.name)}>修改家庭名称</button><button className="btn secondary" disabled={busy} onClick={()=>open('rotateInvite')}>刷新邀请码</button></>}<button className="btn secondary" disabled={busy} onClick={()=>open('setMyDisplayName',home.family.displayName)}>修改本人家庭称呼</button>{!owner&&<button className="btn danger" disabled={busy} onClick={()=>open('leaveFamily')}>退出家庭</button>}</Actions>
 <h3>家庭成员</h3>{home.members.map(m=><article className="family-member" key={m.uid}><div><strong>{m.accountNickname||m.displayName||'家庭成员'}</strong><p>家庭称呼：{m.displayName||'未设置'} · {roleLabel(m.effectiveRole??m.role)}{m.uid===uid?' · 我':''}</p>{m.profileUnavailable&&<small>账号昵称暂未取得，显示家庭称呼</small>}</div>{owner&&m.uid!==uid&&m.uid!==home.family.ownerUid&&<button className="btn danger" disabled={busy} onClick={()=>{setTarget(m.accountNickname||m.displayName||'该成员');open('removeMember',m.uid);}}>移除成员</button>}</article>)}
 {!home.profilesSupported&&<p className="hint">线上接口未声明账号昵称补充能力，家庭称呼仍可使用。</p>}<p className="hint">没有家主转让或解散功能。普通成员共同编辑的权限仍由原云函数验证。</p>
 {action&&<Modal title="确认家庭设置" onClose={()=>{if(!busy)setAction(null);}}><form onSubmit={async e=>{e.preventDefault();if(await onAction(action,value))setAction(null);}}>{action==='renameFamily'||action==='setMyDisplayName'?<Field label={action==='renameFamily'?'新家庭名称':'本人家庭称呼'}><input value={value} onChange={e=>setValue(e.target.value)} required maxLength={action==='renameFamily'?60:40}/></Field>:<p>{action==='rotateInvite'?'确认生成新的12位邀请码？旧码将立即失效。':action==='leaveFamily'?'确认退出本家庭？退出后将不能访问共享内容，云端记录不会因此删除。':`确认移除普通成员“${target}”？该成员将失去本家庭访问权限。`}</p>}{error&&<p className="notice" role="alert">{error}</p>}<button className={`btn ${action==='leaveFamily'||action==='removeMember'?'danger':'primary'} wide`} disabled={busy}>确认操作</button></form></Modal>}
 </section>;
}
