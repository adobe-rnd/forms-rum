/**
 * Build a canonical selector index for fast URL -> (label/selector) mapping.
 *
 * Input:
 *   One or more extractor output folders that contain a `_summary.json` and subfolders.
 *
 * Output (default):
 *   formsJson/
 *     index.json                          (URL-keyed index)
 *     by-url/<sha1-8>.selectors.json      (flat selector rows)
 *
 * Usage:
 *   node scripts/organize-hdfc-form-selectors.mjs --in "./outputs/hdfc-form-selectors-all" --out "./formsJson"
 *   node scripts/organize-hdfc-form-selectors.mjs --in "./outputs/hdfc-form-selectors-all" --in "./outputs/hdfc-form-selectors-test" --out "./formsJson"
 *
 * Optional:
 *   --clean-input   Deletes the input folder(s) after successful export
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function sha1_8(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8);
}

function normalizeUrlKey(url) {
  try {
    const u = new URL(String(url));
    // Normalize to origin + pathname (strip hash/query/trailing slashes)
    const pathname = (u.pathname || '/').replace(/\/+$/, '');
    return `${u.origin}${pathname}`;
  } catch (e) {
    return String(url || '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const inputDirs = [];
  let outDir = './formsJson';
  let cleanInput = false;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--in') {
      const v = args[i + 1];
      if (!v) throw new Error('Missing value for --in');
      inputDirs.push(v);
      i += 1;
      continue;
    }
    if (a === '--out') {
      const v = args[i + 1];
      if (!v) throw new Error('Missing value for --out');
      outDir = v;
      i += 1;
      continue;
    }
    if (a === '--clean-input') {
      cleanInput = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(`
Organize selector extraction outputs into a canonical URL-keyed index.

Usage:
  node scripts/organize-hdfc-form-selectors.mjs --in "<extract-output-dir>" --out "<canonical-out-dir>"
  node scripts/organize-hdfc-form-selectors.mjs --in "<dir1>" --in "<dir2>" --out "<out>"

Options:
  --in           Input extractor output directory (repeatable; must contain _summary.json)
  --out          Output directory (default: ./formsJson)
  --clean-input  Delete input directories after successful export
`);
      process.exit(0);
    }
  }

  if (!inputDirs.length) {
    throw new Error('Provide at least one --in directory that contains _summary.json');
  }
  return { inputDirs, outDir, cleanInput };
}

async function readJson(filePath) {
  const txt = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(txt);
}

function pickBestRecord(existing, next) {
  if (!existing) return next;
  const exOk = !!existing.ok;
  const nxOk = !!next.ok;
  if (nxOk && !exOk) return next;
  if (exOk && !nxOk) return existing;

  const exCount = (existing.counts?.afv1 || 0) + (existing.counts?.afv2 || 0);
  const nxCount = (next.counts?.afv1 || 0) + (next.counts?.afv2 || 0);
  if (nxCount > exCount) return next;
  return existing;
}

function stripHtmlLabel(label) {
  const v = String(label || '').trim();
  if (!v) return '';
  // If it doesn't look like HTML, keep as-is.
  if (!v.includes('<') && !v.includes('>') && !v.includes('&nbsp;')) return v;
  return v
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenSelectors(fields) {
  const rows = [];
  (Array.isArray(fields) ? fields : []).forEach((f) => {
    const label = (f && typeof f.label === 'string') ? stripHtmlLabel(f.label) : '';
    const id = f?.id || null;
    const qname = f?.qname || null;
    const selectors = Array.isArray(f?.selectors) ? f.selectors : [];
    selectors.forEach((sel) => {
      const s = String(sel || '').trim();
      if (!s) return;
      const kind = s.endsWith('___label') ? 'label' : (s.endsWith('___widget') ? 'widget' : 'unknown');
      rows.push({ label, selector: s, kind, id, qname });
    });
  });
  return rows;
}

async function main() {
  const { inputDirs, outDir, cleanInput } = parseArgs(process.argv);
  const resolvedOut = path.resolve(process.cwd(), outDir);
  const byUrlDir = path.join(resolvedOut, 'by-url');
  await fs.mkdir(byUrlDir, { recursive: true });

  // Merge summaries across inputs, keeping one "best" record per normalized URL.
  const merged = new Map(); // urlKey -> record (augmented with _inRoot)

  for (const inDir of inputDirs) {
    const resolvedIn = path.resolve(process.cwd(), inDir);
    const summaryPath = path.join(resolvedIn, '_summary.json');
    const summary = await readJson(summaryPath);
    (Array.isArray(summary) ? summary : []).forEach((rec) => {
      const key = normalizeUrlKey(rec?.url);
      const withRoot = { ...rec, _inRoot: resolvedIn };
      merged.set(key, pickBestRecord(merged.get(key), withRoot));
    });
  }

  const index = {};

  for (const [urlKey, rec] of merged.entries()) {
    const url = rec?.url || urlKey;
    const fileKey = sha1_8(urlKey);

    const outFile = path.join(byUrlDir, `${fileKey}.selectors.json`);

    let rows = [];
    let formName = rec?.formName || null;
    let ok = !!rec?.ok;
    let error = rec?.error || null;

    if (ok && rec?.outDir) {
      // outDir in summary is relative to process.cwd(); join to repo root
      const inRoot = rec._inRoot || process.cwd();
      const sourceOutDir = path.isAbsolute(rec.outDir) ? rec.outDir : path.join(process.cwd(), rec.outDir);

      // When pulling from another input directory, try to rebase the stored outDir.
      const candidateDirs = [
        sourceOutDir,
        path.join(inRoot, rec.outDir),
      ];
      let actualDir = null;
      // eslint-disable-next-line no-restricted-syntax
      for (const d of candidateDirs) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const st = await fs.stat(d);
          if (st.isDirectory()) { actualDir = d; break; }
        } catch (e) {
          // ignore
        }
      }

      if (actualDir) {
        const files = await fs.readdir(actualDir);
        const afv1 = files.find((f) => f.endsWith('.afv1.json'));
        const afv2 = files.find((f) => f.endsWith('.afv2.json'));

        const v1Fields = afv1 ? await readJson(path.join(actualDir, afv1)) : [];
        const v2Fields = afv2 ? await readJson(path.join(actualDir, afv2)) : [];
        rows = rows.concat(flattenSelectors(v1Fields));
        rows = rows.concat(flattenSelectors(v2Fields));
      } else {
        ok = false;
        error = `Could not locate outDir on disk: ${rec.outDir}`;
      }
    }

    // De-dupe selector rows (selector string is the stable key)
    const uniq = new Map();
    rows.forEach((r) => {
      const k = r.selector;
      if (!uniq.has(k)) uniq.set(k, r);
    });
    rows = Array.from(uniq.values());

    await fs.writeFile(outFile, JSON.stringify({ url, urlKey, formName, ok, error, rows }, null, 2), 'utf-8');

    index[urlKey] = {
      url,
      urlKey,
      file: `by-url/${fileKey}.selectors.json`,
      formName,
      ok,
      error,
      counts: { rows: rows.length },
    };
  }

  await fs.writeFile(path.join(resolvedOut, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

  // Optionally delete input directories once canonical output exists.
  if (cleanInput) {
    for (const inDir of inputDirs) {
      const resolvedIn = path.resolve(process.cwd(), inDir);
      // eslint-disable-next-line no-await-in-loop
      await fs.rm(resolvedIn, { recursive: true, force: true });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Wrote selector index: ${path.relative(process.cwd(), path.join(resolvedOut, 'index.json'))}`);
  // eslint-disable-next-line no-console
  console.log(`URL entries: ${Object.keys(index).length}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});





