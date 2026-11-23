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
  title: "Automation Dashboard",
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

function actionLink(href: string, label: string, title?: string): string {
  const external = /^https?:/i.test(href);
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  if (!external) {
    return `        <a class="button" href="${escapeHtml(href)}"${titleAttribute}>${escapeHtml(label)}</a>`;
  }
  return `        <a class="button" href="${escapeHtml(href)}" target="_blank" rel="noreferrer"${titleAttribute}>${escapeHtml(label)}<span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`;
}

export function createDashboard(
  report: DashboardDocument,
  settings: DashboardSettings = {},
): string {
  const resolved = { ...DEFAULT_DASHBOARD_SETTINGS, ...settings };
  const serializedReport = safeJson(report);
  const actionLinks = [
    resolved.reportHref
      ? actionLink(resolved.reportHref, resolved.reportLabel)
      : "",
    resolved.traceViewerHref
      ? actionLink(
          resolved.traceViewerHref,
          resolved.traceViewerLabel,
          "Opens trace.playwright.dev in a new tab. Download a trace ZIP from a test's evidence section, then drop it on that page.",
        )
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const eyebrowHtml = resolved.eyebrow
    ? `\n        <div class="eyebrow">${escapeHtml(resolved.eyebrow)}</div>`
    : "";

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
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0; min-height: 100vh; color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px; line-height: 1.5;
      background: radial-gradient(circle at 10% 0%, #12314c 0, transparent 36%), var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--accent); }
    button, input, select { font: inherit; color: inherit; }
    button { cursor: pointer; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .mono { font-family: var(--font-mono); font-size: 11px; }
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
    .button { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--surface-2); color: var(--text); text-decoration: none; font-size: 12px; font-weight: 700; }
    .button:hover, .button:focus-visible { border-color: var(--accent); outline: none; }
    .button .ext { color: var(--accent); margin-left: 2px; }

    main { padding: 14px 0 48px; }

    .verdict { margin-top: 12px; padding: 18px 20px; border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 12px; box-shadow: var(--shadow); background: linear-gradient(150deg, rgba(23, 38, 59, .96), rgba(12, 24, 40, .96)); }
    .verdict.is-failed { border-left-color: var(--failed); }
    .verdict.is-warning { border-left-color: var(--flaky); }
    .verdict.is-passed { border-left-color: var(--passed); }
    .verdict-kicker { margin: 0; color: var(--accent); font-size: 10px; letter-spacing: .15em; text-transform: uppercase; font-weight: 800; }
    .verdict.is-failed .verdict-kicker { color: var(--failed); }
    .verdict.is-warning .verdict-kicker { color: var(--flaky); }
    .verdict.is-passed .verdict-kicker { color: var(--passed); }
    .verdict h2 { margin: 4px 0 0; font-size: clamp(20px, 2.4vw, 26px); line-height: 1.15; letter-spacing: -.02em; }
    .verdict-sub { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
    .failure-list { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 9px; }
    .failure { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: rgba(8, 17, 31, .55); }
    .failure-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .failure-head strong { font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
    .failure-reason { margin: 6px 0 0; color: #ffd4dc; font-family: var(--font-mono); font-size: 12px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .failure-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; color: var(--muted); font-size: 12px; }
    .failure-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 14px; margin-top: 10px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .chip { border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; background: rgba(8, 17, 31, .45); color: var(--muted); font-size: 11px; }
    .link-button { border: 1px solid var(--border); border-radius: 8px; padding: 4px 10px; background: var(--surface-2); color: var(--text); font-size: 12px; font-weight: 700; }
    .link-button:hover, .link-button:focus-visible { border-color: var(--accent); color: var(--accent); outline: none; }
    .digest { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 10px; margin-top: 16px; }
    .digest-col { min-width: 0; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: rgba(8, 17, 31, .55); }
    .digest-col h3 { margin: 0 0 8px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
    .digest-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
    .digest-row { position: relative; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; width: 100%; padding: 8px 10px; border: 1px solid transparent; border-radius: 8px; background: rgba(23, 38, 59, .55); color: var(--text); text-align: left; overflow: hidden; }
    button.digest-row:hover, button.digest-row:focus-visible { border-color: var(--accent); outline: none; }
    .digest-label { z-index: 1; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
    .digest-count { z-index: 1; color: var(--muted); font-size: 11px; white-space: nowrap; }
    .digest-bar { position: absolute; inset: auto 0 0 0; height: 2px; background: var(--accent); opacity: .55; }
    .digest-msg { display: flex; gap: 10px; padding: 8px 10px; border-radius: 8px; background: rgba(23, 38, 59, .55); }
    .digest-msg p { margin: 0; color: #ffd4dc; font-family: var(--font-mono); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
    .digest-more { margin: 7px 0 0; color: var(--muted); font-size: 11px; }
    .digest-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
    .digest-note { margin: 0; color: var(--muted); font-size: 12px; }

    .cards { display: grid; grid-template-columns: repeat(6, minmax(105px, 1fr)); gap: 8px; margin-top: 12px; }
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
    .panel-head p { margin: 0; color: var(--muted); font-size: 12px; }

    .health-panel { margin-top: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: rgba(16, 28, 46, .82); }
    .health-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .health-head h2 { margin: 0; font-size: 14px; }
    .health-head p { margin: 0; color: var(--muted); font-size: 12px; }
    .health-bar { display: flex; width: 100%; height: 9px; overflow: hidden; border-radius: 999px; background: #25354a; }
    .health-segment { min-width: 3px; height: 100%; padding: 0; border: 0; border-right: 2px solid var(--surface); }
    .health-segment:last-child { border-right: 0; }
    .health-segment:hover, .health-segment:focus-visible { filter: brightness(1.25); outline: 2px solid var(--text); outline-offset: -2px; }
    .health-note { margin: 7px 0 0; color: var(--muted); font-size: 11px; }

    .environment-details { margin-top: 12px; border: 1px solid var(--border); border-radius: 10px; background: rgba(11, 23, 40, .68); }
    .environment-details > summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 12px; cursor: pointer; font-size: 12px; font-weight: 800; list-style: none; }
    .environment-details > summary::-webkit-details-marker { display: none; }
    .environment-details > summary::after { content: "+"; color: var(--accent); font-size: 17px; font-weight: 400; }
    .environment-details[open] > summary::after { content: "−"; }
    .environment-details > summary small { color: var(--muted); font-weight: 400; margin-left: auto; }
    .environment-details[open] > summary { border-bottom: 1px solid var(--border); }
    .metadata { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px; }
    .meta-item { min-width: 0; padding: 9px 10px; border-radius: 8px; background: rgba(8, 17, 31, .5); }
    .meta-item span { display: block; margin-bottom: 3px; color: var(--muted); font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: .05em; }
    .meta-item strong { display: block; font-size: 12px; font-weight: 400; overflow-wrap: anywhere; }

    .run-context { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 12px; padding: 11px 12px; border: 1px solid rgba(103, 232, 249, .22); border-radius: 10px; background: linear-gradient(90deg, rgba(103, 232, 249, .07), rgba(11, 23, 40, .55) 48%); }
    .run-context-copy { min-width: 190px; }
    .run-context-label { display: block; color: var(--text); font-size: 12px; font-weight: 800; }
    .run-context-copy small { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; }
    .run-context-controls { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: min(100%, 470px); }
    .run-latest { flex: none; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--accent); background: rgba(8, 17, 31, .42); font-size: 11.5px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .run-latest:hover, .run-latest:focus-visible { border-color: var(--accent); outline: none; }
    .run-latest[hidden] { display: none; }
    .filters { display: grid; grid-template-columns: minmax(220px, 1.6fr) repeat(5, minmax(125px, 1fr)) auto; gap: 8px; }
    .filters > * { min-width: 0; }
    .search-field { min-width: 180px; }
    input, select { width: 100%; min-height: 38px; border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; color: var(--text); background: #0b1728; }
    input::placeholder { color: var(--muted); }
    input:focus, select:focus { border-color: var(--accent); outline: none; }
    .clear { border: 1px solid var(--border); border-radius: 9px; padding: 8px 11px; color: var(--text); background: var(--surface-2); white-space: nowrap; }
    .clear:hover, .clear:focus-visible { border-color: var(--accent); outline: none; }
    .scope-note { margin: 10px 0 0; color: var(--muted); font-size: 12px; }

    .run-picker { position: relative; flex: 1; width: 100%; min-width: 220px; }
    .run-trigger { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; background: #0b1728; color: var(--text); text-align: left; }
    .run-trigger:hover, .run-trigger:focus-visible, .run-trigger[aria-expanded="true"] { border-color: var(--accent); outline: none; }
    .run-trigger-kicker { color: var(--muted); font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
    .run-trigger #runFilterLabel { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .run-trigger-caret { color: var(--accent); font-size: 11px; }
    .run-popover { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; width: 300px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow); }
    .run-popover[hidden] { display: none; }
    .run-popover-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .run-popover-head strong { font-size: 13px; }
    .run-month { width: 30px; height: 30px; padding: 0; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-2); color: var(--text); font-size: 15px; line-height: 1; }
    .run-month:hover, .run-month:focus-visible { border-color: var(--accent); outline: none; }
    .run-weekdays, .run-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
    .run-weekdays span { padding-bottom: 4px; color: var(--muted); font-size: 9px; text-align: center; text-transform: uppercase; letter-spacing: .05em; }
    .run-day { position: relative; padding: 6px 0; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--muted); font-size: 12px; text-align: center; }
    .run-day.is-blank { visibility: hidden; }
    .run-day.has-runs { border-color: rgba(103, 232, 249, .3); background: rgba(103, 232, 249, .08); color: var(--text); }
    .run-day.has-runs:hover, .run-day.has-runs:focus-visible { border-color: var(--accent); outline: none; }
    .run-day.has-runs::after { content: ""; position: absolute; bottom: 3px; left: 50%; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); transform: translateX(-50%); }
    .run-day.is-current { border-color: var(--accent); }
    .run-day.is-selected { background: var(--accent); border-color: var(--accent); color: #06232b; font-weight: 800; }
    .run-day.is-selected::after { background: #06232b; }
    .run-day:disabled { cursor: default; }
    .run-day-runs { display: grid; gap: 5px; max-height: 168px; margin-top: 10px; overflow: auto; }
    .run-time { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 7px; background: rgba(8, 17, 31, .5); color: var(--text); font-size: 11.5px; text-align: left; }
    .run-time:hover, .run-time:focus-visible { border-color: var(--accent); outline: none; }
    .run-time small { color: var(--muted); font-size: 10.5px; white-space: nowrap; }
    .run-empty-note { margin: 8px 0 0; color: var(--muted); font-size: 11.5px; }

    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
    table { width: 100%; min-width: 900px; border-collapse: collapse; font-size: 12.5px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: .06em; background: rgba(8, 17, 31, .7); white-space: nowrap; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr.clickable { cursor: pointer; }
    tbody tr.clickable:hover, tbody tr.clickable:focus { background: rgba(103, 232, 249, .06); outline: none; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td code, .path { display: block; margin-top: 3px; color: var(--muted); font-family: var(--font-mono); font-size: 11px; overflow-wrap: anywhere; }
    .nowrap { white-space: nowrap; }
    tr.row-failed td:first-child { box-shadow: inset 3px 0 0 var(--failed); }
    tr.row-flaky td:first-child { box-shadow: inset 3px 0 0 var(--flaky); }

    .status { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
    .status-passed { color: #052e22; background: var(--passed); }
    .status-failed { color: #4c0519; background: var(--failed); }
    .status-skipped { color: #111827; background: var(--skipped); }
    .status-flaky { color: #422006; background: var(--flaky); }
    .insight { display: inline-flex; margin-top: 5px; border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px; color: var(--muted); font-size: 10px; }
    .insight-new { color: var(--failed); border-color: rgba(251, 113, 133, .5); }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .drill-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr)); gap: 9px; }
    .drill-card { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; color: var(--text); background: rgba(8, 17, 31, .45); text-align: left; }
    .drill-card:hover, .drill-card:focus-visible { border-color: var(--accent); outline: none; }
    .drill-card.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
    .drill-card strong { display: block; font-size: 13px; overflow-wrap: anywhere; }
    .drill-card p { color: var(--muted); margin: 7px 0 0; font-size: 12px; line-height: 1.5; }

    .analytics-grid { display: grid; grid-template-columns: minmax(300px, .65fr) minmax(520px, 1.35fr); gap: 12px; }
    .analytics-grid .panel { min-width: 0; display: flex; flex-direction: column; }
    .chart-wrap { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; flex: 1; }
    .donut { width: 138px; aspect-ratio: 1; border: 0; border-radius: 50%; position: relative; background: #334155; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .12); flex: 0 0 auto; }
    .donut::after { content: ""; position: absolute; inset: 28%; border-radius: 50%; background: var(--surface); }
    .donut-label { position: absolute; inset: 0; z-index: 1; display: grid; place-content: center; text-align: center; pointer-events: none; }
    .donut-label strong { font-size: 24px; }
    .donut-label span { font-size: 11px; color: var(--muted); text-transform: uppercase; }
    .legend { display: grid; gap: 5px; min-width: 140px; }
    .legend button { display: flex; align-items: center; border: 1px solid transparent; background: transparent; color: var(--text); padding: 5px 7px; border-radius: 7px; text-align: left; font-size: 12px; }
    .legend button:hover, .legend button:focus-visible { border-color: var(--border); outline: none; }
    .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 8px; flex: 0 0 auto; }

    .chart-scroll { overflow-x: auto; }
    .trend { display: block; width: 100%; height: 220px; background: rgba(8, 17, 31, .45); border: 1px solid var(--border); border-radius: 12px; }
    .trend text { fill: var(--muted); font-size: 11px; font-family: var(--font-mono); }
    .trend .grid { stroke: var(--border); stroke-width: 1; }
    .trend .count { fill: var(--accent); font-size: 11px; }
    .trend .line { fill: none; stroke: var(--accent); stroke-width: 3; }
    .trend .point { fill: var(--accent); stroke: var(--bg); stroke-width: 2; cursor: pointer; }
    .trend .point:hover, .trend .point:focus-visible { fill: var(--text); outline: none; }
    .chart-note { margin: 8px 0 0; color: var(--muted); font-size: 11px; }

    dialog { width: min(1040px, calc(100% - 24px)); max-height: 90vh; margin: auto; padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: var(--shadow); overflow: hidden; }
    dialog[open] { display: flex; flex-direction: column; }
    dialog::backdrop { background: rgba(0, 0, 0, .72); backdrop-filter: blur(3px); }
    .dialog-head { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding: 18px 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
    .dialog-head h2 { margin: 6px 0 0; font-size: 20px; overflow-wrap: anywhere; }
    .close { border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; background: var(--surface-2); color: var(--text); font-size: 12px; }
    .close:hover, .close:focus-visible { border-color: var(--accent); outline: none; }
    .details { padding: 20px; overflow: auto; }
    .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .attempt { margin-top: 14px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .attempt > summary { padding: 12px 14px; background: rgba(8, 17, 31, .5); font-size: 12.5px; font-weight: 700; cursor: pointer; }
    .attempt-content { padding: 14px; }
    .steps { list-style: none; padding-left: 0; margin: 10px 0; }
    .steps .steps { padding-left: 20px; border-left: 1px solid var(--border); }
    .step { margin: 7px 0; }
    .step-line { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .step-line strong { font-size: 12.5px; font-weight: 400; }
    .step-icon { color: var(--passed); font-size: 13px; font-weight: 900; }
    .step-failed > .step-line .step-icon { color: var(--failed); }
    .step-meta { color: var(--muted); font-family: var(--font-mono); font-size: 11px; }
    .error { margin: 12px 0; padding: 12px; border-left: 4px solid var(--failed); border-radius: 8px; background: rgba(251, 113, 133, .08); }
    .error strong { font-size: 12px; font-weight: 700; }
    pre { margin: 8px 0 0; color: #ffd4dc; font: 12px/1.55 var(--font-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; font-family: var(--font-mono); font-size: 12px; }
    .comparison div { padding: 10px; border: 1px solid var(--border); border-radius: 8px; overflow-wrap: anywhere; }
    h3 { margin: 18px 0 4px; font-size: 14px; }
    .evidence { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 10px; }
    .artifact { padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: rgba(8, 17, 31, .4); }
    .artifact > strong { font-size: 12px; }
    .artifact img, .artifact video { width: 100%; max-height: 360px; object-fit: contain; border-radius: 7px; background: #030712; }
    .artifact-meta { display: grid; gap: 3px; margin: 7px 0 10px; color: var(--muted); font-family: var(--font-mono); font-size: 11px; overflow-wrap: anywhere; }
    .artifact-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 9px; font-size: 12px; }
    .artifact-preview { max-height: 280px; overflow: auto; margin-top: 9px; padding: 10px; border: 1px solid var(--border); border-radius: 7px; background: #07101d; color: var(--text); font: 12px/1.55 var(--font-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
    .artifact-unavailable { margin: 9px 0 0; color: var(--failed); font-size: 12px; }
    .logs { max-height: 280px; overflow: auto; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: #07101d; font: 12px/1.55 var(--font-mono); }
    .notice { color: var(--muted); font-size: 12px; }
    .empty { margin: 0; padding: 18px; color: var(--muted); font-size: 12px; text-align: center; }

    @media (max-width: 1250px) {
      .filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .filters .search-field { grid-column: span 2; }
    }
    @media (max-width: 1000px) {
      .cards { grid-template-columns: repeat(3, 1fr); }
      .analytics-grid { grid-template-columns: 1fr; }
      .metadata { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .two-col { grid-template-columns: 1fr; }
    }
    @media (max-width: 650px) {
      .container { width: min(100% - 20px, 1500px); }
      .hero { padding: 14px 0; }
      .hero-row { flex-direction: column; align-items: stretch; gap: 12px; }
      .actions { justify-content: flex-start; }
      .cards { grid-template-columns: repeat(2, 1fr); }
      .filters, .metadata, .details-grid, .comparison { grid-template-columns: 1fr; }
      .filters .search-field { grid-column: auto; }
      .run-context { align-items: stretch; flex-direction: column; gap: 9px; }
      .run-context-controls { align-items: stretch; flex-direction: column; width: 100%; }
      .run-picker { min-width: 0; }
      .run-latest { text-align: center; }
      .chart-wrap { justify-content: center; }
      .health-head, .panel-head { align-items: flex-start; flex-direction: column; gap: 3px; }
      .environment-details > summary small { display: none; }
      .failure-head { flex-direction: column; gap: 4px; }
      table { min-width: 520px; }
      .run-popover { width: calc(100vw - 60px); max-width: 320px; }
      .run-day-runs { max-height: 128px; overscroll-behavior: contain; }
      .hide-sm { display: none; }
      .trend { min-width: 720px; }
      .verdict { padding: 14px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="container hero-row">
      <div class="hero-copy">${eyebrowHtml}
        <h1>${escapeHtml(resolved.title)}</h1>
        <p class="subtitle" id="runSubtitle"></p>
        <div class="header-facts">
          <span>Run <strong id="headerRun"></strong></span>
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
    <section class="verdict" id="verdict" aria-labelledby="verdictHeadline"></section>

    <section class="cards" aria-label="Run summary">
      <button class="card metric-total" type="button" data-summary-filter="all"><span class="card-label">Total</span><strong class="card-value" id="totalCount">0</strong></button>
      <button class="card metric-passed" type="button" data-summary-filter="passed"><span class="card-label">Passed</span><strong class="card-value" id="passedCount">0</strong></button>
      <button class="card metric-failed" type="button" data-summary-filter="failed"><span class="card-label">Failed</span><strong class="card-value" id="failedCount">0</strong></button>
      <button class="card metric-skipped" type="button" data-summary-filter="skipped"><span class="card-label">Skipped</span><strong class="card-value" id="skippedCount">0</strong></button>
      <button class="card metric-flaky" type="button" data-summary-filter="flaky"><span class="card-label">Flaky</span><strong class="card-value" id="flakyCount">0</strong></button>
      <div class="card metric-rate"><span class="card-label">Pass rate</span><strong class="card-value" id="passRate">0%</strong></div>
    </section>

    <section class="health-panel" aria-labelledby="healthTitle">
      <div class="health-head"><h2 id="healthTitle">Execution health</h2><p id="healthHeadline"></p></div>
      <div class="health-bar" id="healthBar" role="group" aria-label="Run result distribution"></div>
      <p class="health-note">Select a segment, metric, or legend entry to filter results.</p>
    </section>

    <details class="environment-details">
      <summary><span>Execution details</span><small>Duration, operating system, runtime, URL and ${escapeHtml(resolved.timestampsLabel)}</small></summary>
      <div class="metadata" id="metadata"></div>
    </details>

    <section class="panel" aria-labelledby="filtersTitle">
      <div class="panel-head"><h2 id="filtersTitle">Refine results</h2><p>Combine filters to narrow the tests shown in this execution.</p></div>
      <div class="run-context">
        <div class="run-context-copy">
          <span class="run-context-label">Viewed execution</span>
          <small>Selecting another date opens its saved report.</small>
        </div>
        <div class="run-context-controls">
          <div class="run-picker" id="runPicker">
            <button class="run-trigger" id="runFilter" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="runPopover" aria-label="Choose execution by date" title="Choose execution by date">
              <span id="runFilterLabel"></span>
              <span class="run-trigger-caret" aria-hidden="true">▾</span>
            </button>
            <div class="run-popover" id="runPopover" role="dialog" aria-label="Choose execution by date" hidden>
              <div class="run-popover-head">
                <button type="button" class="run-month" id="runPrevMonth" aria-label="Previous month">‹</button>
                <strong id="runMonthLabel"></strong>
                <button type="button" class="run-month" id="runNextMonth" aria-label="Next month">›</button>
              </div>
              <div class="run-weekdays" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
              <div class="run-days" id="runDays" role="group" aria-label="Execution dates"></div>
              <div class="run-day-runs" id="runDayRuns"></div>
            </div>
          </div>
          <a class="run-latest" id="latestRun" href="#" hidden>View latest run</a>
        </div>
      </div>
      <div class="filters">
        <input class="search-field" id="search" type="search" placeholder="Search tests, suites, specs" aria-label="Search report">
        <select id="suiteFilter" aria-label="Filter by suite"></select>
        <select id="moduleFilter" aria-label="Filter by functional module"></select>
        <select id="specFilter" aria-label="Filter by spec file"></select>
        <select id="statusFilter" aria-label="Filter by status">
          <option value="all">All statuses</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="skipped">Skipped</option><option value="flaky">Flaky</option>
        </select>
        <select id="browserFilter" aria-label="Filter by browser"></select>
        <button class="clear" id="clearFilters" type="button">Reset all</button>
      </div>
      <p class="scope-note" id="filterScope"></p>
    </section>

    <section class="panel" aria-labelledby="testsTitle">
      <div class="panel-head"><h2 id="testsTitle">Test execution</h2><p>Failed and flaky results first. Select a row for evidence.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Test</th><th class="hide-sm">Suite(s)</th><th class="hide-sm">Module / Spec</th><th>Status</th><th>Started (${escapeHtml(resolved.timezoneLabel)})</th><th class="num">Duration</th><th class="hide-sm">${escapeHtml(resolved.variantColumnLabel)}</th><th class="num hide-sm">Retries</th></tr></thead>
        <tbody id="testRows"></tbody>
      </table></div>
      <p class="empty" id="noTests" hidden>No test results match the current filters. Clear or change filters to continue.</p>
    </section>

    <section class="panel" aria-labelledby="specsTitle">
      <div class="panel-head"><h2 id="specsTitle">Spec files</h2><p>Failed specs first.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Spec file</th><th class="hide-sm">Module</th><th class="hide-sm">${escapeHtml(resolved.variantColumnLabel)}</th><th class="num">Tests</th><th class="num hide-sm">Passed</th><th class="num">Failed</th><th class="num hide-sm">Skipped</th><th class="num hide-sm">Flaky</th><th class="num">Duration</th></tr></thead>
        <tbody id="specRows"></tbody>
      </table></div>
      <p class="empty" id="noSpecs" hidden>No spec files match the current filters.</p>
    </section>

    <div class="two-col">
      <section class="panel" aria-labelledby="suitesTitle">
        <div class="panel-head"><h2 id="suitesTitle">Suites</h2><p>A multi-tagged test appears here once per suite but once in totals.</p></div>
        <div class="drill-grid" id="suites"></div>
        <p class="empty" id="noSuites" hidden>No suite data is available for this filter context.</p>
      </section>

      <section class="panel" aria-labelledby="modulesTitle">
        <div class="panel-head"><h2 id="modulesTitle">Functional modules</h2><p>Select a module to drill down.</p></div>
        <div class="drill-grid" id="modules"></div>
        <p class="empty" id="noModules" hidden>No modules match the current filters.</p>
      </section>
    </div>

    <section class="analytics-grid" aria-label="Execution analytics">
      <article class="panel">
        <h2>Result distribution</h2>
        <div class="chart-wrap">
          <button class="donut" id="distributionChart" type="button" aria-label="Cycle test-status filters"><span class="donut-label"><strong id="chartTotal">0</strong><span>tests</span></span></button>
          <div class="legend" id="chartLegend"></div>
        </div>
      </article>
      <article class="panel" aria-labelledby="trendTitle">
        <div class="panel-head"><h2 id="trendTitle">Pass rate by run</h2><p id="trendScope"></p></div>
        <div class="chart-scroll"><svg class="trend" id="trend" viewBox="0 0 900 220" role="img" aria-label="Pass rate by run"></svg></div>
        <p class="chart-note">n is the number of tests each run executed. A 100% result from two tests is not the same signal as 100% from fifty.</p>
      </article>
    </section>

    <section class="panel" aria-labelledby="historyTitle">
      <div class="panel-head"><h2 id="historyTitle">Execution history</h2><p>Completed reports found on disk.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Run ID</th><th>Execution (${escapeHtml(resolved.timezoneLabel)})</th><th class="hide-sm">Environment</th><th class="num">Tests</th><th class="num">Pass rate</th><th class="num hide-sm">Passed</th><th class="num hide-sm">Failed</th><th class="num hide-sm">Flaky</th><th class="num">Duration</th><th>Report</th></tr></thead>
        <tbody id="historyRows"></tbody>
      </table></div>
      <p class="empty" id="noHistory" hidden>No completed historical records are available for this scope.</p>
    </section>
  </main>

  <dialog id="testDetails" aria-labelledby="detailTitle">
    <div class="dialog-head"><div><span class="status" id="detailStatus"></span><h2 id="detailTitle"></h2></div><button class="close" id="closeDetails" type="button">Close</button></div>
    <div class="details" id="detailContent"></div>
  </dialog>

  <script>
    'use strict';
    const report = ${serializedReport};
    const statuses = ['passed', 'failed', 'skipped', 'flaky'];
    const statusColors = { passed: '#34d399', failed: '#fb7185', skipped: '#94a3b8', flaky: '#fbbf24' };
    const statusPriority = { failed: 0, flaky: 1, skipped: 2, passed: 3 };
    const failureDigestThreshold = 25;
    const dashboardSettings = ${safeJson({
      timezone: resolved.timezone,
      timezoneLabel: resolved.timezoneLabel,
      timezoneOffset: resolved.timezoneOffset,
      traceHelp: resolved.traceHelp,
      runtimeLabel: resolved.runtimeLabel,
    })};
    const byId = (id) => document.getElementById(id);
    const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');

    function formatDuration(milliseconds) {
      if (!Number.isFinite(milliseconds)) return 'Not captured';
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

    function dateParts(iso) {
      return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: dashboardSettings.timezone, day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      }).formatToParts(new Date(iso)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    }

    function formatDate(iso) {
      const parts = dateParts(iso);
      return parts.day + '-' + parts.month + '-' + parts.year + ' ' + parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + parts.dayPeriod.toUpperCase() + ' ' + dashboardSettings.timezoneLabel;
    }

    function formatTime(iso) {
      const parts = dateParts(iso);
      return parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + parts.dayPeriod.toUpperCase();
    }

    function formatShortDate(iso) {
      const parts = dateParts(iso);
      return parts.day.replace(/^0/, '') + ' ' + parts.month + ', ' + parts.hour + ':' + parts.minute + ' ' + parts.dayPeriod;
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
      return textElement('span', displayName(status), 'status status-' + status);
    }

    function summaryFor(tests) {
      const summary = { total: tests.length, passed: 0, failed: 0, skipped: 0, flaky: 0, passPercentage: 0, durationMs: 0 };
      tests.forEach((test) => { summary[test.status] += 1; summary.durationMs += test.durationMs; });
      summary.passPercentage = summary.total === 0 ? 0 : Number(((summary.passed / summary.total) * 100).toFixed(1));
      return summary;
    }

    function summaryText(summary) {
      const parts = [summary.passed + '/' + summary.total + ' passed'];
      if (summary.failed) parts.push(summary.failed + ' failed');
      if (summary.skipped) parts.push(summary.skipped + ' skipped');
      if (summary.flaky) parts.push(summary.flaky + ' flaky');
      parts.push(formatDuration(summary.durationMs));
      return parts.join(' · ');
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

    function setStat(id, value) {
      byId(id).textContent = value;
    }

    /** Run-level metrics never change with filters: they describe the run. */
    function renderRunSummary() {
      const summary = report.summary;
      setStat('totalCount', summary.total);
      setStat('passedCount', summary.passed);
      setStat('failedCount', summary.failed);
      setStat('skippedCount', summary.skipped);
      setStat('flakyCount', summary.flaky);
      byId('passRate').textContent = summary.passPercentage + '%';
      byId('chartTotal').textContent = summary.total;
      byId('healthHeadline').textContent = summary.total === 0
        ? 'No test results captured'
        : summary.passed + ' of ' + summary.total + ' passed · ' + summary.passPercentage + '% pass rate · ' + formatDuration(summary.durationMs);

      const total = Math.max(summary.total, 1);
      const bar = byId('healthBar'); bar.replaceChildren();
      statuses.forEach((status) => {
        const count = summary[status]; if (!count) return;
        const segment = document.createElement('button'); segment.type = 'button'; segment.className = 'health-segment';
        segment.style.flexGrow = String(count); segment.style.background = statusColors[status];
        segment.title = displayName(status) + ': ' + count + ' (' + ((count / total) * 100).toFixed(1) + '%)';
        segment.setAttribute('aria-label', segment.title + '. Filter by ' + status + '.');
        segment.addEventListener('click', () => setFilter('status', status, 'testsTitle')); bar.append(segment);
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
        button.setAttribute('aria-label', displayName(status) + ': ' + summary[status] + ' tests. Filter by ' + status + '.');
        button.addEventListener('click', () => setFilter('status', status, 'testsTitle')); legend.append(button);
      });
    }

    function findStepError(steps) {
      for (const step of steps) {
        if (step.error) return step.error;
        const nested = findStepError(step.steps || []);
        if (nested) return nested;
      }
      return undefined;
    }

    function primaryError(test) {
      for (let index = test.attempts.length - 1; index >= 0; index -= 1) {
        const attempt = test.attempts[index];
        if (attempt.errors && attempt.errors.length) return attempt.errors[0];
        const stepError = findStepError(attempt.steps || []);
        if (stepError) return stepError;
      }
      return undefined;
    }

    function reasonText(test) {
      const error = primaryError(test);
      if (!error || !error.message) return 'No failure message was captured for this test.';
      const lines = String(error.message).split('\\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);
      return lines.slice(0, 3).join('\\n');
    }

    function evidenceSummary(test) {
      const seen = new Map();
      test.attempts.forEach((attempt) => {
        (attempt.artifacts || []).forEach((artifact) => {
          if (artifact.available === false) return;
          seen.set(artifact.kind, (seen.get(artifact.kind) || 0) + 1);
        });
      });
      return seen;
    }

    function countBy(items, keyFor) {
      const counts = new Map();
      items.forEach((item) => {
        const key = keyFor(item) || 'Unclassified';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return [...counts.entries()].sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])));
    }

    /** First meaningful line of the error, stripped of timings and timestamps, for failure clustering. */
    function failureSignature(test) {
      const error = primaryError(test);
      if (!error || !error.message) return 'No failure message captured';
      const line = String(error.message).split('\\n').map((value) => value.trim()).find(Boolean) || 'No failure message captured';
      return line
        .replace(/\\b\\d+(\\.\\d+)?\\s?(ms|s)\\b/gi, '<duration>')
        .replace(/\\b\\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z?\\b/g, '<timestamp>')
        .slice(0, 140);
    }

    function filterToFailures(moduleName) {
      if (moduleName) byId('moduleFilter').value = moduleName;
      byId('statusFilter').value = 'failed';
      renderAll();
      byId('testsTitle').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }

    /** Large runs get a triage digest instead of hundreds of cards. */
    function renderFailureDigest(failed, section) {
      const moduleCounts = countBy(failed, (test) => test.module);
      const signatures = countBy(failed, failureSignature);
      const specCount = new Set(failed.map((test) => test.spec.key)).size;
      const evidenceCount = failed.filter((test) => evidenceSummary(test).size > 0).length;

      const digest = document.createElement('div'); digest.className = 'digest';

      const moduleColumn = document.createElement('div'); moduleColumn.className = 'digest-col';
      moduleColumn.append(textElement('h3', 'Where failures cluster'));
      const moduleList = document.createElement('ul'); moduleList.className = 'digest-list';
      moduleCounts.slice(0, 5).forEach(([name, count]) => {
        const item = document.createElement('li');
        const button = document.createElement('button'); button.type = 'button'; button.className = 'digest-row';
        const bar = document.createElement('span'); bar.className = 'digest-bar';
        bar.style.width = Math.round((count / failed.length) * 100) + '%';
        button.append(textElement('span', displayName(name), 'digest-label'), textElement('span', count + ' failed', 'digest-count'), bar);
        button.title = 'Show the ' + count + ' failed test' + (count === 1 ? '' : 's') + ' in ' + displayName(name);
        button.addEventListener('click', () => filterToFailures(name));
        item.append(button); moduleList.append(item);
      });
      moduleColumn.append(moduleList);
      if (moduleCounts.length > 5) moduleColumn.append(textElement('p', '+' + (moduleCounts.length - 5) + ' more modules affected', 'digest-more'));

      const signatureColumn = document.createElement('div'); signatureColumn.className = 'digest-col';
      signatureColumn.append(textElement('h3', 'Most common failure messages'));
      const signatureList = document.createElement('ul'); signatureList.className = 'digest-list';
      signatures.slice(0, 5).forEach(([message, count]) => {
        const item = document.createElement('li'); item.className = 'digest-msg';
        item.append(textElement('span', count + '×', 'digest-count'), textElement('p', message));
        signatureList.append(item);
      });
      signatureColumn.append(signatureList);
      if (signatures.length > 5) signatureColumn.append(textElement('p', '+' + (signatures.length - 5) + ' more distinct messages', 'digest-more'));

      digest.append(moduleColumn, signatureColumn);
      section.append(digest);

      const foot = document.createElement('div'); foot.className = 'digest-foot';
      foot.append(textElement('p', specCount + ' spec file' + (specCount === 1 ? '' : 's') + ' affected · ' + evidenceCount + ' of ' + failed.length + ' failures have captured evidence', 'digest-note'));
      const review = textElement('button', 'Review all ' + failed.length + ' failed tests', 'link-button');
      review.type = 'button';
      review.addEventListener('click', () => filterToFailures());
      foot.append(review);
      section.append(foot);
    }

    function renderVerdict() {
      const section = byId('verdict');
      const summary = report.summary;
      const failed = report.tests.filter((test) => test.status === 'failed');
      const flaky = report.tests.filter((test) => test.status === 'flaky');
      section.className = 'verdict';
      section.replaceChildren();

      let kicker, headline, tone;
      if (failed.length) {
        tone = 'is-failed';
        kicker = 'Run failed';
        headline = failed.length + ' of ' + summary.total + (summary.total === 1 ? ' test failed' : ' tests failed');
      } else if (flaky.length) {
        tone = 'is-warning';
        kicker = 'Passed with retries';
        headline = flaky.length + (flaky.length === 1 ? ' test needed a retry' : ' tests needed a retry');
      } else if (summary.passed > 0) {
        tone = 'is-passed';
        kicker = 'Run passed';
        headline = 'All ' + summary.passed + (summary.passed === 1 ? ' test passed' : ' tests passed');
      } else if (summary.total > 0) {
        tone = 'is-warning';
        kicker = 'Run incomplete';
        headline = summary.total + (summary.total === 1 ? ' test was skipped' : ' tests were skipped');
      } else {
        tone = 'is-empty';
        kicker = 'No results';
        headline = 'This run has no test results';
      }
      if (tone) section.classList.add(tone);

      const headlineElement = textElement('h2', headline);
      headlineElement.id = 'verdictHeadline';
      section.append(textElement('p', kicker, 'verdict-kicker'), headlineElement);

      const sub = [];
      if (summary.total > 0) {
        sub.push(summary.passed + ' of ' + summary.total + ' passed');
        sub.push(formatDuration(summary.durationMs) + ' total');
      } else {
        sub.push('Check the raw runner output for details.');
      }
      section.append(textElement('p', sub.join(' · '), 'verdict-sub'));

      if (failed.length) {
        if (failed.length > failureDigestThreshold) {
          renderFailureDigest(failed, section);
        } else {
          const list = document.createElement('ul'); list.className = 'failure-list';
          failed.slice(0, 5).forEach((test) => {
            const item = document.createElement('li'); item.className = 'failure';
            const head = document.createElement('div'); head.className = 'failure-head';
            head.append(textElement('strong', test.title));
            item.append(head, textElement('p', reasonText(test), 'failure-reason'));

            const meta = document.createElement('div'); meta.className = 'failure-meta';
            meta.append(textElement('span', test.spec.path + ':' + test.line + ':' + test.column, 'mono'),
              textElement('span', formatDuration(test.durationMs)),
              textElement('span', 'Suite: ' + (test.suites.length ? test.suites.map(displayName).join(', ') : 'Unclassified')));
            item.append(meta);

            const foot = document.createElement('div'); foot.className = 'failure-foot';
            const chips = document.createElement('ul'); chips.className = 'chips';
            const evidence = evidenceSummary(test);
            if (evidence.size === 0) chips.append(textElement('li', 'No evidence captured', 'chip'));
            evidence.forEach((count, kind) => chips.append(textElement('li', displayName(kind) + (count > 1 ? ' ×' + count : ''), 'chip')));
            const details = textElement('button', 'View evidence', 'link-button'); details.type = 'button';
            details.addEventListener('click', () => openDetails(test));
            foot.append(chips, details);
            item.append(foot);
            list.append(item);
          });
          section.append(list);
          if (failed.length > 5) {
            const more = textElement('button', 'Review all ' + failed.length + ' failed tests', 'link-button');
            more.type = 'button';
            more.style.marginTop = '10px';
            more.addEventListener('click', () => filterToFailures());
            section.append(more);
          }
        }
      }

      if (report.globalErrors.length) {
        const box = document.createElement('div'); box.className = 'error';
        box.append(textElement('strong', report.globalErrors.length + ' run-level error' + (report.globalErrors.length === 1 ? '' : 's')));
        report.globalErrors.slice(0, 3).forEach((error) => box.append(textElement('pre', error.message)));
        section.append(box);
      }
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let pickerRuns = [];
    let pickerMonth = { year: 1970, monthIndex: 0 };
    let pickerSelectedKey = '';
    let latestPickerRun;

    /** Executions are grouped by the report timezone, not the browser's. */
    function runDateKey(iso) {
      const parts = dateParts(iso);
      return parts.year + '-' + parts.month + '-' + parts.day;
    }

    function pickerDayKey(year, monthIndex, day) {
      return year + '-' + monthNames[monthIndex].slice(0, 3) + '-' + String(day).padStart(2, '0');
    }

    function monthIndexOf(shortName) {
      return monthNames.findIndex((name) => name.slice(0, 3) === shortName);
    }

    function currentRunRecord() {
      return {
        runId: report.run.id, startTime: report.run.startTime, summary: report.summary,
        environment: report.metadata.environment, dashboardPath: '', current: true,
      };
    }

    function runsForDay(key) {
      return pickerRuns.filter((run) => runDateKey(run.startTime) === key);
    }

    function initializeRunPicker() {
      const seen = new Set();
      pickerRuns = [];
      [currentRunRecord(), ...report.history].forEach((run) => {
        if (seen.has(run.runId)) return;
        seen.add(run.runId); pickerRuns.push(run);
      });
      pickerRuns.sort((left, right) => right.startTime.localeCompare(left.startTime));

      const parts = dateParts(report.run.startTime);
      pickerMonth = { year: Number(parts.year), monthIndex: monthIndexOf(parts.month) };
      pickerSelectedKey = runDateKey(report.run.startTime);
      byId('runFilterLabel').textContent = parts.day + ' ' + parts.month + ' ' + parts.year + ' · ' + parts.hour + ':' + parts.minute + ' ' + parts.dayPeriod.toUpperCase();
      const latest = pickerRuns[0];
      latestPickerRun = latest;
      const latestLink = byId('latestRun');
      if (latest && !latest.current && latest.dashboardPath) {
        latestLink.href = latest.dashboardPath;
        latestLink.hidden = false;
        latestLink.setAttribute('aria-label', 'View latest execution from ' + formatDate(latest.startTime));
      }

      byId('runFilter').addEventListener('click', () => {
        if (byId('runFilter').getAttribute('aria-expanded') === 'true') closeRunPicker(); else openRunPicker();
      });
      byId('runPrevMonth').addEventListener('click', () => shiftRunMonth(-1));
      byId('runNextMonth').addEventListener('click', () => shiftRunMonth(1));
      document.addEventListener('click', (event) => {
        const picker = byId('runPicker');
        // Use the dispatch path: a day click re-renders the grid, so the target is already detached.
        if (picker && !event.composedPath().includes(picker)) closeRunPicker();
      });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeRunPicker(); });
    }

    function openRunPicker() {
      const parts = dateParts(report.run.startTime);
      pickerMonth = { year: Number(parts.year), monthIndex: monthIndexOf(parts.month) };
      pickerSelectedKey = runDateKey(report.run.startTime);
      renderRunPicker();
      byId('runPopover').hidden = false;
      byId('runFilter').setAttribute('aria-expanded', 'true');
      const first = byId('runDays').querySelector('.run-day.is-selected') || byId('runDays').querySelector('.run-day.has-runs');
      if (first) first.focus();
    }

    function closeRunPicker() {
      if (byId('runPopover').hidden) return;
      byId('runPopover').hidden = true;
      byId('runFilter').setAttribute('aria-expanded', 'false');
    }

    function shiftRunMonth(delta) {
      const next = pickerMonth.monthIndex + delta;
      pickerMonth = { year: pickerMonth.year + Math.floor(next / 12), monthIndex: ((next % 12) + 12) % 12 };
      renderRunPicker();
    }

    function selectRunDay(key) {
      pickerSelectedKey = key;
      const runs = runsForDay(key);
      if (runs.length === 1) { openPickerRun(runs[0]); return; }
      renderRunPicker();
      const first = byId('runDayRuns').querySelector('.run-time');
      if (first) first.focus();
    }

    function openPickerRun(run) {
      closeRunPicker();
      if (!run.current && run.dashboardPath) window.location.href = run.dashboardPath;
    }

    function renderRunPicker() {
      byId('runMonthLabel').textContent = monthNames[pickerMonth.monthIndex] + ' ' + pickerMonth.year;
      const grid = byId('runDays'); grid.replaceChildren();
      const firstWeekday = new Date(Date.UTC(pickerMonth.year, pickerMonth.monthIndex, 1)).getUTCDay();
      const daysInMonth = new Date(Date.UTC(pickerMonth.year, pickerMonth.monthIndex + 1, 0)).getUTCDate();
      const currentKey = runDateKey(report.run.startTime);

      for (let index = 0; index < firstWeekday; index += 1) {
        const blank = document.createElement('span'); blank.className = 'run-day is-blank'; blank.setAttribute('aria-hidden', 'true'); grid.append(blank);
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = pickerDayKey(pickerMonth.year, pickerMonth.monthIndex, day);
        const runs = runsForDay(key);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'run-day';
        button.textContent = String(day); button.dataset.dateKey = key;
        button.setAttribute('aria-label', day + ' ' + monthNames[pickerMonth.monthIndex] + ' ' + pickerMonth.year + ', ' + (runs.length ? runs.length + ' execution' + (runs.length === 1 ? '' : 's') : 'no executions'));
        if (key === currentKey) button.classList.add('is-current');
        if (key === pickerSelectedKey) button.classList.add('is-selected');
        if (runs.length) {
          button.classList.add('has-runs');
          button.addEventListener('click', () => selectRunDay(key));
        } else {
          button.disabled = true; button.setAttribute('aria-disabled', 'true');
        }
        grid.append(button);
      }
      renderRunDayRuns();
    }

    function renderRunDayRuns() {
      const list = byId('runDayRuns'); list.replaceChildren();
      const runs = runsForDay(pickerSelectedKey);
      if (!runs.length) return;
      if (runs.length === 1) {
        list.append(textElement('p', runs[0].current ? 'This is the execution you are viewing.' : 'Open this execution.', 'run-empty-note'));
        return;
      }
      list.append(textElement('p', runs.length + ' executions · choose a time', 'run-empty-note'));
      runs.forEach((run) => {
        const parts = dateParts(run.startTime);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'run-time';
        if (run.current) button.classList.add('is-current');
        button.append(textElement('span', parts.hour + ':' + parts.minute + ' ' + parts.dayPeriod.toUpperCase()),
          textElement('small', run.current ? 'Current' : run.summary.passed + '/' + run.summary.total + ' passed · ' + run.summary.passPercentage + '%'));
        button.setAttribute('aria-label', 'Open the ' + parts.hour + ':' + parts.minute + ' ' + parts.dayPeriod + ' execution' + (run.current ? ' (current)' : ''));
        button.addEventListener('click', () => openPickerRun(run));
        list.append(button);
      });
    }

    function initialize() {
      byId('runSubtitle').textContent = formatDate(report.run.startTime);
      byId('headerRun').textContent = report.run.id;
      byId('headerBrowser').textContent = report.metadata.browsers.join(', ') || 'Not captured';
      byId('headerProject').textContent = report.metadata.projects.join(', ') || 'Not captured';
      byId('headerEnvironment').textContent = report.metadata.environment;

      initializeRunPicker();

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

      renderRunSummary();
      renderVerdict();
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
      if (scrollTarget) byId(scrollTarget).scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }

    function renderScope(tests) {
      const filters = activeFilters();
      const active = [];
      if (filters.query) active.push('search "' + filters.query + '"');
      ['suite', 'module', 'spec', 'status', 'browser'].forEach((name) => {
        if (filters[name] !== 'all') active.push(name + ': ' + filters[name]);
      });
      const total = report.tests.length;
      if (total === 0) {
        byId('filterScope').textContent = 'No tests recorded in this run';
        return;
      }
      byId('filterScope').textContent = active.length
        ? 'Showing ' + tests.length + ' of ' + total + ' test' + (total === 1 ? '' : 's') + ' · ' + active.join(' · ')
        : 'Showing all ' + total + ' test' + (total === 1 ? '' : 's') + ' · no filters active';
    }

    function renderSuites() {
      const container = byId('suites'); container.replaceChildren();
      report.suites.forEach((suite) => {
        const tests = filteredTests('suite', suite.name); if (!tests.length) return;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'drill-card' + (byId('suiteFilter').value === suite.name ? ' active' : '');
        button.append(textElement('strong', displayName(suite.name)), textElement('p', summaryText(summaryFor(tests))));
        button.addEventListener('click', () => setFilter('suite', suite.name, 'testsTitle')); container.append(button);
      });
      byId('noSuites').textContent = report.suites.length ? 'No suites match the current filters.' : 'No suite data was recorded for this run.';
      byId('noSuites').hidden = container.childElementCount !== 0;
    }

    function renderModules() {
      const container = byId('modules'); container.replaceChildren();
      report.modules.forEach((module) => {
        const tests = filteredTests('module', module.name); if (!tests.length) return;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'drill-card' + (byId('moduleFilter').value === module.name ? ' active' : '');
        button.append(textElement('strong', displayName(module.name)), textElement('p', summaryText(summaryFor(tests))));
        button.addEventListener('click', () => setFilter('module', module.name, 'testsTitle')); container.append(button);
      });
      byId('noModules').textContent = report.modules.length ? 'No modules match the current filters.' : 'No module data was recorded for this run.';
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
        const failedCell = textElement('td', summary.failed, 'num'); if (summary.failed > 0) failedCell.style.color = 'var(--failed)';
        row.append(specCell, textElement('td', displayName(first.module), 'hide-sm'), textElement('td', variantLabel(first), 'hide-sm'),
          textElement('td', summary.total, 'num'), textElement('td', summary.passed, 'num hide-sm'), failedCell,
          textElement('td', summary.skipped, 'num hide-sm'), textElement('td', summary.flaky, 'num hide-sm'), textElement('td', formatDuration(summary.durationMs), 'num'));
        const select = () => setFilter('spec', key, 'testsTitle'); row.addEventListener('click', select);
        row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }); body.append(row);
      });
      byId('noSpecs').textContent = report.specs.length ? 'No spec files match the current filters.' : 'No spec files were recorded for this run.';
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
        const row = document.createElement('tr'); row.className = 'clickable row-' + test.status; row.tabIndex = 0;
        const testCell = document.createElement('td'); testCell.append(textElement('strong', test.title), textElement('span', test.id, 'path'));
        const locationCell = document.createElement('td'); locationCell.className = 'hide-sm';
        locationCell.append(textElement('strong', displayName(test.module)), textElement('span', test.spec.path, 'path'));
        const statusCell = document.createElement('td'); statusCell.append(statusBadge(test.status));
        const insight = failureInsight(test); if (insight) statusCell.append(document.createElement('br'), textElement('span', insight.text, insight.className));
        row.append(testCell, textElement('td', test.suites.length ? test.suites.map(displayName).join(', ') : 'Unclassified', 'hide-sm'), locationCell, statusCell,
          textElement('td', formatTime(test.attempts[0]?.startTime || report.run.startTime)), textElement('td', formatDuration(test.durationMs), 'num'),
          textElement('td', variantLabel(test), 'hide-sm'), textElement('td', test.retryAttempts + ' / ' + test.retriesConfigured, 'num hide-sm'));
        row.addEventListener('click', () => openDetails(test));
        row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(test); } }); body.append(row);
      });
      byId('noTests').textContent = report.tests.length ? 'No tests match the current filters. Clear or change filters to continue.' : 'This run recorded no test results.';
      byId('noTests').hidden = tests.length !== 0;
    }

    function historySummary(run, suiteName) {
      if (suiteName === 'all') return run.summary;
      return (run.suites || []).find((suite) => suite.name === suiteName)?.summary;
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
        row.append(textElement('td', run.runId, 'nowrap'), textElement('td', formatDate(run.startTime), 'nowrap'), textElement('td', run.environment, 'hide-sm'),
          textElement('td', summary.total, 'num'), textElement('td', summary.passPercentage + '%', 'num'),
          textElement('td', summary.passed, 'num hide-sm'), textElement('td', summary.failed, 'num hide-sm'), textElement('td', summary.flaky, 'num hide-sm'),
          textElement('td', formatDuration(summary.durationMs), 'num'), linkCell); body.append(row);
      });
      byId('noHistory').textContent = 'No completed historical records are available for this scope.';
      byId('noHistory').hidden = records.length !== 0; renderTrend(records);
    }

    function renderTrend(records) {
      const svg = byId('trend'); svg.replaceChildren();
      const suite = byId('suiteFilter').value;
      const history = [...records].reverse().slice(-12);
      const totals = history.map((item) => item.summary.total);
      const minTests = totals.length ? Math.min(...totals) : 0;
      const maxTests = totals.length ? Math.max(...totals) : 0;
      const scope = suite === 'all' ? 'Overall' : displayName(suite);
      byId('trendScope').textContent = history.length
        ? scope + ' · ' + history.length + ' completed run' + (history.length === 1 ? '' : 's') + ' · ' + (minTests === maxTests ? minTests + ' test' + (minTests === 1 ? '' : 's') + ' per run' : minTests + '–' + maxTests + ' tests per run')
        : 'No completed runs on disk yet';

      const namespace = 'http://www.w3.org/2000/svg';
      const left = 46, right = 866, top = 32, bottom = 168;
      const countHeader = document.createElementNS(namespace, 'text');
      countHeader.setAttribute('x', 8); countHeader.setAttribute('y', 16); countHeader.textContent = 'n'; svg.append(countHeader);
      [0, 25, 50, 75, 100].forEach((rate) => {
        const y = bottom - ((bottom - top) * rate / 100); const line = document.createElementNS(namespace, 'line');
        line.setAttribute('x1', left); line.setAttribute('x2', right); line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('class', 'grid');
        const label = document.createElementNS(namespace, 'text'); label.setAttribute('x', 8); label.setAttribute('y', y + 4); label.textContent = rate + '%'; svg.append(line, label);
      });

      if (!history.length) {
        const empty = document.createElementNS(namespace, 'text');
        empty.setAttribute('x', (left + right) / 2); empty.setAttribute('y', (top + bottom) / 2);
        empty.setAttribute('text-anchor', 'middle'); empty.textContent = 'No completed runs recorded yet.';
        svg.append(empty);
        return;
      }

      const points = history.map((item, index) => ({
        x: history.length === 1 ? (left + right) / 2 : left + ((right - left) * index / (history.length - 1)),
        y: bottom - ((bottom - top) * item.summary.passPercentage / 100), item
      }));

      const polyline = document.createElementNS(namespace, 'polyline');
      polyline.setAttribute('points', points.map((point) => point.x + ',' + point.y).join(' '));
      polyline.setAttribute('class', 'line'); svg.append(polyline);

      const labelEvery = Math.max(1, Math.ceil(history.length / 5));
      const anchorFor = (index) => index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
      points.forEach((point, index) => {
        const { run, summary } = point.item;
        const count = document.createElementNS(namespace, 'text');
        count.setAttribute('x', point.x); count.setAttribute('y', 16); count.setAttribute('text-anchor', anchorFor(index));
        count.setAttribute('class', 'count');
        count.textContent = String(summary.total); svg.append(count);

        if (index === 0 || index === points.length - 1 || (index % labelEvery === 0 && points.length - 1 - index >= labelEvery)) {
          const label = document.createElementNS(namespace, 'text');
          label.setAttribute('x', point.x); label.setAttribute('y', bottom + 22); label.setAttribute('text-anchor', anchorFor(index));
          label.textContent = formatShortDate(run.startTime); svg.append(label);
        }

        const circle = document.createElementNS(namespace, 'circle');
        circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', 4); circle.setAttribute('class', 'point');
        circle.setAttribute('tabindex', '0'); circle.setAttribute('role', 'link');
        const description = 'Open run ' + run.runId + ': ' + summary.passed + ' of ' + summary.total + ' passed (' + summary.passPercentage + '%)';
        circle.setAttribute('aria-label', description);
        const title = document.createElementNS(namespace, 'title'); title.textContent = description; circle.append(title);
        circle.addEventListener('click', () => { window.location.href = run.dashboardPath; });
        circle.addEventListener('keydown', (event) => { if (event.key === 'Enter') window.location.href = run.dashboardPath; });
        svg.append(circle);
      });

      svg.setAttribute('aria-label', scope + ' pass rate across ' + history.length + ' runs, with the number of tests per run shown across the top');
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
        const meta = textElement('span', step.category + ' · ' + formatDuration(step.durationMs), 'step-meta');
        meta.title = formatDate(step.startTime);
        line.append(textElement('span', step.status === 'failed' ? '×' : '✓', 'step-icon'), textElement('strong', step.title), meta);
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
      const badge = byId('detailStatus'); badge.textContent = displayName(test.status); badge.className = 'status status-' + test.status;
      byId('detailTitle').textContent = test.title;
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
      content.scrollTop = 0;
      byId('testDetails').showModal();
    }

    function renderAll() {
      const tests = filteredTests();
      renderScope(tests);
      renderSuites(); renderModules(); renderSpecs(); renderTests(tests); renderHistory();
    }

    ['search', 'suiteFilter', 'moduleFilter', 'specFilter', 'statusFilter', 'browserFilter'].forEach((id) => {
      byId(id).addEventListener(id === 'search' ? 'input' : 'change', renderAll);
    });
    byId('clearFilters').addEventListener('click', () => {
      byId('search').value = '';
      ['suiteFilter', 'moduleFilter', 'specFilter', 'statusFilter', 'browserFilter'].forEach((id) => { byId(id).value = 'all'; });
      if (latestPickerRun && !latestPickerRun.current && latestPickerRun.dashboardPath) {
        window.location.href = latestPickerRun.dashboardPath;
        return;
      }
      renderAll();
    });
    document.querySelectorAll('[data-summary-filter]').forEach((button) => button.addEventListener('click', () => setFilter('status', button.dataset.summaryFilter, 'testsTitle')));
    let chartFilterIndex = 0;
    byId('distributionChart').addEventListener('click', () => {
      chartFilterIndex = (chartFilterIndex + 1) % (statuses.length + 1);
      setFilter('status', chartFilterIndex === statuses.length ? 'all' : statuses[chartFilterIndex], 'testsTitle');
    });
    byId('closeDetails').addEventListener('click', () => byId('testDetails').close());
    byId('testDetails').addEventListener('click', (event) => { if (event.target === byId('testDetails')) byId('testDetails').close(); });

    initialize();
    renderAll();
  </script>
</body>
</html>`;
}
