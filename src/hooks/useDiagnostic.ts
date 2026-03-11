// ============================================
// useDiagnostic — React State Machine Hook
// ============================================
// Manages the full diagnostic lifecycle with
// AbortController cleanup on unmount/re-run.
// State: idle → checking_* → analyzing → done/error
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagnosticPhase, DiagnosticReport, TestResult, Verdict } from '../engine/types';
import { runDiagnostics, DiagnosticAbortError } from '../engine/runner';
import { PHASE_MICROCOPY } from '../logic/microcopy';
import { trackEvent, trackDiagnosticComplete } from '../logic/telemetry';

/** Shape of the diagnostic state */
export interface DiagnosticState {
    phase: DiagnosticPhase;
    results: TestResult[];
    verdict: Verdict | null;
    report: DiagnosticReport | null;
    isRunning: boolean;
    error: string | null;
    /** Whether an ad-blocker was detected during this run */
    blockerDetected: boolean;
}

const INITIAL_STATE: DiagnosticState = {
    phase: 'idle',
    results: [],
    verdict: null,
    report: null,
    isRunning: false,
    error: null,
    blockerDetected: false,
};

/** Phase order for progress calculation */
const PHASE_ORDER: DiagnosticPhase[] = [
    'checking_online',
    'checking_gateway',
    'checking_dns',
    'checking_latency',
    'checking_speed',
    'analyzing',
    'done',
];

/** Get progress percentage (0-100) from phase */
export function getProgress(phase: DiagnosticPhase): number {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx === -1) return 0;
    return Math.round(((idx + 1) / PHASE_ORDER.length) * 100);
}

/**
 * React hook for managing the diagnostic state machine.
 * Includes AbortController for safe cleanup on unmount.
 */
export function useDiagnostic() {
    const [state, setState] = useState<DiagnosticState>(INITIAL_STATE);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isRunningRef = useRef(false);

    // Cleanup on unmount — abort any in-flight diagnostics
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    /** Start the diagnostic process */
    const startDiagnostic = useCallback(async () => {
        // Prevent double-runs
        if (isRunningRef.current) return;

        // Abort any previous run
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create fresh AbortController for this run
        const controller = new AbortController();
        abortControllerRef.current = controller;
        isRunningRef.current = true;

        setState({
            ...INITIAL_STATE,
            phase: 'checking_online',
            isRunning: true,
        });

        // Track start event
        trackEvent('diagnostic_started');

        try {
            const report = await runDiagnostics(
                (phase, results, blockerInfo) => {
                    // Guard: don't update state if aborted
                    if (controller.signal.aborted) return;
                    setState(prev => ({
                        ...prev,
                        phase,
                        results: [...results],
                        blockerDetected: blockerInfo?.isBlocked || prev.blockerDetected,
                    }));

                    // Track blocker detection once
                    if (blockerInfo?.isBlocked) {
                        trackEvent('blocker_detected', { blockerType: blockerInfo.blockerType });
                    }
                },
                controller.signal
            );

            // Guard: don't update state if aborted during analysis
            if (controller.signal.aborted) return;

            setState(prev => ({
                phase: report.phase,
                results: report.results,
                verdict: report.verdict,
                report,
                isRunning: false,
                error: null,
                blockerDetected: prev.blockerDetected,
            }));

            // Track completion with stats
            trackDiagnosticComplete(report);
        } catch (err) {
            // Silently ignore abort errors (expected on unmount/re-run)
            if (err instanceof DiagnosticAbortError || controller.signal.aborted) {
                return;
            }

            const message = err instanceof Error
                ? err.message
                : 'Terjadi kesalahan yang tidak terduga.';

            setState(prev => ({
                ...prev,
                phase: 'done',
                isRunning: false,
                error: `Diagnosa gagal: ${message}. Coba muat ulang halaman dan tes kembali.`,
            }));

            trackEvent('diagnostic_error', { errorMessage: message });
        } finally {
            isRunningRef.current = false;
        }
    }, []);

    /** Reset state back to idle */
    const reset = useCallback(() => {
        // Abort any in-flight run
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        isRunningRef.current = false;
        setState(INITIAL_STATE);
    }, []);

    // Derive display values from microcopy
    const phaseMicro = PHASE_MICROCOPY[state.phase];

    return {
        ...state,
        startDiagnostic,
        reset,
        phaseLabel: phaseMicro.label,
        phaseDescription: phaseMicro.description,
        progress: getProgress(state.phase),
    };
}
