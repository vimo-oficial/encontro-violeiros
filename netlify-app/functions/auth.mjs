import { authentication } from '../server/auth.mjs';
export default authentication;
export const config = {path:['/api/auth/login','/api/auth/logout','/api/auth/register','/api/auth/me','/api/auth/organizers']};
