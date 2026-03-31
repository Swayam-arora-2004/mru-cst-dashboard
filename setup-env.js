#!/usr/bin/env node
/**
 * setup-env.js
 * Reads the root .env and generates:
 *   - backend/.env        (all backend vars)
 *   - frontend/.env.local (NEXT_PUBLIC_* vars only)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const rootEnvPath = path.join(ROOT, '.env');

if (!fs.existsSync(rootEnvPath)) {
  console.error('❌  Root .env not found. Please create one first.');
  process.exit(1);
}

const raw = fs.readFileSync(rootEnvPath, 'utf-8');
const lines = raw.split('\n');

// ── Frontend: only NEXT_PUBLIC_* vars ──────────────────────
const frontendLines = lines.filter(
  (l) => l.startsWith('NEXT_PUBLIC_') || l.startsWith('#') || l.trim() === ''
);
fs.writeFileSync(path.join(ROOT, 'frontend', '.env.local'), frontendLines.join('\n'));
console.log('✅  frontend/.env.local updated');

// ── Backend: all vars except NEXT_PUBLIC_* ─────────────────
const backendLines = lines.filter((l) => !l.startsWith('NEXT_PUBLIC_'));
fs.writeFileSync(path.join(ROOT, 'backend', '.env'), backendLines.join('\n'));
console.log('✅  backend/.env updated');

console.log('\n🎉  Done! Fill in the placeholder values in .env and re-run this script.');
