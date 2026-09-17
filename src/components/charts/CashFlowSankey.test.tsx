/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CashFlowSankey from './CashFlowSankey';
import { runProjection } from '../../engine/projection';
import {
  planA_simple, planB_largeTradSingle, planC_bracketFillConv,
  planD_singleFIRE, planE_allRothCouple, planF_allTradCouple,
  planG_californiaCouple, planH_survivorMidPlan,
} from '../../engine/__golden/plans';

const plans = {
  A: planA_simple(), B: planB_largeTradSingle(), C: planC_bracketFillConv(),
  D: planD_singleFIRE(), E: planE_allRothCouple(), F: planF_allTradCouple(),
  G: planG_californiaCouple(), H: planH_survivorMidPlan(),
};

const columns = (svg: SVGSVGElement) => {
  const rects = Array.from(svg.querySelectorAll('rect'));
  const xs = rects.map((r) => Number(r.getAttribute('x')));
  const leftX = Math.min(...xs), rightX = Math.max(...xs);
  const sum = (x: number) => rects
    .filter((r) => Number(r.getAttribute('x')) === x)
    .reduce((s, r) => s + Number(r.getAttribute('height')), 0);
  return { left: sum(leftX), right: sum(rightX) };
};

describe('CashFlowSankey ledger', () => {
  for (const [name, plan] of Object.entries(plans)) {
    it(`Plan ${name} — sources and uses balance every year`, () => {
      const rows = runProjection(plan).rows;
      for (const row of rows) {
        const { container, unmount } = render(<CashFlowSankey row={row} />);
        const svg = container.querySelector('svg')!;
        const { left, right } = columns(svg);
        expect(Math.abs(left - right), `age ${row.ageA}: left ${left} vs right ${right}`).toBeLessThan(0.75);
        unmount();
      }
    });
  }

  it('Roth withdrawals never flow into a tax bar', () => {
    for (const plan of Object.values(plans)) {
      for (const row of runProjection(plan).rows) {
        const { container, unmount } = render(<CashFlowSankey row={row} />);
        const flows = Array.from(container.querySelectorAll('path[data-flow]'))
          .map((p) => p.getAttribute('data-flow')!);
        expect(flows).not.toContain('wdRth-fed');
        expect(flows).not.toContain('wdRth-state');
        unmount();
      }
    }
  });

  it('pre-tax money carries tax whenever a tax bill exists', () => {
    const rows = runProjection(plans.F).rows.filter((r) => r.fedTax > 100 && r.wdTrd + r.rmd > 0);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const { container, unmount } = render(<CashFlowSankey row={row} />);
      const flows = Array.from(container.querySelectorAll('path[data-flow]'))
        .map((p) => p.getAttribute('data-flow')!);
      expect(flows.some((f) => f === 'wdTrd-fed' || f === 'rmd-fed' || f === 'conv-fed')).toBe(true);
      unmount();
    }
  });
});
