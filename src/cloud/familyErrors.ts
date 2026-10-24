import {accountIssue,isAborted} from './errors.ts';
import type {FamilyAction} from './familyTypes.ts';
const gatewayCodes=new Set(['EXCEED_AUTHORITY','ACTION_FORBIDDEN']);
const messages:Record<string,string>={INVITE_USED:'此邀请码已被使用，请向家主或管理员索取新码。',RATE_LIMITED:'邀请码尝试过于频繁，请十分钟后重试，不要连续提交。',LIMIT_EXCEEDED:'家庭、成员或邀请数量超过接口上限，当前列表可能不完整。',BAD_REQUEST:'字段格式不正确，请检查输入。',FORBIDDEN:'没有此家庭权限。已隐藏家庭内容，请返回刷新家庭列表。',NOT_MEMBER:'当前已不是家庭成员，已停止访问。',NOT_FOUND:'家庭、成员或记录不存在，可能已被移除或删除。请刷新。',UNAUTHENTICATED:'登录已失效，请重新登录。',INVALID_INVITE:'邀请码错误、已过期或已被家主刷新。',ALREADY_MEMBER:'你已经是该家庭成员，请刷新家庭列表。',INVALID_ACTION:'线上接口尚未支持此操作，请核对已部署的 family_api；未使用本地数据替代。',UNKNOWN_ACTION:'线上接口不支持此操作（UNKNOWN_ACTION），请核对部署版本。',CONFLICT:'记录已被其他成员更新。草稿已保留，请读取最新版本、比较后再决定如何处理。',SNAPSHOT_CHANGED:'分页期间数据发生变化，本次结果已作废，请重新刷新。',INVALID_ASSIGNEE:'所选负责人或经手人已不在家庭，请刷新成员后重新选择。',REQUEST_ID_REUSED:'请求标识与内容不符，已停止提交。请核对上次操作。',SERVER_ERROR:'服务未完成。请核对现有函数、集合和索引，写入结果需要先核对。',PERMISSION_DENIED:'函数调用被拒绝，请核对已登录身份策略，不要放宽集合权限。',INVALID_RESPONSE:'云端返回格式或归属异常，已停止显示。',PENDING:'上次提交结果待确认。请先核对，不能新建另一条请求。',STORAGE:'无法安全读取或保存待确认状态，已停止写入。请保留网站资料。',UNCONFIRMED:'提交结果尚未确认，请先核对云端；不要重复新增。',CARD_CHANGED:'共享卡已变化，请刷新并比较原草稿。旧接口没有服务端版本锁。',IDENTITY:'账号身份或安卓家庭核对尚未通过，已停止写入。',PARTIAL:'批量操作未全部确认，请刷新核对实际结果。'};
export class FamilyError extends Error{
 readonly code:string;readonly action:string;readonly definite:boolean;
 constructor(code:string,action:string,detail?:string){super(detail??messages[code]??(code==='EXCEED_AUTHORITY'?'云函数安全规则拒绝调用，请核对云函数权限控制。':code==='ACTION_FORBIDDEN'?'HTTP API身份策略拒绝调用，请核对FunctionsHttpApiAllow。':'操作未完成，请保留阶段和错误码后核对。'));this.name='FamilyError';this.code=code;this.action=action;this.definite=gatewayCodes.has(code)||['INVITE_USED','RATE_LIMITED','LIMIT_EXCEEDED','BAD_REQUEST','FORBIDDEN','NOT_MEMBER','NOT_FOUND','UNAUTHENTICATED','INVALID_INVITE','ALREADY_MEMBER','INVALID_ACTION','UNKNOWN_ACTION','CONFLICT','INVALID_ASSIGNEE','REQUEST_ID_REUSED','PERMISSION_DENIED'].includes(code);}
}
export function familyError(error:unknown,action:FamilyAction|string):FamilyError{
 if(isAborted(error))throw error;
 if(error instanceof FamilyError)return error;
 const raw=error&&typeof error==='object'?error as Record<string,unknown>:{};
 const code=String(raw.code??raw.error??'').toUpperCase();
 if(code in messages||gatewayCodes.has(code))return new FamilyError(code,action);
 const safe=accountIssue(error,'FAMILY_REQUEST');
 return new FamilyError(safe.kind==='auth'?'UNAUTHENTICATED':safe.kind==='identity'?'IDENTITY':safe.code,action,safe.message);
}
export function familyMessage(error:unknown):string{const e=familyError(error,'FAMILY_REQUEST');return `${e.message}（${e.action} · ${e.code}）`;}
export const accessLost=(e:unknown)=>e instanceof FamilyError&&(gatewayCodes.has(e.code)||['FORBIDDEN','NOT_MEMBER','PERMISSION_DENIED','UNAUTHENTICATED','IDENTITY'].includes(e.code));
