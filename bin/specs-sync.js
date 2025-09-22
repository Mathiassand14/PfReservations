#!/usr/bin/env node
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function copyDir(src, dest) {
  if (!(await exists(src))) return;
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules') continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fsp.mkdir(path.dirname(d), { recursive: true });
      await fsp.copyFile(s, d);
    }
  }
}

async function main() {
  const repoRoot = process.cwd();
  const kiroDir = path.join(repoRoot, '.kiro');
  const specsDir = path.join(repoRoot, '.Specs');
  const importedDir = path.join(specsDir, '_Kiro');

  await fsp.mkdir(specsDir, { recursive: true });
  await fsp.mkdir(importedDir, { recursive: true });

  // Import steering and specs from .kiro into .Specs/_Kiro
  const steeringSrc = path.join(kiroDir, 'steering');
  const specsSrc = path.join(kiroDir, 'specs');
  const steeringDst = path.join(importedDir, 'steering');
  const specsDst = path.join(importedDir, 'specs');

  await copyDir(steeringSrc, steeringDst);
  await copyDir(specsSrc, specsDst);

  // Write manifest
  const now = new Date().toISOString();
  const manifest = { importedAt: now };
  await fsp.writeFile(path.join(importedDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ status: 'ok', importedAt: now, importedPaths: [steeringDst, specsDst] }));
}

main().catch(err => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});

