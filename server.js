import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { HfInference } from '@huggingface/inference';

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

// Tambahkan baris ini untuk testing
console.log("Cek isi token:", process.env.HuggingFace ? process.env.HuggingFace.substring(0, 5) + "..." : "KOSONG/UNDEFINED");

// Hugging Face API Configuration
const hf = new HfInference(process.env.HuggingFace);

app.post('/api/generate-schedule', async (req, res) => {
    try {
        const { destinasi, tanggal, durasi, pax, budget, preferensi } = req.body;
        
        console.log('📥 Request diterima:', { destinasi, tanggal, durasi, pax, budget, preferensi });

        // 1. Prompt Hugging Face API
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
Pastikan data dapat langsung diparse oleh JSON.parse(). Jangan tambahkan teks apapun selain JSON.
        `;

        console.log('🤖 Mengirim prompt ke Hugging Face API...');

        let responseText = '';
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const apiResponse = await hf.chatCompletion({
                    model: "Qwen/Qwen2.5-72B-Instruct",
                    messages: [
                        { role: "system", content: "Kamu adalah asisten ahli pariwisata Indonesia. Selalu balas dalam format JSON murni tanpa markdown." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 4096,
                    temperature: 0.7
                });

                responseText = apiResponse.choices[0].message.content.trim();
                console.log(`✅ Hugging Face response diterima (attempt ${attempt})`);
                break;
            } catch (apiError) {
                const status = apiError.statusCode || apiError.status;
                if ((status === 429 || status === 503) && attempt < maxRetries) {
                    const waitTime = status === 503 ? 20 : attempt * 10;
                    console.warn(`⏳ API Error (${status}). Retry ${attempt}/${maxRetries} dalam ${waitTime}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                } else {
                    throw apiError;
                }
            }
        }
        
        console.log('📝 Raw response:', responseText.substring(0, 200) + '...');

        responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        console.log('🔍 Cleaned response:', responseText.substring(0, 200) + '...');

        const itineraryData = JSON.parse(responseText);
        console.log('✅ JSON berhasil diparse! Title:', itineraryData.title);

        let savedId = null;
        try {
            const query = `
                INSERT INTO itineraries (destinasi, tanggal, durasi, pax, budget, preferensi, itinerary_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;
            const values = [destinasi, tanggal, durasi, pax, budget, preferensi, JSON.stringify(itineraryData)];
            const dbResult = await pool.query(query, values);
            savedId = dbResult.rows[0].id;
            console.log('💾 Tersimpan ke database dengan ID:', savedId);
        } catch (dbError) {
            console.warn('⚠️ Gagal simpan ke database (itinerary tetap ditampilkan):', dbError.message);
        }
        
        res.json({
            success: true,
            id: savedId,
            itinerary: itineraryData
        });
    } catch (error) {
        console.error('❌ Error di /api/generate-schedule:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const query = 'SELECT id, destinasi, tanggal, durasi, pax, budget, preferensi, created_at FROM itineraries ORDER BY created_at DESC LIMIT 10';
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching history:', error);
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
