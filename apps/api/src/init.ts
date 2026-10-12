import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
const sql = await readFile(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
try { await pool.query(sql); console.log('✓ Base Pawfect initialisée.'); }
finally { await pool.end(); }
