// ============================================
// ISP Latency Measurement
// ============================================
// Performs multiple fetch requests to reliable public
// endpoints and calculates average/median latency.
// Uses multiple samples for accuracy.
// ============================================

import type { TestResult } from './types';

/** Endpoints for latency measurement (reliable, global CDN) */
const LATENCY_ENDPOINTS = [
    'https://www.google.com/generate_204',
    'https://1.1.1.1/cdn-cgi/trace',
    'https://www.gstatic.com/generate_204',
];

/** Single ping via fetch timing */
async function singlePing(url: string, timeout: number): Promise<number | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const start = performance.now();

    try {
        await fetch(url, {
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return performance.now() - start;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

/** Calculate median of an array of numbers */
function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Measure ISP latency to multiple endpoints.
 * Takes 3 samples per endpoint, uses median for accuracy.
 */
export async function checkLatency(): Promise<TestResult> {
    const start = performance.now();
    const allSamples: number[] = [];
    const perEndpoint: { url: string; samples: number[] }[] = [];

    for (const url of LATENCY_ENDPOINTS) {
        const samples: number[] = [];

        for (let i = 0; i < 3; i++) {
            const result = await singlePing(url, 5000);
            if (result !== null) {
                samples.push(result);
            }
            // Small delay between pings to avoid burst
            if (i < 2) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        perEndpoint.push({ url, samples });
        allSamples.push(...samples);
    }

    const elapsed = performance.now() - start;

    // No samples at all — complete failure
    if (allSamples.length === 0) {
        return {
            id: 'latency',
            status: 'fail',
            label: 'Kecepatan Respon (Latency)',
            summary: 'Tidak dapat mengukur latency. Semua server tidak merespon.',
            durationMs: elapsed,
            detail: 'Semua ping ke Google, Cloudflare, dan gstatic timeout.',
            recommendation: 'Koneksi internet kemungkinan terputus total. Restart router atau hubungi ISP.',
        };
    }

    const medianLatency = median(allSamples);
    const avgLatency = allSamples.reduce((a, b) => a + b, 0) / allSamples.length;
    const minLatency = Math.min(...allSamples);
    const maxLatency = Math.max(...allSamples);
    const successRate = Math.round((allSamples.length / (LATENCY_ENDPOINTS.length * 3)) * 100);

    // Build detail string
    const detailParts = perEndpoint.map(e => {
        const host = new URL(e.url).hostname;
        if (e.samples.length === 0) return `${host}: timeout`;
        const med = Math.round(median(e.samples));
        return `${host}: ${med}ms (${e.samples.length}/3 sukses)`;
    });

    // Classify latency
    if (medianLatency > 500) {
        return {
            id: 'latency',
            status: 'fail',
            label: 'Kecepatan Respon (Latency)',
            summary: 'Latency sangat tinggi! Koneksi ke ISP sangat lambat.',
            value: Math.round(medianLatency),
            unit: 'ms',
            durationMs: elapsed,
            detail: `Median: ${Math.round(medianLatency)}ms | Avg: ${Math.round(avgLatency)}ms | Min: ${Math.round(minLatency)}ms | Max: ${Math.round(maxLatency)}ms | Success: ${successRate}%\n${detailParts.join(' | ')}`,
            recommendation: 'ISP Anda kemungkinan sedang gangguan. Coba hubungi provider internet Anda.',
        };
    }

    if (medianLatency > 200) {
        return {
            id: 'latency',
            status: 'warn',
            label: 'Kecepatan Respon (Latency)',
            summary: 'Latency cukup tinggi. Koneksi terasa lambat untuk browsing dan video call.',
            value: Math.round(medianLatency),
            unit: 'ms',
            durationMs: elapsed,
            detail: `Median: ${Math.round(medianLatency)}ms | Avg: ${Math.round(avgLatency)}ms | Min: ${Math.round(minLatency)}ms | Max: ${Math.round(maxLatency)}ms | Success: ${successRate}%\n${detailParts.join(' | ')}`,
            recommendation: 'Coba dekatkan device ke router atau kurangi jumlah device yang terhubung.',
        };
    }

    if (medianLatency > 100) {
        return {
            id: 'latency',
            status: 'warn',
            label: 'Kecepatan Respon (Latency)',
            summary: 'Latency sedikit di atas normal. Cukup untuk browsing, mungkin kurang untuk gaming.',
            value: Math.round(medianLatency),
            unit: 'ms',
            durationMs: elapsed,
            detail: `Median: ${Math.round(medianLatency)}ms | Avg: ${Math.round(avgLatency)}ms | Min: ${Math.round(minLatency)}ms | Max: ${Math.round(maxLatency)}ms | Success: ${successRate}%\n${detailParts.join(' | ')}`,
            recommendation: 'Untuk pengalaman terbaik, pastikan tidak ada download besar berjalan di background.',
        };
    }

    // Good latency
    return {
        id: 'latency',
        status: 'pass',
        label: 'Kecepatan Respon (Latency)',
        summary: 'Latency baik! Respon server cepat.',
        value: Math.round(medianLatency),
        unit: 'ms',
        durationMs: elapsed,
        detail: `Median: ${Math.round(medianLatency)}ms | Avg: ${Math.round(avgLatency)}ms | Min: ${Math.round(minLatency)}ms | Max: ${Math.round(maxLatency)}ms | Success: ${successRate}%\n${detailParts.join(' | ')}`,
    };
}
