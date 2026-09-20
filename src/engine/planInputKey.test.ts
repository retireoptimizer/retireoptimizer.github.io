import { describe, it, expect } from 'vitest';
import { OPTIMIZER_INPUT_FIELDS, OPTIMIZER_OUTPUT_FIELDS } from './planInputKey';
import { PlanSchema } from '../schemas/plan';

describe('planInputKey field classification', () => {
  it('every Plan field is either an optimizer input or an explicit output', () => {
    const classified = new Set<string>([...OPTIMIZER_INPUT_FIELDS, ...OPTIMIZER_OUTPUT_FIELDS]);
    const unclassified = Object.keys(PlanSchema.shape).filter((k) => !classified.has(k));
    expect(unclassified).toEqual([]);
  });
});
