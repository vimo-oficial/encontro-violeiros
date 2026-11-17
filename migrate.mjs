import { readdir,readFile } from 'node:fs/promises';
import { client } from '../server/database.mjs';
const db=await client();
await db.execute('CREATE TABLE IF NOT EXISTS netlify_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
for(const name of (await readdir(new URL('../../drizzle/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  if((await db.execute({sql:'SELECT name FROM netlify_migrations WHERE name=?',args:[name]})).rows.length)continue;
  const statements=(await readFile(new URL('../../drizzle/'+name,import.meta.url),'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
  await db.batch([...statements,{sql:'INSERT INTO netlify_migrations VALUES (?,?)',args:[name,new Date().toISOString()]}],'write');
  console.log('Migração aplicada: '+name);
}
db.close();
