const jwt = require('jsonwebtoken');
require('dotenv').config(); // Memastikan variabel .env (terutama JWT_SECRET) dimuat

/**
 * Ini adalah fungsi middleware.
 * Fungsinya adalah mencegat setiap request ke API yang dilindungi.
 * Ia akan memeriksa apakah request tersebut memiliki token login yang valid.
 */
module.exports = function(req, res, next) {
  // 1. Dapatkan token dari header 'Authorization'
  const authHeader = req.header('Authorization');

  // 2. Cek jika tidak ada token sama sekali
  if (!authHeader) {
    return res.status(401).json({ message: 'Akses ditolak. Tidak ada token yang diberikan.' });
  }

  // 3. Cek format token. Token harus berformat "Bearer <token>"
  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Format token tidak valid. Gunakan format "Bearer <token>".' });
  }

  const token = tokenParts[1];

  // 4. Cek jika token-nya kosong
  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak. Token tidak ada.' });
  }

  // 5. Verifikasi token
  try {
    // Memvalidasi token menggunakan JWT_SECRET dari file .env Anda
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Simpan payload user dari token ke objek 'req'
    // Ini penting agar rute /api/me bisa tahu siapa user yang sedang login
    // Sesuai dengan payload yang Anda buat di server.js saat login
    req.user = decoded.user; 
    
    // Lanjutkan ke fungsi rute API (misal: /api/me atau /api/history)
    next();

  } catch (err) {
    // Jika token tidak valid (kadaluwarsa, salah, dll)
    res.status(401).json({ message: 'Token tidak valid atau sudah kadaluwarsa.' });
  }
};