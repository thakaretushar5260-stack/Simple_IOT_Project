const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'iot_super_secret_jwt_key_2026';
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder and db.json exist
function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const initialData = {
    users: [
      {
        id: 'usr_tushar_01',
        name: 'Tushar',
        email: 'tushar@example.com',
        // password is "password123"
        passwordHash: bcrypt.hashSync('password123', 10),
        createdAt: new Date().toISOString()
      }
    ],
    deviceState: {
      ledStatus: 'OFF',
      lcdLine1: 'Simple IoT World',
      lcdLine2: 'Welcome Tushar',
      lastPing: null
    },
    currentReading: {
      temperature: 34,
      humidity: 50,
      lastUpdated: null
    },
    sensorRecords: [
      {
        id: 'rec_001',
        temperature: 34,
        humidity: 50,
        timestamp: Date.now() - 1000 * 60 * 40,
        time: '01:30 PM',
        date: '03-10-2026'
      },
      {
        id: 'rec_002',
        temperature: 35,
        humidity: 49,
        timestamp: Date.now() - 1000 * 60 * 30,
        time: '01:40 PM',
        date: '03-10-2026'
      },
      {
        id: 'rec_003',
        temperature: 36,
        humidity: 52,
        timestamp: Date.now() - 1000 * 60 * 20,
        time: '01:50 PM',
        date: '03-10-2026'
      },
      {
        id: 'rec_004',
        temperature: 33,
        humidity: 55,
        timestamp: Date.now() - 1000 * 60 * 10,
        time: '02:00 PM',
        date: '03-10-2026'
      },
      {
        id: 'rec_005',
        temperature: 34,
        humidity: 53,
        timestamp: Date.now() - 1000 * 60 * 5,
        time: '02:10 PM',
        date: '03-10-2026'
      }
    ]
  };

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  } else {
    try {
      const existing = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (!existing.users || existing.users.length === 0) {
        existing.users = initialData.users;
        fs.writeFileSync(DB_PATH, JSON.stringify(existing, null, 2), 'utf-8');
      }
    } catch {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }
}

ensureDbExists();

// Helper functions for Database
function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], deviceState: {}, currentReading: {}, sensorRecords: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err);
    return false;
  }
}

// Timezone formatter for Asia/Kolkata (+5:30)
function getKolkataTimeAndDate(date = new Date()) {
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const time = timeFormatter.format(date).toUpperCase();
  const dateFormatted = dateFormatter.format(date).replace(/\//g, '-');
  return { time, date: dateFormatted };
}

// Check online status: online if ping within last 45 seconds
function isDeviceOnline(lastPing) {
  if (!lastPing) return false;
  const diff = Date.now() - Number(lastPing);
  return diff < 45000; // 45 seconds threshold
}

// Auth Middleware (Optional for public endpoints, required for protected)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
  }

  const db = readDb();
  const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const newUser = {
    id: 'usr_' + Date.now().toString(36),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDb(db);

  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'Registration successful!',
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password.' });
  }

  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const validPassword = bcrypt.compareSync(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    message: 'Login successful!',
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

// Current User Profile
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ==========================================
// SENSOR DATA ROUTES (ESP8266 & Web Dashboard)
// ==========================================

// Add sensor reading (Supports POST JSON from ESP8266 or Dashboard Simulator)
app.post('/api/sensor-data', (req, res) => {
  const temp = parseFloat(req.body.temperature ?? req.body.temp);
  const hum = parseFloat(req.body.humidity ?? req.body.hum);

  if (isNaN(temp) || isNaN(hum)) {
    return res.status(400).json({ success: false, message: 'Valid temperature and humidity are required.' });
  }

  const db = readDb();
  const now = new Date();
  const { time, date } = getKolkataTimeAndDate(now);

  const newRecord = {
    id: 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
    temperature: Math.round(temp * 10) / 10,
    humidity: Math.round(hum * 10) / 10,
    timestamp: now.getTime(),
    time,
    date
  };

  db.sensorRecords.unshift(newRecord); // newest first
  // Keep last 500 records to prevent file from growing indefinitely
  if (db.sensorRecords.length > 500) {
    db.sensorRecords = db.sensorRecords.slice(0, 500);
  }

  db.currentReading = {
    temperature: newRecord.temperature,
    humidity: newRecord.humidity,
    lastUpdated: now.toISOString()
  };

  // Update ESP8266 heartbeat ping
  db.deviceState.lastPing = now.getTime();

  writeDb(db);

  res.status(201).json({
    success: true,
    message: 'Sensor data recorded successfully',
    record: newRecord,
    deviceState: {
      ledStatus: db.deviceState.ledStatus,
      lcdLine1: db.deviceState.lcdLine1,
      lcdLine2: db.deviceState.lcdLine2
    }
  });
});

// Quick GET update route for ESP8266 HTTP client simplicity (e.g. /api/update?temp=34&hum=50)
app.get('/api/update', (req, res) => {
  const temp = parseFloat(req.query.temp ?? req.query.temperature);
  const hum = parseFloat(req.query.hum ?? req.query.humidity);

  const db = readDb();
  const now = new Date();

  // Always mark ping
  db.deviceState.lastPing = now.getTime();

  if (!isNaN(temp) && !isNaN(hum)) {
    const { time, date } = getKolkataTimeAndDate(now);
    const newRecord = {
      id: 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round(hum * 10) / 10,
      timestamp: now.getTime(),
      time,
      date
    };

    db.sensorRecords.unshift(newRecord);
    if (db.sensorRecords.length > 500) {
      db.sensorRecords = db.sensorRecords.slice(0, 500);
    }

    db.currentReading = {
      temperature: newRecord.temperature,
      humidity: newRecord.humidity,
      lastUpdated: now.toISOString()
    };
  }

  writeDb(db);

  // Return device state in compact JSON for ESP8266
  res.json({
    success: true,
    led: db.deviceState.ledStatus,
    lcd1: db.deviceState.lcdLine1,
    lcd2: db.deviceState.lcdLine2,
    online: true
  });
});

// Get Paginated Sensor Records & Current Readings for Dashboard
app.get('/api/sensor-data', (req, res) => {
  const db = readDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));

  const totalRecords = db.sensorRecords.length;
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedRecords = db.sensorRecords.slice(startIndex, startIndex + limit);

  const isOnline = isDeviceOnline(db.deviceState.lastPing);
  const lastPingSecondsAgo = db.deviceState.lastPing
    ? Math.round((Date.now() - db.deviceState.lastPing) / 1000)
    : null;

  // Recent data for graphing (last 20 readings chronologically)
  const chartData = db.sensorRecords.slice(0, 20).reverse();

  res.json({
    success: true,
    current: db.currentReading,
    device: {
      isOnline,
      lastPing: db.deviceState.lastPing,
      lastPingSecondsAgo,
      ledStatus: db.deviceState.ledStatus,
      lcdLine1: db.deviceState.lcdLine1,
      lcdLine2: db.deviceState.lcdLine2
    },
    pagination: {
      totalRecords,
      totalPages,
      currentPage: page,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    records: paginatedRecords,
    chartData
  });
});

// Delete specific sensor record
app.delete('/api/sensor-data/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const initialLen = db.sensorRecords.length;
  db.sensorRecords = db.sensorRecords.filter(r => r.id !== id);

  if (db.sensorRecords.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  writeDb(db);
  res.json({ success: true, message: 'Record deleted successfully' });
});

// Delete all sensor records (utility)
app.delete('/api/sensor-data', (req, res) => {
  const db = readDb();
  db.sensorRecords = [];
  writeDb(db);
  res.json({ success: true, message: 'All records cleared' });
});

// ==========================================
// ACTUATOR / DEVICE CONTROL ROUTES
// ==========================================

// Get device state (Polled by ESP8266 in Loop or checked by frontend)
app.get('/api/device-state', (req, res) => {
  const db = readDb();
  const isEsp = req.query.source === 'esp8266' || req.headers['user-agent']?.includes('ESP8266');

  if (isEsp) {
    db.deviceState.lastPing = Date.now();
    writeDb(db);
  }

  const isOnline = isDeviceOnline(db.deviceState.lastPing);

  res.json({
    success: true,
    ledStatus: db.deviceState.ledStatus || 'OFF',
    lcdLine1: (db.deviceState.lcdLine1 || '').padEnd(16, ' ').substring(0, 16),
    lcdLine2: (db.deviceState.lcdLine2 || '').padEnd(16, ' ').substring(0, 16),
    isOnline,
    lastPing: db.deviceState.lastPing
  });
});

// Set LED Status (ON or OFF)
app.post('/api/device-state/led', (req, res) => {
  const { ledStatus } = req.body;
  if (!ledStatus || (ledStatus !== 'ON' && ledStatus !== 'OFF')) {
    return res.status(400).json({ success: false, message: 'ledStatus must be either "ON" or "OFF".' });
  }

  const db = readDb();
  db.deviceState.ledStatus = ledStatus;
  writeDb(db);

  res.json({
    success: true,
    message: `LED turned ${ledStatus}`,
    ledStatus: db.deviceState.ledStatus
  });
});

// Set LCD lines (Max 16 chars each)
app.post('/api/device-state/lcd', (req, res) => {
  let { line1 = '', line2 = '' } = req.body;

  line1 = String(line1).substring(0, 16);
  line2 = String(line2).substring(0, 16);

  const db = readDb();
  db.deviceState.lcdLine1 = line1;
  db.deviceState.lcdLine2 = line2;
  writeDb(db);

  res.json({
    success: true,
    message: 'LCD text updated successfully',
    lcdLine1: line1,
    lcdLine2: line2
  });
});

// Device Heartbeat Ping route
app.get('/api/device-ping', (req, res) => {
  const db = readDb();
  db.deviceState.lastPing = Date.now();
  writeDb(db);
  res.json({ success: true, message: 'Ping recorded', time: db.deviceState.lastPing });
});

// Catch-all route to serve index.html for client side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Simple IoT World Server running on port ${PORT}`);
  console.log(`📡 Local URL: http://localhost:${PORT}`);
  console.log(`🕒 Server Timezone: Asia/Kolkata (IST +5:30)`);
  console.log(`===============================================`);
});
