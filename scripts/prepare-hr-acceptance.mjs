// Generate only local acceptance credentials. Never print values, never overwrite an existing file.
import { randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
const values={
 ACCEPTANCE_DB_PASSWORD:randomBytes(24).toString('hex'),
 ACCEPTANCE_AUTH_SECRET:randomBytes(32).toString('hex'),
 ACCEPTANCE_DOCUMENT_KEY:randomBytes(32).toString('base64'),
 ACCEPTANCE_LOGIN_PASSWORD:randomBytes(16).toString('hex'),
};
const file=await open('.env.acceptance.local','wx',0o600);
try{await file.writeFile(Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');}finally{await file.close();}
console.log('Created .env.acceptance.local (mode 0600); values are private. Existing files are never replaced.');
