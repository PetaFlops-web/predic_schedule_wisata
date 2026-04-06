require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
