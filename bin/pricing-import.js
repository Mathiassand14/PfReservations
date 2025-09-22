#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('../lib/pricing/csv');
const { createLogger } = require('../services/logger');
const log = createLogger('cli:pricing-import');

function parseArgs(argv) {
  const args = { file: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--file' || a === '-f') && argv[i + 1]) { args.file = argv[++i]; continue; }
  }
  return args;
}

async function main() {
  const { file } = parseArgs(process.argv);
  if (!file) {
    log.error('missing_file_argument', { hint: 'Use --file <path>' });
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    log.error('file_not_found', { filePath });
    process.exit(1);
  }
  const { rows, rebatePercent, basePrices, errors } = csv.parseCsvFile(filePath);
  const out = {
    status: 'ok',
    file: filePath,
    total_rows: rows.length,
    errors,
    derived_internal_rebate_percent: rebatePercent,
    created_items: null,
    updated_items: null,
    base_prices_count: basePrices.length,
  };
  log.info('csv_parsed', { file: filePath, rows: rows.length, basePrices: basePrices.length, errors: errors.length, internalRebatePercent: rebatePercent });
  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => {
  log.error('import_failed', { error: err.message });
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});
