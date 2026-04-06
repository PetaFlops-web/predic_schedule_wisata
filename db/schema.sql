CREATE TABLE IF NOT EXISTS itineraries (
    id SERIAL PRIMARY KEY,
    destinasi VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL,
    durasi INT NOT NULL,
    pax INT NOT NULL,
    budget INT NOT NULL,
    preferensi VARCHAR(100) NOT NULL,
    itinerary_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
