#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL;
const maxAttempts = parseInt(process.env.DB_WAIT_ATTEMPTS || '30', 10);
const delayMs = parseInt(process.env.DB_WAIT_DELAY_MS || '1000', 10);

if (!url) {
  console.error('DATABASE_URL not set; cannot wait for DB');
  process.exit(1);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryConnect() {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 1000 });
  try {
    const res = await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch (e) {
    await pool.end().catch(() => {});
    return false;
  }
}

(async () => {
  for (let i = 1; i <= maxAttempts; i++) {
    const ok = await tryConnect();
    if (ok) {
      console.log(`DB ready after ${i} attempt(s)`);
      process.exit(0);
    }
    console.log(`Waiting for DB... (${i}/${maxAttempts})`);
    await sleep(delayMs);
  }
  console.error('DB not ready in time');
  process.exit(1);
})();

