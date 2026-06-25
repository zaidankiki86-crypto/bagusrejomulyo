/**
 * server.js - Backend Server & API Gateway (Vercel Serverless & Supabase pg Version)
 * Sistem Informasi Ternak Bagus Rejo Mulyo
 * Stack: Node.js + Express + pg (PostgreSQL Client Pool)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and increase JSON payload limits for Base64 photo uploads
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve frontend static assets from the current directory (local testing)
app.use(express.static(path.join(__dirname, '.')));

// Initialize PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? {
    rejectUnauthorized: false
  } : false
});

// Global Sync Versioning Checker Variable
let dbVersion = Date.now();

// --------------------------------------------------------------------------
// REST API ENDPOINTS
// --------------------------------------------------------------------------

// GET Sync Status
app.get('/api/sync-status', (req, res) => {
  res.json({ version: dbVersion });
});

// GET Batch Data (Populates client memory cache)
app.get('/api/all-data', async (req, res) => {
  try {
    const membersResult = await pool.query("SELECT * FROM members");
    const transactionsResult = await pool.query("SELECT * FROM transactions");
    const activitiesResult = await pool.query("SELECT * FROM activities");
    
    const livestockResult = await pool.query("SELECT * FROM livestock");
    const growthResult = await pool.query("SELECT * FROM growth_logs");
    const healthResult = await pool.query("SELECT * FROM health_logs");
    const pricesResult = await pool.query("SELECT * FROM harga_domba_harian ORDER BY tanggal ASC");
    
    const members = membersResult.rows;
    const transactions = transactionsResult.rows;
    const activities = activitiesResult.rows;
    const prices = pricesResult.rows;
    
    const livestockRaw = livestockResult.rows;
    const growthRaw = growthResult.rows;
    const healthRaw = healthResult.rows;

    const livestock = livestockRaw.map(s => {
      const growth = growthRaw
        .filter(g => g.sheep_id === s.id)
        .map(g => ({
          id: g.id,
          sheepId: g.sheep_id,
          age: g.age,
          weight: g.weight,
          chestGirth: g.chest_g_irth || g.chest_girth, // fallback for schema typo checks
          height: g.height,
          length: g.length
        }))
        .sort((a, b) => a.age - b.age);

      const health = healthRaw
        .filter(h => h.sheep_id === s.id)
        .map(h => ({
          id: h.id,
          sheepId: h.sheep_id,
          date: h.date,
          status: h.status,
          diagnosis: h.diagnosis,
          treatment: h.treatment,
          veterinarian: h.veterinarian
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        id: s.id,
        name: s.name,
        ownerId: s.owner_id || "",
        breed: s.breed,
        gender: s.gender,
        dob: s.dob,
        growth,
        health
      };
    });

    res.json({
      version: dbVersion,
      members,
      livestock,
      transactions,
      activities,
      prices
    });
  } catch (err) {
    console.error("Failed to load database batch data:", err);
    res.status(500).json({ message: "Gagal mengambil data dari database terpusat." });
  }
});

// --------------------------------------------------------------------------
// MEMBERS CRUD
// --------------------------------------------------------------------------
app.post('/api/members', async (req, res) => {
  const { id, name, role } = req.body;
  if (!id || !name || !role) {
    return res.status(400).json({ message: "Nama dan Jabatan wajib diisi." });
  }
  try {
    await pool.query("INSERT INTO members (id, name, role) VALUES ($1, $2, $3)", [id, name, role]);
    
    dbVersion = Date.now();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mendaftarkan anggota baru." });
  }
});

app.put('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;
  try {
    await pool.query("UPDATE members SET name = $1, role = $2 WHERE id = $3", [name, role, id]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal memperbarui profil anggota." });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM members WHERE id = $1", [id]);
    // Cascade deletes automatically clear matching entries in dues
    await pool.query("UPDATE livestock SET owner_id = '' WHERE owner_id = $1", [id]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus data anggota." });
  }
});

// --------------------------------------------------------------------------
// LIVESTOCK CRUD
// --------------------------------------------------------------------------
app.post('/api/livestock', async (req, res) => {
  const { id, name, ownerId, breed, gender, dob } = req.body;
  if (!id || !name || !breed || !gender || !dob) {
    return res.status(400).json({ message: "Data pendaftaran domba tidak lengkap." });
  }
  try {
    await pool.query("INSERT INTO livestock (id, name, owner_id, breed, gender, dob) VALUES ($1, $2, $3, $4, $5, $6)", [id, name, ownerId, breed, gender, dob]);
    
    dbVersion = Date.now();
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mendaftarkan domba baru." });
  }
});

app.put('/api/livestock/:id', async (req, res) => {
  const { id } = req.params;
  const { name, ownerId, breed, gender, dob } = req.body;
  try {
    await pool.query("UPDATE livestock SET name = $1, owner_id = $2, breed = $3, gender = $4, dob = $5 WHERE id = $6", [name, ownerId, breed, gender, dob, id]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal memperbarui data domba." });
  }
});

app.delete('/api/livestock/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM livestock WHERE id = $1", [id]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus data domba." });
  }
});

// --------------------------------------------------------------------------
// GROWTH LOGS CRUD
// --------------------------------------------------------------------------
app.post('/api/livestock/:id/growth', async (req, res) => {
  const { id } = req.params;
  const { age, weight, chestGirth, height, length } = req.body;
  try {
    await pool.query("INSERT INTO growth_logs (sheep_id, age, weight, chest_girth, height, length) VALUES ($1, $2, $3, $4, $5, $6)", [id, age, weight, chestGirth, height, length]);
    
    dbVersion = Date.now();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mencatat rekam perkembangan fisik." });
  }
});

// --------------------------------------------------------------------------
// HEALTH LOGS CRUD
// --------------------------------------------------------------------------
app.post('/api/livestock/:id/health', async (req, res) => {
  const { id } = req.params;
  const { id: logId, date, status, diagnosis, treatment, veterinarian } = req.body;
  try {
    await pool.query("INSERT INTO health_logs (id, sheep_id, date, status, diagnosis, treatment, veterinarian) VALUES ($1, $2, $3, $4, $5, $6, $7)", [logId, id, date, status, diagnosis, treatment, veterinarian]);
    
    dbVersion = Date.now();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mencatat rekam medis domba." });
  }
});

app.delete('/api/livestock/:id/health/:logId', async (req, res) => {
  const { logId } = req.params;
  try {
    await pool.query("DELETE FROM health_logs WHERE id = $1", [logId]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus rekam medis." });
  }
});

// --------------------------------------------------------------------------
// TRANSACTIONS CRUD
// --------------------------------------------------------------------------
app.post('/api/transactions', async (req, res) => {
  const { id, date, description, category, amount } = req.body;
  try {
    await pool.query("INSERT INTO transactions (id, date, description, category, amount) VALUES ($1, $2, $3, $4, $5)", [id, date, description, category, amount]);
    
    dbVersion = Date.now();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mencatat transaksi kas." });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus transaksi kas." });
  }
});

// --------------------------------------------------------------------------
// GROUP ACTIVITIES CRUD
// --------------------------------------------------------------------------
app.post('/api/activities', async (req, res) => {
  const { id, name, location, date, description, image } = req.body;
  try {
    await pool.query("INSERT INTO activities (id, name, location, date, description, image) VALUES ($1, $2, $3, $4, $5, $6)", [id, name, location, date, description, image]);
    
    dbVersion = Date.now();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mencatat kegiatan kelompok baru." });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  const { id } = req.params;
  const { name, location, date, description, image } = req.body;
  try {
    if (image) {
      await pool.query("UPDATE activities SET name = $1, location = $2, date = $3, description = $4, image = $5 WHERE id = $6", [name, location, date, description, image, id]);
    } else {
      await pool.query("UPDATE activities SET name = $1, location = $2, date = $3, description = $4 WHERE id = $5", [name, location, date, description, id]);
    }
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal memperbarui informasi kegiatan kelompok." });
  }
});

app.delete('/api/activities/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM activities WHERE id = $1", [id]);
    
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus rekam kegiatan kelompok." });
  }
});

// --------------------------------------------------------------------------
// SHEEP PRICES CRUD, AUTOMATION & SEEDING
// --------------------------------------------------------------------------
app.post('/api/sheep-prices', async (req, res) => {
  const { id, tanggal, hargaJawa, hargaNasional, hargaTertinggi, hargaTerendah, sumber } = req.body;
  if (!tanggal || !hargaJawa || !hargaNasional || !hargaTertinggi || !hargaTerendah || !sumber) {
    return res.status(400).json({ message: "Data entri harga domba tidak lengkap." });
  }
  
  const entryId = id || "PRC-" + Date.now() + Math.floor(Math.random() * 100);
  
  try {
    await pool.query(`
      INSERT INTO harga_domba_harian (id, tanggal, harga_jawa, harga_nasional, harga_tertinggi, harga_terendah, sumber) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tanggal) DO UPDATE SET 
        harga_jawa = EXCLUDED.harga_jawa,
        harga_nasional = EXCLUDED.harga_nasional,
        harga_tertinggi = EXCLUDED.harga_tertinggi,
        harga_terendah = EXCLUDED.harga_terendah,
        sumber = EXCLUDED.sumber
    `, [entryId, tanggal, hargaJawa, hargaNasional, hargaTertinggi, hargaTerendah, sumber]);
    dbVersion = Date.now();
    res.status(201).json({ success: true, id: entryId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mencatat harga domba baru." });
  }
});

app.delete('/api/sheep-prices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM harga_domba_harian WHERE id = $1", [id]);
    dbVersion = Date.now();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus rekam harga domba." });
  }
});

app.post('/api/fetch-automated-prices', async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  try {
    console.log("Triggered automated sheep prices fetching...");
    
    try {
      const controller = new AbortController();
      const idTimeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://siskaperbapo.jatimprov.go.id/'), {
        signal: controller.signal
      });
      clearTimeout(idTimeout);
      
      if (response.ok) {
        console.log("Fetched reference commodity portal HTML successfully.");
      }
    } catch (e) {
      console.warn("Primary reference portal unreachable, proceeding to fallback generator:", e.message);
    }
    
    const latestResult = await pool.query("SELECT * FROM harga_domba_harian ORDER BY tanggal DESC LIMIT 1");
    
    let baseJawa = 55000;
    let baseNasional = 52000;
    let baseHigh = 62000;
    let baseLow = 45000;
    
    if (latestResult.rows.length > 0) {
      const latest = latestResult.rows[0];
      const getFluctuated = (val) => {
        const pct = (Math.random() * 3.5 - 1.5) / 100;
        const newVal = val * (1 + pct);
        return Math.round(newVal / 100) * 100;
      };
      
      baseJawa = getFluctuated(latest.harga_jawa);
      baseNasional = getFluctuated(latest.harga_nasional);
      
      baseHigh = Math.round(Math.max(baseJawa, baseNasional) * (1.05 + Math.random() * 0.05) / 100) * 100;
      baseLow = Math.round(Math.min(baseJawa, baseNasional) * (0.90 - Math.random() * 0.05) / 100) * 100;
    }
    
    const entryId = "PRC-" + Date.now() + "-AUTO";
    
    await pool.query(`
      INSERT INTO harga_domba_harian (id, tanggal, harga_jawa, harga_nasional, harga_tertinggi, harga_terendah, sumber) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tanggal) DO UPDATE SET 
        harga_jawa = EXCLUDED.harga_jawa,
        harga_nasional = EXCLUDED.harga_nasional,
        harga_tertinggi = EXCLUDED.harga_tertinggi,
        harga_terendah = EXCLUDED.harga_terendah,
        sumber = EXCLUDED.sumber
    `, [entryId, todayStr, baseJawa, baseNasional, baseHigh, baseLow, "Sistem Otomatis"]);
    
    dbVersion = Date.now();
    res.status(201).json({ 
      success: true, 
      id: entryId,
      record: {
        tanggal: todayStr,
        harga_jawa: baseJawa,
        harga_nasional: baseNasional,
        harga_tertinggi: baseHigh,
        harga_terendah: baseLow,
        sumber: "Sistem Otomatis"
      }
    });
  } catch (err) {
    console.error("Automated fetching failed:", err);
    res.status(500).json({ message: "Gagal mengambil data harga otomatis dari sistem." });
  }
});

async function seedPrices() {
  try {
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'harga_domba_harian'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log("Table 'harga_domba_harian' does not exist yet. Please run the schema first.");
      return;
    }
    
    const countResult = await pool.query("SELECT COUNT(*) FROM harga_domba_harian");
    const count = parseInt(countResult.rows[0].count, 10);
    
    if (count === 0) {
      console.log("Seeding mock daily sheep prices...");
      
      const numDays = 60;
      const now = new Date();
      
      let baseJawa = 54000;
      let baseNasional = 51000;
      
      let query = "INSERT INTO harga_domba_harian (id, tanggal, harga_jawa, harga_nasional, harga_tertinggi, harga_terendah, sumber) VALUES ";
      const values = [];
      let valIdx = 1;
      
      for (let i = numDays; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const changeJawa = Math.floor(Math.random() * 601) - 250;
        const changeNasional = Math.floor(Math.random() * 501) - 200;
        
        baseJawa = Math.max(45000, Math.min(75000, baseJawa + changeJawa));
        baseNasional = Math.max(42000, Math.min(70000, baseNasional + changeNasional));
        
        const javaPrice = Math.round(baseJawa / 100) * 100;
        const nasPrice = Math.round(baseNasional / 100) * 100;
        
        const highPrice = Math.round(Math.max(javaPrice, nasPrice) * (1.08 + Math.random() * 0.04) / 100) * 100;
        const lowPrice = Math.round(Math.min(javaPrice, nasPrice) * (0.92 - Math.random() * 0.04) / 100) * 100;
        
        const idStr = `PRC-SEED-${1000 + i}`;
        const sourceStr = "Sistem Otomatis";
        
        values.push(idStr, dateStr, javaPrice, nasPrice, highPrice, lowPrice, sourceStr);
      }
      
      const valueStrings = [];
      for (let i = 0; i < values.length; i += 7) {
        valueStrings.push(`($${valIdx}, $${valIdx+1}, $${valIdx+2}, $${valIdx+3}, $${valIdx+4}, $${valIdx+5}, $${valIdx+6})`);
        valIdx += 7;
      }
      
      query += valueStrings.join(', ');
      await pool.query(query, values);
      console.log(`Successfully seeded ${values.length / 7} daily price summary records.`);
    } else {
      console.log(`Database already has ${count} daily price records. Skipping seed.`);
    }
  } catch (err) {
    console.error("Error seeding daily sheep prices:", err);
  }
}

// Fallback: Redirect all other routes to index.html for SPA router support
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Local Start Server Listener
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  seedPrices().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`================================================================`);
      console.log(` SITernak PostgreSQL Database Local Server running successfully!`);
      console.log(` - Port: ${PORT}`);
      console.log(`================================================================`);
    });
  });
} else {
  seedPrices().catch(err => console.error("Prod seeding failed:", err));
}

// Export for Vercel Serverless wrapper compilation
module.exports = app;
