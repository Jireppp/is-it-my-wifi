// ============================================
// Diagnostic Engine — Type Definitions
// ============================================

/** Status of an individual test */
export type TestStatus = 'idle' | 'running' | 'pass' | 'warn' | 'fail' | 'skipped';

/** Severity level for verdict display */
export type Severity = 'good' | 'degraded' | 'bad' | 'offline';

/** Identifiers for each diagnostic test */
export type TestId = 'online' | 'gateway' | 'dns' | 'latency' | 'speed';

/** Result of a single diagnostic test */
export interface TestResult {
    id: TestId;
    status: TestStatus;
    label: string;
    /** Plain-language summary for non-technical users */
    summary: string;
    /** Measured value (e.g., latency in ms, speed in Mbps) */
    value?: number;
    /** Unit of the measured value */
    unit?: string;
    /** Detailed technical info (expandable) */
    detail?: string;
    /** Duration of the test in ms */
    durationMs: number;
    /** Actionable recommendation if issue detected */
    recommendation?: string;
}

/** Overall diagnostic phase (state machine) */
export type DiagnosticPhase =
    | 'idle'
    | 'checking_online'
    | 'checking_gateway'
    | 'checking_dns'
    | 'checking_latency'
    | 'checking_speed'
    | 'analyzing'
    | 'done'
    | 'error_offline';

/** Final verdict after all tests complete */
export interface Verdict {
    severity: Severity;
    headline: string;
    description: string;
    recommendations: string[];
}

/** Full diagnostic report */
export interface DiagnosticReport {
    timestamp: number;
    phase: DiagnosticPhase;
    results: TestResult[];
    verdict: Verdict | null;
    totalDurationMs: number;
}

/** Config for fetch-based timing tests */
export interface TimingTestConfig {
    url: string;
    timeout: number;
    mode?: RequestMode;
    label: string;
}
