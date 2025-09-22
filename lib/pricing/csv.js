'use strict';

const fs = require('fs');

function normalizeName(raw) {
  const name = String(raw || '').trim();
  const lower = name.toLowerCase();
  const isService = /pr\.?\s*time/.test(lower);
  let kind = null;
  if (/dagspris/.test(lower)) kind = 'Daily';
  else if (/start/.test(lower)) kind = 'Start';
  else if (isService) kind = 'Hourly';

  let group = null;
  if (/\(([^)]*intern)/i.test(name)) group = 'Internal';
  else if (/\(([^)]*ekstern)/i.test(name)) group = 'Ekstern';

  // Base name: strip trailing parenthetical
  const base = name.replace(/\s*\([^)]*\)\s*$/,'').trim();
  return { baseName: base, group, kind, isService };
}

function parseCsvContent(content) {
  const lines = String(content || '').split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return { rows: [], rebatePercent: 0, basePrices: [], errors: [] };
  const header = lines[0];
  const headers = parseCsvLine(header);
  const idxCode = headers.findIndex(h => /^\s*Vare#/.test(h));
  const idxName = headers.findIndex(h => /^\s*Vare\s*$/.test(h));
  const idxPrice = headers.findIndex(h => /^\s*Priser?\s*$/.test(h));
  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length) continue;
    try {
      const legacy_code = idxCode >= 0 ? cols[idxCode] : undefined;
      const name = idxName >= 0 ? cols[idxName] : cols[0];
      const amountRaw = idxPrice >= 0 ? cols[idxPrice] : cols[cols.length - 1];
      const amount = Number(String(amountRaw).replace(',', '.'));
      if (!name || !Number.isFinite(amount)) throw new Error('Invalid row');
      const meta = normalizeName(name);
      rows.push({ legacy_code, name, amount, ...meta });
    } catch (e) {
      errors.push({ row: i + 1, message: e.message });
    }
  }

  const rebatePercent = deriveInternalRebatePercent(rows);
  const basePrices = toBasePrices(rows);
  return { rows, rebatePercent, basePrices, errors };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cur += ch;
    } else {
      if (ch === '"') { inQuotes = true; continue; }
      if (ch === ',') { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function deriveInternalRebatePercent(rows) {
  const pairs = {};
  for (const r of rows) {
    if (r.isService) continue; // exclude Hourly
    if (!(r.kind === 'Start' || r.kind === 'Daily')) continue;
    const key = `${r.baseName}::${r.kind}`;
    if (!pairs[key]) pairs[key] = {};
    if (r.group === 'Ekstern') pairs[key].ekstern = r.amount;
    if (r.group === 'Internal') pairs[key].internal = r.amount;
  }
  const discounts = [];
  Object.values(pairs).forEach(p => {
    if (Number.isFinite(p.ekstern) && Number.isFinite(p.internal) && p.ekstern > 0) {
      const pct = ((p.ekstern - p.internal) / p.ekstern) * 100;
      if (isFinite(pct) && pct >= 0) discounts.push(pct);
    }
  });
  if (!discounts.length) return 0;
  const avg = discounts.reduce((a, b) => a + b, 0) / discounts.length;
  return +avg.toFixed(2);
}

function toBasePrices(rows) {
  // Build base prices from Ekstern (or, if only Intern exists, use that amount as base)
  const map = new Map(); // key: baseName::kind -> amount
  for (const r of rows) {
    const key = `${r.baseName}::${r.kind}`;
    if (!r.kind) continue;
    if (r.isService && r.kind !== 'Hourly') continue; // service only hourly
    if (!map.has(key)) map.set(key, { baseName: r.baseName, kind: r.kind, isService: r.isService, amount: undefined, source: null });
    const entry = map.get(key);
    if (r.group === 'Ekstern') { entry.amount = r.amount; entry.source = 'Ekstern'; }
    else if (entry.amount === undefined) { entry.amount = r.amount; entry.source = r.group || 'Unknown'; }
  }
  return Array.from(map.values()).filter(e => Number.isFinite(e.amount));
}

function parseCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseCsvContent(content);
}

module.exports = {
  normalizeName,
  parseCsvLine,
  parseCsvContent,
  parseCsvFile,
  deriveInternalRebatePercent,
  toBasePrices,
};

