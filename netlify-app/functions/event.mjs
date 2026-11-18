import { GET } from '../generated/event-api.mjs';
import { activeSession } from '../server/auth.mjs';
export default async (request,context) => {
  const action=new URL(request.url).pathname.split('/').pop();
  const isPublic=(action==='confirmed' && request.method==='GET') || (['registrations','lookup'].includes(action) && request.method==='POST');
  if(!isPublic && !await activeSession(request)) return Response.json({error:'Entre para continuar.'},{status:401,headers:{'Cache-Control':'no-store'}});
  // The trusted platform context is the sole source of the visitor IP.
  const headers = new Headers(request.headers);
  headers.set('cf-connecting-ip',context.ip||'unknown');
  return GET(new Request(request,{headers}));
};
export const config = {path:'/api/event/:action'};
