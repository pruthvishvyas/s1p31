import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS, resolveDatasetPath, chartCandidates } from '../src/utils/datasets.js';
import { adaptContract, adaptSimulation, adaptChartFile } from '../src/utils/adapters.js';
import { defaultsFor, predict } from '../src/utils/predict.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public', 'data');
let failed = false;

function readRaw(rel) {
  const file = path.join(dataDir, rel);
  if (!fs.existsSync(file)) return { state: 'MISSING', message: rel };
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (!text.trim()) return { state: 'MISSING', message: 'empty file' };
    return { state: 'READ', raw: JSON.parse(text) };
  } catch (err) {
    return { state: 'INVALID', message: 'not valid JSON: ' + err.message };
  }
}

function load(rel, adapt) {
  const got = readRaw(rel);
  if (got.state !== 'READ') return got;
  const raw = got.raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.status === 'skipped') {
    return { state: 'UNAVAILABLE', message: 'skipped: ' + (raw.reason || 'no reason given') };
  }
  try {
    return { state: 'OK', data: adapt ? adapt(raw) : raw };
  } catch (err) {
    return { state: 'INVALID', message: err.message };
  }
}

const contractResult = load('frontend_contract.json', adaptContract);
if (contractResult.state !== 'OK') {
  console.error('INVALID  frontend_contract.json  ' + (contractResult.message || ''));
  process.exit(1);
}
const contract = contractResult.data;
console.log('Contract OK: project ' + contract.project.name + ', schema ' + contract.schemaVersion + ', run ' + contract.generatedAt);

const results = {};
for (const [name, def] of Object.entries(DATASETS)) {
  const rel = resolveDatasetPath(contract, def).replace(/^\/data\//, '');
  const res = load(rel, def.adapt);
  results[name] = res;
  console.log(res.state.padEnd(12) + name.padEnd(18) + rel + (res.message ? '  (' + res.message + ')' : ''));
  if (res.state === 'INVALID') failed = true;
}

const sims = results.simulations;
if (sims && sims.state === 'OK') {
  for (const item of sims.data) {
    const res = load(item.file, adaptSimulation);
    console.log(res.state.padEnd(12) + ('  sim ' + item.id).padEnd(18) + item.file + (res.message ? '  (' + res.message + ')' : ''));
    if (res.state === 'INVALID' || res.state === 'MISSING') failed = true;
  }
}

const chartList = results.charts;
if (chartList && chartList.state === 'OK') {
  for (const c of chartList.data.filter(x => x.pending)) {
    let res = { state: 'MISSING', message: 'no chart file named' };
    for (const cand of chartCandidates(c.file)) {
      res = load(cand.replace(/^\/data\//, ''), raw => adaptChartFile(raw, c));
      if (res.state !== 'MISSING') break;
    }
    console.log(res.state.padEnd(12) + ('  chart ' + c.id).padEnd(18) + c.file + (res.message ? '  (' + res.message + ')' : ''));
    if (res.state === 'INVALID' || res.state === 'MISSING') failed = true;
  }
}

for (const core of ['kpis', 'charts', 'insights']) {
  if (!results[core] || results[core].state !== 'OK') {
    console.error('A core file is not usable: ' + core);
    failed = true;
  }
}

let mode = 'unavailable (the Predict page will explain why and show a disabled form)';
const scorer = results.scorer;
if (scorer && scorer.state === 'OK') {
  mode = 'model scoring (' + scorer.data.type + ')';
  try {
    const out = predict(scorer.data, defaultsFor(scorer.data.fields));
    const bad = !Number.isFinite(out.value) || (scorer.data.task === 'classification' && (out.value < 0 || out.value > 100));
    if (bad) { console.error('INVALID  scoring smoke test returned ' + out.value); failed = true; }
    if (scorer.data.fidelity && scorer.data.fidelity.quality === 'low') console.warn('Warning: the scoring file reports low fidelity');
  } catch (err) {
    console.error('INVALID  scoring smoke test threw: ' + err.message);
    failed = true;
  }
} else if (results.forecastLookup && results.forecastLookup.state === 'OK') {
  mode = 'lookup';
} else if (results.forecast && results.forecast.state === 'OK' && results.forecast.data.forecast.length > 0) {
  mode = 'forecast period';
}
console.log('Predict page mode: ' + mode);

const PERSONAL = /(e[-_]?mail|phone|mobile|full[-_]?name|first[-_]?name|last[-_]?name)/i;
const LOCAL_PATH = /(^|[^A-Za-z])[A-Za-z]:\\{1,2}[A-Za-z]|\/Users\/|\/home\//;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.json')) continue;
    const text = fs.readFileSync(full, 'utf8');
    const rel = path.relative(dataDir, full);
    if (LOCAL_PATH.test(text)) { console.error('INVALID  ' + rel + ' contains a local file path'); failed = true; }
    const keys = text.match(/"([A-Za-z_ -]+)"\s*:/g) || [];
    if (keys.some(k => PERSONAL.test(k))) console.warn('Warning: ' + rel + ' has a field that looks personal; it will not be displayed');
  }
}
walk(dataDir);

if (failed) {
  console.error('\nData check failed. Fix the lines marked INVALID or MISSING above.');
  process.exit(1);
}
console.log('\nData check passed.');
