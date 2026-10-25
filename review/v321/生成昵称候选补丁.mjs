// 只生成本地候选；拒绝覆盖目标。不会部署、访问数据库或带出node_modules。
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('用法: node 生成昵称候选补丁.mjs 只读源目录 新候选目录');
const baseline=await readFile(join(source,'family_v32.js'),'utf8'),helper=await readFile(new URL('./成员昵称兼容修复.cjs',import.meta.url),'utf8');
const line=baseline.split(/\r?\n/).find(l=>l.includes('if(r.boundAuthUid&&r.boundAuthUid!==r.uid){row.accountNickname=null;'));
if(!line||!line.includes('profile.nickName'))throw Error('基线不匹配：请对当前线上导出重新审查，禁止覆盖未知版本。');
if(!baseline.includes('await member(family,uid);'))throw Error('缺少返回前权限复核，不生成候选。');
const index=await readFile(join(source,'index.js'),'utf8');if(!index.includes('enrichFamilyMembers(rows, family.ownerUid, auth, publicMember)'))throw Error('资料补充层调用不匹配');
const patched=baseline.replace(line,'    // V3.2.1: 昵称补充层直接按 boundAuthUid 查询，不再用旧字段逻辑覆盖其结果。');
await mkdir(resolve(out));await writeFile(join(out,'family_v32.js'),patched);await writeFile(join(out,'family_member_profiles.js'),helper);
await writeFile(join(out,'基线校验.json'),JSON.stringify({sourceHash:createHash('sha256').update(baseline).digest('hex'),candidateHash:createHash('sha256').update(patched).digest('hex'),status:'仅候选，未部署；两文件覆盖层不是完整部署包'},null,2));
console.log('已生成两文件本地候选，未部署。');
