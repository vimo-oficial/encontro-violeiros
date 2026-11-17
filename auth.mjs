import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { databaseAdapter as db } from './database.mjs';
const cookieName = '__Host-violeiros';
const lifetime = 8 * 60 * 60;
const normalize = value => String(value || '').trim().toLowerCase();
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
    const user=users().find(u=>normalize(u.username)===data.username);
    if(!user || !Number.isFinite(data.exp) || data.exp<=Date.now()/1000 || data.version!==createHash('sha256').update(user.passwordHash).digest('hex')) return null;
    return {username:user.username};
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
  if(request.method!=='POST') return json({error:'Método não permitido.'},405);
  if(!sameOrigin(request)) return json({error:'Origem não autorizada.'},403);
  if(new URL(request.url).pathname==='/api/auth/logout') return json({ok:true},200,{'Set-Cookie':expiredCookie});
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
    const user=users().find(u=>normalize(u.username)===username);
    const valid=verify(password,user?.passwordHash||passwordHash('invalid-password','fixed-dummy-salt'));
    if(!user || !valid) return json({error:'Usuário ou senha inválidos.'},401);
    const payload=Buffer.from(JSON.stringify({username,exp:Math.floor(Date.now()/1000)+lifetime,nonce:randomBytes(16).toString('hex'),version:createHash('sha256').update(user.passwordHash).digest('hex')})).toString('base64url');
    return json({ok:true},200,{'Set-Cookie':`${cookieName}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`});
  } catch { return json({error:'Não foi possível entrar. Verifique a configuração do acesso.'},503); }
}
