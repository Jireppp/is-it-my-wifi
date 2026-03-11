// ============================================
// Verdict Logic — Decision Tree
// ============================================
// Analyzes all test results and produces a human-
// readable verdict with severity classification.
// ============================================

import type { TestResult, Verdict, Severity } from '../engine/types';

/** Count results by status */
function countStatus(results: TestResult[]) {
    return {
        fail: results.filter(r => r.status === 'fail').length,
        warn: results.filter(r => r.status === 'warn').length,
        pass: results.filter(r => r.status === 'pass').length,
        skipped: results.filter(r => r.status === 'skipped').length,
    };
}

/** Find result by test ID */
function findResult(results: TestResult[], id: string): TestResult | undefined {
    return results.find(r => r.id === id);
}

/**
 * Generate a human-readable verdict from test results.
 * Uses a decision tree matching the diagnostic flow.
 */
export function generateVerdict(results: TestResult[]): Verdict {
    const online = findResult(results, 'online');
    const gateway = findResult(results, 'gateway');
    const dns = findResult(results, 'dns');
    const latency = findResult(results, 'latency');
    const speed = findResult(results, 'speed');
    const counts = countStatus(results);

    // --- Decision Tree ---

    // Case 1: Device is offline
    if (online?.status === 'fail') {
        return {
            severity: 'offline',
            headline: 'Anda Tidak Terhubung ke Internet',
            description: online.summary,
            recommendations: [
                online.recommendation || 'Pastikan WiFi atau kabel LAN terhubung.',
                'Coba nyalakan ulang WiFi di device Anda.',
                'Periksa apakah router menyala dan lampu indikator normal.',
            ],
        };
    }

    // Case 2: Gateway/router issue
    if (gateway?.status === 'fail') {
        return {
            severity: 'bad',
            headline: 'Router Anda Bermasalah',
            description: 'Device terhubung ke jaringan tapi router tidak bisa mengakses internet.',
            recommendations: [
                'Restart router: cabut kabel power, tunggu 30 detik, colok kembali.',
                'Periksa kabel dari modem ke router.',
                'Jika masih gagal, hubungi ISP Anda.',
            ],
        };
    }

    // Case 3: DNS failure
    if (dns?.status === 'fail') {
        return {
            severity: 'bad',
            headline: 'DNS Anda Bermasalah',
            description: 'Internet tersambung, tapi DNS tidak bisa menerjemahkan nama website.',
            recommendations: [
                'Ganti DNS ke 1.1.1.1 (Cloudflare) atau 8.8.8.8 (Google) di pengaturan WiFi.',
                'Restart router untuk refresh DNS cache.',
                'Jika menggunakan DNS ISP, hubungi ISP Anda.',
            ],
        };
    }

    // Case 4: High latency + low speed → ISP issue
    if (latency?.status === 'fail' && speed?.status === 'fail') {
        return {
            severity: 'bad',
            headline: 'ISP Anda Sedang Bermasalah',
            description: 'Latency sangat tinggi dan kecepatan download sangat rendah. Kemungkinan besar ISP sedang gangguan.',
            recommendations: [
                'Hubungi ISP Anda untuk cek apakah ada gangguan di area Anda.',
                'Coba tes dari device lain untuk memastikan bukan masalah device.',
                'Jika menggunakan WiFi, coba pindah lebih dekat ke router.',
            ],
        };
    }

    // Case 5: High latency only
    if (latency?.status === 'fail') {
        return {
            severity: 'bad',
            headline: 'Koneksi ke ISP Sangat Lambat',
            description: `Latency ${latency.value ? latency.value + 'ms' : 'sangat tinggi'}. Browsing, video call, dan streaming akan terganggu.`,
            recommendations: [
                latency.recommendation || 'Hubungi ISP Anda.',
                'Coba restart router.',
                'Kurangi jumlah device yang terhubung ke jaringan.',
            ],
        };
    }

    // Case 6: Low speed only
    if (speed?.status === 'fail') {
        return {
            severity: 'bad',
            headline: 'Kecepatan Internet Sangat Rendah',
            description: `Download speed hanya ${speed.value ? speed.value + ' Mbps' : 'sangat rendah'}. Aktivitas online akan sangat terbatas.`,
            recommendations: [
                speed.recommendation || 'Periksa paket internet Anda.',
                'Pastikan tidak ada download besar di background.',
                'Kurangi jumlah device yang streaming.',
            ],
        };
    }

    // Case 7: Some warnings (degraded)
    if (counts.warn > 0) {
        const severity: Severity = counts.warn >= 2 ? 'degraded' : 'degraded';
        const warningTests = results.filter(r => r.status === 'warn');
        const descriptions = warningTests.map(t => t.summary).join(' ');
        const recs = warningTests
            .map(t => t.recommendation)
            .filter((r): r is string => !!r);

        return {
            severity,
            headline: counts.warn >= 2
                ? 'Koneksi Anda Kurang Optimal'
                : 'Ada Sedikit Masalah pada Koneksi',
            description: descriptions,
            recommendations: recs.length > 0
                ? recs
                : ['Coba restart router untuk memperbaiki performa.'],
        };
    }

    // Case 8: Some tests were skipped (blocked)
    if (counts.skipped > 0 && counts.fail === 0) {
        const skippedTests = results.filter(r => r.status === 'skipped');
        const skippedNames = skippedTests.map(t => t.label).join(', ');

        return {
            severity: counts.pass > 0 ? 'good' : 'degraded',
            headline: counts.pass > 0
                ? 'Koneksi Anda Kemungkinan Baik ✅'
                : 'Hasil Tidak Lengkap',
            description: `Beberapa tes (${skippedNames}) dilewati karena diblokir oleh ekstensi browser. Tes yang berhasil menunjukkan koneksi normal.`,
            recommendations: [
                'Matikan ad-blocker untuk hasil diagnosa yang lengkap.',
                'Atau buka halaman ini di mode Incognito.',
                ...(counts.warn > 0 ? results.filter(r => r.status === 'warn').map(r => r.recommendation).filter((r): r is string => !!r) : []),
            ],
        };
    }

    // Case 9: All good!
    return {
        severity: 'good',
        headline: 'Koneksi Anda Baik-Baik Saja! ✅',
        description: `Semua tes menunjukkan hasil normal.${speed?.value ? ` Download speed: ${speed.value} Mbps.` : ''}${latency?.value ? ` Latency: ${latency.value}ms.` : ''}`,
        recommendations: [
            'Jika masih terasa lambat, masalah mungkin ada di server/website tujuan.',
            'Pastikan browser dan OS Anda selalu update.',
        ],
    };
}
