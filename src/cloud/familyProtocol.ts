import {FamilyError} from './familyErrors.ts';
import type {Family,Home,Json,Member} from './familyTypes.ts';
export const obj=(v:unknown):v is Json=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function invalid(action='PARSE'):never{throw new FamilyError('INVALID_RESPONSE',action);}
export function text(v:unknown,required=true):string{if(typeof v!=='string'||(required&&!v.trim()))invalid();return v;}
export function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)invalid();return v;}
export function bool(v:unknown):boolean{if(typeof v!=='boolean')invalid();return v;}
export function id(v:unknown):string{const s=text(v);if(s.length>128||/[\\/]/.test(s)||Array.from(s).some(c=>c.charCodeAt(0)<32))invalid();return s;}
export function inviteCode(raw:string):string{const s=raw.trim().toUpperCase();if(!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(s))throw new FamilyError('BAD_REQUEST','JOIN_FAMILY','请输入完整12位邀请码，不含0、1、I、O。');return s;}
export function familyText(name:string|null,displayName:string,required=false){if(name!==null&&(!name.trim()||name.trim().length>60))throw new FamilyError('BAD_REQUEST','FAMILY_INPUT','家庭名称需1～60个字符。');if(displayName.trim().length>40||(required&&!displayName.trim()))throw new FamilyError('BAD_REQUEST','FAMILY_INPUT','本人家庭称呼需1～40个字符；创建、加入时可留空。');}
export function parseFamily(value:Json,uid:string,expected?:string):Family{
 const f=obj(value.family)?value.family:value,fid=id(f.familyId??f._id),ownerUid=text(f.ownerUid);
 if(expected&&expected!==fid)invalid('GET_FAMILY');
 const role=ownerUid===uid?'owner':'member';if(f.myRole!==undefined&&f.myRole!==role)invalid('GET_FAMILY');
 if(f.effectiveRole!==undefined&&!['owner','admin','member'].includes(String(f.effectiveRole)))invalid('GET_FAMILY');
 const invite=value.inviteCode??f.inviteCode,expiry=value.inviteExpiresAt??f.inviteExpiresAt;
 if(invite!==undefined&&inviteCode(text(invite))!==invite)invalid('INVITE');
 if(expiry!==undefined&&(typeof expiry!=='number'||!Number.isSafeInteger(expiry)||expiry<=0))invalid('INVITE');
 return{id:fid,name:text(f.name),ownerUid,role,displayName:typeof value.myDisplayName==='string'?value.myDisplayName:'',...(f.effectiveRole!==undefined?{effectiveRole:f.effectiveRole as Family['effectiveRole']}:{ }),...(typeof invite==='string'?{invite}:{}),...(typeof expiry==='number'?{expires:expiry}:{})};
}
export function parseMembers(value:Json,family:Family,uid:string):Member[]{
 if(!Array.isArray(value.members)||value.members.length>100)invalid('LIST_MEMBERS');const ids=new Set<string>();
 const stableIds=new Set<string>();
 const rows=value.members.map(v=>{if(!obj(v))invalid();const memberUid=text(v.uid??v.userUid);if(ids.has(memberUid))invalid();ids.add(memberUid);const role=family.ownerUid===memberUid?'owner':'member';if(v.role!==undefined&&v.role!==role)invalid();const extra:Partial<Member>={};if(v.memberId!==undefined){const key=id(v.memberId);if(stableIds.has(key))invalid();stableIds.add(key);extra.memberId=key;}if(v.effectiveRole!==undefined){if(!['owner','admin','member'].includes(String(v.effectiveRole))||((v.effectiveRole==='owner')!==(role==='owner')))invalid();extra.effectiveRole=v.effectiveRole as Member['effectiveRole'];}if(v.authKind!==undefined){if(v.authKind!=='formal'&&v.authKind!=='anonymous')invalid();extra.authKind=v.authKind;}if(v.boundAuthUid!==undefined)extra.boundAuthUid=text(v.boundAuthUid);return{uid:memberUid,role,displayName:typeof v.displayName==='string'?v.displayName:'',accountNickname:typeof v.accountNickname==='string'?v.accountNickname:'',profileUnavailable:v.profileUnavailable===true||typeof v.accountNickname!=='string',...extra} as Member;});
 if(!rows.some(m=>(m.boundAuthUid??m.uid)===uid)||!ids.has(family.ownerUid))throw new FamilyError('NOT_MEMBER','LIST_MEMBERS');return rows;
}
export function parseHome(familyResult:Json,membersResult:Json,uid:string,fid:string):Home{const family=parseFamily(familyResult,uid,fid),members=parseMembers(membersResult,family,uid),self=members.find(m=>(m.boundAuthUid??m.uid)===uid)!;if(self.memberId){family.myMemberId=self.memberId;family.myMemberUid=self.uid;family.effectiveRole=self.effectiveRole??self.role;}return{family,members,profilesSupported:membersResult.accountProfilesSupported===true};}
export function canonical(v:unknown):string{if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';if(obj(v))return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export async function digest(v:unknown):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
