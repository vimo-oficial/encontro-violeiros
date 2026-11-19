import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await mkdir('generated',{recursive:true});
await cp('../public','dist',{recursive:true});
let source=await readFile('../lib/event-document.ts','utf8');
let html=JSON.parse(source.replace(/^export const eventDocument = /,'').trim().replace(/;$/,''));
html=html.replace(/<a id="adminLink"[^>]*>.*?<\/a>/,'');
html=html.replace("/signin-with-chatgpt?return_to=%2Forganizacao",'/acesso');
html=html.replace('Entre com a conta da organização.','Entre com seu usuário e senha.');
html=html.replace('async function adminLogout() { location.href=\'/\'; }',"async function adminLogout() { const response=await fetch('/api/auth/logout',{method:'POST'}); if(response.ok) location.href='/acesso'; }");
html=html.replace('>Voltar ao evento</button></div>','>Sair</button></div>');
html=html.replace('location.pathname === "/organizacao" || new URLSearchParams(location.search).get("admin") === "1"','location.pathname.replace(/\\/$/, "") === "/organizacao"');
const registrationLoader='async function loadAdminRegistrations() { adminCache = await fetchAdminRegistrations(); renderAdmin(); }';
if(!html.includes(registrationLoader))throw new Error('Ponto de atualização das inscrições não encontrado.');
html=html.replace(registrationLoader,`async function loadAdminRegistrations() { adminCache = await fetchAdminRegistrations(); renderAdmin(); document.dispatchEvent(new CustomEvent('violeiros:registrations-updated',{detail:adminCache})); }
  let refreshingPendingRegistrations=false;
  document.addEventListener('violeiros:refresh-registrations',async()=>{
    if(refreshingPendingRegistrations)return;
    refreshingPendingRegistrations=true;
    try { await loadAdminRegistrations(); }
    catch { document.dispatchEvent(new CustomEvent('violeiros:registrations-error')); }
    finally { refreshingPendingRegistrations=false; }
  });`);
html=html.replace('</body>','<script src="/organizer-requests.js" defer></script></body>');
await cp('organizer-requests.js','dist/organizer-requests.js');
await writeFile('generated/document.mjs','export const eventDocument = '+JSON.stringify(html)+';\n');
await writeFile('dist/index.html',html);
await cp('login.html','dist/acesso.html');
let api=await readFile('../app/api/event/[action]/route.ts','utf8');
api=api.replace("import { env } from 'cloudflare:workers';", "import { databaseAdapter } from '../server/database.mjs';\nimport { sameOrigin } from '../server/auth.mjs';");
api=api.replace("from '../../../../lib/auth'","from '../server/auth.mjs'");
api=api.replace("const db=()=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;};",'const db=()=>databaseAdapter;');
api=api.replace('async function handle(request:Request){',"async function handle(request:Request){\n  if(['POST','PATCH','DELETE'].includes(request.method) && !sameOrigin(request)) throw new HttpError(403,'Origem não autorizada.');");
await writeFile('generated/event-api.mjs',ts.transpileModule(api,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
console.log('Netlify: páginas, APIs e painel protegido preparados.');

