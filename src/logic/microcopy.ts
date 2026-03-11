// ============================================
// B2C Microcopy Dictionary
// ============================================
// Maps raw technical errors/states to human-readable
// Indonesian text for non-technical users.
// All text must be: actionable, calming, jargon-free.
// ============================================

import type { TestId, TestStatus, Severity, DiagnosticPhase } from '../engine/types';

// ─── Phase Progress Labels (shown during scan) ─────

export const PHASE_MICROCOPY: Record<DiagnosticPhase, {
    label: string;
    description: string;
}> = {
    idle: {
        label: 'Siap Diagnosa',
        description: 'Tekan tombol untuk mulai mengecek koneksi internet Anda.',
    },
    checking_online: {
        label: 'Mengecek koneksi dasar...',
        description: 'Memastikan device Anda terhubung ke jaringan.',
    },
    checking_gateway: {
        label: 'Mengecek router...',
        description: 'Memeriksa apakah router Anda bisa mengakses internet.',
    },
    checking_dns: {
        label: 'Mengecek DNS...',
        description: 'Memastikan browser bisa menemukan alamat website.',
    },
    checking_latency: {
        label: 'Mengukur kecepatan respon...',
        description: 'Menghitung seberapa cepat server membalas permintaan.',
    },
    checking_speed: {
        label: 'Mengukur kecepatan download...',
        description: 'Mengunduh file kecil untuk mengukur bandwidth.',
    },
    analyzing: {
        label: 'Menganalisis hasil...',
        description: 'Menerjemahkan data teknis menjadi laporan yang mudah dipahami.',
    },
    done: {
        label: 'Selesai!',
        description: 'Hasil diagnosa siap dilihat.',
    },
    error_offline: {
        label: 'Tidak terhubung',
        description: 'Device Anda sepertinya sedang offline.',
    },
};

// ─── Test Label (friendly names for each test) ─────

export const TEST_LABELS: Record<TestId, {
    name: string;
    icon: string;
    activeVerb: string;
}> = {
    online: {
        name: 'Koneksi Dasar',
        icon: '🌐',
        activeVerb: 'Mengecek koneksi...',
    },
    gateway: {
        name: 'Router & Gateway',
        icon: '📶',
        activeVerb: 'Mengecek router...',
    },
    dns: {
        name: 'DNS',
        icon: '🔍',
        activeVerb: 'Mengecek DNS...',
    },
    latency: {
        name: 'Kecepatan Respon',
        icon: '⚡',
        activeVerb: 'Mengukur latency...',
    },
    speed: {
        name: 'Kecepatan Download',
        icon: '📥',
        activeVerb: 'Mengukur download...',
    },
};

// ─── Status Icons ─────

export const STATUS_DISPLAY: Record<TestStatus, {
    icon: string;
    label: string;
    color: string;
}> = {
    idle: { icon: '⚪', label: 'Menunggu', color: 'muted' },
    running: { icon: '⏳', label: 'Sedang berjalan', color: 'accent' },
    pass: { icon: '✅', label: 'Aman', color: 'good' },
    warn: { icon: '⚠️', label: 'Perlu perhatian', color: 'warn' },
    fail: { icon: '❌', label: 'Bermasalah', color: 'bad' },
    skipped: { icon: '⏭️', label: 'Dilewati', color: 'muted' },
};

// ─── Severity Display ─────

export const SEVERITY_DISPLAY: Record<Severity, {
    icon: string;
    cssClass: string;
    headerColor: string;
}> = {
    good: { icon: '🟢', cssClass: 'verdictGood', headerColor: 'var(--color-good)' },
    degraded: { icon: '🟡', cssClass: 'verdictDegraded', headerColor: 'var(--color-warn)' },
    bad: { icon: '🔴', cssClass: 'verdictBad', headerColor: 'var(--color-bad)' },
    offline: { icon: '📡', cssClass: 'verdictOffline', headerColor: 'var(--color-offline)' },
};

// ─── Error → Human-Readable Mapping ─────

export interface MicrocopyEntry {
    /** What the user sees */
    headline: string;
    /** Calm, non-technical explanation */
    explanation: string;
    /** What they can actually DO */
    actions: string[];
}

/**
 * Technical error → B2C-friendly microcopy.
 * Keyed by [testId]_[scenario].
 */
export const ERROR_MICROCOPY: Record<string, MicrocopyEntry> = {
    // --- Online / Connectivity ---
    online_offline: {
        headline: 'Tidak ada koneksi internet',
        explanation: 'Device Anda tidak terhubung ke WiFi atau jaringan kabel.',
        actions: [
            'Periksa apakah WiFi di HP/laptop sudah dinyalakan.',
            'Pastikan router Anda menyala (cek lampu indikator).',
            'Coba sambungkan kabel LAN langsung ke router.',
        ],
    },
    online_timeout: {
        headline: 'Koneksi sangat lambat',
        explanation: 'Device Anda terhubung ke router, tapi router tidak bisa mengakses internet.',
        actions: [
            'Restart router: cabut kabel power, tunggu 30 detik, colok kembali.',
            'Hubungi ISP Anda jika masalah berlanjut.',
        ],
    },

    // --- Gateway / Router ---
    gateway_fail: {
        headline: 'Router bermasalah',
        explanation: 'Kami tidak bisa memverifikasi koneksi router Anda ke internet.',
        actions: [
            'Restart router: cabut kabel power, tunggu 30 detik.',
            'Periksa kabel dari modem/ONT ke router.',
            'Cek apakah lampu "Internet" atau "WAN" di router menyala.',
        ],
    },
    gateway_vpn: {
        headline: 'VPN terdeteksi',
        explanation: 'Koneksi Anda melewati VPN. Hasil tes mungkin tidak mencerminkan kecepatan jaringan lokal.',
        actions: [
            'Matikan VPN untuk hasil diagnosa yang lebih akurat.',
            'Jika perlu VPN, abaikan peringatan ini.',
        ],
    },

    // --- DNS ---
    dns_fail: {
        headline: 'DNS tidak merespon',
        explanation: 'Internet Anda sebenarnya tersambung, tapi browser tidak bisa mencari alamat website karena DNS bermasalah.',
        actions: [
            'Ganti DNS ke Cloudflare (1.1.1.1) atau Google (8.8.8.8).',
            'Cara: Buka Pengaturan WiFi → Advanced → DNS → Ganti ke 1.1.1.1.',
            'Restart router untuk membersihkan cache DNS.',
        ],
    },
    dns_slow: {
        headline: 'DNS lambat',
        explanation: 'Website terasa lambat saat pertama kali dibuka karena DNS perlu waktu lama untuk mencari alamat.',
        actions: [
            'Ganti DNS ke provider yang lebih cepat (1.1.1.1 atau 8.8.8.8).',
            'Ini bisa mempercepat loading website secara signifikan.',
        ],
    },

    // --- Latency ---
    latency_high: {
        headline: 'Respon sangat lambat',
        explanation: 'Server membutuhkan waktu lama untuk membalas. Video call, gaming, dan browsing akan terasa lambat.',
        actions: [
            'Pindahkan device lebih dekat ke router WiFi.',
            'Kurangi jumlah device yang terhubung ke jaringan yang sama.',
            'Hubungi ISP jika masalah terjadi terus-menerus.',
        ],
    },
    latency_medium: {
        headline: 'Respon cukup lambat',
        explanation: 'Cukup untuk browsing biasa, tapi mungkin kurang nyaman untuk video call atau gaming online.',
        actions: [
            'Hentikan download atau streaming di background.',
            'Coba pindah ke band WiFi 5GHz jika tersedia.',
        ],
    },

    // --- Speed ---
    speed_very_slow: {
        headline: 'Kecepatan sangat rendah',
        explanation: 'Download speed di bawah 1 Mbps. Bahkan membuka website akan terasa sangat lambat.',
        actions: [
            'Kurangi device yang terhubung ke WiFi.',
            'Pastikan tidak ada sedang download file besar.',
            'Hubungi ISP — Anda mungkin terkena throttling atau ada gangguan.',
        ],
    },
    speed_slow: {
        headline: 'Kecepatan rendah',
        explanation: 'Bisa untuk browsing ringan, tapi streaming video HD dan video call mungkin terputus-putus.',
        actions: [
            'Kurangi device yang sedang streaming video.',
            'Pertimbangkan upgrade paket internet Anda.',
        ],
    },
    speed_blocked: {
        headline: 'Tes kecepatan diblokir',
        explanation: 'Tes download tidak bisa dijalankan. Kemungkinan diblokir oleh ad-blocker atau firewall.',
        actions: [
            'Matikan ad-blocker untuk website ini, lalu tes ulang.',
            'Jika menggunakan VPN, coba matikan sementara.',
        ],
    },

    // --- Generic fallbacks ---
    generic_timeout: {
        headline: 'Koneksi timeout',
        explanation: 'Server tidak merespon dalam batas waktu yang ditentukan.',
        actions: [
            'Coba tes ulang — kadang ini masalah sementara.',
            'Restart router jika masalah terus terjadi.',
        ],
    },
    generic_error: {
        headline: 'Terjadi kesalahan',
        explanation: 'Ada masalah yang tidak terduga saat menjalankan tes.',
        actions: [
            'Muat ulang halaman ini dan coba lagi.',
            'Pastikan browser Anda versi terbaru.',
        ],
    },
};

/**
 * Get microcopy for a specific test + scenario.
 * Falls back to generic entries if specific one not found.
 */
export function getMicrocopy(testId: TestId, scenario: string): MicrocopyEntry {
    const key = `${testId}_${scenario}`;
    return ERROR_MICROCOPY[key] || ERROR_MICROCOPY['generic_error'];
}
