import type { DashboardDocument } from "./report-types";

/**
 * Optional presentation settings. Every default preserves the original
 * Playwright dashboard so existing reports and tests keep their behavior.
 */
export type DashboardSettings = {
  title?: string;
  eyebrow?: string;
  reportLabel?: string;
  /** Set to null to hide the primary report link. */
  reportHref?: string | null;
  /** Set to null to hide the trace viewer link. */
  traceViewerHref?: string | null;
  traceViewerLabel?: string;
  traceHelp?: string;
  timezone?: string;
  timezoneLabel?: string;
  timezoneOffset?: string;
  timestampsLabel?: string;
  runtimeLabel?: string;
  variantColumnLabel?: string;
};

const DEFAULT_DASHBOARD_SETTINGS = {
  title: "Playwright Execution Dashboard",
  eyebrow: "Playwright execution intelligence",
  reportLabel: "Playwright report",
  reportHref: "../playwright-report/index.html",
  traceViewerHref: "https://trace.playwright.dev/",
  traceViewerLabel: "Trace Viewer",
  traceHelp:
    "Open this ZIP with the Trace Viewer button or: npx playwright show-trace <trace.zip>",
  timezone: "Asia/Kolkata",
  timezoneLabel: "IST",
  timezoneOffset: "UTC+05:30",
  timestampsLabel: "IST timestamps",
  runtimeLabel: "Node.js",
  variantColumnLabel: "Project / Browser",
} as const;

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createDashboard(
  report: DashboardDocument,
  settings: DashboardSettings = {},
): string {
  const resolved = { ...DEFAULT_DASHBOARD_SETTINGS, ...settings };
  const serializedReport = safeJson(report);
  const actionLinks = [
    resolved.reportHref
      ? `        <a class="button" href="${escapeHtml(resolved.reportHref)}">${escapeHtml(resolved.reportLabel)} <span>↗</span></a>`
      : "",
    resolved.traceViewerHref
      ? `        <a class="button" href="${escapeHtml(resolved.traceViewerHref)}" target="_blank" rel="noreferrer">${escapeHtml(resolved.traceViewerLabel)} <span>↗</span></a>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(resolved.title)} — ${report.run.id}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #08111f;
      --surface: #101c2e;
      --surface-2: #17263b;
      --border: #2a3d56;
      --text: #e8f0fa;
      --muted: #9eb0c6;
      --accent: #67e8f9;
      --passed: #34d399;
      --failed: #fb7185;
      --skipped: #94a3b8;
      --flaky: #fbbf24;
      --shadow: 0 16px 45px rgba(0, 0, 0, .28);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at 10% 0%, #12314c 0, transparent 36%), var(--bg); color: var(--text); }
    a { color: var(--accent); }
    button, input, select { font: inherit; }
    button { cursor: pointer; }
    .container { width: min(1500px, calc(100% - 32px)); margin: 0 auto; }
    .hero { padding: 18px 0 16px; border-bottom: 1px solid var(--border); background: rgba(8, 17, 31, .55); }
    .hero-row { display: flex; justify-content: space-between; gap: 20px; align-items: center; }
    .hero-copy { min-width: 0; }
    .eyebrow { color: var(--accent); font-size: 10px; letter-spacing: .15em; text-transform: uppercase; font-weight: 800; }
    h1 { margin: 4px 0 5px; font-size: clamp(24px, 3vw, 34px); line-height: 1.1; letter-spacing: -.025em; }
    .subtitle { margin: 0; color: var(--muted); font-size: 13px; }
    .header-facts { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 9px; color: var(--muted); font-size: 12px; }
    .header-facts strong { color: var(--text); font-weight: 700; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; flex: 0 0 auto; }
    .button { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--surface-2); color: var(--text); text-decoration: none; font-size: 12px; font-weight: 700; }
    .button:hover, .button:focus-visible { border-color: var(--accent); outline: none; }
    .button span { color: var(--accent); margin-left: 4px; }
    main { padding: 14px 0 48px; }
    .cards { display: grid; grid-template-columns: repeat(6, minmax(105px, 1fr)); gap: 8px; }
    .card, .panel { background: linear-gradient(150deg, rgba(23, 38, 59, .96), rgba(12, 24, 40, .96)); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); }
    .card { --metric-color: var(--accent); position: relative; overflow: hidden; padding: 11px 13px; text-align: left; color: var(--text); }
    .card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--metric-color); }
    .metric-total { --metric-color: var(--accent); }
    .metric-passed { --metric-color: var(--passed); }
    .metric-failed { --metric-color: var(--failed); }
    .metric-skipped { --metric-color: var(--skipped); }
    .metric-flaky { --metric-color: var(--flaky); }
    .metric-rate { --metric-color: #a78bfa; }
    button.card:hover, button.card:focus-visible { border-color: var(--metric-color); outline: none; transform: translateY(-1px); }
    .card-label { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .09em; }
    .card-value { display: block; font-size: 24px; line-height: 1; font-weight: 800; margin-top: 5px; }
    .panel { padding: 16px; margin-top: 12px; }
    .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .panel h2, .panel-head h2 { margin: 0; font-size: 17px; letter-spacing: -.01em; }
    .panel-head p { color: var(--muted); font-size: 12px; margin: 0; }
    .health-panel { margin-top: 9px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: rgba(16, 28, 46, .82); }
    .health-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .health-head h2 { margin: 0; font-size: 14px; }
    .health-head p { margin: 0; color: var(--muted); font-size: 12px; }
    .health-bar { display: flex; width: 100%; height: 9px; overflow: hidden; border-radius: 999px; background: #25354a; }
    .health-segment { min-width: 3px; height: 100%; padding: 0; border: 0; border-right: 2px solid var(--surface); }
    .health-segment:last-child { border-right: 0; }
    .health-segment:hover, .health-segment:focus-visible { filter: brightness(1.25); outline: 2px solid var(--text); outline-offset: -2px; }
    .health-note { margin: 7px 0 0; color: var(--muted); font-size: 11px; }
    .environment-details { margin-top: 9px; border: 1px solid var(--border); border-radius: 10px; background: rgba(11, 23, 40, .68); }
    .environment-details summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 12px; cursor: pointer; font-size: 12px; font-weight: 800; list-style: none; }
    .environment-details summary::-webkit-details-marker { display: none; }
    .environment-details summary::after { content: "+"; color: var(--accent); font-size: 17px; font-weight: 400; }
    .environment-details[open] summary::after { content: "−"; }
    .environment-details summary small { color: var(--muted); font-weight: 400; margin-left: auto; }
    .environment-details[open] summary { border-bottom: 1px solid var(--border); }
    .metadata { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px; }
    .meta-item { padding: 9px 10px; background: rgba(8,17,31,.5); border-radius: 8px; min-width: 0; }
    .meta-item span { display: block; color: var(--muted); font-size: 10px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .05em; }
    .meta-item strong { overflow-wrap: anywhere; font-size: 12px; }
    .filters { display: grid; grid-template-columns: 1.4fr repeat(6, minmax(130px, 1fr)) auto; gap: 8px; }
    .search-field { min-width: 180px; }
    input, select { width: 100%; min-height: 38px; border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; color: var(--text); background: #0b1728; }
    input:focus, select:focus { border-color: var(--accent); outline: none; }
    .clear { border: 1px solid var(--border); border-radius: 9px; padding: 8px 11px; color: var(--text); background: var(--surface-2); white-space: nowrap; }
    .clear:hover, .clear:focus-visible { border-color: var(--accent); outline: none; }
    .scope-note { margin: 10px 0 0; color: var(--muted); font-size: 12px; }
    .drill-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr)); gap: 9px; }
    .drill-card { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; color: var(--text); background: rgba(8,17,31,.45); text-align: left; }
    .drill-card:hover, .drill-card:focus-visible { border-color: var(--accent); outline: none; }
    .drill-card.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
    .drill-card strong { display: block; overflow-wrap: anywhere; }
    .drill-card p { color: var(--muted); margin: 7px 0 0; font-size: 12px; line-height: 1.5; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; min-width: 900px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; background: rgba(8,17,31,.7); }
    tbody tr.clickable { cursor: pointer; }
    tbody tr.clickable:hover, tbody tr.clickable:focus { background: rgba(103,232,249,.06); outline: none; }
    tbody tr:last-child td { border-bottom: 0; }
    .path { display: block; color: var(--muted); font-size: 11px; margin-top: 3px; overflow-wrap: anywhere; }
    .status { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .status-passed { color: #052e22; background: var(--passed); }
    .status-failed { color: #4c0519; background: var(--failed); }
    .status-skipped { color: #111827; background: var(--skipped); }
    .status-flaky { color: #422006; background: var(--flaky); }
    .insight { display: inline-flex; margin-top: 5px; border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px; color: var(--muted); font-size: 10px; }
    .insight-new { color: var(--failed); border-color: rgba(251,113,133,.5); }
    .analytics-grid { display: grid; grid-template-columns: minmax(300px, .65fr) minmax(520px, 1.35fr); gap: 12px; }
    .analytics-grid .panel { min-width: 0; }
    .chart-wrap { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .donut { width: 138px; aspect-ratio: 1; border: 0; border-radius: 50%; position: relative; background: #334155; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
    .donut::after { content: ""; position: absolute; inset: 28%; border-radius: 50%; background: var(--surface); }
    .donut-label { position: absolute; inset: 0; z-index: 1; display: grid; place-content: center; text-align: center; pointer-events: none; }
    .donut-label strong { font-size: 24px; }
    .donut-label span { font-size: 11px; color: var(--muted); text-transform: uppercase; }
    .legend { display: grid; gap: 5px; min-width: 140px; }
    .legend button { border: 1px solid transparent; background: transparent; color: var(--text); padding: 5px 7px; border-radius: 7px; text-align: left; font-size: 12px; }
    .legend button:hover, .legend button:focus-visible { border-color: var(--border); outline: none; }
    .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 8px; }
    .trend { width: 100%; height: 220px; background: rgba(8,17,31,.45); border: 1px solid var(--border); border-radius: 12px; }
    .trend text { fill: var(--muted); font-size: 11px; }
    .trend .grid { stroke: var(--border); stroke-width: 1; }
    .trend .line { fill: none; stroke: var(--accent); stroke-width: 3; }
    .trend .point { fill: var(--accent); stroke: var(--bg); stroke-width: 2; cursor: pointer; }
    dialog { width: min(1040px, calc(100% - 24px)); max-height: 90vh; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: var(--shadow); padding: 0; }
    dialog::backdrop { background: rgba(0, 0, 0, .72); backdrop-filter: blur(3px); }
    .dialog-head { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding: 18px 20px; background: var(--surface); border-bottom: 1px solid var(--border); }
    .dialog-head h2 { margin: 6px 0 0; }
    .close { border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; background: var(--surface-2); color: var(--text); }
    .details { padding: 20px; }
    .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .attempt { border: 1px solid var(--border); border-radius: 12px; margin-top: 14px; overflow: hidden; }
    .attempt > summary { cursor: pointer; padding: 12px 14px; background: rgba(8,17,31,.5); font-weight: 700; }
    .attempt-content { padding: 14px; }
    .steps { list-style: none; padding-left: 0; margin: 10px 0; }
    .steps .steps { padding-left: 20px; border-left: 1px solid var(--border); }
    .step { margin: 7px 0; }
    .step-line { display: flex; gap: 8px; align-items: baseline; }
    .step-icon { color: var(--passed); font-weight: 900; }
    .step-failed > .step-line .step-icon { color: var(--failed); }
    .step-meta { color: var(--muted); font-size: 12px; }
    .error { border-left: 4px solid var(--failed); background: rgba(251,113,133,.08); padding: 12px; border-radius: 8px; margin: 12px 0; }
    .error pre, pre { white-space: pre-wrap; overflow-wrap: anywhere; color: #ffd4dc; margin: 8px 0 0; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
    .comparison div { padding: 10px; border: 1px solid var(--border); border-radius: 8px; overflow-wrap: anywhere; }
    .evidence { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .artifact { border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: rgba(8,17,31,.4); }
    .artifact img, .artifact video { width: 100%; max-height: 360px; object-fit: contain; border-radius: 7px; background: #030712; }
    .artifact-meta { display: grid; gap: 3px; margin: 7px 0 10px; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
    .artifact-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 9px; }
    .artifact-preview { max-height: 280px; overflow: auto; margin-top: 9px; padding: 10px; border: 1px solid var(--border); border-radius: 7px; background: #07101d; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .artifact-unavailable { margin: 9px 0 0; color: var(--failed); font-size: 12px; }
    .logs { border: 1px solid var(--border); border-radius: 9px; padding: 10px; background: #07101d; }
    .notice { color: var(--muted); font-size: 13px; }
    .empty { color: var(--muted); padding: 18px; text-align: center; }
    @media (max-width: 1250px) { .filters { grid-template-columns: repeat(4, 1fr); } .search-field { grid-column: span 2; } }
    @media (max-width: 1000px) { .cards { grid-template-columns: repeat(3, 1fr); } .analytics-grid { grid-template-columns: 1fr; } .metadata { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 650px) {
      .container { width: min(100% - 20px, 1500px); }
      .hero { padding: 14px 0; }
      .hero-row { flex-direction: column; align-items: stretch; gap: 12px; }
      .actions { justify-content: flex-start; }
      .cards { grid-template-columns: repeat(2, 1fr); }
      .filters, .metadata, .details-grid, .comparison { grid-template-columns: 1fr; }
      .search-field { grid-column: auto; }
      .chart-wrap { justify-content: center; }
      .health-head, .panel-head { align-items: flex-start; flex-direction: column; gap: 3px; }
      .environment-details summary small { display: none; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="container hero-row">
      <div class="hero-copy">
        <div class="eyebrow">${escapeHtml(resolved.eyebrow)}</div>
        <h1>Automation Dashboard</h1>
        <p class="subtitle" id="runSubtitle"></p>
        <div class="header-facts">
          <span>Browser <strong id="headerBrowser"></strong></span>
          <span>Project <strong id="headerProject"></strong></span>
          <span>Environment <strong id="headerEnvironment"></strong></span>
        </div>
      </div>
      <nav class="actions" aria-label="Report actions">
${actionLinks}
      </nav>
    </div>
  </header>

  <main class="container">
    <section class="cards" aria-label="Execution summary">
      <button class="card metric-total" data-summary-filter="all"><span class="card-label">Total</span><strong class="card-value" id="totalCount">0</strong></button>
      <button class="card metric-passed" data-summary-filter="passed"><span class="card-label">Passed</span><strong class="card-value" id="passedCount">0</strong></button>
      <button class="card metric-failed" data-summary-filter="failed"><span class="card-label">Failed</span><strong class="card-value" id="failedCount">0</strong></button>
      <button class="card metric-skipped" data-summary-filter="skipped"><span class="card-label">Skipped</span><strong class="card-value" id="skippedCount">0</strong></button>
      <button class="card metric-flaky" data-summary-filter="flaky"><span class="card-label">Flaky</span><strong class="card-value" id="flakyCount">0</strong></button>
      <div class="card metric-rate"><span class="card-label">Pass rate</span><strong class="card-value" id="passRate">0%</strong></div>
    </section>

    <section class="health-panel" aria-labelledby="healthTitle">
      <div class="health-head"><h2 id="healthTitle">Execution health</h2><p id="healthHeadline"></p></div>
      <div class="health-bar" id="healthBar" role="group" aria-label="Filtered test result distribution"></div>
      <p class="health-note">Select a segment or metric to filter results. Metrics reflect the active filter context.</p>
    </section>

    <details class="environment-details">
      <summary><span>Execution details</span><small>Duration, operating system, runtime, URL and ${escapeHtml(resolved.timestampsLabel)}</small></summary>
      <div class="metadata" id="metadata"></div>
    </details>

    <section class="panel" aria-labelledby="filtersTitle">
      <div class="panel-head"><h2 id="filtersTitle">Report filters</h2><p>All filters combine; changing execution opens that immutable run.</p></div>
      <div class="filters">
        <input class="search-field" id="search" type="search" placeholder="Search test, suite, module, or spec" aria-label="Search report">
        <select id="runFilter" aria-label="Filter by execution run"></select>
        <select id="suiteFilter" aria-label="Filter by suite"></select>
        <select id="moduleFilter" aria-label="Filter by functional module"></select>
        <select id="specFilter" aria-label="Filter by spec file"></select>
        <select id="statusFilter" aria-label="Filter by status">
          <option value="all">All statuses</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="skipped">Skipped</option><option value="flaky">Flaky</option>
        </select>
        <select id="browserFilter" aria-label="Filter by browser"></select>
        <button class="clear" id="clearFilters" type="button">Clear filters</button>
      </div>
      <p class="scope-note" id="filterScope"></p>
    </section>

    <section class="panel" aria-labelledby="suitesTitle">
      <div class="panel-head"><h2 id="suitesTitle">Suite results</h2><p>A multi-tagged test appears in each suite view but only once in overall metrics.</p></div>
      <div class="drill-grid" id="suites"></div>
      <p class="empty" id="noSuites" hidden>No suite data is available for this filter context.</p>
    </section>

    <section class="panel" aria-labelledby="modulesTitle">
      <div class="panel-head"><h2 id="modulesTitle">Functional modules</h2><p>Select a module to drill down.</p></div>
      <div class="drill-grid" id="modules"></div>
      <p class="empty" id="noModules" hidden>No modules match the current filters.</p>
    </section>

    <section class="panel" aria-labelledby="specsTitle">
      <div class="panel-head"><h2 id="specsTitle">Spec files</h2><p>Failed specs are prioritized; project boundaries remain explicit.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Spec file</th><th>Module</th><th>${escapeHtml(resolved.variantColumnLabel)}</th><th>Tests</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Flaky</th><th>Duration</th></tr></thead>
        <tbody id="specRows"></tbody>
      </table></div>
      <p class="empty" id="noSpecs" hidden>No spec files match the current filters.</p>
    </section>

    <section class="panel" aria-labelledby="testsTitle">
      <div class="panel-head"><h2 id="testsTitle">Test execution</h2><p>Failed and flaky results are shown first.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Test</th><th>Suite(s)</th><th>Module / Spec</th><th>Status</th><th>Started (${escapeHtml(resolved.timezoneLabel)})</th><th>Duration</th><th>${escapeHtml(resolved.variantColumnLabel)}</th><th>Retries</th></tr></thead>
        <tbody id="testRows"></tbody>
      </table></div>
      <p class="empty" id="noTests" hidden>No test results match the current filters. Clear or change filters to continue.</p>
    </section>

    <section class="analytics-grid" aria-label="Execution analytics">
      <article class="panel">
        <h2>Result distribution</h2>
        <div class="chart-wrap">
          <button class="donut" id="distributionChart" aria-label="Cycle test-status filters"><span class="donut-label"><strong id="chartTotal">0</strong><span>tests</span></span></button>
          <div class="legend" id="chartLegend"></div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Pass-rate trend</h2><p id="trendScope"></p></div>
        <svg class="trend" id="trend" viewBox="0 0 900 220" role="img" aria-label="Pass rate over available report history"></svg>
      </article>
    </section>

    <section class="panel" aria-labelledby="historyTitle">
      <div class="panel-head"><h2 id="historyTitle">Execution history</h2><p>Only completed reports found on disk are included.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Run ID</th><th>Execution (${escapeHtml(resolved.timezoneLabel)})</th><th>Environment</th><th>Browser(s)</th><th>Pass rate</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Duration</th><th>Report</th></tr></thead>
        <tbody id="historyRows"></tbody>
      </table></div>
      <p class="empty" id="noHistory" hidden>No completed historical records are available for this scope.</p>
    </section>
  </main>

  <dialog id="testDetails">
    <div class="dialog-head"><div><span class="status" id="detailStatus"></span><h2 id="detailTitle"></h2></div><button class="close" id="closeDetails" type="button">Close</button></div>
    <div class="details" id="detailContent"></div>
  </dialog>

  <script>
    'use strict';
    const report = ${serializedReport};
    const statuses = ['passed', 'failed', 'skipped', 'flaky'];
    const statusColors = { passed: '#34d399', failed: '#fb7185', skipped: '#94a3b8', flaky: '#fbbf24' };
    const statusPriority = { failed: 0, flaky: 1, skipped: 2, passed: 3 };
    const dashboardSettings = ${safeJson({
      timezone: resolved.timezone,
      timezoneLabel: resolved.timezoneLabel,
      timezoneOffset: resolved.timezoneOffset,
      traceHelp: resolved.traceHelp,
      runtimeLabel: resolved.runtimeLabel,
    })};
    const byId = (id) => document.getElementById(id);

    function formatDuration(milliseconds) {
      if (milliseconds < 1000) return Math.round(milliseconds) + ' ms';
      if (milliseconds < 60000) return (milliseconds / 1000).toFixed(2) + ' s';
      return (milliseconds / 60000).toFixed(2) + ' min';
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 0) return 'Size not captured';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KiB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MiB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GiB';
    }

    function formatDate(iso) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: dashboardSettings.timezone, day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      }).formatToParts(new Date(iso)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
      return parts.day + '-' + parts.month + '-' + parts.year + ' ' + parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + parts.dayPeriod.toUpperCase() + ' ' + dashboardSettings.timezoneLabel;
    }

    function variantLabel(test) {
      return test.browser ? test.project + ' / ' + test.browser : test.project;
    }

    function displayName(value) {
      return value.split('-').map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
    }

    function textElement(tag, text, className) {
      const element = document.createElement(tag);
      element.textContent = String(text);
      if (className) element.className = className;
      return element;
    }

    function statusBadge(status) {
      return textElement('span', status, 'status status-' + status);
    }

    function summaryFor(tests) {
      const summary = { total: tests.length, passed: 0, failed: 0, skipped: 0, flaky: 0, passPercentage: 0, durationMs: 0 };
      tests.forEach((test) => { summary[test.status] += 1; summary.durationMs += test.durationMs; });
      summary.passPercentage = summary.total === 0 ? 0 : Number(((summary.passed / summary.total) * 100).toFixed(1));
      return summary;
    }

    function appendOptions(select, values, allLabel, labelFor) {
      select.replaceChildren();
      const allOption = document.createElement('option');
      allOption.value = 'all'; allOption.textContent = allLabel; select.append(allOption);
      values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value; option.textContent = labelFor ? labelFor(value) : displayName(value); select.append(option);
      });
    }

    function initialize() {
      byId('runSubtitle').textContent = 'Run ' + report.run.id + ' · ' + formatDate(report.run.startTime);
      byId('headerBrowser').textContent = report.metadata.browsers.join(', ') || 'Not captured';
      byId('headerProject').textContent = report.metadata.projects.join(', ') || 'Not captured';
      byId('headerEnvironment').textContent = report.metadata.environment;

      const runFilter = byId('runFilter');
      const runRecords = [...report.history].sort((left, right) => right.startTime.localeCompare(left.startTime));
      const seenRuns = new Set();
      runRecords.forEach((run) => {
        if (seenRuns.has(run.runId)) return;
        seenRuns.add(run.runId);
        const option = document.createElement('option');
        option.value = run.runId; option.textContent = run.runId + (run.runId === report.run.id ? ' · current' : ''); runFilter.append(option);
      });
      if (!seenRuns.has(report.run.id)) {
        const option = document.createElement('option'); option.value = report.run.id; option.textContent = report.run.id + ' · current'; runFilter.prepend(option);
      }
      runFilter.value = report.run.id;

      appendOptions(byId('suiteFilter'), report.suites.map((suite) => suite.name), 'All suites');
      appendOptions(byId('moduleFilter'), report.modules.map((module) => module.name), 'All modules');
      appendOptions(byId('specFilter'), report.specs.map((spec) => spec.key), 'All spec files', (key) => {
        const spec = report.specs.find((item) => item.key === key);
        return spec ? spec.path + ' · ' + spec.project : key;
      });
      const browsers = [...new Set(report.tests.map((test) => test.browser).filter(Boolean))].sort();
      const browserFilter = byId('browserFilter');
      if (browsers.length) {
        appendOptions(browserFilter, browsers, 'All browsers');
      } else {
        browserFilter.replaceChildren();
        const option = document.createElement('option');
        option.value = 'all'; option.textContent = 'All browsers'; browserFilter.append(option);
        browserFilter.hidden = true;
      }

      const metadata = [
        ['Run ID', report.run.id], ['Run duration', formatDuration(report.summary.durationMs)],
        ['Browser(s)', report.metadata.browsers.join(', ') || 'Not captured'], ['Project(s)', report.metadata.projects.join(', ') || 'Not captured'],
        ['Environment', report.metadata.environment], ['Timezone', dashboardSettings.timezoneLabel + ' (' + dashboardSettings.timezone + ', ' + dashboardSettings.timezoneOffset + ')'],
        ['Base URL', report.metadata.baseURL || 'Not captured'], ['Operating system', report.metadata.operatingSystem || 'Not captured'],
        [dashboardSettings.runtimeLabel, report.metadata.nodeVersion || 'Not captured'], ['Started', formatDate(report.run.startTime)], ['Completed', formatDate(report.run.endTime)]
      ];
      metadata.forEach(([label, value]) => {
        const item = document.createElement('div'); item.className = 'meta-item';
        item.append(textElement('span', label), textElement('strong', value)); byId('metadata').append(item);
      });
    }

    function activeFilters() {
      return {
        query: byId('search').value.trim().toLowerCase(), suite: byId('suiteFilter').value,
        module: byId('moduleFilter').value, spec: byId('specFilter').value,
        status: byId('statusFilter').value, browser: byId('browserFilter').value
      };
    }

    function filteredTests(ignoreFilter, forcedValue) {
      const filters = activeFilters();
      if (ignoreFilter && forcedValue !== undefined) filters[ignoreFilter] = forcedValue;
      return report.tests.filter((test) => {
        const searchable = [test.title, test.titlePath.join(' '), test.suites.join(' '), test.module, test.spec.path, test.project, test.browser].join(' ').toLowerCase();
        return (!filters.query || searchable.includes(filters.query)) &&
          (filters.suite === 'all' || test.suites.includes(filters.suite)) &&
          (filters.module === 'all' || test.module === filters.module) &&
          (filters.spec === 'all' || test.spec.key === filters.spec) &&
          (filters.status === 'all' || test.status === filters.status) &&
          (filters.browser === 'all' || test.browser === filters.browser);
      });
    }

    function setFilter(name, value, scrollTarget) {
      byId(name + 'Filter').value = value;
      renderAll();
      if (scrollTarget) byId(scrollTarget).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderSummary(tests) {
      const summary = summaryFor(tests);
      byId('totalCount').textContent = summary.total;
      byId('passedCount').textContent = summary.passed;
      byId('failedCount').textContent = summary.failed;
      byId('skippedCount').textContent = summary.skipped;
      byId('flakyCount').textContent = summary.flaky;
      byId('passRate').textContent = summary.passPercentage + '%';
      byId('chartTotal').textContent = summary.total;
      byId('healthHeadline').textContent = summary.passed + ' of ' + summary.total + ' passed · ' + summary.passPercentage + '% pass rate';

      const total = Math.max(summary.total, 1);
      const healthBar = byId('healthBar'); healthBar.replaceChildren();
      statuses.forEach((status) => {
        const count = summary[status]; if (!count) return;
        const segment = document.createElement('button'); segment.type = 'button'; segment.className = 'health-segment';
        segment.style.flexGrow = String(count); segment.style.background = statusColors[status];
        segment.title = displayName(status) + ': ' + count + ' (' + ((count / total) * 100).toFixed(1) + '%)';
        segment.setAttribute('aria-label', segment.title + '. Filter by ' + status + '.');
        segment.addEventListener('click', () => setFilter('status', status, 'testsTitle')); healthBar.append(segment);
      });

      let cursor = 0;
      const segments = statuses.filter((status) => summary[status] > 0).map((status) => {
        const start = cursor; cursor += (summary[status] / total) * 100;
        return statusColors[status] + ' ' + start + '% ' + cursor + '%';
      });
      byId('distributionChart').style.background = segments.length ? 'conic-gradient(' + segments.join(',') + ')' : '#334155';
      const legend = byId('chartLegend'); legend.replaceChildren();
      statuses.forEach((status) => {
        const button = document.createElement('button'); button.type = 'button';
        const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = statusColors[status];
        button.append(dot, document.createTextNode(displayName(status) + ' · ' + summary[status]));
        button.addEventListener('click', () => setFilter('status', status, 'testsTitle')); legend.append(button);
      });
      return summary;
    }

    function summaryText(summary) {
      return summary.total + ' total · ' + summary.passed + ' passed · ' + summary.failed + ' failed · ' + summary.skipped + ' skipped · ' + summary.flaky + ' flaky · ' + summary.passPercentage + '% · ' + formatDuration(summary.durationMs);
    }

    function renderSuites() {
      const container = byId('suites'); container.replaceChildren();
      report.suites.forEach((suite) => {
        const tests = filteredTests('suite', suite.name); if (!tests.length) return;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'drill-card' + (byId('suiteFilter').value === suite.name ? ' active' : '');
        button.append(textElement('strong', displayName(suite.name)), textElement('p', summaryText(summaryFor(tests))));
        button.addEventListener('click', () => setFilter('suite', suite.name, 'modulesTitle')); container.append(button);
      });
      byId('noSuites').hidden = container.childElementCount !== 0;
    }

    function renderModules() {
      const container = byId('modules'); container.replaceChildren();
      report.modules.forEach((module) => {
        const tests = filteredTests('module', module.name); if (!tests.length) return;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'drill-card' + (byId('moduleFilter').value === module.name ? ' active' : '');
        button.append(textElement('strong', displayName(module.name)), textElement('p', summaryText(summaryFor(tests))));
        button.addEventListener('click', () => setFilter('module', module.name, 'specsTitle')); container.append(button);
      });
      byId('noModules').hidden = container.childElementCount !== 0;
    }

    function groupBy(items, keyFor) {
      const groups = new Map();
      items.forEach((item) => { const key = keyFor(item); groups.set(key, [...(groups.get(key) || []), item]); });
      return groups;
    }

    function renderSpecs() {
      const body = byId('specRows'); body.replaceChildren();
      const groups = groupBy(filteredTests('spec', 'all'), (test) => test.spec.key);
      const rows = [...groups.entries()].map(([key, tests]) => ({ key, tests, summary: summaryFor(tests) }))
        .sort((left, right) => right.summary.failed - left.summary.failed || right.summary.flaky - left.summary.flaky || left.key.localeCompare(right.key));
      rows.forEach(({ key, tests, summary }) => {
        const first = tests[0]; const row = document.createElement('tr'); row.className = 'clickable'; row.tabIndex = 0;
        const specCell = document.createElement('td'); specCell.append(textElement('strong', first.spec.name), textElement('span', first.spec.path, 'path'));
        row.append(specCell, textElement('td', displayName(first.module)), textElement('td', variantLabel(first)),
          textElement('td', summary.total), textElement('td', summary.passed), textElement('td', summary.failed),
          textElement('td', summary.skipped), textElement('td', summary.flaky), textElement('td', formatDuration(summary.durationMs)));
        const select = () => setFilter('spec', key, 'testsTitle'); row.addEventListener('click', select);
        row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') select(); }); body.append(row);
      });
      byId('noSpecs').hidden = rows.length !== 0;
    }

    function priorRuns() {
      return report.history.filter((run) => run.runId !== report.run.id && run.startTime < report.run.startTime);
    }

    function failureInsight(test) {
      if (test.status !== 'failed') return undefined;
      const prior = priorRuns(); if (!prior.length) return { text: 'No prior run data', className: 'insight' };
      const seen = prior.some((run) => run.failedTestIds.includes(test.id));
      return seen ? { text: 'Previously observed', className: 'insight' } : { text: 'New in available history', className: 'insight insight-new' };
    }

    function renderTests(tests) {
      const body = byId('testRows'); body.replaceChildren();
      [...tests].sort((left, right) => statusPriority[left.status] - statusPriority[right.status] || left.title.localeCompare(right.title)).forEach((test) => {
        const row = document.createElement('tr'); row.className = 'clickable'; row.tabIndex = 0;
        const testCell = document.createElement('td'); testCell.append(textElement('strong', test.title), textElement('span', test.id, 'path'));
        const locationCell = document.createElement('td'); locationCell.append(textElement('strong', displayName(test.module)), textElement('span', test.spec.path, 'path'));
        const statusCell = document.createElement('td'); statusCell.append(statusBadge(test.status));
        const insight = failureInsight(test); if (insight) statusCell.append(document.createElement('br'), textElement('span', insight.text, insight.className));
        row.append(testCell, textElement('td', test.suites.length ? test.suites.map(displayName).join(', ') : 'Unclassified'), locationCell, statusCell,
          textElement('td', formatDate(test.attempts[0]?.startTime || report.run.startTime)), textElement('td', formatDuration(test.durationMs)),
          textElement('td', variantLabel(test)), textElement('td', test.retryAttempts + ' / ' + test.retriesConfigured));
        row.addEventListener('click', () => openDetails(test));
        row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') openDetails(test); }); body.append(row);
      });
      byId('noTests').hidden = tests.length !== 0;
    }

    function historySummary(run, suiteName) {
      if (suiteName === 'all') return run.summary;
      return run.suites.find((suite) => suite.name === suiteName)?.summary;
    }

    function scopedHistory() {
      const suiteName = byId('suiteFilter').value;
      return report.history.map((run) => ({ run, summary: historySummary(run, suiteName) })).filter((item) => item.summary);
    }

    function renderHistory() {
      const body = byId('historyRows'); body.replaceChildren();
      const records = scopedHistory().sort((left, right) => right.run.startTime.localeCompare(left.run.startTime));
      records.forEach(({ run, summary }) => {
        const link = document.createElement('a'); link.href = run.dashboardPath; link.textContent = run.runId === report.run.id ? 'Current' : 'Open';
        const linkCell = document.createElement('td'); linkCell.append(link);
        const row = document.createElement('tr');
        row.append(textElement('td', run.runId), textElement('td', formatDate(run.startTime)), textElement('td', run.environment),
          textElement('td', run.browsers.join(', ') || 'Not captured'), textElement('td', summary.passPercentage + '%'),
          textElement('td', summary.passed), textElement('td', summary.failed), textElement('td', summary.flaky),
          textElement('td', formatDuration(summary.durationMs)), linkCell); body.append(row);
      });
      byId('noHistory').hidden = records.length !== 0; renderTrend(records);
    }

    function renderTrend(records) {
      const svg = byId('trend'); svg.replaceChildren();
      const suite = byId('suiteFilter').value; byId('trendScope').textContent = suite === 'all' ? 'Overall completed runs' : displayName(suite) + ' runs with available suite data';
      const namespace = 'http://www.w3.org/2000/svg'; const history = [...records].reverse().slice(-20);
      const left = 55, right = 875, top = 18, bottom = 184;
      [0, 25, 50, 75, 100].forEach((rate) => {
        const y = bottom - ((bottom - top) * rate / 100); const line = document.createElementNS(namespace, 'line');
        line.setAttribute('x1', left); line.setAttribute('x2', right); line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('class', 'grid');
        const label = document.createElementNS(namespace, 'text'); label.setAttribute('x', 12); label.setAttribute('y', y + 4); label.textContent = rate + '%'; svg.append(line, label);
      });
      if (!history.length) return;
      const points = history.map((item, index) => ({
        x: history.length === 1 ? (left + right) / 2 : left + ((right - left) * index / (history.length - 1)),
        y: bottom - ((bottom - top) * item.summary.passPercentage / 100), item
      }));
      const polyline = document.createElementNS(namespace, 'polyline'); polyline.setAttribute('points', points.map((point) => point.x + ',' + point.y).join(' ')); polyline.setAttribute('class', 'line'); svg.append(polyline);
      points.forEach((point) => {
        const circle = document.createElementNS(namespace, 'circle'); circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', 6); circle.setAttribute('class', 'point');
        const title = document.createElementNS(namespace, 'title'); title.textContent = point.item.run.runId + ': ' + point.item.summary.passPercentage + '%'; circle.append(title);
        circle.addEventListener('click', () => { window.location.href = point.item.run.dashboardPath; }); svg.append(circle);
      });
    }

    function appendError(container, error) {
      const box = document.createElement('section'); box.className = 'error'; box.append(textElement('strong', 'Captured failure'));
      if (error.expected !== undefined || error.actual !== undefined) {
        const comparison = document.createElement('div'); comparison.className = 'comparison';
        comparison.append(textElement('div', 'Expected: ' + (error.expected ?? 'Not separately captured')), textElement('div', 'Actual: ' + (error.actual ?? 'Not separately captured'))); box.append(comparison);
      }
      box.append(textElement('pre', error.message)); if (error.snippet) box.append(textElement('pre', error.snippet)); if (error.stack) box.append(textElement('pre', error.stack)); container.append(box);
    }

    function createStepList(steps) {
      const list = document.createElement('ul'); list.className = 'steps';
      steps.forEach((step) => {
        const item = document.createElement('li'); item.className = 'step ' + (step.status === 'failed' ? 'step-failed' : 'step-passed');
        const line = document.createElement('div'); line.className = 'step-line';
        line.append(textElement('span', step.status === 'failed' ? '×' : '✓', 'step-icon'), textElement('strong', step.title),
          textElement('span', (step.subtitle ? step.subtitle + ' · ' : '') + step.category + ' · ' + formatDate(step.startTime) + ' · ' + formatDuration(step.durationMs), 'step-meta'));
        item.append(line); if (step.error) appendError(item, step.error); if (step.steps.length) item.append(createStepList(step.steps)); list.append(item);
      });
      return list;
    }

    function safeArtifactPath(artifact) {
      const value = artifact.path;
      if (artifact.available === false || typeof value !== 'string' || !value.startsWith('../') || value.startsWith('../../')) return undefined;
      if (value.includes('\\\\') || value.includes('%') || value.includes('?') || value.includes('#')) return undefined;
      const segments = value.slice(3).split('/');
      if (!segments.length || segments.some((segment) => !segment || segment === '.' || segment === '..')) return undefined;
      return value;
    }

    function safeDownloadName(artifact) {
      const value = String(artifact.filename || artifact.name || 'attachment').split(/[\\\\/]/).at(-1) || 'attachment';
      return value.replace(/[\\u0000-\\u001f\\u007f]/g, '_').slice(0, 180) || 'attachment';
    }

    function appendArtifactUnavailable(card, message) {
      if (card.querySelector('.artifact-unavailable')) return;
      card.append(textElement('p', message || 'Attachment is unavailable.', 'artifact-unavailable'));
    }

    function createEvidence(artifacts) {
      const section = document.createElement('section'); section.append(textElement('h3', 'Evidence'));
      if (!artifacts.length) { section.append(textElement('p', 'No evidence attachment was captured for this attempt.', 'notice')); return section; }
      const grid = document.createElement('div'); grid.className = 'evidence';
      artifacts.forEach((artifact) => {
        const card = document.createElement('article'); card.className = 'artifact';
        card.dataset.evidenceKind = artifact.kind;
        card.dataset.evidenceFilename = artifact.filename || '';
        card.append(textElement('strong', displayName(artifact.kind) + ' · ' + artifact.name));
        const metadata = document.createElement('div'); metadata.className = 'artifact-meta';
        metadata.append(
          textElement('span', 'Filename: ' + (artifact.filename || 'Not captured')),
          textElement('span', 'MIME type: ' + (artifact.contentType || 'Not captured')),
          textElement('span', 'Size: ' + formatBytes(artifact.bytes))
        );
        card.append(metadata);

        const artifactPath = safeArtifactPath(artifact);
        if (!artifactPath) {
          appendArtifactUnavailable(card, artifact.unavailableReason || 'Unsafe attachment path was blocked.');
          grid.append(card);
          return;
        }

        if (artifact.kind === 'screenshot') {
          const image = document.createElement('img'); image.src = artifactPath; image.alt = 'Captured screenshot for this test attempt';
          image.addEventListener('error', () => { image.hidden = true; appendArtifactUnavailable(card, 'Screenshot could not be loaded.'); }); card.append(image);
        }
        if (artifact.kind === 'video') {
          const video = document.createElement('video'); video.src = artifactPath; video.controls = true; video.preload = 'metadata';
          video.addEventListener('error', () => { video.hidden = true; appendArtifactUnavailable(card, 'Video could not be loaded.'); }); card.append(video);
        }
        if (artifact.preview) {
          const preview = textElement('pre', artifact.preview.content, 'artifact-preview');
          preview.setAttribute('aria-label', (artifact.preview.kind === 'json' ? 'JSON' : 'Text') + ' preview for ' + (artifact.filename || artifact.name));
          card.append(preview);
          if (artifact.preview.truncated) card.append(textElement('p', 'Preview truncated; download the attachment for complete content.', 'notice'));
        } else if (artifact.kind !== 'screenshot' && artifact.kind !== 'video' && artifact.kind !== 'trace') {
          card.append(textElement('p', 'Preview is not available for this file type.', 'notice'));
        }

        const actions = document.createElement('div'); actions.className = 'artifact-actions';
        const link = document.createElement('a'); link.className = 'artifact-download'; link.href = artifactPath; link.rel = 'noreferrer';
        if (artifact.kind === 'screenshot' || artifact.kind === 'video') {
          link.textContent = 'Open artifact'; link.target = '_blank';
        } else {
          link.textContent = artifact.kind === 'trace' ? 'Download trace ZIP' : 'Download attachment';
          link.download = safeDownloadName(artifact);
        }
        actions.append(link); card.append(actions);
        if (artifact.kind === 'trace') card.append(textElement('p', dashboardSettings.traceHelp, 'notice'));
        grid.append(card);
      });
      section.append(grid); return section;
    }

    function createLogs(logs) {
      const section = document.createElement('section'); section.append(textElement('h3', 'Available logs'));
      if (!logs.length) { section.append(textElement('p', 'No stdout or stderr was captured for this attempt.', 'notice')); return section; }
      const box = document.createElement('pre'); box.className = 'logs'; box.textContent = logs.map((log) => '[' + formatDate(log.timestamp) + '] ' + log.stream.toUpperCase() + '\\n' + log.text).join('\\n'); section.append(box); return section;
    }

    function openDetails(test) {
      const badge = byId('detailStatus'); badge.textContent = test.status; badge.className = 'status status-' + test.status; byId('detailTitle').textContent = test.title;
      const content = byId('detailContent'); content.replaceChildren(); const info = document.createElement('div'); info.className = 'details-grid';
      const insight = failureInsight(test);
      [
        ['Suite membership', test.suites.length ? test.suites.map(displayName).join(', ') : 'Unclassified'], ['Module', displayName(test.module)], ['Spec file', test.spec.path],
        ['Project', test.project], ['Browser', test.browser || 'Not captured'], ['Stable test ID', test.id],
        ['Started', formatDate(test.attempts[0]?.startTime || report.run.startTime)], ['Duration', formatDuration(test.durationMs)],
        ['Retries used', String(test.retryAttempts)], ['History insight', insight ? insight.text : 'Not a current failure'], ['Source', test.file + ':' + test.line + ':' + test.column]
      ].forEach(([label, value]) => { const item = document.createElement('div'); item.className = 'meta-item'; item.append(textElement('span', label), textElement('strong', value)); info.append(item); });
      content.append(info, textElement('p', 'Displayed information is captured execution evidence, not an automated root-cause diagnosis.', 'notice'));
      test.attempts.forEach((attempt) => {
        const details = document.createElement('details'); details.className = 'attempt'; details.open = true;
        const summary = document.createElement('summary'); summary.textContent = 'Attempt ' + attempt.attempt + ' · retry ' + attempt.retry + ' · ' + attempt.status + ' · ' + formatDate(attempt.startTime) + ' · ' + formatDuration(attempt.durationMs);
        const attemptContent = document.createElement('div'); attemptContent.className = 'attempt-content';
        if (attempt.steps.length) attemptContent.append(textElement('h3', 'Captured steps and assertions'), createStepList(attempt.steps));
        else attemptContent.append(textElement('p', 'No step details were captured.', 'notice'));
        attempt.errors.forEach((error) => appendError(attemptContent, error)); attemptContent.append(createLogs(attempt.logs || []), createEvidence(attempt.artifacts));
        details.append(summary, attemptContent); content.append(details);
      });
      byId('testDetails').showModal();
    }

    function renderAll() {
      const tests = filteredTests(); const summary = renderSummary(tests);
      renderSuites(); renderModules(); renderSpecs(); renderTests(tests); renderHistory();
      const filters = activeFilters(); const active = [];
      if (filters.query) active.push('search “' + filters.query + '”');
      ['suite', 'module', 'spec', 'status', 'browser'].forEach((name) => { if (filters[name] !== 'all') active.push(name + ': ' + filters[name]); });
      byId('filterScope').textContent = summary.total + ' unique test/project result(s) in scope' + (active.length ? ' · ' + active.join(' · ') : ' · no filters active');
    }

    ['search', 'suiteFilter', 'moduleFilter', 'specFilter', 'statusFilter', 'browserFilter'].forEach((id) => {
      byId(id).addEventListener(id === 'search' ? 'input' : 'change', renderAll);
    });
    byId('runFilter').addEventListener('change', () => {
      const selected = report.history.find((run) => run.runId === byId('runFilter').value);
      if (selected && selected.runId !== report.run.id) window.location.href = selected.dashboardPath;
    });
    byId('clearFilters').addEventListener('click', () => {
      byId('search').value = ''; ['suiteFilter', 'moduleFilter', 'specFilter', 'statusFilter', 'browserFilter'].forEach((id) => { byId(id).value = 'all'; }); renderAll();
    });
    document.querySelectorAll('[data-summary-filter]').forEach((button) => button.addEventListener('click', () => setFilter('status', button.dataset.summaryFilter, 'testsTitle')));
    let chartFilterIndex = -1;
    byId('distributionChart').addEventListener('click', () => { chartFilterIndex = (chartFilterIndex + 1) % (statuses.length + 1); setFilter('status', chartFilterIndex === statuses.length ? 'all' : statuses[chartFilterIndex], 'testsTitle'); });
    byId('closeDetails').addEventListener('click', () => byId('testDetails').close());
    byId('testDetails').addEventListener('click', (event) => { if (event.target === byId('testDetails')) byId('testDetails').close(); });

    initialize();
    renderAll();
  </script>
</body>
</html>`;
}
