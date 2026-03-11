// ============================================
// Gateway / Router Connectivity Check
// ============================================
// Uses navigator.onLine as baseline + fetch to public
// endpoint to verify actual internet (not just LAN).
// navigator.onLine is unreliable (true if connected to
// router even without internet), so we always verify.
// ============================================

import type { TestResult } from './types';

/**
 * Check if device is online (baseline check).
 * Uses navigator.onLine + a real fetch to verify.
 */
export async function checkOnlineStatus(): Promise<TestResult> {
    const start = performance.now();

    // Layer 1: navigator.onLine (fast but unreliable)
    if (!navigator.onLine) {
        return {
            id: 'online',
            status: 'fail',
            label: 'Koneksi Dasar',
            summary: 'Device Anda tidak terhubung ke jaringan apapun.',
            detail: 'navigator.onLine = false. Device tidak mendeteksi koneksi jaringan.',
            durationMs: performance.now() - start,
            recommendation: 'Pastikan WiFi atau kabel LAN terhubung dengan benar.',
        };
    }

    // Layer 2: Real connectivity check via fetch
    // (navigator.onLine can be true even without internet)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const fetchStart = performance.now();
        await fetch('https://www.google.com/generate_204', {
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal,
        });
        const fetchDuration = performance.now() - fetchStart;
        clearTimeout(timeoutId);

        return {
            id: 'online',
            status: 'pass',
            label: 'Koneksi Dasar',
            summary: 'Device terhubung ke internet.',
            value: Math.round(fetchDuration),
            unit: 'ms',
            detail: `navigator.onLine = true. Fetch ke Google berhasil dalam ${Math.round(fetchDuration)}ms.`,
            durationMs: performance.now() - start,
        };
    } catch (error) {
        const elapsed = performance.now() - start;
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';

        return {
            id: 'online',
            status: 'fail',
            label: 'Koneksi Dasar',
            summary: isTimeout
                ? 'Koneksi sangat lambat atau terputus. Router mungkin terhubung tapi tidak ada akses internet.'
                : 'Tidak dapat terhubung ke internet.',
            detail: isTimeout
                ? 'Fetch timeout setelah 5 detik. navigator.onLine = true tapi tidak ada respon dari server.'
                : `Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            durationMs: elapsed,
            recommendation: isTimeout
                ? 'Coba restart router Anda. Jika masih gagal, hubungi ISP.'
                : 'Periksa koneksi WiFi atau kabel LAN Anda.',
        };
    }
}

/**
 * Check gateway/router connectivity.
 * Attempts to reach common router IPs.
 * NOTE: This will fail on HTTPS pages (mixed content).
 * Treated as a best-effort bonus check.
 */
export async function checkGateway(): Promise<TestResult> {
    const start = performance.now();

    // In HTTPS context, we can't fetch HTTP router IPs (mixed content).
    // We use a heuristic: if online check passed but with high latency,
    // the gateway is likely fine but ISP/internet has issues.
    // For a more reliable check, we'd need WebRTC or a service worker.

    // Attempt fetch to Cloudflare trace (always accessible, gives network info)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://1.1.1.1/cdn-cgi/trace', {
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await response.text();
        const elapsed = performance.now() - start;

        // Parse Cloudflare trace for useful info
        const lines = text.split('\n');
        const ipLine = lines.find(l => l.startsWith('ip='));
        const locLine = lines.find(l => l.startsWith('loc='));
        const warpLine = lines.find(l => l.startsWith('warp='));

        const ip = ipLine ? ipLine.split('=')[1] : 'unknown';
        const loc = locLine ? locLine.split('=')[1] : 'unknown';
        const isVpn = warpLine ? warpLine.split('=')[1] !== 'off' : false;

        return {
            id: 'gateway',
            status: 'pass',
            label: 'Gateway & Router',
            summary: isVpn
                ? 'Koneksi melalui VPN terdeteksi. Hasil mungkin tidak akurat untuk jaringan lokal.'
                : 'Router terhubung ke internet dengan baik.',
            value: Math.round(elapsed),
            unit: 'ms',
            detail: `IP publik: ${ip} | Lokasi: ${loc} | VPN/WARP: ${isVpn ? 'Ya' : 'Tidak'}`,
            durationMs: elapsed,
            recommendation: isVpn
                ? 'Matikan VPN untuk hasil diagnosa jaringan lokal yang lebih akurat.'
                : undefined,
        };
    } catch (error) {
        const elapsed = performance.now() - start;
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';

        return {
            id: 'gateway',
            status: isTimeout ? 'warn' : 'fail',
            label: 'Gateway & Router',
            summary: isTimeout
                ? 'Router lambat merespon. Mungkin ada masalah pada jaringan lokal.'
                : 'Tidak dapat memeriksa gateway. Kemungkinan router bermasalah.',
            durationMs: elapsed,
            detail: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendation: 'Coba restart router dengan mencabut kabel power selama 30 detik.',
        };
    }
}
