import { eventDocument } from '../generated/document.mjs';
import { activeSession } from '../server/auth.mjs';
export default async request => {
  if(!await activeSession(request)) return new Response(null,{status:302,headers:{Location:'/acesso','Cache-Control':'no-store'}});
  return new Response(eventDocument,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
};
export const config = {path:['/organizacao','/organizacao/']};
