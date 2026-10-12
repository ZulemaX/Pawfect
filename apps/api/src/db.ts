import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquante. Copie .env.example vers .env à la racine.');
export const pool = new pg.Pool({ connectionString: url, max: 10 });
