// authMiddleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Ini adalah 'Penjaga' kita
module.exports = function(req, res, next) {
  // 1. Ambil token dari header 'x-auth-token'
  const token = req.header('x-auth-token');

  // 2. Cek jika tidak ada token
  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak. Tidak ada token.' });
  }

  // 3. Verifikasi token
  try {
    // Coba 'buka' token menggunakan kunci rahasia kita
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Jika berhasil, 'tempelkan' data user ke request
    req.user = decoded.user;

    // Lanjutkan ke tujuan (misal: API /api/history)
    next();
  } catch (err) {
    // Jika token palsu atau kedaluwarsa
    res.status(401).json({ message: 'Token tidak valid.' });
  }
};