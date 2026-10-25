import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
export function releaseBlockers(value){
 const required=['SEC-01','SEC-02','SEC-03','REL-01','REL-03'];
 if(value?.schemaVersion!==1||value.environment!=='jiashitong-d4g8m8lfcdc047ffe'||!Array.isArray(value.gates))return['INVALID_RELEASE_GATE_RECORD'];
 return required.filter(id=>{const entries=value.gates.filter(g=>g.id===id);return entries.length!==1||entries[0].status!=='verified'||!Array.isArray(entries[0].evidence)||!entries[0].evidence.length||entries[0].evidence.some(ref=>typeof ref!=='string'||!ref.trim());});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const blocked=releaseBlockers(JSON.parse(readFileSync('release-gates.json','utf8')));if(blocked.length){console.error('RELEASE BLOCKED: '+blocked.join(', ')+'. Local mocks/builds do not replace deployed security or device verification.');process.exitCode=2;}else console.log('Reviewed release gate record passed.');}
