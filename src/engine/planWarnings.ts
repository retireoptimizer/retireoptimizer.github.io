import type { Plan } from '../schemas/plan';
import { firstRetirementAgeA, householdAgeFrame, resolveWindow } from './streamWindow';
import { calendarYearAge } from '../lib/ageUtils';
import { INHERITED_DEADLINE_YEARS } from './taxConstants';
import { resolveStrategy } from './strategy/resultSettings';
import { qcdEligible } from './qcd';
import { effectiveHsaCoverage, hsaBaseLimit, hsaCatchUp, hsaLimit, HSA_MEDICARE_AGE } from './hsa';
import { tipsLadderIssues } from './tipsValidation';
import { fmtFull } from '../lib/format';
import { ssStartAge } from './socialSecurity';

/**
 * Ages (Person A's frame) with a non-zero manual Roth conversion that will actually run before the
 * first retirement year. Only `mode: 'manual'` reaches these years — auto-window and bracket-fill
 * are retirement-gated in `rothConversion()`, and `optimize: true` means the optimizer owns
 * conversions, which projection gates to 0 during accumulation.
 */
export function preRetirementConversionAges(livePlan: Plan): number[] {
  const plan = resolveStrategy(livePlan);
  if (plan.conversion.mode !== 'manual') return [];
  if (plan.conversion.optimize ?? true) return [];
  const firstRetA = firstRetirementAgeA(plan);
  return Object.entries(plan.conversion.manualSchedule)
    .filter(([age, amt]) => amt > 0 && Number(age) < firstRetA)
    .map(([age]) => Number(age))
    .sort((a, b) => a - b);
}

export interface PlanWarning {
  id: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
}

export function computePlanWarnings(livePlan: Plan): PlanWarning[] {
  const plan = resolveStrategy(livePlan);
  const warnings: PlanWarning[] = [];
  const hasB = !!plan.personB;

  const currentAgeA = calendarYearAge(plan.personA.dob);
  const currentAgeB = plan.personB ? calendarYearAge(plan.personB.dob) : undefined;

  if (plan.expenseStreams.length === 0) {
    warnings.push({ id: 'no-expenses', severity: 'warn', message: 'No expense streams — the plan will always appear fully funded.' });
  }

  // Pre-retirement Roth conversions are permitted, but their tax cannot be priced: the plan
  // models no wage income during accumulation (contributions are the only input), so the
  // conversion is taxed as if it were the household's entire income — full standard deduction
  // and bottom brackets. The reported federal tax is therefore understated, often by ~2x.
  const preRetConvAges = preRetirementConversionAges(plan);
  if (preRetConvAges.length > 0) {
    const range = preRetConvAges.length === 1
      ? `age ${preRetConvAges[0]}`
      : `ages ${preRetConvAges[0]}–${preRetConvAges[preRetConvAges.length - 1]}`;
    warnings.push({
      id: 'conv-pre-retirement-tax',
      severity: 'warn',
      message: `Roth conversions are scheduled before retirement (${range}). Tax on these is understated — no wage income is modeled during accumulation, so the conversion is taxed as the household's only income. Their tax is also funded by liquidating the brokerage account.`,
    });
  }

  for (const s of plan.incomeStreams) {
    if (s.whose === 'B' && !hasB) {
      warnings.push({ id: `inc-b-${s.id}`, severity: 'error', message: `"${s.description}" is tagged to Person B, but no Person B is configured.` });
    }
    if (s.end.mode === 'age' && s.end.age < s.startAge) {
      warnings.push({ id: `inc-order-${s.id}`, severity: 'warn', message: `"${s.description}": stop age (${s.end.age}) is before start age (${s.startAge}).` });
    }
    if (s.annualAmount === 0) {
      warnings.push({ id: `inc-zero-${s.id}`, severity: 'warn', message: `"${s.description}": amount is $0 — fill in the annual amount.` });
    }
    const ownerCurrentAge = s.whose === 'B' ? currentAgeB : currentAgeA;
    if (ownerCurrentAge !== undefined && s.startAge < ownerCurrentAge) {
      warnings.push({ id: `inc-past-${s.id}`, severity: 'warn', message: `"${s.description}": start age (${s.startAge}) is before the first simulation year (age ${ownerCurrentAge}) — earlier years are not modeled.` });
    }
    if (s.type === 'SS' && s.survivorPct > 0) {
      warnings.push({ id: `ss-surv-${s.id}`, severity: 'warn', message: `"${s.description}": SS survivor benefits are modeled separately — Survivor % should be 0.` });
    }
  }

  // For each person with multiple SS streams, at least one must be lastSurvivor
  const ssByOwner = new Map<string, typeof plan.incomeStreams>();
  for (const s of plan.incomeStreams) {
    if (s.type !== 'SS') continue;
    if (!ssByOwner.has(s.whose)) ssByOwner.set(s.whose, []);
    ssByOwner.get(s.whose)!.push(s);
  }
  for (const [whose, streams] of ssByOwner) {
    if (streams.length > 1 && !streams.some((s) => s.end.mode === 'lastSurvivor')) {
      const label = whose === 'B' ? (plan.personB?.name || 'Person B') : whose === 'A' ? (plan.personA.name || 'Person A') : 'Household';
      warnings.push({ id: `ss-no-permanent-${whose}`, severity: 'warn', message: `${label} has ${streams.length} SS streams but none ends at "Last survivor" — one should represent the permanent benefit.` });
    }
  }

  for (const s of plan.expenseStreams) {
    if (s.whose === 'B' && !hasB) {
      warnings.push({ id: `exp-b-${s.id}`, severity: 'error', message: `Expense "${s.description}" is tagged to Person B, but no Person B is configured.` });
    }
    if (s.end.mode === 'age' && s.end.age < s.startAge) {
      warnings.push({ id: `exp-order-${s.id}`, severity: 'warn', message: `Expense "${s.description}": stop age (${s.end.age}) is before start age (${s.startAge}).` });
    }
    if (s.annualAmount === 0) {
      warnings.push({ id: `exp-zero-${s.id}`, severity: 'warn', message: `Expense "${s.description}": amount is $0 — fill in the annual amount.` });
    }
    const ownerCurrentAge = s.whose === 'B' ? currentAgeB : currentAgeA;
    if (ownerCurrentAge !== undefined && s.startAge < ownerCurrentAge) {
      warnings.push({ id: `exp-past-${s.id}`, severity: 'warn', message: `Expense "${s.description}": start age (${s.startAge}) is before the first simulation year (age ${ownerCurrentAge}) — earlier years are not modeled.` });
    }
  }

  for (const ev of plan.lumpSumEvents ?? []) {
    const ownerCurrentAge = ev.whose === 'B' ? currentAgeB : currentAgeA;
    if (ownerCurrentAge === undefined || ev.age >= ownerCurrentAge) continue;
    const inheritedAcct = ev.bucket === 'inheritedPreTaxIRA' || ev.bucket === 'inheritedRoth';
    if (!inheritedAcct) {
      warnings.push({ id: `lump-past-${ev.id}`, severity: 'warn', message: `"${ev.description}": age ${ev.age} is in the past, so this event is not counted. If you still have this money, include it in your Portfolio balances.` });
    } else if (ownerCurrentAge - ev.age > INHERITED_DEADLINE_YEARS) {
      warnings.push({ id: `lump-expired-${ev.id}`, severity: 'warn', message: `"${ev.description}": the 10-year deadline to empty this inherited account has passed, so it is not counted.` });
    }
  }

  // QCD checks on charitable expense rows (see qcd.ts). A QCD pays gifts straight from the owner's IRA.
  const ownIraEmpty = (pf: Plan['portfolio']['personA']) =>
    pf.traditional <= 0
    && pf.annualContribution * pf.contribSplit.traditional <= 0
    && ((pf.spousalContribution ?? 0) <= 0 || pf.spousalTarget === 'roth');
  const firstQcdAge = (dob: string) => (qcdEligible(dob, 70) ? 70 : 71);
  const frame = householdAgeFrame(plan);
  // `offset` turns Person A's age into this spouse's age (the frame every stream window uses).
  const spouses = [
    { name: plan.personA.name || 'Person A', dob: plan.personA.dob, through: plan.personA.planThroughAge, pf: plan.portfolio.personA, offset: 0 },
    ...(plan.personB && plan.portfolio.personB && frame.deltaBA !== undefined
      ? [{ name: plan.personB.name || 'Person B', dob: plan.personB.dob, through: plan.personB.planThroughAge, pf: plan.portfolio.personB, offset: frame.deltaBA }]
      : []),
  ];
  for (const s of plan.expenseStreams) {
    if (s.category !== 'charitable' || s.annualAmount <= 0) continue;
    if (s.qcd === false) {
      warnings.push({
        id: `qcd-optout-${s.id}`,
        severity: 'info',
        message: `"${s.description}" is marked as not paid directly to a public charity (for example a donor-advised fund), so it is taxed like General spending: paid from your other accounts, with no QCD and no charity deduction. It still shows as giving in Projections.`,
      });
      continue;
    }
    // The engine pools the household's QCD-eligible giving and pays it from either spouse's IRA, so
    // every spouse who is 70½ and alive in some year of this row's age window could pay it.
    const w = resolveWindow(s, frame);
    const fromA = Math.max(w.startAge, frame.startAgeA), toA = Math.min(w.stopAge, frame.horizonA);
    const canPay = (o: typeof spouses[number]) => {
      for (let x = fromA; x <= toA; x++) {
        const age = x + o.offset;
        if (age >= firstQcdAge(o.dob) && age <= o.through) return true;
      }
      return false;
    };
    const owners = spouses.filter(canPay);
    if (owners.length > 0 && owners.every((o) => ownIraEmpty(o.pf))) {
      const who = owners.length === 1 ? `${owners[0].name}'s IRA is` : `${owners.map((o) => `${o.name}'s`).join(' and ')} IRAs are`;
      warnings.push({
        id: `qcd-no-ira-${s.id}`,
        severity: 'warn',
        message: `Charitable giving "${s.description}" can't be paid as QCDs because ${who} empty. Gifts will be paid from other accounts.`,
      });
    }
  }

  // HSA checks. Amounts are today's dollars: the limit and the contribution both index with inflation.
  const hsaWho = [
    { name: plan.personA.name || 'Person A', age: currentAgeA, claim: ssStartAge(plan, 'A')!, pf: plan.portfolio.personA },
    ...(plan.personB && plan.portfolio.personB && currentAgeB !== undefined
      ? [{ name: plan.personB.name || 'Person B', age: currentAgeB, claim: ssStartAge(plan, 'B')!, pf: plan.portfolio.personB }]
      : []),
  ];
  const money = (n: number) => fmtFull(Math.round(n));
  for (const o of hsaWho) {
    const c = o.pf.hsaContribution ?? 0;
    if (c <= 0) continue;
    if (o.age >= Math.max(HSA_MEDICARE_AGE, o.claim)) {
      warnings.push({
        id: `hsa-medicare-${o.name}`,
        severity: 'warn',
        message: `${o.name}'s HSA contribution is ignored: contributions stop once you are on Medicare (65, or when you claim Social Security if later), and ${o.name} is already past that.`,
      });
      continue;
    }
    const spouse = hsaWho.find((x) => x !== o);
    const limit = hsaLimit(effectiveHsaCoverage(o.pf.hsaCoverage, spouse?.pf.hsaCoverage), o.age, 1);
    if (c > limit + 0.5) {
      warnings.push({
        id: `hsa-limit-${o.name}`,
        severity: 'warn',
        message: `${o.name}'s HSA contribution of ${money(c)} is above the annual limit of ${money(limit)} (today's dollars; the plan raises it with inflation). Capped at the limit.`,
      });
    }
  }
  // When either spouse is on family coverage they share one family limit (§223(b)(5); each keeps
  // their own catch-up).
  if (hsaWho.length === 2 && hsaWho.some((o) => o.pf.hsaCoverage === 'family')) {
    const pool = hsaBaseLimit('family', 1) + hsaWho.reduce((s, o) => s + hsaCatchUp(o.age), 0);
    const asked = hsaWho.reduce((s, o) => s + (o.pf.hsaContribution ?? 0), 0);
    const eachWithin = hsaWho.every((o) => (o.pf.hsaContribution ?? 0) <= hsaLimit('family', o.age, 1) + 0.5);
    if (asked > pool + 0.5 && eachWithin) {
      warnings.push({
        id: 'hsa-family-pool',
        severity: 'warn',
        message: `${hsaWho[0].name} and ${hsaWho[1].name} share one family limit because ${hsaWho.every((o) => o.pf.hsaCoverage === 'family') ? 'both are' : 'one of them is'} on family coverage: together they can put in ${money(pool)}, but ${money(asked)} is entered. The second contribution is capped.`,
      });
    }
  }
  const hasAnyHsa = hsaWho.some((o) => (o.pf.hsa ?? 0) > 0 || (o.pf.hsaContribution ?? 0) > 0);
  if (hasAnyHsa && plan.state === 'CA') {
    warnings.push({
      id: 'hsa-ca-conformity',
      severity: 'warn',
      message: "California doesn't recognize HSAs: state tax on HSA growth isn't modeled.",
    });
  }

  // TIPS ladder: rungs bigger than their account are an error (the plan caps them at the balance, so the
  // numbers would be wrong); stale rungs are ignored; taxable rungs owe tax on money they haven't paid out.
  const tipsYear = new Date().getFullYear();
  const tipsIssues = tipsLadderIssues(plan.portfolio, tipsYear, { a: plan.personA.name, b: plan.personB?.name });
  for (const i of tipsIssues) {
    if (i.code === 'overflow') {
      const bal = i.account === 'traditional' ? 'pre-tax balance' : `${i.place} balance`;
      warnings.push({
        id: `tips-overflow-${i.place}`,
        severity: 'error',
        message: `TIPS rungs in ${i.place} (${money(i.total ?? 0)}) exceed the ${bal} (${money(i.balance ?? 0)}). The plan caps them at the balance.`,
      });
    } else if (i.code === 'matured') {
      warnings.push({ id: `tips-matured-${i.rungId}`, severity: 'warn', message: i.message });
    } else if (i.code === 'face') {
      warnings.push({ id: `tips-face-${i.rungId}`, severity: 'warn', message: i.message });
    } else if (i.code === 'basis') {
      warnings.push({ id: 'tips-basis', severity: 'info', message: i.message });
    } else {
      warnings.push({ id: `tips-owner-${i.rungId}`, severity: 'warn', message: `${i.message} Pick whose IRA holds it.` });
    }
  }
  const taxableTips = (plan.portfolio.tipsLadder?.rungs ?? [])
    .filter((r) => r.account === 'taxable' && r.maturityYear >= tipsYear)
    .reduce((s, r) => s + r.adjustedPrincipal, 0);
  if (taxableTips > 0) {
    warnings.push({
      id: 'tips-phantom-income',
      severity: 'info',
      message: `Taxable TIPS rungs (${money(taxableTips)}) owe federal tax each year on the inflation increase, before you get any cash. An IRA is often a better home for them. The plan counts this income from the first year either of you has retired.`,
    });
  }

  // Warn when conversions are active alongside a Roth-first withdrawal ordering. Bracket-fill
  // conversions sized against anticipated Roth draws will net to zero (converting into Roth then
  // drawing immediately cancels out). Manual/auto-window amounts are explicit user instructions
  // and are not capped, but the round-trip still makes them economically pointless.
  const convMode = plan.conversion.mode;
  const convActive = convMode !== 'off' && !(plan.conversion.optimize ?? true);
  const rothFirstOrdering = plan.withdrawalStrategy === 'rothfirst';
  if (convActive && rothFirstOrdering) {
    warnings.push({
      id: 'conv-roth-first-incoherent',
      severity: 'warn',
      message: 'Roth-first withdrawal ordering draws from the Roth account in the same year as conversions. Converted dollars are withdrawn immediately, so nothing is repositioned. Switch the withdrawal order to tax-first or traditional-first, or let the optimizer choose.',
    });
  }

  return warnings;
}
