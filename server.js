// server.js (Versi 4.2: Final - Perbaikan SyntaxError)

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mqtt = require('mqtt');                   // Dari Langkah 5
const { Server } = require("socket.io");      // Dari Langkah 5
require('dotenv').config();

const authMiddleware = require('./authMiddleware'); // Dari Langkah 4

// --- Konfigurasi Awal ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

// --- Inisialisasi Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// --- 1. Koneksi ke MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Terhubung ke MongoDB"))
  .catch(err => console.error("❌ Gagal koneksi MongoDB:", err.message));

// --- 2A. Skema & Model User ---
// (Kode UserSchema dan Model User Anda dari Langkah 2)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  namaLengkap: { type: String, default: 'Pengguna Baru' },
  jabatan: { type: String, default: 'Pegawai' } // <-- [BARU] TAMBAHKAN BARIS INI
}, { timestamps: true });
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
const User = mongoose.model('User', UserSchema);

// --- 2B. Skema & Model Data Tandon ---
// (Kode TandonDataSchema dari Langkah 5)
const TandonDataSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  value: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const TandonData = mongoose.model('TandonData', TandonDataSchema);

// --- 3. Melayani File Frontend Statis ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 4. API Endpoints untuk Autentikasi ---

// === API: REGISTER ===
// [DI SINI SUDAH DIPERBAIKI - KODE LENGKAP DARI LANGKAH 2]
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password diperlukan' });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username sudah digunakan' });
    }
    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json({ message: 'Registrasi berhasil! Silakan login.' });
  } catch (error) {
    console.error("Error di /register:", error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// === API: LOGIN ===
// [DI SINI SUDAH DIPERBAIKI - KODE LENGKAP DARI LANGKAH 2]
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password diperlukan' });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }
    const payload = { user: { id: user.id, username: user.username } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({
      message: 'Login berhasil!',
      token: token,
      username: user.username
    });
  } catch (error) {
    console.error("Error di /login:", error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// --- 5. API Endpoints yang DILINDUNGI ---

// === API: GET PROFIL SAYA ===
// [DI SINI SUDAH DIPERBAIKI - KODE LENGKAP DARI LANGKAH 4]
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); 
    if (!user) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// === API: GET HISTORI ===
// (Kode /api/history dari Langkah 5)
app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    const history = await TandonData.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(history);
  } catch (error) {
    console.error("Gagal ambil histori:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ... (setelah endpoint app.get('/api/history', ...))

// === [BARU] API: UPDATE PROFIL SAYA ===
app.put('/api/me', authMiddleware, async (req, res) => {
  try {
    // 1. Ambil data dari body
    const { namaLengkap, jabatan } = req.body;

    // 2. Cari user di DB berdasarkan ID dari token
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // 3. Update data user
    user.namaLengkap = namaLengkap || user.namaLengkap;
    user.jabatan = jabatan || user.jabatan;
    
    // (Catatan: Kita sengaja tidak mengizinkan perubahan username/password di sini)

    // 4. Simpan ke database
    await user.save();

    // 5. Kirim kembali data user yang sudah di-update (tanpa password)
    const userUpdated = await User.findById(req.user.id).select('-password');
    res.json({ message: 'Profil berhasil diperbarui!', user: userUpdated });

  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});


// --- 6. Logika Jembatan (MQTT <-> Socket.IO) ---
// (Semua kode MQTT & Socket.IO dari Langkah 5 ada di sini)

// === 6A. Inisialisasi Klien MQTT ===
const MQTT_TOPIC_LEVEL    = "BBPMP/tandon/level";
const MQTT_TOPIC_POMPA    = "BBPMP/tandon/pompa";
const MQTT_TOPIC_PERINTAH = "BBPMP/tandon/perintah";

// [MODIFIKASI] Ambil info koneksi dari .env
const mqttOptions = {
  host: process.env.MQTT_HOST_URL,
  port: process.env.MQTT_HOST_PORT,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  protocol: 'mqtts'
};

console.log("Mencoba terhubung ke MQTT Broker (HiveMQ Cloud)...");
const mqttClient = mqtt.connect(mqttOptions);

mqttClient.on('connect', () => {
  console.log("✅ Terhubung ke MQTT Broker (HiveMQ)");
  mqttClient.subscribe([MQTT_TOPIC_LEVEL, MQTT_TOPIC_POMPA], (err) => {
    if (!err) {
      console.log(`Berhasil subscribe ke: ${MQTT_TOPIC_LEVEL} & ${MQTT_TOPIC_POMPA}`);
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  const payload = message.toString();
  console.log(`[MQTT] Pesan diterima: ${topic} = ${payload}`);
  try {
    const dataBaru = new TandonData({ topic, value: payload });
    await dataBaru.save();
    io.emit('data-iot', { topic, value: payload, timestamp: dataBaru.timestamp });
  } catch (error) {
    console.error("Gagal simpan ke DB atau kirim ke socket:", error.message);
  }
});

mqttClient.on('error', (err) => {
  console.error("❌ Gagal terhubung ke MQTT Broker:", err);
});

// === 6B. Logika Socket.IO (Frontend <-> Backend) ===
io.on('connection', (socket) => {
  console.log(`🔌 Frontend terhubung: ${socket.id}`);

  socket.on('autentikasi', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`🔑 Autentikasi socket ${socket.id} berhasil untuk user: ${decoded.user.username}`);
      socket.join(decoded.user.id);
      socket.emit('autentikasi_berhasil');
    } catch (err) {
      console.log(`🔒 Autentikasi socket ${socket.id} GAGAL. Token tidak valid.`);
      socket.emit('autentikasi_gagal');
      socket.disconnect();
    }
  });

  socket.on('perintah-iot', (perintah) => {
    console.log(`[Socket.IO] Perintah diterima: ${perintah}`);
    mqttClient.publish(MQTT_TOPIC_PERINTAH, perintah, (err) => {
      if (err) {
        console.error("Gagal kirim perintah ke MQTT:", err);
      } else {
        console.log(`[MQTT] Perintah "${perintah}" berhasil dikirim ke ${MQTT_TOPIC_PERINTAH}`);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Frontend terputus: ${socket.id}`);
  });
});


// --- Menjalankan Server ---
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server "TandonTrack" berjalan di http://localhost:${PORT}`);
});