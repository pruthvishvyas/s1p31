import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, '..', 'backend', 'output');
const target = path.resolve(root, 'public', 'data');

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return n;
}

function stamp(dir) {
  try {
    const text = fs.readFileSync(path.join(dir, 'frontend_contract.json'), 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text).generated_at || 'unknown';
  } catch {
    return 'unknown';
  }
}

if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
  const guarded = path.basename(target) === 'data' && path.basename(path.dirname(target)) === 'public' && fs.existsSync(path.join(root, 'package.json'));
  if (!guarded) {
    console.error('Refusing to replace a folder that is not this site data copy: ' + target);
    process.exit(1);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log('Data refreshed: ' + countFiles(target) + ' files, analysis run ' + stamp(target));
} else if (fs.existsSync(path.join(target, 'frontend_contract.json'))) {
  console.log('Using the existing data copy (run ' + stamp(target) + ')');
} else {
  console.error('No data found.');
  console.error('Run main.py and then export_for_frontend.py in the backend folder, then try again.');
  process.exit(1);
}
