import { eventDocument } from '../generated/document.mjs';
import { session } from '../server/auth.mjs';
export default async request => {
  if(!session(request)) return new Response(null,{status:302,headers:{Location:'/acesso','Cache-Control':'no-store'}});
  return new Response(eventDocument,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
};
export const config = {path:['/organizacao','/organizacao/']};
