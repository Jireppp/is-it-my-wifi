// ============================================
// Ad-Blocker & Request Blocker Detection
// ============================================
// Detects if browser extensions (ad-blockers, privacy
// tools) are blocking our diagnostic fetch requests.
// Uses canary requests to distinguish between:
//   - "Internet is down" vs "Ad-blocker blocked the request"
// ============================================

import type { TestId } from './types';

/** Result of a blocker detection check */
export interface BlockerCheckResult {
    /** Whether a blocker was detected */
    isBlocked: boolean;
    /** Which type of blocker was likely detected */
    blockerType: 'adblocker' | 'firewall' | 'vpn' | 'none';
    /** Human-readable explanation */
    message: string;
}

/**
 * Canary endpoints for blocker detection.
 * Strategy: Use multiple endpoints with different risk profiles.
 * If some work and others don't, it's likely a blocker, not offline.
 */
const CANARY_ENDPOINTS = [
    // Low risk — almost never blocked by ad-blockers
    { url: 'https://www.google.com/generate_204', risk: 'low' as const },
    // Medium risk — some privacy-focused blockers block Cloudflare
    { url: 'https://1.1.1.1/cdn-cgi/trace', risk: 'medium' as const },
    // Higher risk — speed test domains are commonly blocked
    { url: 'https://speed.cloudflare.com/__down?bytes=1', risk: 'high' as const },
];

/** Quick canary fetch — just check if a URL is reachable */
async function canaryFetch(url: string, timeoutMs = 3000): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        await fetch(url, {
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return true;
    } catch {
        return false;
    }
}

/**
 * Run all canary checks in parallel.
 * Returns which endpoints are reachable.
 */
async function runCanaryChecks(): Promise<{
    low: boolean;
    medium: boolean;
    high: boolean;
}> {
    const [low, medium, high] = await Promise.all(
        CANARY_ENDPOINTS.map(ep => canaryFetch(ep.url))
    );
    return { low, medium, high };
}

/**
 * Detect if a request failure is likely due to a blocker.
 * Call this AFTER a diagnostic test fails to determine the cause.
 *
 * Decision matrix:
 * | Low | Med | High | Verdict |
 * |-----|-----|------|---------|
 * |  ✅ |  ✅ |  ❌  | Ad-blocker (blocks speed test domain) |
 * |  ✅ |  ❌ |  ❌  | Aggressive blocker (blocks Cloudflare) |
 * |  ❌ |  ❌ |  ❌  | Actually offline |
 * |  ✅ |  ✅ |  ✅  | No blocker (test failure is genuine) |
 */
export async function detectBlocker(): Promise<BlockerCheckResult> {
    const canary = await runCanaryChecks();

    // All reachable — no blocker detected, failure is genuine
    if (canary.low && canary.medium && canary.high) {
        return {
            isBlocked: false,
            blockerType: 'none',
            message: 'Tidak ada blocker terdeteksi.',
        };
    }

    // None reachable — actually offline
    if (!canary.low && !canary.medium && !canary.high) {
        return {
            isBlocked: false,
            blockerType: 'none',
            message: 'Koneksi internet tidak tersedia.',
        };
    }

    // Low works, but medium/high blocked — ad-blocker
    if (canary.low && !canary.high) {
        return {
            isBlocked: true,
            blockerType: 'adblocker',
            message: canary.medium
                ? 'Ad-blocker terdeteksi memblokir tes kecepatan. Hasil tes kecepatan download mungkin tidak tersedia.'
                : 'Ad-blocker agresif terdeteksi. Beberapa tes mungkin diblokir.',
        };
    }

    // Edge case: only low blocked (unusual, possibly firewall)
    if (!canary.low && canary.medium) {
        return {
            isBlocked: true,
            blockerType: 'firewall',
            message: 'Firewall atau proxy terdeteksi. Beberapa tes mungkin tidak akurat.',
        };
    }

    return {
        isBlocked: false,
        blockerType: 'none',
        message: 'Tidak ada blocker terdeteksi.',
    };
}

/**
 * Check if a specific test failure was likely caused by a blocker.
 * Uses heuristic: if the error is a network error (not timeout),
 * and we know a blocker is present, classify appropriately.
 */
export function isLikelyBlockedError(
    _testId: TestId,
    error: string | undefined
): boolean {
    if (!error) return false;

    // Typical blocked patterns
    const blockedPatterns = [
        'failed to fetch',
        'networkerror',
        'net::err_blocked',
        'err_blocked_by_client',
        'ns_error_failure',
        'load failed',
    ];

    const lowerError = error.toLowerCase();
    return blockedPatterns.some(pattern => lowerError.includes(pattern));
}

/**
 * Generate a user-friendly message when a test is blocked.
 */
export function getBlockedMessage(testId: TestId): {
    summary: string;
    recommendation: string;
} {
    const messages: Record<TestId, { summary: string; recommendation: string }> = {
        online: {
            summary: 'Tes koneksi dasar tidak bisa dijalankan. Kemungkinan diblokir oleh ekstensi browser.',
            recommendation: 'Coba nonaktifkan ad-blocker atau buka di mode Incognito.',
        },
        gateway: {
            summary: 'Tes gateway diblokir oleh ekstensi browser. Ini bukan berarti router bermasalah.',
            recommendation: 'Nonaktifkan ad-blocker untuk hasil yang akurat, atau abaikan tes ini.',
        },
        dns: {
            summary: 'Tes DNS tidak bisa dijalankan karena diblokir. DNS Anda kemungkinan baik-baik saja.',
            recommendation: 'Ad-blocker memblokir request ke server tes. Coba nonaktifkan sementara.',
        },
        latency: {
            summary: 'Tes latency diblokir. Tidak bisa mengukur kecepatan respon.',
            recommendation: 'Coba buka halaman ini di browser tanpa ad-blocker untuk tes lengkap.',
        },
        speed: {
            summary: 'Tes kecepatan download diblokir oleh ad-blocker. Ini sangat umum terjadi.',
            recommendation: 'Matikan ad-blocker untuk website ini, lalu tes ulang. Tes kecepatan sering diblokir karena mirip tracking request.',
        },
    };

    return messages[testId] || {
        summary: 'Tes ini diblokir oleh ekstensi browser.',
        recommendation: 'Coba nonaktifkan ad-blocker dan tes ulang.',
    };
}
