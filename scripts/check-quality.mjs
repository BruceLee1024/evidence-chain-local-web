import { readFileSync } from 'node:fs';

const limits = [
  ['src/App.jsx', 220],
  ['src/pages/PackagePage.jsx', 430],
  ['src/components.jsx', 380],
  ['shared/evidenceDomain.js', 80],
  ['server/app.js', 80],
  ['server/routes/ai.js', 120],
  ['server/routes/evidence.js', 260],
  ['server/routes/projects.js', 100],
  ['server/routes/search.js', 100],
  ['server/routes/settlements.js', 380]
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
