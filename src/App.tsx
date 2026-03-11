import { useState } from 'react';
import { useDiagnostic } from './hooks/useDiagnostic';
import { STATUS_DISPLAY, SEVERITY_DISPLAY, TEST_LABELS } from './logic/microcopy';
import type { TestResult } from './engine/types';
import './App.css';

// ─── Test Result Card ─────
function TestCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_DISPLAY[result.status];
  const testMeta = TEST_LABELS[result.id];

  return (
    <div
      className="testCard"
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      aria-expanded={expanded}
      aria-label={`${testMeta.name}: ${status.label}`}
    >
      <div className="testCardHeader">
        <span className="statusIcon" aria-hidden="true">{status.icon}</span>
        <span className="testLabel">{testMeta.icon} {result.label}</span>
        {result.value !== undefined && (
          <span className={`testValue testValue${result.status === 'pass' ? 'Good' : result.status === 'warn' ? 'Warn' : 'Bad'}`}>
            {result.value} {result.unit}
          </span>
        )}
        <span className="expandHint" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="testSummary">{result.summary}</div>

      {expanded && (
        <>
          {result.detail && (
            <div className="testDetail">{result.detail}</div>
          )}
          {result.recommendation && (
            <div className="testRecommendation">
              <span aria-hidden="true">💡</span>
              <span>{result.recommendation}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Skeleton Loader (shown during phases) ─────
function SkeletonCard() {
  return (
    <div className="testCard skeletonCard" aria-hidden="true">
      <div className="testCardHeader">
        <span className="statusIcon">⏳</span>
        <span className="testLabel skeletonText" />
        <span className="testValue skeletonText skeletonShort" />
      </div>
      <div className="testSummary skeletonText" />
    </div>
  );
}

// ─── Main App ─────
function App() {
  const {
    phase,
    results,
    verdict,
    report,
    isRunning,
    error,
    blockerDetected,
    startDiagnostic,
    reset,
    phaseLabel,
    phaseDescription,
    progress,
  } = useDiagnostic();

  const isDone = phase === 'done' || phase === 'error_offline';

  // How many tests are pending (show as skeleton)
  const totalTests = 5;
  const pendingCount = isRunning ? Math.max(0, totalTests - results.length) : 0;

  return (
    <div className="app">
      {/* ── Hero Section ── */}
      <header className="header">
        <div className="logo" aria-hidden="true">📡</div>
        <h1 className="title">Is It My WiFi?</h1>
        <p className="subtitle">
          Diagnosa koneksi internet Anda dalam hitungan detik.
          <br />
          Cukup satu klik untuk tahu masalahnya.
        </p>
      </header>

      {/* ── Main Content ── */}
      <main className="main">
        {/* ── Diagnostic Button ── */}
        <section className="diagnoseSection" aria-label="Kontrol diagnosa">
          <button
            id="diagnose-button"
            className={`diagnoseBtn ${isRunning ? 'diagnoseBtnRunning' : ''}`}
            onClick={isDone ? () => { reset(); setTimeout(startDiagnostic, 50); } : startDiagnostic}
            disabled={isRunning}
            aria-busy={isRunning}
          >
            {isRunning ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>{phaseLabel}</span>
              </>
            ) : isDone ? (
              <>
                <span className="btnIcon" aria-hidden="true">🔄</span>
                <span>Tes Ulang</span>
              </>
            ) : (
              <>
                <span className="btnIcon" aria-hidden="true">🚀</span>
                <span>Diagnosa Sekarang</span>
              </>
            )}
          </button>

          {/* ── Progress Bar ── */}
          {isRunning && (
            <div className="progressSection" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="progressBar">
                <div className="progressFill" style={{ width: `${progress}%` }} />
              </div>
              <div className="phaseLabel">{phaseDescription}</div>
            </div>
          )}
        </section>

        {/* ── Error Banner ── */}
        {error && (
          <div className="errorBanner" role="alert">{error}</div>
        )}

        {/* ── Blocker Warning ── */}
        {blockerDetected && isDone && (
          <div className="blockerBanner" role="status">
            ⚠️ Ad-blocker terdeteksi. Beberapa tes mungkin dilewati. Untuk hasil lengkap, matikan ad-blocker dan tes ulang.
          </div>
        )}

        {/* ── Live Progress: completed test cards + skeleton ── */}
        {isRunning && results.length > 0 && (
          <section className="resultsSection" aria-label="Progress diagnosa">
            <div className="testCards">
              {results.map((result) => (
                <TestCard key={result.id} result={result} />
              ))}
              {Array.from({ length: pendingCount }, (_, i) => (
                <SkeletonCard key={`skeleton-${i}`} />
              ))}
            </div>
          </section>
        )}

        {/* ── Final Results ── */}
        {isDone && (
          <section className="resultsSection" aria-label="Hasil diagnosa">
            {/* Verdict Banner */}
            {verdict && (
              <div className={`verdict ${SEVERITY_DISPLAY[verdict.severity].cssClass}`} role="alert">
                <div className="verdictIcon" aria-hidden="true">
                  {SEVERITY_DISPLAY[verdict.severity].icon}
                </div>
                <h2 className="verdictHeadline">{verdict.headline}</h2>
                <p className="verdictDescription">{verdict.description}</p>

                {verdict.recommendations.length > 0 && (
                  <div className="recommendations">
                    <div className="recommendationsTitle">Saran Perbaikan</div>
                    {verdict.recommendations.map((rec, i) => (
                      <div key={i} className="recommendationItem">
                        <span className="recommendationBullet" aria-hidden="true">💡</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Test Cards */}
            <div className="testCards">
              {results.map((result) => (
                <TestCard key={result.id} result={result} />
              ))}
            </div>

            {/* Duration */}
            {report && (
              <div className="duration">
                Diagnosa selesai dalam {(report.totalDurationMs / 1000).toFixed(1)} detik
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>
          Semua tes berjalan di browser Anda — tidak ada data yang dikirim ke server manapun.
        </p>
      </footer>
    </div>
  );
}

export default App;
