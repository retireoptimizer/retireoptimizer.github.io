#!/usr/bin/env tsx
/**
 * CLI optimizer — runs the engine directly against an exported plan JSON,
 * bypassing the browser, the Web Worker, Vite, and Zustand. Use this to
 * confirm what the engine produces independent of the UI.
 *
 * Usage:
 *   pnpm exec tsx scripts/optimize-cli.ts <plan.json> [--thorough] [--write-back]
 *
 * Examples:
 *   pnpm exec tsx scripts/optimize-cli.ts reference/fireopt-2026-05-28-4.json --thorough
 *   pnpm exec tsx scripts/optimize-cli.ts reference/fireopt-2026-05-28-4.json --thorough --write-back > out.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { optimizeStrategy } from '../src/engine/optimizer';

const args = process.argv.slice(2);
const inputPath = args[0];
const thorough = args.includes('--thorough');
const writeBack = args.includes('--write-back');
const outPath = args.find((a, i) => args[i - 1] === '-o');

if (!inputPath) {
  console.error('Usage: optimize-cli.ts <plan.json> [--thorough] [--write-back] [-o output.json]');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inputPath, 'utf-8'));
const plan = raw.plan;

console.error(`Loaded plan from ${inputPath}`);
console.error(`  conversion.mode = ${plan.conversion.mode}`);
console.error(`  withdrawalStrategy = ${plan.withdrawalStrategy}`);
console.error(`  state = ${plan.state}`);
console.error(`  thorough = ${thorough}`);
console.error(`\nRunning optimizer (max-end-balance)...`);

const t0 = Date.now();
const result = optimizeStrategy(plan, 'max-end-balance', { thorough });
const ms = Date.now() - t0;

console.error(`Done in ${ms}ms · ${result.evaluations} evaluations\n`);
console.error(`Headline:           ${result.headline}`);
console.error(`End balance (real): $${result.projection.endTotalReal.toFixed(0)}`);
console.error(`Plan ran out?       ${result.ranOut}`);

const retAge = plan.personA.retirementAge;
const planTo = plan.personA.planToAge;

console.error('\nPer-year conversions (real $):');
console.error('Age   Conv          TaxPct  TradPct  RothPct');
console.error('---   -----------   ------  -------  -------');
const convs: number[] = [];
for (let age = retAge; age <= Math.min(planTo, retAge + 35); age++) {
  const w = result.perYearPolicy.windows.find((w) => age >= w.fromAge && age <= w.toAge);
  if (!w) continue;
  const c = w.convAmt ?? 0;
  convs.push(c);
  const bar = '█'.repeat(Math.round(c / 5000));
  console.error(
    `${age}   $${Math.round(c).toLocaleString().padStart(9)}   ` +
    `${(w.pctTaxable * 100).toFixed(0).padStart(3)}%    ` +
    `${(w.pctTraditional * 100).toFixed(0).padStart(3)}%    ` +
    `${(w.pctRoth * 100).toFixed(0).padStart(3)}%   ${bar}`
  );
}

let variation = 0;
for (let i = 1; i < convs.length; i++) variation += Math.abs(convs[i] - convs[i - 1]);
const total = convs.reduce((a, b) => a + b, 0);
console.error(`\nTotal conversion: $${Math.round(total).toLocaleString()}`);
console.error(`Variation/total ratio: ${(variation / Math.max(1, total)).toFixed(3)} (lower = smoother; healthy < 0.5)`);

if (writeBack) {
  const out = { ...raw, plan: { ...plan, customPolicy: result.policy } };
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.error(`\nWrote updated plan to ${outPath}`);
  } else {
    // Print to stdout so the user can pipe to a file or `pbcopy`.
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
