// SDK 3.10.3部分认证方法会直接console.warn远端message，debug:false仍会发生。
// 调用期间临时抑制第三方控制台输出，诊断只经本应用白名单错误码进入界面。
const levels=['log','warn','error','info','debug'] as const;
let depth=0;
let original:Partial<Record<typeof levels[number],typeof console.log>>={};
const quiet=()=>{};
export async function privateSdkCall<T>(task:()=>Promise<T>):Promise<T>{
 if(depth++===0){original={};for(const level of levels){original[level]=console[level];console[level]=quiet;}}
 try{return await task();}
 finally{if(--depth===0){for(const level of levels){if(console[level]===quiet&&original[level])console[level]=original[level]!;}original={};}}
}
