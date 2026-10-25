import {AccountError,accountIssue,failAccount,cancelable,isAborted} from './errors.ts';
import type {AccountProfile,AuthPort,FamilySummary,Stage} from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function parse(value:unknown,stage:Stage):Record<string,unknown>{
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{failAccount(stage,'INVALID_RESPONSE','云函数返回格式不正确，已停止读取。','unknown');}}
 if(!object(value))failAccount(stage,'INVALID_RESPONSE','云函数返回结构缺失，不能将其当作空家庭列表。','unknown');
 return value;
}
export function functionPayload(response:unknown,stage:Stage):Record<string,unknown> {
 let outer=parse(response,stage);
 if(outer.error)throw outer.error;
 if(outer.code&&outer.code!=='0')throw {code:outer.code};
 if('data'in outer&&outer.error===null)outer=parse(outer.data,stage);
 if(outer.code&&outer.code!=='0')throw {code:outer.code};
 const body=parse(outer.result??outer,stage);
 if(body.success!==true){if(body.success===false)throw {code:body.code??body.error??'SERVER_ERROR'};failAccount(stage,'INVALID_RESPONSE','云函数没有返回明确的业务成功状态，已停止读取。','unknown');}
 return object(body.data)?body.data:body;
}
export function assertSameUid(webUid:string,functionUid:string,androidUid?:string):void {
 if(!webUid||!functionUid||webUid!==functionUid)failAccount('WHO_AM_I','UID_MISMATCH','Web账号与云函数身份不一致，已停止家庭数据接入。请保留阶段和错误码，不要创建新账号或同名家庭。','identity');
 if(androidUid!==undefined&&androidUid.trim()!==webUid)failAccount('ANDROID_UID','ANDROID_UID_MISMATCH','安卓版UID与当前账号不一致，已停止家庭列表读取。请确认两端使用同一原账号。','identity');
}
export function parseFamilies(payload:Record<string,unknown>):FamilySummary[]{
 if(!Array.isArray(payload.families))failAccount('LIST_MY_FAMILIES','INVALID_RESPONSE','家庭列表字段缺失，不能当作没有家庭。','unknown');
 const ids=new Set<string>();
 return payload.families.map(value=>{
  if(!object(value)||typeof value.familyId!=='string'||!value.familyId||typeof value.name!=='string'||!value.name||(value.myRole!=='owner'&&value.myRole!=='member')||ids.has(value.familyId as string))failAccount('LIST_MY_FAMILIES','INVALID_RESPONSE','家庭列表的编号、名称或角色异常，已停止显示。','unknown');
  if(value.effectiveRole!==undefined&&!['owner','admin','member'].includes(String(value.effectiveRole)))failAccount('LIST_MY_FAMILIES','INVALID_RESPONSE','家庭角色字段异常。','unknown');
  ids.add(value.familyId);return {id:value.familyId,name:value.name,role:value.myRole,...(typeof value.effectiveRole==='string'?{effectiveRole:value.effectiveRole as 'owner'|'admin'|'member'}:{}),...(typeof value.memberId==='string'?{memberId:value.memberId}:{})};
 });
}
export function publicProfile(value:unknown,allowAnonymous=false):AccountProfile {
 if(!object(value)||typeof value.id!=='string'||!value.id.trim()||(!allowAnonymous&&value.is_anonymous===true))failAccount('GET_PROFILE','INVALID_ACCOUNT_IDENTITY','SDK没有返回此入口允许的真实认证身份。','identity');
 const metadata=object(value.user_metadata)?value.user_metadata:{};
 if(typeof metadata.uid==='string'&&metadata.uid&&metadata.uid!==value.id)failAccount('GET_PROFILE','PROFILE_UID_MISMATCH','账号资料身份不一致，已停止显示。','identity');
 const text=(v:unknown)=>typeof v==='string'?v:'';
 return {uid:value.id,nickname:text(metadata.nickName)||text(metadata.nickname)||text(metadata.name),email:text(value.email),username:text(metadata.username),...(value.is_anonymous===true?{anonymous:true}:{})};
}
export function normalizeNickname(raw:string):string {
 const value=raw.trim(),chars=Array.from(value);
 if(chars.length<2||chars.length>24||chars.some(c=>{const n=c.codePointAt(0)!;return n<32||(n>=127&&n<=159)||(n>=0xD800&&n<=0xDFFF)||[0x2028,0x2029,0xFEFF,0x200B].includes(n)||(n>=0x202A&&n<=0x202E)||(n>=0x2066&&n<=0x2069);}))failAccount('UPDATE_NICKNAME','INVALID_NICKNAME','昵称需为2～24个字符，不能包含换行、控制符或隐藏方向字符。');
 return value;
}
export async function whoAmI(port:AuthPort,webUid:string,signal:AbortSignal):Promise<string>{
 try{
 const body=functionPayload(await cancelable(port.callRead('whoAmI',signal),signal),'WHO_AM_I');
 if(typeof body.uid!=='string')failAccount('WHO_AM_I','INVALID_RESPONSE','whoAmI未返回有效UID，已停止家庭读取。','identity');
 assertSameUid(webUid,body.uid);return body.uid;
 }catch(error){if(isAborted(error))throw error;throw new AccountError(accountIssue(error,'WHO_AM_I'));}
}
export async function listMyFamilies(port:AuthPort,webUid:string,functionUid:string,androidUid:string,signal:AbortSignal):Promise<FamilySummary[]>{
 assertSameUid(webUid,functionUid,androidUid);
 try{return parseFamilies(functionPayload(await cancelable(port.callRead('listMyFamilies',signal),signal),'LIST_MY_FAMILIES'));}
 catch(error){if(isAborted(error))throw error;throw new AccountError(accountIssue(error,'LIST_MY_FAMILIES'));}
}
