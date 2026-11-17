import { env } from 'cloudflare:workers';
export function adminStatus(request: Request): number {
  const id=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  if(!id || !email) return 401;
  const allowed=(env as unknown as Record<string,string>).ADMIN_EMAIL;
  return allowed && email.trim().toLowerCase()===allowed.trim().toLowerCase()?200:403;
}
