import { useMemo, useRef } from 'react';
import type { Chart, Plugin, Scale } from 'chart.js';
import { toFont } from 'chart.js/helpers';
import { usePlanStore } from '../../store/usePlanStore';
import { palette } from './setup';

const birthYear = (dob: string) => parseInt(dob.slice(0, 4), 10);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const NAME_GAP = 8;

/** Age-axis helpers for charts whose labels are Person A's age. For couples, each x tick shows
 *  both ages on two lines (A on top, B below) and `plugin` draws each person's name to the left
 *  of their row, widening the left y-axis if needed. Each person's age is blank after their
 *  plan-through age. Labels stay as A's age so anything keyed on the label value (milestone
 *  markers, filters) keeps working. */
export function useAgeAxis() {
  const personA = usePlanStore((s) => s.plan.personA);
  const personB = usePlanStore((s) => s.plan.personB);

  const axis = useMemo(() => {
    // First names, unless they collide (e.g. the defaults "Person A" / "Person B").
    const short = !personB || firstName(personA.name) !== firstName(personB.name);
    const nameA = short ? firstName(personA.name) : personA.name;
    const nameB = personB ? (short ? firstName(personB.name) : personB.name) : '';
    const offsetB = personB ? birthYear(personA.dob) - birthYear(personB.dob) : 0;
    const ageBFor = (ageA: number): number | undefined => {
      if (!personB) return undefined;
      const ageB = ageA + offsetB;
      return ageB <= personB.planThroughAge ? ageB : undefined;
    };

    // Couples keep both rows on every tick so the names line up; a row is blank once that
    // person is past their plan-through age.
    const ageAFor = (ageA: number): number | undefined => (ageA <= personA.planThroughAge ? ageA : undefined);
    const show = (age: number | undefined) => (age === undefined ? '' : String(age));

    const tick = function (this: Scale, value: string | number): string | string[] {
      const label = this.getLabelForValue(Number(value));
      if (!personB) return label;
      const ageA = Number(label);
      return [show(ageAFor(ageA)), show(ageBFor(ageA))];
    };

    const tooltipTitle = (items: Array<{ label: string }>): string => {
      const label = items[0]?.label ?? '';
      if (!personB) return `Age ${label}`;
      const ageA = ageAFor(Number(label));
      const ageB = ageBFor(Number(label));
      return [ageA !== undefined && `${nameA} ${ageA}`, ageB !== undefined && `${nameB} ${ageB}`]
        .filter(Boolean).join('  ·  ');
    };

    /** x-axis title: `text` if given, otherwise none. */
    const title = (text?: string) => ({
      display: !!text,
      text: text ?? '',
      color: palette.textMuted,
      font: { size: 11 },
    });

    // Two-line labels don't rotate cleanly (and the names plugin assumes level rows), so couples
    // thin out ticks instead of tilting them.
    const ticks = { callback: tick, maxRotation: personB ? 0 : 50 };

    return { ticks, tooltipTitle, title, names: personB ? [nameA, nameB] : null };
  }, [personA, personB]);

  // react-chartjs-2 only reads `plugins` when the chart is created, so the plugin stays
  // stable and reads the current names through a ref.
  const namesRef = useRef(axis.names);
  namesRef.current = axis.names;

  const plugin = useMemo<Plugin>(() => {
    const nameFont = (chart: Chart) =>
      toFont({ ...(chart.options.scales?.x?.ticks?.font as object | undefined), weight: 600 });

    return {
      id: 'ageAxisNames',
      // Make the left y-axis at least as wide as the longest name.
      beforeUpdate(chart) {
        const names = namesRef.current;
        const scales = chart.config.options?.scales ?? {};
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = nameFont(chart).string;
        const needed = names ? Math.max(...names.map((n) => ctx.measureText(n).width)) + NAME_GAP * 2 : 0;
        ctx.restore();
        for (const [id, opts] of Object.entries(scales)) {
          const s = opts as { axis?: string; position?: unknown; afterFit?: (scale: Scale) => void } | undefined;
          if (!s || !(s.axis === 'y' || id.startsWith('y')) || s.position === 'right') continue;
          s.afterFit = (scale: Scale) => { scale.width = Math.max(scale.width, needed); };
        }
      },
      afterDraw(chart) {
        const names = namesRef.current;
        const x = chart.scales.x;
        if (!names || !x || x.labelRotation !== 0) return;
        const items = x.getLabelItems();
        const first = items.find((it) => Array.isArray(it.label));
        const translation = first?.options.translation;
        if (!first || !translation) return;
        const font = nameFont(chart);
        const { ctx } = chart;
        ctx.save();
        ctx.font = font.string;
        const firstWidth = Math.max(...(first.label as string[]).map((l) => ctx.measureText(l).width));
        const right = Math.min(chart.chartArea.left - NAME_GAP, translation[0] - firstWidth / 2 - NAME_GAP);
        const y0 = translation[1] + first.textOffset;
        ctx.fillStyle = palette.textMuted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        names.forEach((n, i) => ctx.fillText(n, right, y0 + i * font.lineHeight));
        ctx.restore();
      },
    };
  }, []);

  return { ...axis, plugin };
}
