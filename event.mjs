import { GET } from '../generated/event-api.mjs';
export default async (request,context) => {
  // The trusted platform context is the sole source of the visitor IP.
  const headers = new Headers(request.headers);
  headers.set('cf-connecting-ip',context.ip||'unknown');
  return GET(new Request(request,{headers}));
};
export const config = {path:'/api/event/:action'};
