import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../organizer-requests.js',import.meta.url),'utf8');
class Element extends EventTarget {
  constructor(tag='div'){super();this.tag=tag;this.children=[];this.attrs={};this.value='pending';this.classList={add(){},contains:()=>false};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attrs[k]=v;}
  contains(el){return this===el||this.children.some(n=>n.contains?.(el));}
  focus(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
  querySelector(s){return this.parts?.[s]||null;}
  querySelectorAll(){return Object.values(this.parts||{});}
}
class CustomEvent extends Event {constructor(type,options={}){super(type);this.detail=options.detail;}}
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
async function setup(owner=true){
 const doc=new EventTarget();doc.hidden=false;doc.head=new Element();doc.body=new Element();
 const nav=new Element(),tab=new Element('button');tab.textContent='Inscrições';nav.parts={'[data-admin-view="registrations"]':tab};
 doc.querySelector=s=>s==='.attendance-tabs'?nav:null;
 let dialog;doc.createElement=tag=>{const e=new Element(tag);if(tag==='dialog'){dialog=e;e.parts=Object.fromEntries(['[role=status]','[data-accounts]','select','header button','[data-refresh]'].map(s=>[s,new Element()]));}return e;};
 const win=new EventTarget(),timers=[],calls=[];let users=[{username:'ana',status:'pending',created_at:'2026-11-19'},{username:'bia',status:'approved',created_at:'2026-11-19'}],delayed;
 const fetch=async(url,options={})=>{calls.push({url,options});if(url.endsWith('/me'))return {ok:true,json:async()=>({owner})};if(options.method==='PATCH'){const body=JSON.parse(options.body);users=users.map(u=>u.username===body.username?{...u,status:body.status}:u);return {ok:true,json:async()=>body};}const data=structuredClone(users);if(delayed)return new Promise(resolve=>{delayed.resolve=()=>resolve({ok:true,json:async()=>data});});return {ok:true,json:async()=>data};};
 let refreshes=0;doc.addEventListener('violeiros:refresh-registrations',()=>refreshes++);
 await vm.runInNewContext(source,{document:doc,window:win,location:{pathname:'/organizacao'},fetch,CustomEvent,AbortSignal,setInterval:(cb,ms)=>timers.push({cb,ms})});await flush();
 return {doc,win,nav,tab,dialog,timers,calls,get refreshes(){return refreshes;},set users(v){users=v;},delay(){delayed={};return delayed;},undelay(){delayed=undefined;}};
}
test('contadores distinguem solicitações, ocultam zero e pausam em segundo plano',async()=>{
 const h=await setup();const org=h.nav.children[0];
 assert.equal(org.children[0].textContent,'1');assert.equal(org.children[0].hidden,false);
 h.doc.dispatchEvent(new CustomEvent('violeiros:registrations-updated',{detail:[{status:'pending',total_participants:5},{status:'confirmed'},{status:'pending',total_participants:2}]}));
 assert.equal(h.tab.children[0].textContent,'2');assert.match(h.tab.attrs['aria-label'],/2 solicitações/);
 h.doc.dispatchEvent(new CustomEvent('violeiros:registrations-updated',{detail:[]}));assert.equal(h.tab.children[0].hidden,true);
 const timer=h.timers[0];assert.equal(timer.ms,15000);let count=h.refreshes;h.doc.hidden=true;timer.cb();await flush();assert.equal(h.refreshes,count);
 h.doc.hidden=false;h.users=[];h.win.dispatchEvent(new Event('focus'));await flush();assert.equal(h.refreshes,count+1);assert.equal(org.children[0].hidden,true);
});
test('aprovar reduz o selo e uma leitura anterior não desfaz a decisão',async()=>{
 const h=await setup();const org=h.nav.children[0];await org.onclick();await flush();
 const list=h.dialog.parts['[data-accounts]'];const approve=list.children[0].children[1].children[0];
 const pending=h.delay();h.timers[0].cb();await flush();
 await approve.onclick();await flush();assert.equal(org.children[0].hidden,true);
 pending.resolve();await flush();assert.equal(org.children[0].hidden,true);
});
test('outros organizadores veem inscrições, mas não consultam pedidos de acesso',async()=>{
 const h=await setup(false);assert.equal(h.nav.children.length,0);assert.equal(h.tab.children.length,1);assert.ok(h.refreshes>0);assert.equal(h.calls.filter(c=>c.url.endsWith('/organizers')).length,0);
});
