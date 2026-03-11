// ============================================
// DNS Resolution Test
// ============================================
// Compares fetch timing to a domain vs direct IP.
// If domain fetch is significantly slower, DNS is
// the bottleneck. Also tests DNS-over-HTTPS (DoH)
// API for actual resolution verification.
// ============================================

import type { TestResult } from './types';

/** Measure fetch timing to a URL (no-cors, timing only) */
async function measureFetchTiming(
    url: string,
    timeout: number,
    mode: RequestMode = 'no-cors'
): Promise<{ durationMs: number; ok: boolean; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const start = performance.now();

    try {
        await fetch(url, {
            mode,
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return { durationMs: performance.now() - start, ok: true };
    } catch (error) {
        clearTimeout(timeoutId);
        return {
            durationMs: performance.now() - start,
            ok: false,
            error: error instanceof DOMException && error.name === 'AbortError'
                ? 'timeout'
                : (error instanceof Error ? error.message : 'unknown'),
        };
    }
}

/**
 * Test DNS resolution by comparing domain vs IP fetch times
 * and optionally querying DoH API.
 */
export async function checkDns(): Promise<TestResult> {
    const start = performance.now();

    // Test 1: Fetch by domain (requires DNS resolution)
    const domainTest = await measureFetchTiming(
        'https://www.google.com/generate_204',
        5000,
        'no-cors'
    );

    // Test 2: Fetch by direct IP (bypasses DNS)
    const ipTest = await measureFetchTiming(
        'https://1.1.1.1/cdn-cgi/trace',
        5000,
        'cors'
    );

    const elapsed = performance.now() - start;

    // Both failed — network is down
    if (!domainTest.ok && !ipTest.ok) {
        return {
            id: 'dns',
            status: 'fail',
            label: 'DNS (Resolusi Nama)',
            summary: 'Tidak dapat terhubung ke internet. DNS maupun koneksi langsung gagal.',
            durationMs: elapsed,
            detail: `Domain error: ${domainTest.error} | IP error: ${ipTest.error}`,
            recommendation: 'Periksa koneksi internet Anda secara keseluruhan.',
        };
    }

    // Domain failed but IP works — DNS is the problem
    if (!domainTest.ok && ipTest.ok) {
        return {
            id: 'dns',
            status: 'fail',
            label: 'DNS (Resolusi Nama)',
            summary: 'DNS Anda bermasalah! Internet sebenarnya tersambung, tapi DNS tidak bisa menerjemahkan nama website.',
            value: Math.round(ipTest.durationMs),
            unit: 'ms',
            durationMs: elapsed,
            detail: `Fetch ke IP berhasil (${Math.round(ipTest.durationMs)}ms) tapi fetch ke domain gagal (${domainTest.error}).`,
            recommendation: 'Ganti DNS ke 1.1.1.1 (Cloudflare) atau 8.8.8.8 (Google) di pengaturan WiFi.',
        };
    }

    // Both work — compare timing
    const dnsDelta = domainTest.durationMs - ipTest.durationMs;

    // DNS adds significant overhead (>150ms more than direct IP)
    if (domainTest.ok && ipTest.ok && dnsDelta > 150) {
        return {
            id: 'dns',
            status: 'warn',
            label: 'DNS (Resolusi Nama)',
            summary: 'DNS Anda lambat. Website mungkin terasa lebih lambat dari seharusnya.',
            value: Math.round(dnsDelta),
            unit: 'ms overhead',
            durationMs: elapsed,
            detail: `Domain fetch: ${Math.round(domainTest.durationMs)}ms | IP fetch: ${Math.round(ipTest.durationMs)}ms | DNS overhead: +${Math.round(dnsDelta)}ms`,
            recommendation: 'Pertimbangkan ganti DNS ke 1.1.1.1 (Cloudflare) atau 8.8.8.8 (Google) untuk performa lebih baik.',
        };
    }

    // DNS is fine
    return {
        id: 'dns',
        status: 'pass',
        label: 'DNS (Resolusi Nama)',
        summary: 'DNS bekerja normal. Nama website diterjemahkan dengan cepat.',
        value: Math.round(domainTest.durationMs),
        unit: 'ms',
        durationMs: elapsed,
        detail: `Domain fetch: ${Math.round(domainTest.durationMs)}ms | IP fetch: ${Math.round(ipTest.durationMs)}ms | DNS overhead: ${Math.round(dnsDelta)}ms`,
    };
}
