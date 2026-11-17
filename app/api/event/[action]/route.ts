import { env } from 'cloudflare:workers';
import { adminStatus } from '../../../../lib/auth';
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
const db=()=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;};
const clean=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max?v.trim():null;
function authorize(request:Request){const status=adminStatus(request);if(status!==200)throw new HttpError(status,status===401?'Entre com a conta da organização.':'Acesso restrito à organização.');}
async function rateLimit(request:Request,action:string,max:number){
  const ip=request.headers.get('cf-connecting-ip')||'local';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
  const key=action+':'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const now=Date.now();
  const row=await db().prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at < ? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at < ? THEN ? ELSE expires_at END RETURNING count').bind(key,now+600000,now,now,now+600000).first<{count:number}>();
  if(row && row.count>max)throw new HttpError(429,'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
}
async function readBody(request:Request){
  if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Formato inválido.');
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)throw new HttpError(403,'Origem não autorizada.');
  const text=await request.text();if(text.length>20000)throw new HttpError(413,'Dados muito extensos.');
  try{return JSON.parse(text);}catch{throw new HttpError(400,'Dados inválidos.');}
}
async function handle(request:Request){
  const action=new URL(request.url).pathname.split('/').pop();
  if(action==='raffle'){
    authorize(request);
    if(request.method==='GET'){
      const {results}=await db().prepare('SELECT * FROM raffle_draws ORDER BY created_at DESC,id DESC').all();
      const settings=await db().prepare('SELECT no_repeat FROM raffle_settings WHERE id=1').first();
      return json({history:results,no_repeat:settings?!!settings.no_repeat:true});
    }
    const body=await readBody(request);
    if(request.method==='PATCH'){
      if(typeof body.no_repeat!=='boolean')throw new HttpError(400,'Opção inválida.');
      await db().prepare('INSERT INTO raffle_settings (id,no_repeat) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET no_repeat=excluded.no_repeat').bind(body.no_repeat?1:0).run();
      return json({ok:true});
    }
    if(request.method==='POST'){
      const id=clean(body.request_id,36,36);
      if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw new HttpError(400,'Sorteio inválido.');
      await db().prepare("INSERT OR IGNORE INTO raffle_draws (id,participant_id,full_name,city,state,participant_number,created_at) SELECT ?,p.id,p.full_name,p.city,p.state,t.number,? FROM participants p JOIN registrations r ON r.id=p.registration_id JOIN tickets t ON t.participant_id=p.id WHERE r.status='confirmed' AND p.checked_in_at IS NOT NULL AND (COALESCE((SELECT no_repeat FROM raffle_settings WHERE id=1),1)=0 OR NOT EXISTS(SELECT 1 FROM raffle_draws d WHERE d.participant_id=p.id)) AND NOT EXISTS(SELECT 1 FROM raffle_draws WHERE id=?) ORDER BY random() LIMIT 1").bind(id,new Date().toISOString(),id).run();
      const winner=await db().prepare('SELECT * FROM raffle_draws WHERE id=?').bind(id).first();
      if(!winner)throw new HttpError(409,'Não há participantes presentes elegíveis para este sorteio.');
      return json(winner);
    }
    throw new HttpError(405,'Método não permitido.');
  }
  if(request.method==='GET'&&action==='confirmed'){
    const {results}=await db().prepare("SELECT p.full_name,p.city,p.state,p.is_violeiro FROM participants p JOIN registrations r ON r.id=p.registration_id WHERE r.status='confirmed' ORDER BY p.full_name COLLATE NOCASE").all();return json(results);
  }
  if(request.method==='GET'&&action==='attendance'){
    authorize(request);
    const {results}=await db().prepare("SELECT p.id,p.full_name,p.city,p.state,p.checked_in_at,t.number AS participant_number,r.protocol FROM participants p JOIN registrations r ON r.id=p.registration_id LEFT JOIN tickets t ON t.participant_id=p.id WHERE r.status='confirmed'").all();
    results.sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'pt-BR',{sensitivity:'base'})||String(a.id).localeCompare(String(b.id)));
    return json(results);
  }
  if(request.method==='GET'&&action==='registrations'){
    authorize(request);
    const {results:regs}=await db().prepare('SELECT * FROM registrations ORDER BY created_at DESC').all();
    const {results:people}=await db().prepare('SELECT p.*,t.number AS participant_number FROM participants p LEFT JOIN tickets t ON t.participant_id=p.id ORDER BY p.sort_order').all();
    return json(regs.map(r=>({...r,participants:people.filter(p=>p.registration_id===r.id)})));
  }
  if(request.method==='PATCH'||request.method==='DELETE')authorize(request);
  const body=await readBody(request);
  if(request.method==='POST'&&action==='lookup'){
    await rateLimit(request,'lookup',50);
    const protocol=clean(body.protocol,10,50)?.toUpperCase();const phone=String(body.phone||'').replace(/\D/g,'');
    if(!protocol||!/^[0-9]{10,11}$/.test(phone))throw new HttpError(400,'Informe o protocolo e o WhatsApp com DDD.');
    const result=await db().prepare('SELECT protocol,status,total_participants,total_amount FROM registrations WHERE protocol=? AND contact_whatsapp=?').bind(protocol,phone).first();
    if(!result)throw new HttpError(404,'Inscrição não encontrada. Confira o protocolo e o WhatsApp do responsável.');return json(result);
  }
  if(request.method==='PATCH'&&action==='attendance'){
    const id=clean(body.id,36,36);
    if(!id||typeof body.present!=='boolean')throw new HttpError(400,'Participante ou presença inválidos.');
    const result=await db().prepare("UPDATE participants SET checked_in_at=CASE WHEN ?=1 THEN COALESCE(checked_in_at,?) ELSE NULL END WHERE id=? AND registration_id IN (SELECT id FROM registrations WHERE status='confirmed') RETURNING id,checked_in_at").bind(body.present?1:0,new Date().toISOString(),id).first();
    if(!result)throw new HttpError(409,'Participante não está confirmado. Atualize a lista.');
    return json(result);
  }
  if(action!=='registrations')throw new HttpError(404,'Não encontrado.');
  if(request.method==='POST'){
    await rateLimit(request,'registration',30);
    const name=clean(body.contact_name,3,120);const phone=String(body.contact_whatsapp||'').replace(/\D/g,'');
    const requestId=clean(body.request_id,36,36);
    if(!name||!/^[0-9]{10,11}$/.test(phone)||!requestId||!/^[a-f0-9-]{36}$/i.test(requestId)||body.consent!==true||!Array.isArray(body.participants)||body.participants.length<1||body.participants.length>20)throw new HttpError(400,'Confira os dados do responsável, participantes e autorização.');
    const people=body.participants.map((p:Record<string,unknown>)=>{
      const full_name=clean(p.full_name,3,120),city=clean(p.city,2,80),state=clean(p.state,2,2);
      if(!full_name||!city||!state||!states.has(state)||typeof p.is_violeiro!=='boolean')throw new HttpError(400,'Confira nome, cidade e estado de todos os participantes.');
      return {full_name,city,state,is_violeiro:p.is_violeiro?1:0};
    });
    if(people[0].full_name!==name)throw new HttpError(400,'O responsável deve ser o primeiro participante.');
    const prior=await db().prepare('SELECT id,protocol,total_participants,total_amount FROM registrations WHERE request_id=?').bind(requestId).first();if(prior)return json(prior);
    const id=crypto.randomUUID();const protocol='EV27-'+crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase();
    const total=people.length*50;
    const inserts=[db().prepare('INSERT INTO registrations (id,request_id,protocol,contact_name,contact_whatsapp,status,total_participants,total_amount,consent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,requestId,protocol,name,phone,'pending',people.length,total,1,new Date().toISOString()),...people.map((p:any,i:number)=>db().prepare('INSERT INTO participants (id,registration_id,full_name,city,state,is_violeiro,sort_order) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,p.full_name,p.city,p.state,p.is_violeiro,i))];
    try{await db().batch(inserts);}catch(error){const existing=await db().prepare('SELECT id,protocol,total_participants,total_amount FROM registrations WHERE request_id=?').bind(requestId).first();if(existing)return json(existing);throw error;}
    return json({id,protocol,total_participants:people.length,total_amount:total},201);
  }
  const id=clean(body.id,36,36);if(!id)throw new HttpError(400,'Inscrição inválida.');
  const reg=await db().prepare('SELECT id FROM registrations WHERE id=?').bind(id).first();if(!reg)throw new HttpError(404,'Inscrição não encontrada.');
  if(request.method==='PATCH'){
    if(!['pending','confirmed','cancelled'].includes(body.status))throw new HttpError(400,'Status inválido.');
    const statements=[db().prepare('UPDATE registrations SET status=? WHERE id=?').bind(body.status,id)];
    if(body.status!=='confirmed')statements.push(db().prepare('UPDATE participants SET checked_in_at=NULL WHERE registration_id=?').bind(id));
    if(body.status==='confirmed')statements.push(db().prepare('INSERT OR IGNORE INTO tickets (participant_id) SELECT id FROM participants WHERE registration_id=? ORDER BY sort_order').bind(id));
    await db().batch(statements);return json({ok:true});
  }
  if(request.method==='DELETE'){
    await db().batch([db().prepare('DELETE FROM tickets WHERE participant_id IN (SELECT id FROM participants WHERE registration_id=?)').bind(id),db().prepare('DELETE FROM participants WHERE registration_id=?').bind(id),db().prepare('DELETE FROM registrations WHERE id=?').bind(id)]);return json({ok:true});
  }
  throw new HttpError(405,'Método não permitido.');
}
async function endpoint(request:Request){try{return await handle(request);}catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Event API failure',error instanceof Error?error.message:'unknown');return json({error:'Não foi possível concluir agora. Tente novamente.'},500);}}
export const GET=endpoint;export const POST=endpoint;export const PATCH=endpoint;export const DELETE=endpoint;
