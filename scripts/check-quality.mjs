import { readFileSync } from 'node:fs';

const limits = [
  ['src/App.jsx', 220],
  ['src/pages/PackagePage.jsx', 430],
  ['src/components.jsx', 380],
  ['server/app.js', 760]
];

const failures = [];

for (const [file, maxLines] of limits) {
  const lines = readFileSync(file, 'utf8').split('\n').length;
  if (lines > maxLines) {
    failures.push(`${file} has ${lines} lines; expected <= ${maxLines}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Quality checks passed');
