// ============================================
// Diagnostic Runner — Test Orchestrator
// ============================================
// Runs all diagnostic tests sequentially, emitting
// progress callbacks for real-time UI updates.
// Integrates ad-blocker detection for false-positive
// prevention. Supports AbortController for cleanup.
// ============================================

import type { DiagnosticPhase, DiagnosticReport, TestResult } from './types';
import { checkOnlineStatus, checkGateway } from './gateway';
import { checkDns } from './dns';
import { checkLatency } from './latency';
import { checkSpeed } from './speed';
import { generateVerdict } from '../logic/verdict';
import { detectBlocker, getBlockedMessage, isLikelyBlockedError } from './adblocker';
import type { BlockerCheckResult } from './adblocker';

/** Callback for progress updates */
export type ProgressCallback = (
    phase: DiagnosticPhase,
    results: TestResult[],
    blockerInfo?: BlockerCheckResult
) => void;

/** Custom error for abort signaling */
export class DiagnosticAbortError extends Error {
    constructor() {
        super('Diagnostic aborted');
        this.name = 'DiagnosticAbortError';
    }
}

/** Check if abort has been signaled, throw if so */
function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new DiagnosticAbortError();
    }
}

/**
 * Post-process a test result: if the test failed and the failure
 * pattern matches a blocker, override to 'skipped' with appropriate
 * message instead of false-positive 'fail'.
 */
function patchBlockedResult(
    result: TestResult,
    blockerInfo: BlockerCheckResult
): TestResult {
    if (
        result.status === 'fail' &&
        blockerInfo.isBlocked &&
        isLikelyBlockedError(result.id, result.detail)
    ) {
        const msg = getBlockedMessage(result.id);
        return {
            ...result,
            status: 'skipped',
            summary: msg.summary,
            recommendation: msg.recommendation,
            detail: `[Blocker: ${blockerInfo.blockerType}] ${result.detail || ''}`,
        };
    }
    return result;
}

/**
 * Run the full diagnostic suite sequentially.
 * 1. Pre-flight: detect blockers
 * 2. Run tests with blocker-aware result patching
 * 3. Generate verdict
 */
export async function runDiagnostics(
    onProgress: ProgressCallback,
    signal?: AbortSignal
): Promise<DiagnosticReport> {
    const startTime = performance.now();
    const results: TestResult[] = [];

    // --- Pre-flight: detect blockers ---
    throwIfAborted(signal);
    const blockerInfo = await detectBlocker();

    // --- Step 1: Online baseline check ---
    throwIfAborted(signal);
    onProgress('checking_online', results, blockerInfo);
    const onlineResult = await checkOnlineStatus();
    results.push(patchBlockedResult(onlineResult, blockerInfo));

    // Short-circuit if completely offline (and NOT just blocked)
    if (onlineResult.status === 'fail' && !blockerInfo.isBlocked) {
        onProgress('error_offline', results, blockerInfo);
        return {
            timestamp: Date.now(),
            phase: 'error_offline',
            results,
            verdict: generateVerdict(results),
            totalDurationMs: performance.now() - startTime,
        };
    }

    // --- Step 2: Gateway/Router check ---
    throwIfAborted(signal);
    onProgress('checking_gateway', [...results], blockerInfo);
    const gatewayResult = await checkGateway();
    results.push(patchBlockedResult(gatewayResult, blockerInfo));

    // --- Step 3: DNS resolution test ---
    throwIfAborted(signal);
    onProgress('checking_dns', [...results], blockerInfo);
    const dnsResult = await checkDns();
    results.push(patchBlockedResult(dnsResult, blockerInfo));

    // --- Step 4: ISP Latency measurement ---
    throwIfAborted(signal);
    onProgress('checking_latency', [...results], blockerInfo);
    const latencyResult = await checkLatency();
    results.push(patchBlockedResult(latencyResult, blockerInfo));

    // --- Step 5: Download speed test ---
    throwIfAborted(signal);
    onProgress('checking_speed', [...results], blockerInfo);
    const speedResult = await checkSpeed();
    results.push(patchBlockedResult(speedResult, blockerInfo));

    // --- Step 6: Analyze and generate verdict ---
    throwIfAborted(signal);
    onProgress('analyzing', [...results], blockerInfo);
    const verdict = generateVerdict(results);

    const report: DiagnosticReport = {
        timestamp: Date.now(),
        phase: 'done',
        results,
        verdict,
        totalDurationMs: performance.now() - startTime,
    };

    onProgress('done', [...results], blockerInfo);
    return report;
}
