#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
require('dotenv').config();

function buildConnStr(baseUrl, overrideDb) {
  try {
    const u = new URL(baseUrl);
    if (overrideDb) u.pathname = '/' + overrideDb;
    return u.toString();
  } catch (e) {
    console.error(JSON.stringify({ status: 'error', message: 'Invalid DATABASE_URL', error: e.message }));
    process.exit(1);
  }
}

async function dbExists(connStr) {
  const pool = new Pool({ connectionString: connStr, connectionTimeoutMillis: 2000 });
  try {
    const client = await pool.connect();
    client.release();
    await pool.end();
    return true;
  } catch (e) {
    await pool.end().catch(() => {});
    if (e && e.code === '3D000') return false; // undefined_database
    throw e;
  }
}

async function ensureDatabase() {
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl) {
    console.error(JSON.stringify({ status: 'error', message: 'DATABASE_URL is not set' }));
    process.exit(1);
  }
  const url = new URL(envUrl);
  const targetDb = url.pathname.replace(/^\//, '') || 'postgres';
  const exists = await dbExists(envUrl).catch(e => {
    if (e && e.code === '3D000') return false;
    throw e;
  });
  if (exists) {
    console.log(JSON.stringify({ status: 'ok', action: 'exists', database: targetDb }));
    return;
  }
  // Connect to server-level database (postgres) and create the target db
  const serverConn = buildConnStr(envUrl, 'postgres');
  const pool = new Pool({ connectionString: serverConn, connectionTimeoutMillis: 2000 });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE DATABASE ${JSON.stringify(targetDb).slice(1,-1)}`);
      console.log(JSON.stringify({ status: 'ok', action: 'created', database: targetDb }));
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    console.error(JSON.stringify({ status: 'error', message: 'Failed to create database', error: e.message }));
    process.exit(1);
  }
}

ensureDatabase();

