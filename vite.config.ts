import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),{
    name:'jiashitong-versioned-shell',apply:'build',
    async writeBundle(options,bundle){
      const dir=resolve(options.dir??'dist'),template=await readFile('public/sw.js','utf8'),html=await readFile(resolve(dir,'index.html'),'utf8');
      const assets=Object.keys(bundle).filter(name=>/^assets\/[^/]+\.(js|css|woff2?)$/.test(name)).sort();
      const version=createHash('sha256').update(template+html+assets.join('\n')).digest('hex').slice(0,16);
      const files=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png',...assets.map(name=>'./'+name)];
      const worker=template.replace(/const CACHE = '[^']+';/,`const CACHE = 'jiashitong-pwa-shell-3.2.1-${version}';`).replace(/const SHELL = \[[^;]+\];/,`const SHELL = ${JSON.stringify(files)};`);
      await writeFile(resolve(dir,'sw.js'),worker);
    },
  }],
})
