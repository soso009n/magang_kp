// public/authGuard.js (SUDAH DIPERBAIKI)

// Ambil token dari localStorage
const token = localStorage.getItem('token');

// Cek apakah token ada DAN halaman saat ini BUKAN halaman publik
if (!token && 
    !window.location.pathname.endsWith('/login.html') && 
    !window.location.pathname.endsWith('/register.html') &&
    !window.location.pathname.endsWith('/') &&
    !window.location.pathname.endsWith('/index.html') &&
    !window.location.pathname.endsWith('/tentang.html') // <-- [PERBAIKAN] Tambahkan ini
) {
    // Jika tidak ada token, paksa kembali ke halaman login
    alert('Anda harus login untuk mengakses halaman ini.');
    window.location.href = '/login.html';
}

// (Kurung kurawal ekstra di akhir sudah dihapus)