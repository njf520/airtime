// Daily feed smoke test. Drives the existing test.html harness in a real headless browser (the
// same proxy chain / <audio> load checks production playback actually uses -- deliberately not a
// second, separately-maintained test implementation) against the live production site, then
// reports regressions as a single tracking GitHub issue that's updated in place rather than
// re-opened or re-notified every day it stays red.
//
// Scope is deliberately narrow: only sources the catalog already claims are feedStatus:'verified'.
// Sources that resolve dynamically at play time (Radio-Browser, SomaFM) are already skipped by
// test.html itself, since a failure there wouldn't indicate a stale catalog entry -- see test.html's
// own comment on this. That also sidesteps a real risk found during this project's own debugging:
// SomaFM's streaming edges block some cloud/datacenter IPs with 403s (confirmed sandbox-specific,
// not a real bug -- real devices played fine), and a GitHub Actions runner is also a datacenter IP.

const { chromium } = require('playwright');

const OWNER = 'njf520';
const REPO = 'airtime';
const SITE_URL = 'https://njf520.github.io/airtime/test.html';
const TRACKING_TITLE = 'Feed smoke-test failures';
const LABEL = 'smoke-test';
const STATE_MARKER_RE = /<!--\s*smoke-test-state:([\s\S]*?)-->/;
const RUN_TIMEOUT_MS = 20 * 60 * 1000;

async function ghFetch(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${opts.method || 'GET'} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function findTrackingIssue() {
  const issues = await ghFetch(`/repos/${OWNER}/${REPO}/issues?state=all&labels=${LABEL}&per_page=20`);
  return issues.find(i => i.title === TRACKING_TITLE) || null;
}

function parsePrevState(body) {
  const m = body?.match(STATE_MARKER_RE);
  if (!m) return {};
  try {
    return JSON.parse(m[1]);
  } catch {
    return {};
  }
}

function buildBody(failingMap) {
  const ids = Object.keys(failingMap);
  const list = ids.length
    ? ids.map(id => `- **${failingMap[id].name}** (\`${id}\`) -- ${failingMap[id].detail}`).join('\n')
    : '_No verified sources currently failing._';
  const stamp = new Date().toISOString().slice(0, 10);
  return `Automated daily smoke test of catalog sources marked \`feedStatus: 'verified'\`, run against production via \`test.html\`. This issue is updated in place each run rather than reopened or re-notified daily -- a comment is only added when the failing set actually changes. Last checked: ${stamp}.\n\n${list}\n\n<!-- smoke-test-state:${JSON.stringify(failingMap)} -->`;
}

async function runSmokeTest() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const consoleLog = [];
    page.on('console', msg => consoleLog.push(`[console.${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => consoleLog.push(`[pageerror] ${err.message}`));
    page.on('requestfailed', req => consoleLog.push(`[requestfailed] ${req.url()} -- ${req.failure()?.errorText}`));

    const gotoRes = await page.goto(SITE_URL, { waitUntil: 'load' });
    consoleLog.push(`[goto] status=${gotoRes?.status()} url=${page.url()}`);

    try {
      await page.waitForFunction(() => !document.getElementById('run-btn').disabled, { timeout: 30000 });
    } catch (e) {
      const btnText = await page.evaluate(() => document.getElementById('run-btn')?.textContent).catch(() => '(no button)');
      throw new Error(`Sources never finished loading (run-btn text: "${btnText}").\n${consoleLog.join('\n')}`);
    }

    await page.click('#run-btn');
    await page.waitForFunction(
      () => !document.getElementById('export-json-btn').disabled,
      { timeout: RUN_TIMEOUT_MS }
    );
    return await page.evaluate(() => (
      sources
        .filter(s => s.sourceType === 'podcast-rss' || s.sourceType === 'internet-radio')
        .map(s => ({ id: s.id, name: s.name, definedStatus: s.feedStatus, ...results[s.id] }))
    ));
  } finally {
    await browser.close();
  }
}

async function main() {
  const data = await runSmokeTest();
  const verified = data.filter(d => d.definedStatus === 'verified');

  const currentFailing = {};
  for (const d of verified) {
    if (d.status === 'fail') currentFailing[d.id] = { name: d.name, detail: d.detail || 'no detail' };
  }

  console.log(`Checked ${verified.length} verified sources: ${verified.length - Object.keys(currentFailing).length} passing, ${Object.keys(currentFailing).length} failing.`);

  const existing = await findTrackingIssue();
  const prevState = existing ? parsePrevState(existing.body) : {};

  const newlyFailing = Object.keys(currentFailing).filter(id => !prevState[id]);
  const recovered = Object.keys(prevState).filter(id => !currentFailing[id]);
  const failingCount = Object.keys(currentFailing).length;

  if (failingCount === 0) {
    if (existing && existing.state === 'open') {
      if (recovered.length) {
        await ghFetch(`/repos/${OWNER}/${REPO}/issues/${existing.number}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            body: `✅ All previously-failing sources have recovered:\n${recovered.map(id => `- ${prevState[id].name}`).join('\n')}`,
          }),
        });
      }
      await ghFetch(`/repos/${OWNER}/${REPO}/issues/${existing.number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed', body: buildBody({}) }),
      });
      console.log('All verified sources passing -- closed tracking issue.');
    } else {
      console.log('All verified sources passing -- nothing to report.');
    }
    return;
  }

  const bodyText = buildBody(currentFailing);

  if (!existing) {
    const issue = await ghFetch(`/repos/${OWNER}/${REPO}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title: TRACKING_TITLE, body: bodyText, labels: [LABEL] }),
    });
    console.log(`Opened tracking issue #${issue.number}.`);
  } else if (existing.state === 'closed') {
    await ghFetch(`/repos/${OWNER}/${REPO}/issues/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'open', body: bodyText }),
    });
    await ghFetch(`/repos/${OWNER}/${REPO}/issues/${existing.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: `⚠️ Reopened -- new failures:\n${Object.keys(currentFailing).map(id => `- ${currentFailing[id].name} -- ${currentFailing[id].detail}`).join('\n')}`,
      }),
    });
    console.log(`Reopened tracking issue #${existing.number}.`);
  } else {
    await ghFetch(`/repos/${OWNER}/${REPO}/issues/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: bodyText }),
    });
    if (newlyFailing.length || recovered.length) {
      const lines = [];
      if (newlyFailing.length) {
        lines.push(`**New failures:**\n${newlyFailing.map(id => `- ${currentFailing[id].name} -- ${currentFailing[id].detail}`).join('\n')}`);
      }
      if (recovered.length) {
        lines.push(`**Recovered:**\n${recovered.map(id => `- ${prevState[id].name}`).join('\n')}`);
      }
      await ghFetch(`/repos/${OWNER}/${REPO}/issues/${existing.number}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: lines.join('\n\n') }),
      });
      console.log(`Updated tracking issue #${existing.number} -- ${newlyFailing.length} new, ${recovered.length} recovered.`);
    } else {
      console.log(`Updated tracking issue #${existing.number} -- no change in failing set.`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
