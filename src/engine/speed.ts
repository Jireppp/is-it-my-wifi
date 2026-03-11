// ============================================
// Download Speed Test
// ============================================
// Downloads a known-size payload from Cloudflare's
// speed test CDN and calculates throughput.
// Uses multiple sizes for progressive measurement.
// ============================================

import type { TestResult } from './types';

/** Download a payload and measure throughput */
async function downloadTest(
    bytes: number,
    timeout: number
): Promise<{ durationMs: number; bytesReceived: number; ok: boolean; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const start = performance.now();

    try {
        const response = await fetch(
            `https://speed.cloudflare.com/__down?bytes=${bytes}&cachebust=${Date.now()}`,
            {
                cache: 'no-store',
                signal: controller.signal,
            }
        );

        if (!response.ok || !response.body) {
            clearTimeout(timeoutId);
            return { durationMs: performance.now() - start, bytesReceived: 0, ok: false, error: `HTTP ${response.status}` };
        }

        // Read the full response body to ensure complete download
        const reader = response.body.getReader();
        let totalBytes = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
        }

        clearTimeout(timeoutId);
        return {
            durationMs: performance.now() - start,
            bytesReceived: totalBytes,
            ok: true,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        return {
            durationMs: performance.now() - start,
            bytesReceived: 0,
            ok: false,
            error: error instanceof DOMException && error.name === 'AbortError'
                ? 'timeout'
                : (error instanceof Error ? error.message : 'unknown'),
        };
    }
}

/** Convert bytes/ms to Mbps */
function toMbps(bytes: number, durationMs: number): number {
    if (durationMs <= 0) return 0;
    const bits = bytes * 8;
    const seconds = durationMs / 1000;
    return bits / seconds / 1_000_000;
}

/**
 * Measure download speed using Cloudflare's speed test endpoint.
 * Progressive: starts small (100KB), then larger if fast enough.
 */
export async function checkSpeed(): Promise<TestResult> {
    const start = performance.now();

    // Start with small payload (100KB)
    const smallTest = await downloadTest(100_000, 10000);

    if (!smallTest.ok) {
        const elapsed = performance.now() - start;
        return {
            id: 'speed',
            status: 'fail',
            label: 'Kecepatan Download',
            summary: smallTest.error === 'timeout'
                ? 'Download terlalu lambat. Tidak selesai dalam batas waktu.'
                : 'Tidak dapat melakukan tes kecepatan download.',
            durationMs: elapsed,
            detail: `Download 100KB gagal: ${smallTest.error}`,
            recommendation: smallTest.error === 'timeout'
                ? 'Koneksi sangat lambat. Coba restart router atau hubungi ISP Anda.'
                : 'Tes kecepatan mungkin diblokir oleh ad-blocker. Coba matikan ad-blocker dan tes ulang.',
        };
    }

    const smallSpeed = toMbps(smallTest.bytesReceived, smallTest.durationMs);
    let finalSpeed = smallSpeed;
    let detailParts = [`100KB: ${smallSpeed.toFixed(2)} Mbps (${Math.round(smallTest.durationMs)}ms)`];

    // If small test was fast (<2s), try a larger payload for more accurate result
    if (smallTest.durationMs < 2000) {
        const largeTest = await downloadTest(1_000_000, 15000);
        if (largeTest.ok) {
            const largeSpeed = toMbps(largeTest.bytesReceived, largeTest.durationMs);
            finalSpeed = largeSpeed; // Larger sample is more accurate
            detailParts.push(`1MB: ${largeSpeed.toFixed(2)} Mbps (${Math.round(largeTest.durationMs)}ms)`);
        }
    }

    const elapsed = performance.now() - start;

    // Classify speed
    if (finalSpeed < 1) {
        return {
            id: 'speed',
            status: 'fail',
            label: 'Kecepatan Download',
            summary: 'Kecepatan sangat rendah (< 1 Mbps). Streaming dan video call akan sangat terganggu.',
            value: parseFloat(finalSpeed.toFixed(2)),
            unit: 'Mbps',
            durationMs: elapsed,
            detail: detailParts.join(' | '),
            recommendation: 'Bandwidth sangat terbatas. Kemungkinan terlalu banyak device, ISP throttling, atau paket internet Anda perlu di-upgrade.',
        };
    }

    if (finalSpeed < 5) {
        return {
            id: 'speed',
            status: 'warn',
            label: 'Kecepatan Download',
            summary: 'Kecepatan rendah. Bisa browsing, tapi video HD dan video call mungkin tersendat.',
            value: parseFloat(finalSpeed.toFixed(2)),
            unit: 'Mbps',
            durationMs: elapsed,
            detail: detailParts.join(' | '),
            recommendation: 'Kurangi jumlah device yang streaming video. Pertimbangkan upgrade paket internet.',
        };
    }

    if (finalSpeed < 25) {
        return {
            id: 'speed',
            status: 'pass',
            label: 'Kecepatan Download',
            summary: 'Kecepatan cukup baik untuk browsing dan streaming SD/HD.',
            value: parseFloat(finalSpeed.toFixed(2)),
            unit: 'Mbps',
            durationMs: elapsed,
            detail: detailParts.join(' | '),
        };
    }

    return {
        id: 'speed',
        status: 'pass',
        label: 'Kecepatan Download',
        summary: `Kecepatan sangat baik! ${finalSpeed >= 100 ? 'Cocok untuk gaming dan 4K streaming.' : 'Cukup untuk semua aktivitas online.'}`,
        value: parseFloat(finalSpeed.toFixed(2)),
        unit: 'Mbps',
        durationMs: elapsed,
        detail: detailParts.join(' | '),
    };
}
