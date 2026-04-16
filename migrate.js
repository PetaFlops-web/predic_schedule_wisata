import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigration() {
    try {
        console.log('Membaca file db/schema.sql...');
        const schemaPath = path.join(__dirname, 'db', 'schema.sql');
        const schemaQuery = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Menjalankan skrip SQL...');
        await pool.query(schemaQuery);
        
        console.log('✅ Migrasi berhasil dibuat/diperbarui!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Gagal menjalankan migrasi:', error.message);
        process.exit(1);
    }
}

runMigration();
