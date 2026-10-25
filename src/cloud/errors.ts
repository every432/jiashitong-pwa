import type {SafeIssue,Stage} from './types.ts';
export class AccountError extends Error {
  readonly issue:SafeIssue;
  constructor(issue:SafeIssue){super(issue.message);this.name='AccountError';this.issue=issue;}
}
const known=new Set(['bad_request','invalid_argument','invalid_parameter','invalid_username_or_password','invalid_password','password_not_set','invalid_credentials','user_not_found','not_found','user_not_exist','invalid_email','invalid_username','weak_password','password_too_weak','username_already_exists','email_already_exists','user_already_exists','already_exists','captcha_required','captcha_invalid','captcha_expired','rate_limit_exceeded','too_many_requests','resource_exhausted','verification_code_invalid','invalid_verification_code','verification_code_expired','verification_token_expired','verification_failed','otp_expired','otp_invalid','invalid_token','token_expired','invalid_grant','invalid_refresh_token','refresh_token_expired','unauthenticated','unauthorized','forbidden','permission_denied','no_authority','invalid_origin','invalid_domain','domain_not_allowed','provider_not_enabled','operation_not_allowed','login_method_disabled','server_error','database_error','failed_precondition','network_error','timeout','invalid_action','auth_method_mismatch']);
const categories=new Set(['PROVIDER_NOT_ENABLED','INVALID_CREDENTIALS','USER_NOT_FOUND','INVALID_PARAMS','RATE_LIMITED','CAPTCHA_REQUIRED','CAPTCHA_INVALID','VERIFICATION_FAILED','SERVICE_ERROR','AUTH_METHOD_MISMATCH']);
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'?v as Record<string,unknown>:{};
export function accountIssue(error:unknown,stage:Stage):SafeIssue {
 if(error instanceof AccountError)return error.issue;
 const e=object(error),raw=String(e.code??e.error??'').toLowerCase(),category=typeof e.category==='string'?e.category:'';
 const code=known.has(raw)?raw.toUpperCase():categories.has(category)?category:'SDK_ERROR';
 const status=Number(e.statusCode??e.status??0),hint=String(e.message??e.error_description??'').toLowerCase();
 const match=(...parts:string[])=>parts.some(p=>raw.includes(p)||category.toLowerCase().includes(p));
 const issue=(message:string,kind:SafeIssue['kind']):SafeIssue=>({stage,code,message,kind});
 if(match('captcha'))return issue('需要完成腾讯云安全验证。请按安全验证窗口操作；若窗口未出现，请允许本站弹窗后重试。不会关闭风控或替你跳过验证。','captcha');
 if(status===429||match('rate','too_many','resource_exhausted'))return {...issue('操作过于频繁，请稍后重试。不要连续点击发送验证码。','rate'),retryAfter:Math.min(3600,Math.max(60,Number(e.retryAfter)||60))};
 if(match('username_already','email_already','user_already','already_exists'))return issue('该邮箱或用户名已注册。请回到“登录已有账号”，不要重复注册。','input');
 if(match('verification','otp'))return issue(match('expired')?'验证码或本次验证凭证已过期，请重新发送。':'验证码不正确或已失效，请核对邮件中的最新验证码。','input');
 if(match('weak_password','password_too_weak'))return issue('密码未达到云端强度要求，请使用8～64位大小写字母、数字和符号组合。','input');
 if(status===401||match('invalid_token','token_expired','invalid_grant','invalid_refresh_token','unauthenticated','unauthorized'))return issue('登录已失效或令牌未被接受，请重新登录；若反复出现，需核对调用通道与认证策略。','auth');
 if(match('invalid_username_or_password','invalid_password','password_not_set','invalid_credentials'))return issue('账号或密码不正确，或尚未设置密码。可以改用邮箱验证码登录。','input');
 if(match('user_not_found','user_not_exist')||(raw==='not_found'&&stage!=='LIST_MY_FAMILIES'))return issue('未找到已有账号，请核对邮箱或用户名。本次登录不会自动注册。','input');
 if(match('provider_not_enabled','disabled','operation_not_allowed','auth_method_mismatch'))return issue('此登录方式不可用，请核对控制台“身份认证”的登录方式配置。','permission');
 if(match('unknown_action','invalid_action'))return {...issue('线上 family_api 尚未支持此接口，请核对部署版本；本次未使用本地数据代替云端结果。','permission'),code:'BACKEND_ACTION_UNSUPPORTED'};
 if(match('invalid_origin','invalid_domain','domain_not_allowed')||hint.includes('安全域名'))return {...issue('当前安全来源未被允许，请核对CloudBase安全来源配置；不会放宽数据库权限。','permission'),code:code==='SDK_ERROR'?'SECURITY_ORIGIN_REJECTED':code};
 if(status===403||match('forbidden','permission_denied','no_authority','exceed_authority'))return {...issue('当前登录身份没有调用权限。请核对family_api函数权限和HTTP API策略，不要开放匿名访问或数据库权限。','permission'),...(['exceed_authority','action_forbidden'].includes(raw)?{code:raw.toUpperCase()}:{})};
 if(match('invalid_email'))return issue('邮箱格式不正确，请检查邮箱地址。','input');
 if(match('bad_request','invalid_argument','invalid_parameter','invalid_username','invalid_params'))return issue('云端拒绝了输入参数，请核对账号、用户名或表单格式。','input');
 if(match('timeout','network')||error instanceof TypeError||/network|failed to fetch|cors|timeout|timed out|load failed/.test(hint))return {...issue('网络请求未完成。浏览器无法单独确定是断网、CORS、安全来源还是网关故障，请检查连接并按配置清单排查。','network'),code:code==='SDK_ERROR'?'NETWORK_UNDETERMINED':code};
 return issue('云端暂未完成此操作。请保留下面的阶段与错误码后重试。'+(stage==='VERIFY_REGISTER_CODE'?'注册结果不确定时请用验证码登录核对。':''),'unknown');
}
export function failAccount(stage:Stage,code:string,message:string,kind:SafeIssue['kind']='input'):never {throw new AccountError({stage,code,message,kind});}
export const aborted=()=>new DOMException('账户请求已取消','AbortError');
export const isAborted=(e:unknown)=>e instanceof DOMException&&e.name==='AbortError';
/** SDK公共函数接口未暴露AbortSignal：取消本方等待和发布，晚到回包永不进入新账号状态。 */
export function cancelable<T>(operation:Promise<T>,signal:AbortSignal):Promise<T> {
 if(signal.aborted){void operation.catch(()=>{});return Promise.reject(aborted());}
 return new Promise((resolve,reject)=>{const cancel=()=>reject(aborted());signal.addEventListener('abort',cancel,{once:true});operation.then(value=>{if(!signal.aborted)resolve(value);},error=>{if(!signal.aborted)reject(error);}).finally(()=>signal.removeEventListener('abort',cancel));});
}
