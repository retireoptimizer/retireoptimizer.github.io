/**
 * Annual U.S. market history, 1928–2023 (96 years).
 *
 * Source: Aswath Damodaran's public "Historical Returns on Stocks, Bonds and Bills"
 * dataset (NYU Stern), which is itself built on S&P 500 total returns, 10-year U.S.
 * Treasury total returns, and CPI inflation. Figures are nominal annual total returns.
 *
 * We derive **real** (inflation-adjusted) returns at load time so the Monte Carlo
 * bootstrap can sample real return sequences and re-inflate them with the plan's own
 * inflation assumption — keeping portfolio growth and expense growth on one inflation
 * basis. See returnModels.ts / monteCarlo.ts.
 */

/** [stockNominal, bondNominal, cpiInflation] per year, decimals. */
const RAW: ReadonlyArray<readonly [number, number, number]> = [
  [0.4381, 0.0084, -0.0117], // 1928
  [-0.0830, 0.0420, 0.0058],
  [-0.2512, 0.0454, -0.0640],
  [-0.4384, -0.0256, -0.0932],
  [-0.0864, 0.0879, -0.1027],
  [0.4998, 0.0186, 0.0076],
  [-0.0119, 0.0796, 0.0152],
  [0.4674, 0.0447, 0.0299],
  [0.3194, 0.0502, 0.0145],
  [-0.3534, 0.0138, 0.0286],
  [0.2928, 0.0421, -0.0278], // 1938
  [-0.0110, 0.0441, 0.0000],
  [-0.1067, 0.0540, 0.0071],
  [-0.1277, -0.0202, 0.0993],
  [0.1917, 0.0229, 0.0903],
  [0.2506, 0.0249, 0.0296],
  [0.1903, 0.0258, 0.0230],
  [0.3582, 0.0380, 0.0225],
  [-0.0843, 0.0313, 0.1813],
  [0.0520, 0.0092, 0.0884],
  [0.0570, 0.0195, 0.0299], // 1948
  [0.1830, 0.0466, -0.0207],
  [0.3081, 0.0043, 0.0593],
  [0.2368, -0.0030, 0.0600],
  [0.1815, 0.0227, 0.0075],
  [-0.0121, 0.0414, 0.0075],
  [0.5256, 0.0329, -0.0074],
  [0.3260, -0.0134, 0.0037],
  [0.0744, -0.0226, 0.0299],
  [-0.1046, 0.0680, 0.0290],
  [0.4372, -0.0210, 0.0176], // 1958
  [0.1206, -0.0265, 0.0173],
  [0.0034, 0.1164, 0.0136],
  [0.2664, 0.0206, 0.0067],
  [-0.0881, 0.0569, 0.0122],
  [0.2261, 0.0168, 0.0165],
  [0.1642, 0.0373, 0.0119],
  [0.1240, 0.0072, 0.0192],
  [-0.0997, 0.0291, 0.0335],
  [0.2380, -0.0158, 0.0304],
  [0.1081, 0.0327, 0.0472], // 1968
  [-0.0824, -0.0501, 0.0611],
  [0.0356, 0.1675, 0.0549],
  [0.1422, 0.0979, 0.0336],
  [0.1876, 0.0282, 0.0341],
  [-0.1431, 0.0366, 0.0880],
  [-0.2590, 0.0199, 0.1220],
  [0.3700, 0.0361, 0.0701],
  [0.2383, 0.1598, 0.0481],
  [-0.0698, 0.0129, 0.0677],
  [0.0651, -0.0078, 0.0903], // 1978
  [0.1852, 0.0067, 0.1331],
  [0.3174, -0.0299, 0.1240],
  [-0.0470, 0.0820, 0.0894],
  [0.2042, 0.3281, 0.0387],
  [0.2234, 0.0320, 0.0380],
  [0.0615, 0.1373, 0.0395],
  [0.3124, 0.2571, 0.0377],
  [0.1849, 0.2428, 0.0113],
  [0.0581, -0.0496, 0.0441],
  [0.1654, 0.0822, 0.0442], // 1988
  [0.3148, 0.1769, 0.0465],
  [-0.0306, 0.0624, 0.0611],
  [0.3023, 0.1500, 0.0306],
  [0.0749, 0.0936, 0.0290],
  [0.0997, 0.1421, 0.0275],
  [0.0133, -0.0804, 0.0267],
  [0.3720, 0.2348, 0.0254],
  [0.2268, 0.0143, 0.0332],
  [0.3310, 0.0994, 0.0170],
  [0.2834, 0.1492, 0.0161], // 1998
  [0.2089, -0.0825, 0.0268],
  [-0.0903, 0.1666, 0.0339],
  [-0.1185, 0.0557, 0.0155],
  [-0.2197, 0.1512, 0.0238],
  [0.2836, 0.0038, 0.0188],
  [0.1074, 0.0449, 0.0326],
  [0.0483, 0.0287, 0.0342],
  [0.1561, 0.0196, 0.0254],
  [0.0548, 0.1021, 0.0408],
  [-0.3655, 0.2010, 0.0009], // 2008
  [0.2594, -0.1112, 0.0272],
  [0.1482, 0.0846, 0.0150],
  [0.0210, 0.1604, 0.0296],
  [0.1589, 0.0297, 0.0174],
  [0.3215, -0.0910, 0.0150],
  [0.1352, 0.1075, 0.0076],
  [0.0138, 0.0128, 0.0073],
  [0.1177, 0.0069, 0.0207],
  [0.2161, 0.0280, 0.0211],
  [-0.0438, -0.0002, 0.0191], // 2018
  [0.3149, 0.0964, 0.0229],
  [0.1840, 0.1133, 0.0136],
  [0.2871, -0.0442, 0.0704],
  [-0.1811, -0.1741, 0.0645],
  [0.2629, 0.0339, 0.0335], // 2023
];

/** First calendar year in the dataset. */
export const START_YEAR = 1928;
/** Number of years available. */
export const N_YEARS = RAW.length;

const toReal = (nom: number, cpi: number) => (1 + nom) / (1 + cpi) - 1;

/** Real (inflation-adjusted) annual total return for the S&P 500, by year index. */
export const STOCK_REAL: readonly number[] = RAW.map(([s, , cpi]) => toReal(s, cpi));
/** Real annual total return for 10-yr U.S. Treasuries, by year index. */
export const BOND_REAL: readonly number[] = RAW.map(([, b, cpi]) => toReal(b, cpi));
/** Annual CPI inflation rate by year index (same ordering as STOCK_REAL / BOND_REAL). */
export const CPI_INFLATION: readonly number[] = RAW.map(([, , cpi]) => cpi);

/** Real blended return for a stock/bond mix in a given historical year. */
export function blendedReal(equityPct: number, yearIdx: number): number {
  const e = Math.max(0, Math.min(1, equityPct));
  return e * STOCK_REAL[yearIdx] + (1 - e) * BOND_REAL[yearIdx];
}

/** Convert a calendar year to its dataset index (clamped). Returns -1 if out of range. */
export function indexOfYear(year: number): number {
  const idx = year - START_YEAR;
  return idx >= 0 && idx < N_YEARS ? idx : -1;
}
