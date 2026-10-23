import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const rec = JSON.parse(readFileSync('/Users/Carlos/htdocs/plitzi-experimental/laptop-express/tmp/plitzi-cache/kept-browser.json', 'utf8'));
const b = await chromium.connectOverCDP(`http://127.0.0.1:${rec.port}`);
const pages = b.contexts()[0].pages();
for (const p of pages) console.log(p.url(), await p.evaluate(() => (window as any).__plitziKept), JSON.stringify(await p.evaluate(() => (window as any).__plitziLeases ?? {})));
await b.close();
