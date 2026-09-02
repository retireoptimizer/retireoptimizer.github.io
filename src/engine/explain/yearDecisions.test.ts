import { describe, it, expect } from 'vitest';
import { buildYearDecisions, type YearDecisionContext } from './yearDecisions';
import { fmtUSD } from '../../lib/format';

const base: YearDecisionContext = {
  year: 2040,
  ageA: 68,
  conv: 0,
  convPolicyZero: false,
  headroomNominal: 52_000,
  maxConv: 600_000,
  ceilForConv: 206_700,
  baseOrdIncome: 154_700,
  tradBalance: 600_000,
  wdTax: 39_900,
  wdTrd: 0,
  wdRth: 0,
  gap: 71_300,
  rmdAmt: 0,
  bracketOverridden: false,
  spill: undefined,
  spillWindow: undefined,
  isActiveBracketfill: false,
  bracketfillRoom: 0,
};

describe('buildYearDecisions', () => {
  describe('conv-bracket-headroom', () => {
    it('fires and is binding when headroomNominal <= maxConv', () => {
      const ctx: YearDecisionContext = { ...base, conv: 52_000, headroomNominal: 52_000, maxConv: 600_000 };
      const notes = buildYearDecisions(ctx);
      const n = notes.find(x => x.code === 'conv-bracket-headroom');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(true);
      expect(n!.severity).toBe('info');
    });

    it('binding flips at headroomNominal === maxConv (boundary: headroom IS maxConv → bracket binds)', () => {
      const ctx: YearDecisionContext = { ...base, conv: 40_000, headroomNominal: 40_000, maxConv: 40_000 };
      const notes = buildYearDecisions(ctx);
      expect(notes.find(x => x.code === 'conv-bracket-headroom')?.binding).toBe(true);
      expect(notes.find(x => x.code === 'conv-trad-cap')).toBeUndefined();
    });

    it('text contains all amounts fmtUSD-formatted', () => {
      const ctx: YearDecisionContext = { ...base, conv: 52_000, headroomNominal: 52_000, maxConv: 600_000 };
      const { text } = buildYearDecisions(ctx).find(x => x.code === 'conv-bracket-headroom')!;
      expect(text).toContain(fmtUSD(52_000));
      expect(text).toContain(fmtUSD(206_700));
      expect(text).toContain(fmtUSD(154_700));
    });
  });

  describe('conv-trad-cap', () => {
    it('fires and is binding when headroomNominal > maxConv', () => {
      const ctx: YearDecisionContext = { ...base, conv: 30_000, headroomNominal: 80_000, maxConv: 30_000 };
      const notes = buildYearDecisions(ctx);
      const n = notes.find(x => x.code === 'conv-trad-cap');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(true);
    });

    it('conv-bracket-headroom is absent when conv-trad-cap fires', () => {
      const ctx: YearDecisionContext = { ...base, conv: 30_000, headroomNominal: 80_000, maxConv: 30_000 };
      expect(buildYearDecisions(ctx).find(x => x.code === 'conv-bracket-headroom')).toBeUndefined();
    });

    it('text contains fmtUSD amounts', () => {
      const ctx: YearDecisionContext = { ...base, conv: 30_000, headroomNominal: 80_000, maxConv: 30_000 };
      const { text } = buildYearDecisions(ctx).find(x => x.code === 'conv-trad-cap')!;
      expect(text).toContain(fmtUSD(80_000));
      expect(text).toContain(fmtUSD(30_000));
    });
  });

  describe('conv-policy-zero', () => {
    it('fires when convPolicyZero=true and conv=0', () => {
      const ctx: YearDecisionContext = { ...base, conv: 0, convPolicyZero: true };
      const notes = buildYearDecisions(ctx);
      const n = notes.find(x => x.code === 'conv-policy-zero');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(true);
    });

    it('does not fire when conv>1 (conversion actually happened)', () => {
      const ctx: YearDecisionContext = { ...base, conv: 10_000, convPolicyZero: true };
      expect(buildYearDecisions(ctx).find(x => x.code === 'conv-policy-zero')).toBeUndefined();
    });
  });

  describe('conv-with-trad-wd', () => {
    it('fires (non-binding) when conv>1 and wdTrd>1', () => {
      const ctx: YearDecisionContext = { ...base, conv: 52_000, wdTrd: 31_400 };
      const notes = buildYearDecisions(ctx);
      const n = notes.find(x => x.code === 'conv-with-trad-wd');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(false);
    });

    it('does not fire when wdTrd=0', () => {
      const ctx: YearDecisionContext = { ...base, conv: 52_000, wdTrd: 0 };
      expect(buildYearDecisions(ctx).find(x => x.code === 'conv-with-trad-wd')).toBeUndefined();
    });

    it('text contains all relevant amounts', () => {
      const ctx: YearDecisionContext = { ...base, conv: 52_000, wdTrd: 31_400, wdTax: 39_900, gap: 71_300 };
      const { text } = buildYearDecisions(ctx).find(x => x.code === 'conv-with-trad-wd')!;
      expect(text).toContain(fmtUSD(52_000));
      expect(text).toContain(fmtUSD(71_300));
      expect(text).toContain(fmtUSD(39_900));
      expect(text).toContain(fmtUSD(31_400));
    });
  });

  describe('conv-during-rmd', () => {
    it('fires (non-binding) when conv>1 and rmdAmt>1', () => {
      const ctx: YearDecisionContext = { ...base, conv: 18_300, rmdAmt: 48_100, headroomNominal: 18_300 };
      const notes = buildYearDecisions(ctx);
      const n = notes.find(x => x.code === 'conv-during-rmd');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(false);
    });

    it('text contains RMD and conversion amounts', () => {
      const ctx: YearDecisionContext = { ...base, conv: 18_300, rmdAmt: 48_100, headroomNominal: 18_300, gap: 92_000 };
      const { text } = buildYearDecisions(ctx).find(x => x.code === 'conv-during-rmd')!;
      expect(text).toContain(fmtUSD(48_100));
      expect(text).toContain(fmtUSD(18_300));
      expect(text).toContain(fmtUSD(92_000));
    });
  });

  describe('wd-policy-spill', () => {
    it('fires (binding, caution) on no-window spill', () => {
      const ctx: YearDecisionContext = {
        ...base,
        spill: { kind: 'no-window', amount: 21_800 },
        spillWindow: undefined,
        gap: 64_000,
        wdTax: 7_680, wdTrd: 45_440, wdRth: 10_880,
      };
      const n = buildYearDecisions(ctx).find(x => x.code === 'wd-policy-spill');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(true);
      expect(n!.severity).toBe('caution');
      expect(n!.text).toContain('not covered by any window');
      expect(n!.text).toContain(fmtUSD(21_800));
      expect(n!.text).toContain(fmtUSD(64_000));
    });

    it('fires on trad-cap spill with tradCap in text', () => {
      const ctx: YearDecisionContext = {
        ...base,
        spill: { kind: 'trad-cap', amount: 15_000, tradCap: 10_000 },
        spillWindow: { pctTaxable: 0, pctTraditional: 1, pctRoth: 0 },
        gap: 50_000,
        wdTax: 0, wdTrd: 10_000, wdRth: 40_000,
      };
      const { text } = buildYearDecisions(ctx).find(x => x.code === 'wd-policy-spill')!;
      expect(text).toContain(fmtUSD(10_000));
    });

    it('fires on pct-unhonorable spill', () => {
      const ctx: YearDecisionContext = {
        ...base,
        spill: { kind: 'pct-unhonorable', amount: 10_000 },
        spillWindow: { pctTaxable: 0.4, pctTraditional: 0.6, pctRoth: 0 },
        gap: 50_000,
        wdTax: 20_000, wdTrd: 30_000, wdRth: 0,
      };
      const { text } = buildYearDecisions(ctx).find(x => x.code === 'wd-policy-spill')!;
      expect(text).toContain('too small');
    });

    it('does not fire when spill amount <= 0.01', () => {
      const ctx: YearDecisionContext = { ...base, spill: { kind: 'no-window', amount: 0.005 } };
      expect(buildYearDecisions(ctx).find(x => x.code === 'wd-policy-spill')).toBeUndefined();
    });
  });

  describe('wd-bracket-override', () => {
    it('fires (binding, caution) when bracketOverridden=true and no spill', () => {
      const ctx: YearDecisionContext = {
        ...base,
        bracketOverridden: true,
        gap: 150_000, wdTrd: 80_000, wdTax: 40_000, wdRth: 30_000,
      };
      const n = buildYearDecisions(ctx).find(x => x.code === 'wd-bracket-override');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(true);
      expect(n!.severity).toBe('caution');
      expect(n!.text).toContain(fmtUSD(80_000));
    });

    it('spill takes priority over bracketOverridden', () => {
      const ctx: YearDecisionContext = {
        ...base,
        bracketOverridden: true,
        spill: { kind: 'no-window', amount: 5_000 },
        gap: 50_000, wdTax: 50_000,
      };
      const notes = buildYearDecisions(ctx);
      expect(notes.find(x => x.code === 'wd-policy-spill')).toBeDefined();
      expect(notes.find(x => x.code === 'wd-bracket-override')).toBeUndefined();
    });
  });

  describe('wd-bracketfill-room', () => {
    it('fires (non-binding, info) when isActiveBracketfill and bracketfillRoom>1', () => {
      const ctx: YearDecisionContext = { ...base, isActiveBracketfill: true, bracketfillRoom: 20_000 };
      const n = buildYearDecisions(ctx).find(x => x.code === 'wd-bracketfill-room');
      expect(n).toBeDefined();
      expect(n!.binding).toBe(false);
      expect(n!.text).toContain(fmtUSD(20_000));
    });

    it('does not fire when bracketfillRoom <= 1', () => {
      const ctx: YearDecisionContext = { ...base, isActiveBracketfill: true, bracketfillRoom: 0.5 };
      expect(buildYearDecisions(ctx).find(x => x.code === 'wd-bracketfill-room')).toBeUndefined();
    });
  });

  describe('no spurious notes on clean year', () => {
    it('returns empty array when nothing is notable', () => {
      expect(buildYearDecisions(base)).toHaveLength(0);
    });
  });

  describe('amounts field contains values rendered in text', () => {
    it('conv-bracket-headroom amounts match text', () => {
      const ctx: YearDecisionContext = { ...base, conv: 52_000, headroomNominal: 52_000, maxConv: 600_000 };
      const n = buildYearDecisions(ctx).find(x => x.code === 'conv-bracket-headroom')!;
      for (const v of Object.values(n.amounts ?? {})) {
        if (v > 0) expect(n.text).toContain(fmtUSD(v));
      }
    });

    it('conv-during-rmd amounts match text', () => {
      const ctx: YearDecisionContext = { ...base, conv: 18_300, rmdAmt: 48_100, headroomNominal: 18_300, gap: 92_000 };
      const n = buildYearDecisions(ctx).find(x => x.code === 'conv-during-rmd')!;
      for (const v of Object.values(n.amounts ?? {})) {
        if (v > 0) expect(n.text).toContain(fmtUSD(v));
      }
    });
  });
});
