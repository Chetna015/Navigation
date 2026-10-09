import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Resolve current directory path for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Setup static file hosting for uploaded assets
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Setup SQLite Database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite Database at:', dbPath);
    initializeDatabase();
  }
});

// Configure Multer for File Uploads (360 Panoramas, Photos, Videos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Database initialization
function initializeDatabase() {
  db.serialize(() => {
    // Admins Table
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin'
      )
    `);

    // Locations Table (Pins)
    db.run(`
      CREATE TABLE IF NOT EXISTS locations (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        category VARCHAR(100),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        x INTEGER,
        y INTEGER,
        floors INTEGER DEFAULT 2,
        description TEXT,
        cover_image VARCHAR(255),
        video_url VARCHAR(255),
        is_custom BOOLEAN DEFAULT FALSE
      )
    `);

    // Rooms Table
    db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(100) PRIMARY KEY,
        location_id VARCHAR(100),
        floor_level VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        capacity VARCHAR(100),
        equipment TEXT,
        current_event TEXT,
        status VARCHAR(100),
        coord_x INTEGER DEFAULT 0,
        coord_y INTEGER DEFAULT 0
      )
    `);

    // Watercoolers Table
    db.run(`
      CREATE TABLE IF NOT EXISTS water_coolers (
        id VARCHAR(100) PRIMARY KEY,
        location_id VARCHAR(100),
        floor_level VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        temperature VARCHAR(50),
        purity VARCHAR(50),
        capacity VARCHAR(50),
        status VARCHAR(100),
        image VARCHAR(255),
        location_description TEXT,
        coord_x INTEGER DEFAULT 0,
        coord_y INTEGER DEFAULT 0
      )
    `);

    // Seed Default Admin Creds (admin / admin2026)
    db.get("SELECT * FROM admins WHERE username = 'admin'", (err, row) => {
      if (!row) {
        db.run(
          "INSERT INTO admins (id, username, password, role) VALUES (?, ?, ?, ?)",
          ['usr_admin_default', 'admin', 'admin2026', 'superadmin']
        );
      }
    });

    // Seed Default SBM Rooms & Locations if empty
    db.get("SELECT COUNT(*) as count FROM locations", (err, row) => {
      if (row && row.count === 0) {
        console.log('Seeding initial location data...');
        // Seed default CSJM Auditorium
        db.run(`
          INSERT INTO locations (id, name, code, category, lat, lng, x, y, floors, description)
          VALUES ('loc_auditorium', 'CSJM Auditorium', 'BLD-650', 'Summit Venue', 26.504193, 80.268463, 490, 397, 1, 'Primary venue for the CSJMU AI Summit 2026 containing classrooms, keynote spaces, and exhibitions.')
        `);

        // Seed G-01 Room
        db.run(`
          INSERT INTO rooms (id, location_id, floor_level, name, type, capacity, equipment, current_event, status, coord_x, coord_y)
          VALUES ('G-01', 'loc_auditorium', 'ground', 'G-01: Reception & Visitor Registration', 'Lobby', '50 Seats', 'Ramp Access, Smart Terminals', 'Visitor check-in & delegate badging', 'Active Session', 120, 140)
        `);

        // Seed SBM Water Cooler #1
        db.run(`
          INSERT INTO water_coolers (id, location_id, floor_level, name, type, temperature, purity, capacity, status, image, location_description, coord_x, coord_y)
          VALUES ('SBM-WC-01', 'loc_auditorium', 'ground', 'SBM Water Cooler #1 (Central Atrium RO Station)', 'RO + UV Purifier', '6.0°C', '99.9%', '80 L/hr', 'Operational • Active', '/assets/buildings/watercooler_ro.jpg', 'Ground Floor Central Atrium near ML Lab', 390, 220)
        `);
      }
    });
  });
}

// --------------------------------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CSJMU Smart Campus SQLite Backend API Operational 🚀' });
});

// File Upload Handler (Returns path to static file URL)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM admins WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      res.json({ success: true, user: { username: row.username, role: row.role } });
    } else {
      res.status(401).json({ success: false, message: 'Invalid Admin credentials!' });
    }
  });
});

// Locations API (GET, POST, DELETE)
app.get('/api/locations', (req, res) => {
  db.all("SELECT * FROM locations", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, locations: rows });
  });
});

app.post('/api/locations', (req, res) => {
  const { id, name, code, category, lat, lng, x, y, floors, description, cover_image, video_url } = req.body;
  const sql = `
    INSERT INTO locations (id, name, code, category, lat, lng, x, y, floors, description, cover_image, video_url, is_custom)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, code=excluded.code, category=excluded.category,
      lat=excluded.lat, lng=excluded.lng, x=excluded.x, y=excluded.y,
      floors=excluded.floors, description=excluded.description,
      cover_image=excluded.cover_image, video_url=excluded.video_url
  `;
  db.run(sql, [id, name, code, category, lat, lng, x, y, floors, description, cover_image, video_url], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: id });
  });
});

app.delete('/api/locations/:id', (req, res) => {
  db.run("DELETE FROM locations WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Rooms API
app.get('/api/rooms', (req, res) => {
  db.all("SELECT * FROM rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, rooms: rows });
  });
});

app.post('/api/rooms', (req, res) => {
  const { id, location_id, floor_level, name, type, capacity, equipment, current_event, status, coord_x, coord_y } = req.body;
  const sql = `
    INSERT INTO rooms (id, location_id, floor_level, name, type, capacity, equipment, current_event, status, coord_x, coord_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      location_id=excluded.location_id, floor_level=excluded.floor_level, name=excluded.name,
      type=excluded.type, capacity=excluded.capacity, equipment=excluded.equipment,
      current_event=excluded.current_event, status=excluded.status,
      coord_x=excluded.coord_x, coord_y=excluded.coord_y
  `;
  db.run(sql, [id, location_id, floor_level, name, type, capacity, equipment, current_event, status, coord_x, coord_y], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: id });
  });
});

app.delete('/api/rooms/:id', (req, res) => {
  db.run("DELETE FROM rooms WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Watercoolers API
app.get('/api/watercoolers', (req, res) => {
  db.all("SELECT * FROM water_coolers", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, watercoolers: rows });
  });
});

app.post('/api/watercoolers', (req, res) => {
  const { id, location_id, floor_level, name, type, temperature, purity, capacity, status, image, location_description, coord_x, coord_y } = req.body;
  const sql = `
    INSERT INTO water_coolers (id, location_id, floor_level, name, type, temperature, purity, capacity, status, image, location_description, coord_x, coord_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      location_id=excluded.location_id, floor_level=excluded.floor_level, name=excluded.name,
      type=excluded.type, temperature=excluded.temperature, purity=excluded.purity,
      capacity=excluded.capacity, status=excluded.status, image=excluded.image,
      location_description=excluded.location_description, coord_x=excluded.coord_x, coord_y=excluded.coord_y
  `;
  db.run(sql, [id, location_id, floor_level, name, type, temperature, purity, capacity, status, image, location_description, coord_x, coord_y], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: id });
  });
});

app.delete('/api/watercoolers/:id', (req, res) => {
  db.run("DELETE FROM water_coolers WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CSJMU SQLite API Server running on http://0.0.0.0:${PORT} (LAN & Localhost)`);
  });
}

export { app, db };
