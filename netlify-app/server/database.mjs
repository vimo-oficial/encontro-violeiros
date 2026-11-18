import { createClient } from '@libsql/client/http';let database;
export function setDatabaseForTests(value) { database = value; }
export async function client() {
  if (!database) {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Configure o banco de dados.');
    
    database = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN, intMode: 'number' });
  }
  return database;
}
class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql, args); }
  async first() { return (await (await client()).execute(this)).rows[0] ?? null; }
  async all() { return { results: (await (await client()).execute(this)).rows }; }
  async run() { return (await client()).execute(this); }
}
export const databaseAdapter = {
  prepare: sql => new Statement(sql),
  batch: async statements => (await client()).batch(statements.map(({sql,args})=>({sql,args})), 'write')
};
