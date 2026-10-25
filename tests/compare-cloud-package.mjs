// 只读比对本人从控制台导出的已部署函数目录。绝不获取凭据、调用函数或部署。
// node tests/compare-cloud-package.mjs "D:/已导出的family_api目录"
import {readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
const reference=process.env.ANDROID_SECURITY_PACKAGE??'D:/android projects app/cloud_deploy_prepare/phase5_security_20261023_01/verified_package',exported=process.argv[2]?resolve(process.argv[2]):null;
const digest=data=>createHash('sha256').update(data).digest('hex'),files=[];
for(const name of ['index.js','family_collaboration.js','family_access_fence.js','family_member_profiles.js']){
 const original=await readFile(join(reference,name)),row={name,referenceSHA256:digest(original)};
 if(exported){try{const online=await readFile(join(exported,name));row.exportSHA256=digest(online);row.byteEqual=online.equals(original);row.normalizedEqual=online.toString('utf8').replaceAll('\r\n','\n')===original.toString('utf8').replaceAll('\r\n','\n');}catch(e){if(e.code!=='ENOENT')throw e;row.missing=true;}}
 files.push(row);
}
const matched=exported?files.every(f=>f.normalizedEqual):null;
console.log(JSON.stringify({mode:'READ-ONLY local files; exported source provenance/deployment time must be confirmed by user; NOT live CloudBase verification',reference,exported,matched,files},null,2));
if(exported&&!matched)process.exitCode=1;
