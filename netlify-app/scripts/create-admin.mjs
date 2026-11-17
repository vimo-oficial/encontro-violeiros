import { passwordHash } from '../server/auth.mjs';
import { randomBytes } from 'node:crypto';
import readline from 'node:readline';
const username=String(process.argv[2]||'').trim().toLowerCase();
if(!/^[a-z0-9._-]{3,60}$/.test(username))throw Error('Use: npm run admin:create -- nome.usuario (3 a 60 letras, números, ponto, hífen ou sublinhado).');
if(!process.stdin.isTTY)throw Error('Execute em um terminal interativo. A senha não deve ser passada por argumento.');
process.stdout.write('Senha (mínimo 6 caracteres; entrada oculta): ');
readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
let password='';
process.stdin.on('keypress',(str,key)=>{
  if(key.name==='c' && key.ctrl)process.exit(1);
  if(key.name==='return'){
    process.stdin.setRawMode(false);process.stdin.pause();
    if(password.length<6||password.length>128)throw Error('A senha deve ter entre 6 e 128 caracteres.');
    console.log('\nDefina estas variáveis privadas na Netlify (não salve no repositório):');
    console.log('ADMIN_USERS_JSON='+JSON.stringify([{username,passwordHash:passwordHash(password)}]));
    console.log('SESSION_SECRET='+randomBytes(48).toString('base64url'));
    return;
  }
  if(key.name==='backspace'){password=password.slice(0,-1);return;}
  if(str&&!key.ctrl&&!key.meta)password+=str;
});
