import {failAccount} from './errors.ts';
export const hasControls=(s:string)=>Array.from(s).some(c=>{const n=c.charCodeAt(0);return n<32||(n>=127&&n<=159);});
export function validatePassword(value:string,confirmation=value){
 if(value!==confirmation)failAccount('PASSWORD_LOGIN','PASSWORD_MISMATCH','两次输入的密码不一致。');
 if(value.length<8||value.length>64||hasControls(value)||!/[A-Z]/.test(value)||!/[a-z]/.test(value)||!/[0-9]/.test(value)||!/[\p{P}\p{S}]/u.test(value))failAccount('PASSWORD_LOGIN','WEAK_PASSWORD','密码需8～64位，包含大写字母、小写字母、数字和符号。');
 return value;
}
export function newInvite(raw:string,type?:'join'|'recovery'){
 const code=raw.trim().toUpperCase();
 if(!/^[JR][23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{9}$/.test(code)||(type==='join'&&code[0]!=='J')||(type==='recovery'&&code[0]!=='R'))failAccount('FAMILY_REQUEST','INVALID_INVITE','请输入完整10位加入码（J开头）或恢复码（R开头），两者不能混用。');
 return code;
}
export const badge=(n:number)=>n>99?'99+':String(Math.max(0,n));
