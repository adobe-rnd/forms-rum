/**
 * Extract AF v1/v2 field selector metadata from all HDFC URLs in forms/journey-mapping.json
 *
 * Usage:
 *   node scripts/extract-hdfc-form-selectors.mjs
 *
 * Output:
 *   outputs/hdfc-form-selectors/<formName>/<formName>.afv1.json
 *   outputs/hdfc-form-selectors/<formName>/<formName>.afv2.json
 *   outputs/hdfc-form-selectors/_summary.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In sandboxed environments, Playwright cannot write to the default OS cache path.
// Default to a workspace-local browser cache so installs + runs work reliably.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '..', '.playwright-browsers');
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function safeName(s) {
  const cleaned = String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\-(). ]+/g, '')
    .replace(/[ /]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'unknown_form';
}

function shortHash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8);
}

async function readJourneyUrls() {
  const journeyPath = path.join(__dirname, '..', 'forms', 'journey-mapping.json');
  const txt = await fs.readFile(journeyPath, 'utf-8');
  const json = JSON.parse(txt);

  const urls = [];
  Object.values(json || {}).forEach((v) => {
    if (typeof v === 'string' && v.startsWith('http')) urls.push(v);
  });

  // Keep only HDFC-related URLs (user asked “all the hdfc urls”)
  const filtered = urls.filter((u) => /hdfc/i.test(u));
  return uniq(filtered);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const urls = [];
  let outRootOverride = null;
  let headful = false;
  let delayMs = 1500;
  let retries = 2;
  let freshContextPerUrl = true;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--url' || a === '-u') {
      const v = args[i + 1];
      if (!v) throw new Error('Missing value for --url');
      urls.push(v);
      i += 1;
      continue;
    }
    if (a === '--out') {
      const v = args[i + 1];
      if (!v) throw new Error('Missing value for --out');
      outRootOverride = v;
      i += 1;
      continue;
    }
    if (a === '--headful') {
      headful = true;
      continue;
    }
    if (a === '--delay-ms') {
      const v = args[i + 1];
      if (!v) throw new Error('Missing value for --delay-ms');
      delayMs = Number(v);
      if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('Invalid --delay-ms value');
      i += 1;
      continue;
    }
    if (a === '--retries') {
      const v = args[i + 1];
      if (!v) throw new Error('Missing value for --retries');
      retries = Number(v);
      if (!Number.isFinite(retries) || retries < 0) throw new Error('Invalid --retries value');
      i += 1;
      continue;
    }
    if (a === '--no-fresh-context') {
      freshContextPerUrl = false;
      continue;
    }
    if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(`
Extract AF v1/v2 field selector metadata from HDFC URLs.

Usage:
  node scripts/extract-hdfc-form-selectors.mjs
  node scripts/extract-hdfc-form-selectors.mjs --url "<url>"
  node scripts/extract-hdfc-form-selectors.mjs --url "<url1>" --url "<url2>"

Options:
  --url, -u   Extract only for the provided URL(s) (repeatable)
  --out       Override output directory (default: outputs/hdfc-form-selectors)
  --headful   Launch a visible browser (helps when headless is blocked)
  --delay-ms  Delay between URLs (default: 1500)
  --retries   Extra retries on navigation failures (default: 2)
  --no-fresh-context  Reuse a single browser context across URLs (faster, but more likely to get blocked)
`);
      process.exit(0);
    }
  }

  return { urls: uniq(urls), outRootOverride, headful, delayMs, retries, freshContextPerUrl };
}

function buildEvalScript() {
  // This string is executed in the page context.
  return `
(() => {
  function cssEscape(v) {
    try { return CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_\\-]/g, '\\\\$&'); } catch (e) { return String(v); }
  }

  // Old CSS-ish selector (kept for backward compatibility)
  function cssSelector(el) {
    if (!el) return null;
    let elSel = '';
    if (el.id) {
      elSel = '#' + cssEscape(el.id);
    } else {
      // Fallback: tag + nth-child chain (best effort)
      const parts = [];
      let cur = el;
      while (cur && cur.nodeType === 1 && cur !== document.body) {
        const tag = cur.tagName ? cur.tagName.toLowerCase() : 'node';
        const parent = cur.parentElement;
        if (!parent) { parts.unshift(tag); break; }
        const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        const idx = siblings.indexOf(cur) + 1;
        parts.unshift(siblings.length > 1 ? tag + ':nth-of-type(' + idx + ')' : tag);
        cur = parent;
        if (cur && cur.id) { parts.unshift('#' + cssEscape(cur.id)); break; }
      }
      elSel = parts.join(' > ');
    }

    const form = el.closest('form');
    const formSel = form ? ('form' + (form.id ? ('#' + cssEscape(form.id)) : '')) : '';
    return formSel ? (formSel + ' ' + elSel) : elSel;
  }

  // RUM-like source selector logic (matches the code you shared)
  function walk(el, checkFn) {
    if (!el || el === document.body || el === document.documentElement) return undefined;
    return checkFn(el) || walk(el.parentElement || (el.parentNode && el.parentNode.host), checkFn);
  }

  function isDialog(el) {
    if (el.tagName === 'DIALOG') return true;
    const cs = window.getComputedStyle(el);
    return ['dialog', 'alertdialog'].find((r) => el.getAttribute('role') === r)
      || el.getAttribute('aria-modal') === 'true'
      || (cs && cs.position === 'fixed' && cs.zIndex > 100);
  }

  function isButton(el) {
    if (el.tagName === 'BUTTON') return true;
    if (el.tagName === 'INPUT' && el.getAttribute('type') === 'button') return true;
    if (el.tagName === 'A') {
      const classes = Array.from(el.classList);
      return classes.some((className) => className.match(/button|cta/));
    }
    return el.getAttribute('role') === 'button';
  }

  function getSourceContext(el) {
    const formEl = el && el.closest ? el.closest('form') : null;
    if (formEl) {
      const id = formEl.getAttribute('id');
      if (id) return \`form#\${cssEscape(id)}\`;
      return \`form\${formEl.classList.length > 0 ? \`.\${cssEscape(formEl.classList[0])}\` : ''}\`;
    }
    const block = el && el.closest ? el.closest('.block[data-block-name]') : null;
    return ((block && \`.\${block.getAttribute('data-block-name')}\`)
      || (walk(el, isDialog) && 'dialog')
      || (walk(el, (e) => e.tagName && e.tagName.includes('-') && e.tagName.toLowerCase()))
      || ['nav', 'header', 'footer', 'aside'].find((t) => el && el.closest && el.closest(t))
      || walk(el, (e) => e.id && \`#\${cssEscape(e.id)}\`));
  }

  function getSourceElement(el) {
    const f = el && el.closest ? el.closest('form') : null;
    if (f && Array.from(f.elements || []).includes(el)) {
      return (el.tagName.toLowerCase()
        + (['INPUT', 'BUTTON'].includes(el.tagName)
          ? \`[type='\${el.getAttribute('type') || ''}']\`
          : ''));
    }
    if (walk(el, isButton)) return 'button';
    const t = el && el.tagName ? el.tagName.toLowerCase() : '';
    return t.match(/^(a|img|video|form)$/) && t;
  }

  function getSourceIdentifier(el) {
    if (el && el.id) return \`#\${cssEscape(el.id)}\`;
    if (el && el.getAttribute && el.getAttribute('data-block-name')) return \`.\${el.getAttribute('data-block-name')}\`;
    return (el && el.classList && el.classList.length > 0 && \`.\${cssEscape(el.classList[0])}\`);
  }

  function rumSourceSelector(el) {
    try {
      if (!el || el === document.body || el === document.documentElement) return undefined;
      if (el.getAttribute && el.getAttribute('data-rum-source')) return el.getAttribute('data-rum-source');
      const ctx = getSourceContext(el.parentElement) || '';
      const name = getSourceElement(el) || '';
      const id = getSourceIdentifier(el) || '';
      return \`\${ctx} \${name}\${id}\`.trim() || \`"\${(el.textContent || '').substring(0, 10)}"\`;
    } catch (e) {
      return null;
    }
  }

  // When RUM captures clicks, the clicked node is often a wrapper element, not the actual input.
  // In those cases getSourceElement() returns '' and RUM emits "form#... #<id>" (no input[type]).
  // To make matching robust, emit multiple variants per element.
  function selectorVariants(el) {
    const out = [];
    const rum = rumSourceSelector(el);
    if (rum) out.push(rum);

    // Simplified ctx + identifier (matches RUM when name is empty)
    try {
      const ctx = getSourceContext(el && el.parentElement) || '';
      const id = getSourceIdentifier(el) || '';
      const simple = \`\${ctx} \${id}\`.trim();
      if (simple) out.push(simple);
    } catch (e) {}

    const css = cssSelector(el);
    if (css) out.push(css);

    // De-dupe
    return Array.from(new Set(out.filter(Boolean)));
  }

  function visitV2(form, data = []) {
    if (!form || !form.items || !Array.isArray(form.items)) return data;
    form.items.forEach((field) => {
      if (field && field.items && Array.isArray(field.items)) {
        visitV2(field, data);
      } else if (field && field.id) {
        const htmlEl = document.getElementById(field.id);
        const selectors = selectorVariants(htmlEl);
        data.push({
          id: field.id,
          label: (field && field.label && field.label.value) || field.name || field.id,
          qname: field.qualifiedName,
          selectors,
        });
      }
    });
    return data;
  }

  function visitV1(data = []) {
    const gb = window.guideBridge;
    if (!gb || typeof gb.visit !== 'function') return data;
    gb.visit((field) => {
      if (!field || field.children) return;
      if (field.className === 'guideInstanceManager' || field.className === 'guideNode') return;
      const htmlEl = document.getElementById(field.id);
      if (!htmlEl) return;

      const labels = Array.from(htmlEl.querySelectorAll('label'));
      const widgets = Array.from(htmlEl.querySelectorAll('input,select,button,textarea'));

      let selectors = [];
      selectors = selectors.concat(widgets.flatMap((el) => selectorVariants(el)));
      selectors = selectors.concat(labels.flatMap((el) => selectorVariants(el)));
      selectors = Array.from(new Set(selectors));

      if (selectors.length > 0) {
        data.push({
          id: field.id,
          label: field.title,
          qname: field.somExpression,
          selectors,
        });
      }
    });
    return data;
  }

  function afv2() {
    const data = [];
    const form = window.myForm || window.formModel || null;
    visitV2(form, data);
    return data;
  }

  function afv1() {
    const data = [];
    visitV1(data);
    return data;
  }

  function getFormName() {
    // Prefer AF model titles, fallback to document title / URL
    try {
      const v2 = window.myForm || window.formModel;
      const v2Title = v2 && v2.title && (v2.title.value || v2.title);
      if (typeof v2Title === 'string' && v2Title.trim()) return v2Title.trim();
      if (v2 && typeof v2.name === 'string' && v2.name.trim()) return v2.name.trim();
    } catch (e) {}

    try {
      const gb = window.guideBridge;
      const gm = gb && typeof gb.getGuideModel === 'function' ? gb.getGuideModel() : null;
      if (gm && typeof gm.title === 'string' && gm.title.trim()) return gm.title.trim();
    } catch (e) {}

    if (document && document.title) return document.title;
    return String(location && location.pathname ? location.pathname : 'unknown');
  }

  return {
    formName: getFormName(),
    afv1: afv1(),
    afv2: afv2(),
    globals: {
      hasGuideBridge: !!window.guideBridge,
      hasMyForm: !!window.myForm,
      hasFormModel: !!window.formModel,
    },
    meta: {
      title: document && document.title ? document.title : null,
      href: String(location && location.href ? location.href : ''),
    },
  };
})()
`;
}

async function main() {
  const { urls: cliUrls, outRootOverride, headful, delayMs, retries, freshContextPerUrl } = parseArgs(process.argv);
  const urls = cliUrls.length ? cliUrls : await readJourneyUrls();
  if (!urls.length) {
    console.error('No URLs found. Provide --url "<url>" or add URLs to forms/journey-mapping.json');
    process.exitCode = 1;
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch (e) {
    console.error('Missing dependency: playwright-core');
    console.error('Run: npm i -D playwright-core');
    process.exitCode = 1;
    return;
  }

  const outRoot = outRootOverride
    ? path.resolve(process.cwd(), outRootOverride)
    : path.join(__dirname, '..', 'outputs', 'hdfc-form-selectors');
  await fs.mkdir(outRoot, { recursive: true });

  const browser = await chromium.launch({
    headless: !headful,
    // Prefer system Chrome if available (avoids downloading browsers)
    channel: 'chrome',
  }).catch(async () => {
    // Fallback: try without specifying channel
    return chromium.launch({ headless: !headful });
  });

  async function newContextAndPage() {
    const context = await browser.newContext({
      // Give the page a realistic-ish environment; some CDNs are picky even without automation.
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en;q=0.9',
        'Sec-CH-UA': '"Chromium";v="121", "Not A(Brand";v="24", "Google Chrome";v="121"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"macOS"',
      },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        // Reduce obvious automation fingerprints (not a guarantee, but can help with some CDNs).
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      } catch (e) {}
    });
    return { context, page };
  }

  const shared = freshContextPerUrl ? null : await newContextAndPage();

  const evalScript = buildEvalScript();
  const summary = [];

  for (const url of urls) {
    const record = {
      url,
      ok: false,
      formName: null,
      outDir: null,
      error: null,
      counts: null,
      http: null,
      detected: null,
    };
    try {
      const attemptErrors = [];
      let resp = null;
      let context = null;
      let page = null;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          if (freshContextPerUrl) {
            ({ context, page } = await newContextAndPage());
          } else {
            ({ context, page } = shared);
          }

          // Some HDFC pages (and intermediate security layers) may never reach DOMContentLoaded.
          // Use 'commit' to ensure we at least get a document, then wait a bit for AF globals to appear.
          resp = await page.goto(url, { waitUntil: 'commit', timeout: 90_000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
          await page.waitForFunction(() => !!(window.guideBridge || window.myForm || window.formModel), { timeout: 25_000 }).catch(() => {});
          await page.waitForTimeout(1200);
          break; // navigation succeeded enough to evaluate
        } catch (e) {
          attemptErrors.push(String(e && e.message ? e.message : e));
          if (freshContextPerUrl && context) await context.close().catch(() => {});

          // Exponential-ish backoff with jitter to reduce rate limiting.
          const backoff = Math.min(15_000, 1500 * (2 ** attempt)) + Math.floor(Math.random() * 750);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }

      if (!page) {
        throw new Error(`Failed to create page/context for ${url}`);
      }
      if (!resp && attemptErrors.length) {
        throw new Error(attemptErrors[attemptErrors.length - 1]);
      }

      const title = await page.title().catch(() => null);
      record.http = {
        status: resp ? resp.status() : null,
        ok: resp ? resp.ok() : null,
        finalUrl: page.url(),
        title,
      };

      const result = await page.evaluate(evalScript);
      const baseName = safeName(result?.formName || title || url);
      const uniqueName = `${baseName}__${shortHash(url)}`;
      const outDir = path.join(outRoot, uniqueName);
      await fs.mkdir(outDir, { recursive: true });

      const v1Path = path.join(outDir, `${uniqueName}.afv1.json`);
      const v2Path = path.join(outDir, `${uniqueName}.afv2.json`);
      const debugHtmlPath = path.join(outDir, `${uniqueName}.__page.html`);
      const debugPngPath = path.join(outDir, `${uniqueName}.__page.png`);
      const errorJsonPath = path.join(outDir, `${uniqueName}.__error.json`);

      const v1 = Array.isArray(result?.afv1) ? result.afv1 : [];
      const v2 = Array.isArray(result?.afv2) ? result.afv2 : [];

      await fs.writeFile(v1Path, JSON.stringify(v1, null, 2), 'utf-8');
      await fs.writeFile(v2Path, JSON.stringify(v2, null, 2), 'utf-8');

      const isCloudFrontBlock = String(title || '').toLowerCase().includes('the request could not be satisfied')
        || String(result?.meta?.title || '').toLowerCase().includes('the request could not be satisfied');
      const globals = result?.globals || {};
      const hasAnyAfGlobal = !!(globals.hasGuideBridge || globals.hasMyForm || globals.hasFormModel);

      record.detected = { isCloudFrontBlock, globals };
      record.ok = !isCloudFrontBlock && hasAnyAfGlobal;
      record.formName = result?.formName || null;
      record.outDir = path.relative(process.cwd(), outDir);
      record.counts = { afv1: v1.length, afv2: v2.length };

      if (!record.ok) {
        const html = await page.content().catch(() => null);
        if (html) await fs.writeFile(debugHtmlPath, html, 'utf-8');
        await page.screenshot({ path: debugPngPath, fullPage: true }).catch(() => {});
        await fs.writeFile(
          errorJsonPath,
          JSON.stringify(
            {
              url,
              title,
              finalUrl: page.url(),
              reason: record.error || null,
              detected: record.detected || null,
              http: record.http || null,
            },
            null,
            2,
          ),
          'utf-8',
        );
        if (isCloudFrontBlock) {
          record.error = 'Blocked by CDN / CloudFront (got "The request could not be satisfied" page).';
        } else if (!hasAnyAfGlobal) {
          record.error = 'AF globals (guideBridge/myForm/formModel) not found on page.';
        }
      }

      if (freshContextPerUrl && context) await context.close().catch(() => {});
    } catch (e) {
      // On early navigation failures we might not have a page to screenshot.
      record.error = String(e && e.message ? e.message : e);

      // Still produce a stable output folder with the error for debugging.
      const baseName = `FAILED__${safeName(url)}`;
      const uniqueName = `${baseName}__${shortHash(url)}`;
      const outDir = path.join(outRoot, uniqueName);
      await fs.mkdir(outDir, { recursive: true }).catch(() => {});
      const errorJsonPath = path.join(outDir, `${uniqueName}.__error.json`);
      await fs.writeFile(
        errorJsonPath,
        JSON.stringify({ url, error: record.error }, null, 2),
        'utf-8',
      ).catch(() => {});
      record.outDir = path.relative(process.cwd(), outDir);
    }
    summary.push(record);
    // eslint-disable-next-line no-console
    console.log(
      `[${record.ok ? 'OK' : 'FAIL'}] ${url} -> ${record.outDir || ''} ${record.counts ? JSON.stringify(record.counts) : ''}${
        !record.ok && record.error ? ` | ${String(record.error).split('\n')[0]}` : ''
      }`,
    );

    if (delayMs) {
      // Gentle pacing across URLs to reduce rate limiting / bot detection.
      await new Promise((r) => setTimeout(r, delayMs + Math.floor(Math.random() * 500)));
    }
  }

  await fs.writeFile(path.join(outRoot, '_summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
  await browser.close();

  const okCount = summary.filter((s) => s.ok).length;
  console.log(`Done. Success: ${okCount}/${summary.length}. Output: ${path.relative(process.cwd(), outRoot)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


