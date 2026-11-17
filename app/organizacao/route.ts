import { eventDocument } from '../../lib/event-document';
import { adminStatus } from '../../lib/auth';
export function GET(request: Request) {
  const status=adminStatus(request);
  if(status===401) return Response.redirect(new URL('/signin-with-chatgpt?return_to=%2Forganizacao',request.url),302);
  if(status!==200) return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Acesso restrito</title><body style="font:16px Arial;max-width:600px;margin:80px auto;padding:24px"><h1>Acesso restrito à organização</h1><p>Entre com a conta do ChatGPT responsável por este site.</p><a href="/signout-with-chatgpt?return_to=%2Forganizacao" target="_top">Trocar de conta</a> · <a href="/">Voltar ao evento</a></body></html>',{status:403,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  return new Response(eventDocument,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
