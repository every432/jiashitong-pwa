import type {FamilyClient} from './familyClient.ts';
import type {FamilyAction,Json,Member,Role} from './familyTypes.ts';
import {FamilyError,familyError} from './familyErrors.ts';
import {id,text,integer,bool,obj,invalid} from './familyProtocol.ts';
import {newInvite,hasControls} from './authPolicyV32.ts';
import {consumeInviteSafely} from './inviteJoinV321.ts';
export type Invitation={id:string;type:'join'|'recovery';target:string;expires:number};
export type InviteResult={code?:string;id:string;expires:number};
export const roleLabel=(role:Role|undefined)=>role==='owner'?'家主':role==='admin'?'管理员':'普通成员';
export const selfMember=(members:Member[],uid:string)=>members.find(m=>(m.boundAuthUid??m.uid)===uid);
export class V32Client {
 readonly core:FamilyClient;
 constructor(core:FamilyClient){this.core=core;}
 async capabilities(signal:AbortSignal){const result=await this.core.call('v32Capabilities',{},signal);if(result.version!=='3.2'||typeof result.anonymous!=='boolean')throw new FamilyError('INVALID_ACTION','v32Capabilities','当前后端未支持完整V3.2，保留原共享功能；不使用本地数据替代新功能。');return{anonymous:result.anonymous};}
 private async call(action:FamilyAction,payload:Json,signal:AbortSignal){await this.capabilities(signal);return this.core.call(action,payload,signal);}
 async invites(family:string,signal:AbortSignal){const r=await this.call('v32ListInvites',{familyId:id(family)},signal);if(!Array.isArray(r.invites)||r.invites.length>100)invalid('INVITES');const seen=new Set<string>();const rows=r.invites.map(v=>{if(!obj(v)||!['join','recovery'].includes(String(v.type)))invalid('INVITES');const key=id(v.inviteId);if(seen.has(key))invalid('INVITES');seen.add(key);return{id:key,type:v.type as 'join'|'recovery',target:text(v.targetMemberId,false),expires:integer(v.expiresAt,1)};});return{rows,hasMore:bool(r.hasMore)};}
 // 管理回执接口不返回明文；持久保存原requestId，未知结果只能人工同ID重试。
 async management(family:string,action:'v32CreateInvite'|'v32RevokeInvite'|'v32SetMemberRole'|'v32SyncIdentity',payload:Json,signal:AbortSignal,retry=false){
  const key=this.core.slot(family,'v32-management');return this.core.exclusive(key,signal,async()=>{
   let request=await this.core.pending.read(key);
   if(request&&!retry)throw new FamilyError('PENDING',action,'上次V3.2管理操作待核对，请先按原请求重试，不要生成另一邀请码。');
   if(!request){if(retry)throw new FamilyError('PENDING',action,'没有待核对管理操作。');request={action,familyId:id(family),...payload,requestId:crypto.randomUUID()};await this.core.pending.write(key,request);}
   if(request.familyId!==family||!['v32CreateInvite','v32RevokeInvite','v32SetMemberRole','v32SyncIdentity'].includes(String(request.action))||typeof request.requestId!=='string'||!/^[a-f0-9-]{32,36}$/i.test(request.requestId))throw new FamilyError('STORAGE',action);
   const {action:storedAction,...body}=request;
   try{const result=await this.call(storedAction as FamilyAction,body,signal);await this.core.pending.ack(key);return {action:storedAction,result};}
   catch(error){const safe=familyError(error,action);if(safe.definite)await this.core.pending.ack(key);throw safe;}
  });
 }
 async hasPending(family:string){return!!await this.core.pending.read(this.core.slot(family,'v32-management'));}
 async createInvite(family:string,type:'join'|'recovery',signal:AbortSignal,target?:string):Promise<InviteResult>{
  const home=await this.core.home(family,signal),role=home.family.effectiveRole??home.family.role;if(!['owner','admin'].includes(role))throw new FamilyError('FORBIDDEN','v32CreateInvite');if(type==='recovery'&&!home.members.some(m=>m.memberId===target&&m.authKind==='anonymous'&&(m.effectiveRole??m.role)==='member'))throw new FamilyError('BAD_REQUEST','v32CreateInvite','仅可恢复本家庭普通免邮箱成员；正式账号请使用邮箱找回。');
  const {result}=await this.management(family,'v32CreateInvite',{type,...type==='recovery'?{targetMemberId:id(target)}:{}},signal);return parseInviteResult(result,type);
 }
 async join(invite:string,displayName:string,signal:AbortSignal){const code=newInvite(invite);if(!displayName.trim()||Array.from(displayName.trim()).length>40||hasControls(displayName))throw new FamilyError('BAD_REQUEST','v32ConsumeInvite','请填写1～40字的家庭昵称。');await this.capabilities(signal);const gate=this.core.gate();if(!gate.uid||!gate.canWrite)throw new FamilyError('IDENTITY','v32ConsumeInvite');return this.core.exclusive(this.core.slot('all','invite-form'),signal,async()=>{const family=await consumeInviteSafely(this.core.port,this.core.pending,gate.uid,code,displayName.trim(),signal);return this.core.call('getFamily',{familyId:family},signal);});}
 async setRole(family:string,target:string,role:'admin'|'member',signal:AbortSignal){const home=await this.core.home(family,signal);if((home.family.effectiveRole??home.family.role)!=='owner')throw new FamilyError('FORBIDDEN','v32SetMemberRole');if(!home.members.some(m=>m.memberId===target&&m.role!=='owner'&&m.authKind==='formal'))throw new FamilyError('BAD_REQUEST','v32SetMemberRole','只允许为正式普通成员设置管理员，不修改家主。');return this.management(family,'v32SetMemberRole',{targetMemberId:id(target),role},signal);}
}
export function parseInviteResult(r:Json,type?:'join'|'recovery'):InviteResult{const available=bool(r.codeAvailable);return{id:id(r.inviteId),expires:integer(r.inviteExpiresAt,1),...(available?{code:newInvite(text(r.inviteCode),type)}:{})};}
