#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function ts() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${day}-${hh}${mm}${ss}Z`;
}

const base = path.join('.data', 'test-logs');
const dir = path.join(base, ts());
fs.mkdirSync(dir, { recursive: true });

// Also update a stable "latest" pointer
try {
  const latest = path.join(base, 'latest');
  try { fs.rmSync(latest, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(latest, { recursive: true });
} catch (e) {
  // ignore
}

const jsonOut = path.join(dir, 'jest-results.json');
const textOut = path.join(dir, 'jest-console.log');

const cmd = `jest --runInBand --verbose --detectOpenHandles --json --outputFile ${jsonOut} 2>&1 | tee ${textOut}`;
console.log('Test logs directory:', dir);

const child = spawn('sh', ['-lc', cmd], { stdio: 'inherit' });
child.on('exit', (code) => {
  try {
    const baseLatest = path.join(base, 'latest');
    try { fs.rmSync(baseLatest, { recursive: true, force: true }); } catch (e) {}
    fs.mkdirSync(baseLatest, { recursive: true });
    // Copy artifacts into latest for quick access
    if (fs.existsSync(jsonOut)) fs.copyFileSync(jsonOut, path.join(baseLatest, 'jest-results.json'));
    if (fs.existsSync(textOut)) fs.copyFileSync(textOut, path.join(baseLatest, 'jest-console.log'));
    fs.writeFileSync(path.join(baseLatest, 'run-dir.txt'), dir);
  } catch (e) {
    // ignore
  }
  process.exit(code);
});
