import type { FeedbackFacts } from './facts';

/**
 * The page a report to Plitzi is written in: one `REPORT` object the agent fills — the findings, what was built, what
 * changed since the last report — and a page that lays it out the same way every time: a tally by severity, the
 * priorities, a ledger filtered by severity and area, each finding copied as an issue, in light and dark, on a phone.
 *
 * The facts the CLI read are in it already (`FACTS`): the agent writes about the project, never the versions by hand.
 * Its script is written without template literals, so this module's own template literal holds it as it is.
 */

/** JSON safe inside a `<script>`: a `</script>` in a string would end the element. */
const scriptJson = (value: unknown): string => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

export const reportTemplate = (facts: FeedbackFacts, previous: readonly string[]): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plitzi report</title>
<style>
  :root {
    --bg: #f5f6f9; --surface: #ffffff; --ink: #161a24; --muted: #5b6275; --rule: #dde1ea;
    --accent: #4422ee; --accent-soft: #ece9fe; --high: #c7292f; --high-soft: #fde8e8; --mid: #b26a00;
    --mid-soft: #fdf1dc; --low: #3a6f8f; --low-soft: #e3eff6; --good: #1d7a4f; --good-soft: #e1f3e9;
    --code-bg: #eef0f5; --on-accent: #ffffff;
    --sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #10121a; --surface: #171a24; --ink: #e8eaf2; --muted: #9aa1b5; --rule: #2a2f3e;
      --accent: #9d8bff; --accent-soft: #252047; --high: #ff7a7f; --high-soft: #3a1d22; --mid: #f0b14f;
      --mid-soft: #362a14; --low: #7fb7d8; --low-soft: #182b37; --good: #5fd39a; --good-soft: #15301f;
      --code-bg: #20242f; --on-accent: #10121a; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #10121a; --surface: #171a24; --ink: #e8eaf2; --muted: #9aa1b5; --rule: #2a2f3e;
    --accent: #9d8bff; --accent-soft: #252047; --high: #ff7a7f; --high-soft: #3a1d22; --mid: #f0b14f;
    --mid-soft: #362a14; --low: #7fb7d8; --low-soft: #182b37; --good: #5fd39a; --good-soft: #15301f;
    --code-bg: #20242f; --on-accent: #10121a; color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.55; }
  .page { max-width: 1040px; margin: 0 auto; padding: 40px 16px 72px; display: flex; flex-direction: column; gap: 40px; }
  h1, h2 { margin: 0; line-height: 1.2; text-wrap: balance; }
  h1 { font-size: clamp(28px, 4vw, 40px); font-weight: 700; letter-spacing: -0.02em; }
  h2 { font-size: 21px; font-weight: 650; }
  p { margin: 0; }
  a { color: var(--accent); }
  code { font-family: var(--mono); font-size: 0.86em; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; overflow-wrap: anywhere; }
  section, header { display: flex; flex-direction: column; gap: 14px; }
  .eyebrow { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .lede { max-width: 70ch; color: var(--muted); font-size: 16px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-family: var(--mono); font-size: 12.5px; color: var(--muted); }
  .meta b { color: var(--ink); font-weight: 500; }
  .tally { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; }
  .tally div { background: var(--surface); padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
  .tally strong { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sev); }
  .tally span { font-size: 13px; color: var(--muted); }
  [data-sev="high"] { --sev: var(--high); --sev-soft: var(--high-soft); }
  [data-sev="medium"] { --sev: var(--mid); --sev-soft: var(--mid-soft); }
  [data-sev="low"] { --sev: var(--low); --sev-soft: var(--low-soft); }
  [data-sev="improvement"] { --sev: var(--accent); --sev-soft: var(--accent-soft); }
  .built { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .built div { background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .built strong { font-family: var(--mono); font-size: 20px; font-weight: 500; }
  .built span { font-size: 13.5px; color: var(--muted); }
  .table-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 8px; background: var(--surface); }
  table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 640px; }
  th, td { text-align: left; vertical-align: top; padding: 11px 14px; border-bottom: 1px solid var(--rule); }
  thead th { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
  tbody tr:last-child td { border-bottom: 0; }
  .verdict { display: inline-block; font-family: var(--mono); font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
  .v-fixed { background: var(--good-soft); color: var(--good); }
  .v-partial { background: var(--mid-soft); color: var(--mid); }
  .v-open { background: var(--high-soft); color: var(--high); }
  .priorities { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--rule); }
  .priorities li { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--rule); }
  .priorities a { font-family: var(--mono); font-size: 13px; text-decoration: none; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center; position: sticky; top: 0; z-index: 2; background: var(--bg); padding-block: 10px; border-bottom: 1px solid var(--rule); }
  .group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .group > span { font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .chip { font: inherit; font-size: 13px; padding: 4px 11px; border-radius: 999px; border: 1px solid var(--rule); background: var(--surface); color: var(--ink); cursor: pointer; }
  .chip[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .chip:focus-visible, .btn:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .spacer { flex: 1; }
  .btn { font: inherit; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); cursor: pointer; }
  .btn.ghost { background: transparent; color: var(--accent); }
  .count, .copied { font-family: var(--mono); font-size: 12.5px; color: var(--muted); }
  .ledger { display: flex; flex-direction: column; gap: 10px; }
  .issue { background: var(--surface); border: 1px solid var(--rule); border-left: 4px solid var(--sev); border-radius: 8px; scroll-margin-top: 72px; }
  .issue summary { list-style: none; cursor: pointer; padding: 14px 16px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 14px; align-items: start; }
  .issue summary::-webkit-details-marker { display: none; }
  .id { font-family: var(--mono); font-size: 12.5px; color: var(--muted); padding-top: 2px; }
  .title { font-weight: 600; font-size: 15.5px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .tag { font-family: var(--mono); font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--code-bg); color: var(--muted); white-space: nowrap; }
  .tag.sev { background: var(--sev-soft); color: var(--sev); font-weight: 500; text-transform: uppercase; }
  .body { margin: 0; padding: 14px 16px 16px; display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px 18px; border-top: 1px solid var(--rule); }
  .body dt { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding-top: 3px; }
  .body dd { margin: 0; min-width: 0; max-width: 72ch; }
  .actions { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
  .good { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; max-width: 80ch; }
  footer { color: var(--muted); font-size: 13px; border-top: 1px solid var(--rule); padding-top: 16px; }
  [hidden] { display: none !important; }
  @media (max-width: 720px) {
    .tally { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .built { grid-template-columns: minmax(0, 1fr); }
    .issue summary, .body, .priorities li { grid-template-columns: minmax(0, 1fr); }
    .tags { justify-content: flex-start; }
    .toolbar { position: static; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <p class="eyebrow" id="eyebrow"></p>
    <h1 id="title"></h1>
    <p class="lede" id="lede"></p>
    <div class="meta" id="meta"></div>
  </header>
  <div class="tally" id="tally"></div>
  <section id="built-section"><h2 id="built-h"></h2><div class="built" id="built"></div></section>
  <section id="changed-section">
    <h2 id="changed-h"></h2>
    <div class="table-wrap"><table><thead><tr id="changed-head"></tr></thead><tbody id="changed"></tbody></table></div>
  </section>
  <section id="priorities-section"><h2 id="priorities-h"></h2><ol class="priorities" id="priorities"></ol></section>
  <section>
    <h2 id="ledger-h"></h2>
    <div class="toolbar" role="group">
      <div class="group" id="f-sev"></div>
      <div class="group" id="f-area"></div>
      <div class="spacer"></div>
      <span class="count" id="count" aria-live="polite"></span>
      <button class="btn" id="copy-all" type="button"></button>
    </div>
    <div class="ledger" id="ledger"></div>
  </section>
  <section id="worked-section"><h2 id="worked-h"></h2><ul class="good" id="worked"></ul></section>
  <footer id="footer"></footer>
</div>
<script>
// Read by the CLI (plitzi feedback): the versions and the project this report is about. Leave as it is.
const FACTS = ${scriptJson(facts)};
const PREVIOUS = ${scriptJson(previous)};

// Written by the agent. Every text may hold <code>…</code>; nothing else is needed. Fields left empty are not shown.
const REPORT = {
  // The language the report is written in, and the page's labels in it.
  lang: 'en',
  labels: {
    eyebrow: 'Usage report',
    built: 'What was built',
    changed: 'What changed since the last report',
    changedHead: ['Finding', 'Status now', 'How I saw it'],
    status: { fixed: 'fixed', partial: 'partly', open: 'still open' },
    priorities: 'Where I would start',
    findings: 'Findings',
    severity: 'Severity',
    area: 'Area',
    severities: { high: 'High', medium: 'Medium', low: 'Low', improvement: 'Improvement' },
    tally: { high: 'High severity', medium: 'Medium severity', low: 'Low severity', improvement: 'Improvements' },
    fields: {
      what: 'What happens', repro: 'Reproduce', evidence: 'Evidence', impact: 'Impact',
      workaround: 'How I worked around it', fix: 'Proposed fix'
    },
    copyAll: 'Copy what is shown as Markdown',
    copyOne: 'Copy as an issue',
    copied: 'Copied',
    copyFailed: 'Could not copy: select the text by hand',
    of: 'of',
    worked: 'What worked well',
    version: 'Version',
    project: 'Project',
    date: 'Date',
    previous: 'Earlier reports'
  },
  title: '',
  lede: '',
  // Each: { figure: '12 pages · 2 layouts', text: 'What they are' }.
  built: [],
  // Each, for a finding of an earlier report: { point: 'PZ-32 · what it was', url: '', status: 'fixed' | 'partial' | 'open', how: '' }.
  changed: [],
  // The few to start with: { ids: ['PZ-60'], text: 'Why first' }.
  priorities: [],
  // Each: { id, sev: 'high' | 'medium' | 'low' | 'improvement', area, title, what, repro, evidence, impact, workaround, fix }.
  issues: [],
  // What worked, each a sentence: as useful to Plitzi as what did not.
  worked: [],
  footer: ''
};

const L = REPORT.labels;
const SEVS = ['high', 'medium', 'low', 'improvement'];
const FIELDS = ['what', 'repro', 'evidence', 'impact', 'workaround', 'fix'];
const VERSION = FACTS.packages['@plitzi/sdk-authoring'] || FACTS.packages['@plitzi/plitzi-sdk'] || FACTS.cli;
const state = { sev: new Set(), area: new Set() };

const el = function (tag, className, html) {
  const node = document.createElement(tag);
  if (className) { node.className = className; }
  if (html !== undefined) { node.innerHTML = html; }
  return node;
};
const setText = function (id, text) { document.getElementById(id).innerHTML = text; };
const hideEmpty = function (id, list) { document.getElementById(id).hidden = !list.length; };

document.documentElement.lang = REPORT.lang;
document.title = REPORT.title || 'Plitzi report';
setText('eyebrow', L.eyebrow);
setText('title', REPORT.title);
setText('lede', REPORT.lede);

const meta = document.getElementById('meta');
const packages = Object.keys(FACTS.packages).map(function (name) { return name.replace('@plitzi/', '') + ' ' + FACTS.packages[name]; });
const metaItems = [
  [L.version, packages.length ? packages.join(' · ') : 'cli ' + FACTS.cli],
  ['Node', FACTS.node + ' · ' + FACTS.os],
  [L.date, FACTS.date]
];
if (FACTS.project) {
  metaItems.splice(1, 0, [L.project, FACTS.project.name + ' · ' + FACTS.project.mode + ' · ' + FACTS.project.source]);
}
metaItems.forEach(function (item) {
  const span = el('span');
  span.append(item[0] + ': ');
  span.append(el('b', '', item[1]));
  meta.append(span);
});
if (PREVIOUS.length) {
  const span = el('span');
  span.append(L.previous + ': ');
  PREVIOUS.forEach(function (url, index) {
    if (index) { span.append(' · '); }
    const link = el('a', '', String(index + 1));
    link.href = url;
    span.append(link);
  });
  meta.append(span);
}

const tally = document.getElementById('tally');
SEVS.forEach(function (sev) {
  const box = el('div');
  box.dataset.sev = sev;
  box.append(el('strong', '', String(REPORT.issues.filter(function (issue) { return issue.sev === sev; }).length)));
  box.append(el('span', '', L.tally[sev]));
  tally.append(box);
});

setText('built-h', L.built);
REPORT.built.forEach(function (item) {
  const box = el('div');
  box.append(el('strong', '', item.figure));
  box.append(el('span', '', item.text));
  document.getElementById('built').append(box);
});
hideEmpty('built-section', REPORT.built);

setText('changed-h', L.changed);
L.changedHead.forEach(function (label) { document.getElementById('changed-head').append(el('th', '', label)); });
REPORT.changed.forEach(function (item) {
  const row = el('tr');
  const point = el('td');
  if (item.url) {
    const link = el('a', '', item.point);
    link.href = item.url;
    point.append(link);
  } else {
    point.innerHTML = item.point;
  }
  row.append(point);
  const status = el('td');
  status.append(el('span', 'verdict v-' + item.status, L.status[item.status] || item.status));
  row.append(status);
  row.append(el('td', '', item.how || ''));
  document.getElementById('changed').append(row);
});
hideEmpty('changed-section', REPORT.changed);

setText('priorities-h', L.priorities);
REPORT.priorities.forEach(function (item) {
  const row = el('li');
  const ids = el('span');
  item.ids.forEach(function (id, index) {
    if (index) { ids.append(' · '); }
    const link = el('a', '', id);
    link.href = '#' + id;
    ids.append(link);
  });
  row.append(ids);
  row.append(el('span', '', item.text));
  document.getElementById('priorities').append(row);
});
hideEmpty('priorities-section', REPORT.priorities);

const toMarkdown = function (html) {
  return String(html).replace(/<code>(.*?)<\\/code>/g, '\\u0060$1\\u0060').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};
const issueMarkdown = function (issue) {
  return ['### ' + issue.id + ' · ' + toMarkdown(issue.title),
    '**' + L.severity + ':** ' + L.severities[issue.sev] + ' · **' + L.area + ':** ' + issue.area + ' · **' + L.version + ':** ' + VERSION,
    ''].concat(FIELDS.filter(function (field) { return issue[field]; }).map(function (field) {
    return '**' + L.fields[field] + ':** ' + toMarkdown(issue[field]);
  })).join('\\n');
};
const copy = function (text, note, after) {
  navigator.clipboard.writeText(text)
    .then(function () { note.textContent = L.copied; })
    .catch(function () { note.textContent = L.copyFailed; })
    .finally(function () { setTimeout(function () { note.textContent = after; }, 2400); });
};

REPORT.issues.sort(function (a, b) {
  return SEVS.indexOf(a.sev) - SEVS.indexOf(b.sev) || a.id.localeCompare(b.id, 'en', { numeric: true });
});
const visible = function (issue) {
  return (!state.sev.size || state.sev.has(issue.sev)) && (!state.area.size || state.area.has(issue.area));
};
const render = function () {
  const ledger = document.getElementById('ledger');
  ledger.innerHTML = '';
  const shown = REPORT.issues.filter(visible);
  shown.forEach(function (issue) {
    const details = el('details', 'issue');
    details.id = issue.id;
    details.dataset.sev = issue.sev;
    const summary = el('summary');
    summary.append(el('span', 'id', issue.id), el('span', 'title', issue.title));
    const tags = el('span', 'tags');
    tags.append(el('span', 'tag sev', L.severities[issue.sev]), el('span', 'tag', issue.area), el('span', 'tag', VERSION));
    summary.append(tags);
    const body = el('dl', 'body');
    FIELDS.filter(function (field) { return issue[field]; }).forEach(function (field) {
      body.append(el('dt', '', L.fields[field]), el('dd', '', issue[field]));
    });
    const actions = el('div', 'actions');
    const note = el('span', 'copied');
    const button = el('button', 'btn ghost', L.copyOne);
    button.type = 'button';
    button.addEventListener('click', function () { copy(issueMarkdown(issue), note, ''); });
    actions.append(note, button);
    body.append(actions);
    details.append(summary, body);
    ledger.append(details);
  });
  document.getElementById('count').textContent = shown.length + ' ' + L.of + ' ' + REPORT.issues.length;
};
const chips = function (id, label, items, set) {
  const box = document.getElementById(id);
  box.append(el('span', '', label));
  items.forEach(function (item) {
    const chip = el('button', 'chip', item.label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', function () {
      if (set.has(item.key)) { set.delete(item.key); } else { set.add(item.key); }
      chip.setAttribute('aria-pressed', String(set.has(item.key)));
      render();
    });
    box.append(chip);
  });
};
setText('ledger-h', L.findings);
chips('f-sev', L.severity, SEVS.map(function (sev) { return { key: sev, label: L.severities[sev] }; }), state.sev);
chips('f-area', L.area, Array.from(new Set(REPORT.issues.map(function (issue) { return issue.area; }))).map(function (area) {
  return { key: area, label: area };
}), state.area);
render();

const copyAll = document.getElementById('copy-all');
copyAll.textContent = L.copyAll;
copyAll.addEventListener('click', function () {
  const count = document.getElementById('count');
  copy('# ' + toMarkdown(REPORT.title) + '\\n\\n' + REPORT.issues.filter(visible).map(issueMarkdown).join('\\n\\n'), count, count.textContent);
});

const openIssue = function (id) {
  const target = document.getElementById(id);
  if (target && target.tagName === 'DETAILS') { target.open = true; target.scrollIntoView({ block: 'start' }); }
};
document.querySelectorAll('.priorities a').forEach(function (link) {
  link.addEventListener('click', function () { openIssue(link.getAttribute('href').slice(1)); });
});
if (location.hash) { openIssue(location.hash.slice(1)); }

setText('worked-h', L.worked);
REPORT.worked.forEach(function (text) { document.getElementById('worked').append(el('li', '', text)); });
hideEmpty('worked-section', REPORT.worked);
setText('footer', REPORT.footer);
</script>
</body>
</html>
`;
