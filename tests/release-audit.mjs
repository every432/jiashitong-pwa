// 只读发布内容审查；不输出命中值，不连接云，不部署。
import {execFileSync} from 'node:child_process';import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
const root=resolve('docs/phase-e-2026-10-24/checkpoint'),tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),findings=[],checked=[];
const secretPatterns=[/AKID[A-Za-z0-9]{16,}/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{40,}/g,/(?:secretId|secretKey|secret_id|secret_key|adminToken)\s*['"]?\s*[:=]\s*['"][A-Za-z0-9+/=_-]{20,}['"]/gi];
for(const file of tracked){
 if(/(^|\/)(node_modules|dist|test-results|playwright-report)\/|(^|\/)\.env(?:$|\.(?!example$))|\.(zip|bundle)$|^docs\/.*\/checkpoint\//i.test(file))findings.push({file,type:'NON_RELEASE_ARTIFACT'});
 if(!/\.(tsx?|m?js|cjs|json|html|css|md|ya?ml|example)$/.test(file))continue;
 const value=await readFile(file,'utf8');for(const pattern of secretPatterns){pattern.lastIndex=0;if(pattern.test(value))findings.push({file,type:'POSSIBLE_PRIVATE_CREDENTIAL'});}
 if(file.startsWith('src/')&&/(?<!\d)1[3-9]\d{9}(?!\d)/.test(value))findings.push({file,type:'MOBILE_NUMBER_NEEDS_REVIEW'});
 if(file.endsWith('.json')){try{const parsed=JSON.parse(value);if(parsed?.format==='jiashitong-pwa')findings.push({file,type:'PERSONAL_BACKUP_NOT_SOURCE'});}catch{/* 非JSON源码不在此分支。 */}}
 checked.push(file);
}
const pkg=JSON.parse(await readFile('package.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));if(pkg.dependencies['@cloudbase/js-sdk']!=='3.10.3'||lock.packages['node_modules/@cloudbase/js-sdk']?.version!=='3.10.3')findings.push({file:'package-lock.json',type:'SDK_VERSION_NOT_LOCKED'});
const html=await readFile('dist/index.html','utf8'),worker=await readFile('dist/sw.js','utf8'),manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8')),match=worker.match(/const SHELL = (\[[^;]+\]);/);const shell=match?JSON.parse(match[1]):[];
if(!html.includes('/jiashitong-pwa/assets/')||manifest.start_url!=='./'||manifest.scope!=='./'||shell.length<8||worker.includes('e-dev'))findings.push({file:'dist',type:'BASE_OR_PRECACHE_INVALID'});
for(const file of shell){if(!file.startsWith('./')||file.includes('..')||file.includes('?'))findings.push({file:'dist/sw.js',type:'INVALID_PRECACHE_URL'});else if(file!=='./')await readFile(resolve('dist',file));}
const assets=await readdir('dist/assets');for(const file of assets){if(!file.endsWith('.js'))continue;const value=await readFile(join('dist/assets',file),'utf8');for(const pattern of secretPatterns.slice(0,2)){pattern.lastIndex=0;if(pattern.test(value))findings.push({file:'dist/assets/'+file,type:'BUNDLE_PRIVATE_CREDENTIAL'});}}
await mkdir(root,{recursive:true});const report={mode:'Local tracked source + production bundle review; pattern scan and manual fixture classification, not a universal secret detector',passed:!findings.length,trackedFileCount:tracked.length,checkedTextCount:checked.length,findings,precacheFiles:shell.length,serviceWorkerSHA256:createHash('sha256').update(worker).digest('hex'),sdk:'3.10.3',base:'/jiashitong-pwa/',remarks:['Tests contain explicitly synthetic fixtures only; runtime checkpoint files removed from Git index and retained locally.','Release must use a reviewed squash commit after security gates pass to avoid uploading historical checkpoint artifacts.']};await writeFile(join(root,'release-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(findings.length)process.exitCode=1;
