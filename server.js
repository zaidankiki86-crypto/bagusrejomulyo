/**
 * server.js - Backend Server & Centralized Database (Dependency-free Version)
 * Sistem Informasi Ternak Bagus Rejo Mulyo
 * Stack: Node.js (Built-in http, fs, and sqlite modules)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new DatabaseSync(dbPath);

// Enable SQLite Foreign Keys cascade deletes
db.exec("PRAGMA foreign_keys = ON;");

// Initialize Schema Tables
function initSchema() {
  try {
    // 1. Members
    db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL
      )
    `);

    // 2. Dues
    db.exec(`
      CREATE TABLE IF NOT EXISTS dues (
        memberId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        duesPaid INTEGER DEFAULT 0,
        debtInstallment INTEGER DEFAULT 0,
        installmentPaid INTEGER DEFAULT 1,
        FOREIGN KEY(memberId) REFERENCES members(id) ON DELETE CASCADE
      )
    `);

    // 3. Livestock
    db.exec(`
      CREATE TABLE IF NOT EXISTS livestock (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ownerId TEXT,
        breed TEXT NOT NULL,
        gender TEXT NOT NULL,
        dob TEXT NOT NULL
      )
    `);

    // 4. Growth Logs
    db.exec(`
      CREATE TABLE IF NOT EXISTS growth_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sheepId TEXT NOT NULL,
        age INTEGER NOT NULL,
        weight REAL NOT NULL,
        chestGirth INTEGER NOT NULL,
        height INTEGER NOT NULL,
        length INTEGER NOT NULL,
        FOREIGN KEY(sheepId) REFERENCES livestock(id) ON DELETE CASCADE
      )
    `);

    // 5. Health Logs
    db.exec(`
      CREATE TABLE IF NOT EXISTS health_logs (
        id TEXT PRIMARY KEY,
        sheepId TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        diagnosis TEXT NOT NULL,
        treatment TEXT NOT NULL,
        veterinarian TEXT NOT NULL,
        FOREIGN KEY(sheepId) REFERENCES livestock(id) ON DELETE CASCADE
      )
    `);

    // 6. Transactions
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL
      )
    `);

    // 7. Activities
    db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        image TEXT
      )
    `);
    
    console.log("SQLite schema tables verified and ready using node:sqlite.");
  } catch (err) {
    console.error("Schema creation failed:", err.message);
  }
}

initSchema();

// Global Sync Versioning Checker Variable
let dbVersion = Date.now();

// Helper to determine Content-Type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

// REST API Request Router
function handleApiRequest(req, res, pathname, body) {
  const method = req.method;

  const jsonResponse = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  try {
    // GET /api/sync-status
    if (method === 'GET' && pathname === '/api/sync-status') {
      return jsonResponse(200, { version: dbVersion });
    }

    // GET /api/all-data
    if (method === 'GET' && pathname === '/api/all-data') {
      const members = db.prepare("SELECT * FROM members").all();
      const duesRaw = db.prepare("SELECT * FROM dues").all();
      const transactions = db.prepare("SELECT * FROM transactions").all();
      const activities = db.prepare("SELECT * FROM activities").all();
      
      const livestockRaw = db.prepare("SELECT * FROM livestock").all();
      const growthRaw = db.prepare("SELECT * FROM growth_logs").all();
      const healthRaw = db.prepare("SELECT * FROM health_logs").all();
      
      // Map growth and health logs to their respective livestock
      const livestock = livestockRaw.map(s => {
        return {
          ...s,
          growth: growthRaw.filter(g => g.sheepId === s.id).sort((a,b) => a.age - b.age),
          health: healthRaw.filter(h => h.sheepId === s.id).sort((a,b) => new Date(b.date) - new Date(a.date))
        };
      });
      
      // Format boolean flags for dues (SQLite stores booleans as 0/1 integers)
      const dues = duesRaw.map(d => ({
        ...d,
        duesPaid: d.duesPaid === 1,
        installmentPaid: d.installmentPaid === 1
      }));
      
      return jsonResponse(200, {
        version: dbVersion,
        members,
        livestock,
        transactions,
        dues,
        activities
      });
    }

    // --------------------------------------------------------------------------
    // MEMBERS CRUD
    // --------------------------------------------------------------------------
    if (method === 'POST' && pathname === '/api/members') {
      const { id, name, role } = body || {};
      if (!id || !name || !role) {
        return jsonResponse(400, { message: "Nama dan Jabatan wajib diisi." });
      }
      db.prepare("INSERT INTO members (id, name, role) VALUES (?, ?, ?)").run(id, name, role);
      // Auto-create matching entry in dues checklist
      db.prepare("INSERT INTO dues (memberId, name, duesPaid, debtInstallment, installmentPaid) VALUES (?, ?, 0, 0, 1)").run(id, name);
      
      dbVersion = Date.now();
      return jsonResponse(201, { success: true });
    }

    let match = pathname.match(/^\/api\/members\/([^\/]+)$/);
    if (method === 'PUT' && match) {
      const id = match[1];
      const { name, role } = body || {};
      db.prepare("UPDATE members SET name = ?, role = ? WHERE id = ?").run(name, role, id);
      db.prepare("UPDATE dues SET name = ? WHERE memberId = ?").run(name, id);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    if (method === 'DELETE' && match) {
      const id = match[1];
      db.prepare("DELETE FROM members WHERE id = ?").run(id);
      db.prepare("DELETE FROM dues WHERE memberId = ?").run(id);
      db.prepare("UPDATE livestock SET ownerId = '' WHERE ownerId = ?").run(id);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    // --------------------------------------------------------------------------
    // LIVESTOCK CRUD
    // --------------------------------------------------------------------------
    if (method === 'POST' && pathname === '/api/livestock') {
      const { id, name, ownerId, breed, gender, dob } = body || {};
      if (!id || !name || !breed || !gender || !dob) {
        return jsonResponse(400, { message: "Data pendaftaran domba tidak lengkap." });
      }
      db.prepare("INSERT INTO livestock (id, name, ownerId, breed, gender, dob) VALUES (?, ?, ?, ?, ?, ?)").run(id, name, ownerId, breed, gender, dob);
      
      dbVersion = Date.now();
      return jsonResponse(201, { id });
    }

    match = pathname.match(/^\/api\/livestock\/([^\/]+)$/);
    if (method === 'PUT' && match) {
      const id = match[1];
      const { name, ownerId, breed, gender, dob } = body || {};
      db.prepare("UPDATE livestock SET name = ?, ownerId = ?, breed = ?, gender = ?, dob = ? WHERE id = ?").run(name, ownerId, breed, gender, dob, id);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    if (method === 'DELETE' && match) {
      const id = match[1];
      db.prepare("DELETE FROM livestock WHERE id = ?").run(id);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    // --------------------------------------------------------------------------
    // GROWTH LOGS CRUD
    // --------------------------------------------------------------------------
    match = pathname.match(/^\/api\/livestock\/([^\/]+)\/growth$/);
    if (method === 'POST' && match) {
      const id = match[1];
      const { age, weight, chestGirth, height, length } = body || {};
      db.prepare("INSERT INTO growth_logs (sheepId, age, weight, chestGirth, height, length) VALUES (?, ?, ?, ?, ?, ?)").run(id, age, weight, chestGirth, height, length);
      
      dbVersion = Date.now();
      return jsonResponse(201, { success: true });
    }

    // --------------------------------------------------------------------------
    // HEALTH LOGS CRUD
    // --------------------------------------------------------------------------
    match = pathname.match(/^\/api\/livestock\/([^\/]+)\/health$/);
    if (method === 'POST' && match) {
      const id = match[1];
      const { id: logId, date, status, diagnosis, treatment, veterinarian } = body || {};
      db.prepare("INSERT INTO health_logs (id, sheepId, date, status, diagnosis, treatment, veterinarian) VALUES (?, ?, ?, ?, ?, ?, ?)").run(logId, id, date, status, diagnosis, treatment, veterinarian);
      
      dbVersion = Date.now();
      return jsonResponse(201, { success: true });
    }

    match = pathname.match(/^\/api\/livestock\/([^\/]+)\/health\/([^\/]+)$/);
    if (method === 'DELETE' && match) {
      const logId = match[2];
      db.prepare("DELETE FROM health_logs WHERE id = ?").run(logId);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    // --------------------------------------------------------------------------
    // TRANSACTIONS CRUD
    // --------------------------------------------------------------------------
    if (method === 'POST' && pathname === '/api/transactions') {
      const { id, date, description, category, amount } = body || {};
      db.prepare("INSERT INTO transactions (id, date, description, category, amount) VALUES (?, ?, ?, ?, ?)").run(id, date, description, category, amount);
      
      dbVersion = Date.now();
      return jsonResponse(201, { success: true });
    }

    match = pathname.match(/^\/api\/transactions\/([^\/]+)$/);
    if (method === 'DELETE' && match) {
      const id = match[1];
      db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    // --------------------------------------------------------------------------
    // DUES UPDATE
    // --------------------------------------------------------------------------
    match = pathname.match(/^\/api\/dues\/([^\/]+)$/);
    if (method === 'PUT' && match) {
      const memberId = match[1];
      const { field, val } = body || {};
      const valInt = val ? 1 : 0;
      if (field !== 'duesPaid' && field !== 'installmentPaid') {
        return jsonResponse(400, { message: "Invalid field name." });
      }
      db.prepare(`UPDATE dues SET ${field} = ? WHERE memberId = ?`).run(valInt, memberId);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    // --------------------------------------------------------------------------
    // GROUP ACTIVITIES CRUD
    // --------------------------------------------------------------------------
    if (method === 'POST' && pathname === '/api/activities') {
      const { id, name, location, date, description, image } = body || {};
      db.prepare("INSERT INTO activities (id, name, location, date, description, image) VALUES (?, ?, ?, ?, ?, ?)").run(id, name, location, date, description, image);
      
      dbVersion = Date.now();
      return jsonResponse(201, { success: true });
    }

    match = pathname.match(/^\/api\/activities\/([^\/]+)$/);
    if (method === 'PUT' && match) {
      const id = match[1];
      const { name, location, date, description, image } = body || {};
      if (image) {
        db.prepare("UPDATE activities SET name = ?, location = ?, date = ?, description = ?, image = ? WHERE id = ?").run(name, location, date, description, image, id);
      } else {
        db.prepare("UPDATE activities SET name = ?, location = ?, date = ?, description = ? WHERE id = ?").run(name, location, date, description, id);
      }
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    if (method === 'DELETE' && match) {
      const id = match[1];
      db.prepare("DELETE FROM activities WHERE id = ?").run(id);
      
      dbVersion = Date.now();
      return jsonResponse(200, { success: true });
    }

    // Fallback if API route not recognized
    return jsonResponse(404, { message: "Endpoint API tidak ditemukan." });

  } catch (err) {
    console.error("API Error details:", err);
    return jsonResponse(500, { message: err.message || "Gagal memproses transaksi database terpusat." });
  }
}

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL pathname
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    // Buffer Request Payload for JSON Parsing
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      let payload = null;
      if (body) {
        try {
          payload = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ message: "Payload JSON tidak valid." }));
          return;
        }
      }
      handleApiRequest(req, res, pathname, payload);
    });
  } else {
    // Serve Static File
    let fileRelativePath = pathname === '/' ? 'index.html' : pathname;
    let absolutePath = path.join(__dirname, fileRelativePath);

    // Prevent directory traversal attacks
    if (!absolutePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Akses ditolak.');
      return;
    }

    fs.stat(absolutePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Single Page Application SPA fallback: serve index.html
        absolutePath = path.join(__dirname, 'index.html');
      }
      
      const contentType = getContentType(absolutePath);
      const stream = fs.createReadStream(absolutePath);
      res.writeHead(200, { 'Content-Type': contentType });
      stream.pipe(res);
    });
  }
});

// Start Server Listen
server.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(` SITernak Dependency-free Database Server running successfully!`);
  console.log(` - Port: ${PORT}`);
  console.log(` - Local Access:   http://localhost:${PORT}`);
  console.log(` - Network Access: http://<your-computer-ip-address>:${PORT}`);
  console.log(`================================================================`);
});
