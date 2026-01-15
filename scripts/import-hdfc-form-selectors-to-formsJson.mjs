/**
 * Import an extractor output folder (e.g. outputs/hdfc-form-selectors-XYZ style)
 * into the canonical selector store used by the dashboard (formsJson/).
 *
 * It will:
 *  - build a temporary canonical output via organize-hdfc-form-selectors.mjs
 *  - merge ONLY successful entries (ok=true and rows>0) into existing formsJson/
 *  - copy required by-url/*.selectors.json files
 *
 * Usage:
 *   node scripts/import-hdfc-form-selectors-to-formsJson.mjs --in "./outputs/hdfc-form-selectors-final-retry" --out "./formsJson"
 *
 * Options:
 *   --clean-in   delete the input folder after successful import
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = argv.slice(2);
  let inDir = null;
  let outDir = './formsJson';
  let cleanIn = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--in') {
      inDir = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--out') {
      outDir = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--clean-in') {
      cleanIn = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(`
Import extractor output into canonical formsJson.

Usage:
  node scripts/import-hdfc-form-selectors-to-formsJson.mjs --in "<extract-out>" --out "./formsJson"

Options:
  --in        Extractor output directory (must contain _summary.json)
  --out       Canonical output directory (default: ./formsJson)
  --clean-in  Delete input directory after successful import
`);
      process.exit(0);
    }
  }
  if (!inDir) throw new Error('Missing required --in argument');
  return { inDir, outDir, cleanIn };
}

async function readJson(p) {
  const txt = await fs.readFile(p, 'utf-8');
  return JSON.parse(txt);
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  const { inDir, outDir, cleanIn } = parseArgs(process.argv);
  const resolvedIn = path.resolve(process.cwd(), inDir);
  const resolvedOut = path.resolve(process.cwd(), outDir);

  const tmpOut = `${resolvedOut}.tmp-import`;
  await fs.rm(tmpOut, { recursive: true, force: true });

  // Build temp canonical output from the extractor output.
  const organizer = path.join(__dirname, 'organize-hdfc-form-selectors.mjs');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [organizer, '--in', resolvedIn, '--out', tmpOut], {
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    throw new Error(`Organizer failed with exit code ${r.status}`);
  }

  const tmpIndexPath = path.join(tmpOut, 'index.json');
  const tmpIndex = await readJson(tmpIndexPath);

  // Ensure destination exists
  await fs.mkdir(path.join(resolvedOut, 'by-url'), { recursive: true });

  const destIndexPath = path.join(resolvedOut, 'index.json');
  const destIndex = (await fileExists(destIndexPath)) ? await readJson(destIndexPath) : {};

  // Merge ONLY successes from tmp into dest
  let mergedCount = 0;
  let skippedCount = 0;
  for (const [urlKey, entry] of Object.entries(tmpIndex || {})) {
    const ok = !!entry?.ok;
    const rows = entry?.counts?.rows || 0;
    if (!ok || rows <= 0) {
      skippedCount += 1;
      continue;
    }
    destIndex[urlKey] = entry;
    mergedCount += 1;

    // Copy by-url file
    const relFile = entry.file; // e.g. by-url/<hash>.selectors.json
    const src = path.join(tmpOut, relFile);
    const dst = path.join(resolvedOut, relFile);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }

  await fs.writeFile(destIndexPath, JSON.stringify(destIndex, null, 2), 'utf-8');
  await fs.rm(tmpOut, { recursive: true, force: true });

  if (cleanIn) {
    await fs.rm(resolvedIn, { recursive: true, force: true });
  }

  // eslint-disable-next-line no-console
  console.log(`Imported into ${path.relative(process.cwd(), resolvedOut)}. Merged: ${mergedCount}, skipped: ${skippedCount}.`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});


