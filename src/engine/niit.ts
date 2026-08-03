import { NIIT_RATE, NIIT_THRESHOLD_MFJ, NIIT_THRESHOLD_SINGLE } from './taxConstants';
import type { FilingStatus } from './filingStatus';

/** Net Investment Income Tax (IRC §1411): 3.8% on lesser of NII or MAGI above threshold.
 *  Thresholds are not inflation-indexed. NII proxy = LTCG from taxable-account withdrawals. */
export function annualNIIT(magi: number, netInvestmentIncome: number, filingStatus: FilingStatus): number {
  if (netInvestmentIncome <= 0) return 0;
  const threshold = filingStatus === 'MFJ' ? NIIT_THRESHOLD_MFJ : NIIT_THRESHOLD_SINGLE;
  const excessMAGI = Math.max(0, magi - threshold);
  return NIIT_RATE * Math.min(netInvestmentIncome, excessMAGI);
}
