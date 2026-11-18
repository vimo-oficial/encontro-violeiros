import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { databaseAdapter as db } from './database.mjs';
const cookieName = '__Host-violeiros';
const lifetime = 8 * 60 * 60;
const normalize = value => String(value || '').trim().toLowerCase();
const ownerUsername = 'juliocnovais';
let accountsReady;
function accounts() {
  if (!accountsReady) accountsReady = db.prepare("CREATE TABLE IF NOT EXISTS organizer_accounts (username TEXT PRIMARY KEY NOT NULL, password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by TEXT)").run().catch(error => { accountsReady = undefined; throw error; });
  return accountsReady;
}
const version = hash => createHash('sha256').update(hash).digest('hex');
function users() {
  const list = JSON.parse(process.env.ADMIN_USERS_JSON || '[]');
  if (!Array.isArray(list)) throw new Error('Configuração de organizadores inválida.');
  return list;
}
function secret() {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) throw new Error('Configure SESSION_SECRET com pelo menos 32 caracteres.');
  return key;
}
function sign(payload) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
function equal(a,b) { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export function passwordHash(password, salt=randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${scryptSync(password,salt,32).toString('hex')}`;
}
function verify(password, hash) {
  const [kind,salt,digest] = String(hash).split('$');
  return kind==='scrypt' && !!salt && !!digest && equal(passwordHash(password,salt).split('$')[2],digest);
}
export function sameOrigin(request) { return request.headers.get('origin') === new URL(request.url).origin; }
export function session(request) {
  const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!value || value.length>2048) return null;
  try {
    const [payload,signature,...extra]=value.split('.');
    if(extra.length || !equal(sign(payload),signature||'')) return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(!Number.isFinite(data.exp) || data.exp<=Date.now()/1000 || !/^[a-z0-9._-]{3,60}$/.test(data.username)) return null;
    if(data.source==='database') return {username:data.username,owner:false,source:'database',version:data.version};
    const user=users().find(u=>normalize(u.username)===data.username);
    if(!user || data.version!==version(user.passwordHash)) return null;
    return {username:normalize(user.username),owner:normalize(user.username)===ownerUsername,source:'environment'};
  } catch { return null; }
}
export async function activeSession(request) {
  const current=session(request);
  if(!current || current.source!=='database') return current;
  try {
    await accounts();
    const user=await db.prepare('SELECT password_hash,status FROM organizer_accounts WHERE username=?').bind(current.username).first();
    return user?.status==='approved' && version(user.password_hash)===current.version ? current : null;
  } catch { return null; }
}
export function adminStatus(request) { return session(request)?200:401; }
export const expiredCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
async function limit(key,max) {
  const now=Date.now(),digest=createHash('sha256').update(key).digest('hex');
  const result=await db.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at < ? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at < ? THEN ? ELSE expires_at END RETURNING count').bind('login:'+digest,now+900000,now,now,now+900000).first();
  return result.count<=max;
}
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function authentication(request,context={}) {
  const action=new URL(request.url).pathname.split('/').pop();
  if(request.method!=='GET' && !sameOrigin(request)) return json({error:'Origem não autorizada.'},403);
  if(action==='me' && request.method==='GET') {
    const current=await activeSession(request);
    return current ? json({username:current.username,owner:current.owner}) : json({error:'Entre para continuar.'},401);
  }
  if(action==='organizers') {
    const current=await activeSession(request);
    if(!current) return json({error:'Entre para continuar.'},401);
    if(!current.owner) return json({error:'Somente Júlio pode analisar os cadastros.'},403);
    try {
      await accounts();
      if(request.method==='GET') {
        const {results}=await db.prepare('SELECT username,status,created_at,reviewed_at,reviewed_by FROM organizer_accounts ORDER BY created_at DESC,username').all();
        return json(results);
      }
      if(request.method!=='PATCH') return json({error:'Método não permitido.'},405);
      if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'Formato inválido.'},415);
      const text=await request.text();if(text.length>2048)return json({error:'Dados muito extensos.'},413);
      let body;try{body=JSON.parse(text);}catch{return json({error:'Dados inválidos.'},400);}
      if(!['approved','rejected'].includes(body.status) || !/^[a-z0-9._-]{3,60}$/.test(body.username)) return json({error:'Solicitação inválida.'},400);
      const result=await db.prepare("UPDATE organizer_accounts SET status=?,reviewed_at=?,reviewed_by=? WHERE username=? AND status='pending' RETURNING username,status").bind(body.status,new Date().toISOString(),current.username,body.username).first();
      return result ? json(result) : json({error:'Esse pedido já foi analisado. Atualize a lista.'},409);
    } catch {return json({error:'Não foi possível analisar os cadastros. Tente novamente.'},503);}
  }
  if(request.method!=='POST' || !['login','logout','register'].includes(action)) return json({error:'Método não permitido.'},405);
  if(action==='logout') return json({ok:true},200,{'Set-Cookie':expiredCookie});
  try {
    if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'Formato inválido.'},415);
    const text=await request.text(); if(text.length>2048) return json({error:'Dados muito extensos.'},413);
    let body;try{body=JSON.parse(text);}catch{return json({error:'Dados inválidos.'},400);}
    const username=normalize(body.username),password=body.password;
    if(!/^[a-z0-9._-]{3,60}$/.test(username) || typeof password!=='string' || password.length>128) return json({error:'Usuário ou senha inválidos.'},401);
    // Netlify supplies context.ip; never trust caller-controlled forwarding headers.
    const ipAllowed=await limit('ip:'+(context.ip||'unknown'),40);
    const userAllowed=await limit('user:'+username,10);
    if(!ipAllowed || !userAllowed) return json({error:'Muitas tentativas. Tente novamente em 15 minutos.'},429);
    await accounts();
    const configured=users().find(u=>normalize(u.username)===username);
    if(action==='register') {
      if(!/^\d{6}$/.test(password)) return json({error:'A senha precisa ter exatamente 6 dígitos numéricos.'},400);
      if(!await limit('register-ip:'+(context.ip||'unknown'),10)) return json({error:'Muitas solicitações. Tente novamente em 15 minutos.'},429);
      if(configured) return json({error:'Esse nome de usuário já está em uso.'},409);
      const result=await db.prepare("INSERT INTO organizer_accounts (username,password_hash,status,created_at) VALUES (?,?,'pending',?) ON CONFLICT(username) DO NOTHING RETURNING username").bind(username,passwordHash(password),new Date().toISOString()).first();
      return result ? json({ok:true,status:'pending',message:'Cadastro enviado. Aguarde a aprovação de Júlio para entrar.'},201) : json({error:'Esse nome de usuário já possui um cadastro.'},409);
    }
    const stored=configured ? null : await db.prepare('SELECT username,password_hash,status FROM organizer_accounts WHERE username=?').bind(username).first();
    const user=configured || (stored && {username:stored.username,passwordHash:stored.password_hash});
    const valid=verify(password,user?.passwordHash||passwordHash('invalid-password','fixed-dummy-salt'));
    if(!user || !valid) return json({error:'Usuário ou senha inválidos.'},401);
    if(stored && stored.status!=='approved') return json({error:stored.status==='pending'?'Seu cadastro aguarda a aprovação de Júlio.':'Seu pedido de acesso não foi aprovado.'},403);
    const payload=Buffer.from(JSON.stringify({username,source:configured?'environment':'database',exp:Math.floor(Date.now()/1000)+lifetime,nonce:randomBytes(16).toString('hex'),version:version(user.passwordHash)})).toString('base64url');
    return json({ok:true},200,{'Set-Cookie':`${cookieName}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`});
  } catch { return json({error:'Não foi possível entrar. Verifique a configuração do acesso.'},503); }
}
