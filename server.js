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
    
    const members = membersResult.rows;
    const transactions = transactionsResult.rows;
    const activities = activitiesResult.rows;
    
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
      activities
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

// Fallback: Redirect all other routes to index.html for SPA router support
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Local Start Server Listener
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(` SITernak PostgreSQL Database Local Server running successfully!`);
    console.log(` - Port: ${PORT}`);
    console.log(`================================================================`);
  });
}

// Export for Vercel Serverless wrapper compilation
module.exports = app;
