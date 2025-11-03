/*
 * ====================================================================
 * authGuard.js - Penjaga Rute Sisi Klien (Frontend)
 * ====================================================================
 * TUJUAN:
 * 1.  Mencegah pengguna yang belum login mengakses halaman privat.
 * 2.  File ini harus dimuat di <head> SETIAP halaman (termasuk publik).
 * ====================================================================
 */

(function() {
    // 1. Ambil token dari localStorage
    const token = localStorage.getItem('token');

    // 2. Tentukan halaman mana saja yang Boleh diakses tanpa login
    //    (Ini berdasarkan logika dari file Anda)
    const publicPages = [
        '/login.html',
        '/register.html',
        '/index.html',
        '/tentang.html',
        '/' // Halaman root
    ];

    // 3. Cek path halaman saat ini
    const currentPage = window.location.pathname;

    // 4. Cek apakah halaman ini adalah halaman publik
    let isPublicPage = false;
    for (const page of publicPages) {
        if (currentPage.endsWith(page)) {
            isPublicPage = true;
            break;
        }
    }

    // 5. Logika Pengalihan
    // JIKA token TIDAK ADA (belum login)
    // DAN halaman saat ini BUKAN halaman publik
    if (!token && !isPublicPage) {
        console.warn('Akses ditolak. Tidak ada token. Mengalihkan ke login...');
        alert('Anda harus login untuk mengakses halaman ini.');
        
        // Alihkan pengguna kembali ke halaman login
        window.location.href = '/login.html';
    }

    // 6. Jika token ADA, atau jika ini halaman publik, biarkan halaman dimuat.
})();