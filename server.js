import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/generate-schedule', async (req, res) => {
    try {
        const { destinasi, tanggal, durasi, pax, budget, preferensi } = req.body;
        
        // 1. Prompt Gemini API
        const prompt = `
Anda adalah seorang ahli pariwisata. Buatkan itinerary desa wisata untuk ${destinasi} selama ${durasi} hari.
Jumlah orang: ${pax} pax.
Budget maksimal per orang: Rp ${budget}.
Fokus aktivitas: ${preferensi}.

Format balasan HARUS JSON murni tanpa markdown/backticks, dengan struktur berikut:
{
    "title": "Judul Itinerary",
    "days": [
        {
            "dayId": 1,
            "title": "Judul Hari",
            "desc": "Deskripsi singkat hari ini",
            "items": [
                {
                    "time": "09:00",
                    "name": "Nama Aktivitas",
                    "cost": 50000,
                    "icon": "fa-solid fa-person-hiking",
                    "color": "text-green-600",
                    "bg": "bg-green-50"
                }
            ]
        }
    ]
}
Pastikan data dapat langsung diparse oleh JSON.parse().
        `;

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();
        
        // Bersihkan jika ada markdown JSON output dari gemini
        if (responseText.startsWith('\`\`\`json')) {
            responseText = responseText.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim();
        } else if (responseText.startsWith('\`\`\`')) {
            responseText = responseText.replace(/^\`\`\`/m, '').replace(/\`\`\`$/m, '').trim();
        }

        const itineraryData = JSON.parse(responseText);

        // 2. Simpan ke database
        const query = `
            INSERT INTO itineraries (destinasi, tanggal, durasi, pax, budget, preferensi, itinerary_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;
        const values = [destinasi, tanggal, durasi, pax, budget, preferensi, JSON.stringify(itineraryData)];
        const dbResult = await pool.query(query, values);
        
        res.json({
            success: true,
            id: dbResult.rows[0].id,
            itinerary: itineraryData
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/schedule/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM itineraries WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Itinerary not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
