// ============================================
// Lightweight Telemetry — Event Tracking Wrapper
// ============================================
// Abstraction layer for product analytics.
// Tracks only essential events for portfolio showcase:
// - diagnostic_started
// - diagnostic_completed (with verdict severity)
// - diagnostic_error
// - blocker_detected
//
// DESIGN DECISIONS:
// - No PII collected (no IP, no geolocation stored)
// - Respects Do Not Track (navigator.doNotTrack)
// - Lazy-loaded: doesn't block initial page load
// - Provider-agnostic: swap backend without changing callsites
// ============================================

/** Supported event names */
export type TelemetryEvent =
    | 'diagnostic_started'
    | 'diagnostic_completed'
    | 'diagnostic_error'
    | 'blocker_detected'
    | 'test_skipped'
    | 'page_loaded';

/** Event properties (all optional, keep minimal) */
export interface TelemetryProperties {
    /** Verdict severity (good/degraded/bad/offline) */
    severity?: string;
    /** Total diagnostic duration in ms */
    durationMs?: number;
    /** Number of tests that passed */
    passCount?: number;
    /** Number of tests that failed */
    failCount?: number;
    /** Number of tests skipped (blocked) */
    skipCount?: number;
    /** Type of blocker detected */
    blockerType?: string;
    /** Error message (sanitized, no PII) */
    errorMessage?: string;
    /** Which test was skipped */
    testId?: string;
}

/** Whether telemetry is enabled */
function isTelemetryEnabled(): boolean {
    // Respect Do Not Track
    if (navigator.doNotTrack === '1') return false;

    // Check for opt-out flag (user can set this in console)
    try {
        if (localStorage.getItem('iimw_optout') === '1') return false;
    } catch {
        // localStorage might be blocked
    }

    return true;
}

/**
 * Track an event.
 *
 * Current implementation: console.log (development).
 * In production, replace the body with your analytics provider:
 *
 * @example
 * // Vercel Analytics
 * import { track } from '@vercel/analytics';
 * track(event, properties);
 *
 * // PostHog
 * posthog.capture(event, properties);
 *
 * // Google Analytics
 * gtag('event', event, properties);
 */
export function trackEvent(
    event: TelemetryEvent,
    properties?: TelemetryProperties
): void {
    if (!isTelemetryEnabled()) return;

    // --- Development: log to console ---
    if (import.meta.env.DEV) {
        console.log(
            `%c[Telemetry] ${event}`,
            'color: #38bdf8; font-weight: bold;',
            properties || ''
        );
        return;
    }

    // --- Production: send to analytics provider ---
    // Uncomment ONE of the following when you add a provider:

    // Option 1: Vercel Analytics (recommended for Vercel deploys)
    // import { track } from '@vercel/analytics';
    // track(event, properties);

    // Option 2: Beacon API (lightweight, fire-and-forget)
    try {
        const payload = JSON.stringify({
            event,
            properties,
            timestamp: Date.now(),
            url: window.location.pathname,
        });

        // Send via Beacon API (doesn't block page unload)
        if ('sendBeacon' in navigator) {
            // Replace URL with your analytics endpoint
            // navigator.sendBeacon('/api/telemetry', payload);
            void payload; // no-op until endpoint configured
        }
    } catch {
        // Silently fail — telemetry should never crash the app
    }
}

/**
 * Track diagnostic completion with summary stats.
 * Call this after a diagnostic run finishes.
 */
export function trackDiagnosticComplete(report: {
    verdict?: { severity: string } | null;
    results: { status: string; id: string }[];
    totalDurationMs: number;
}): void {
    const passCount = report.results.filter(r => r.status === 'pass').length;
    const failCount = report.results.filter(r => r.status === 'fail').length;
    const skipCount = report.results.filter(r => r.status === 'skipped').length;

    trackEvent('diagnostic_completed', {
        severity: report.verdict?.severity || 'unknown',
        durationMs: Math.round(report.totalDurationMs),
        passCount,
        failCount,
        skipCount,
    });

    // Track each skipped test individually (blocker signal)
    report.results
        .filter(r => r.status === 'skipped')
        .forEach(r => {
            trackEvent('test_skipped', { testId: r.id });
        });
}
