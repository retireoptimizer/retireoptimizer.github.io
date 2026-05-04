"""
2025 tax constants for MFJ filing status.
Source: IRS Rev. Proc. 2024-40 (inflation adjustments for 2025).
Update annually; version these constants by adding a TAX_YEAR attribute.
"""

from fireopt.schemas.tax import TaxBracket

TAX_YEAR = 2025

# ------------------------------------------------------------------
# Federal ordinary income brackets (MFJ, 2025)
# Stacked: each bracket covers income from prior upper to this upper.
# ------------------------------------------------------------------
FEDERAL_BRACKETS_ORDINARY_MFJ_2025: list[TaxBracket] = [
    TaxBracket(rate=0.10, upper=23_200),
    TaxBracket(rate=0.12, upper=94_300),
    TaxBracket(rate=0.22, upper=201_050),
    TaxBracket(rate=0.24, upper=383_900),
    TaxBracket(rate=0.32, upper=487_450),
    TaxBracket(rate=0.35, upper=731_200),
    TaxBracket(rate=0.37, upper=None),   # top bracket
]

# ------------------------------------------------------------------
# Federal LTCG / qualified dividends brackets (MFJ, 2025)
# Applied stacked-on-top of ordinary income.
# ------------------------------------------------------------------
FEDERAL_BRACKETS_LTCG_MFJ_2025: list[TaxBracket] = [
    TaxBracket(rate=0.00, upper=96_700),
    TaxBracket(rate=0.15, upper=583_750),
    TaxBracket(rate=0.20, upper=None),
]

# ------------------------------------------------------------------
# Standard deduction (MFJ, 2025)
# ------------------------------------------------------------------
STANDARD_DEDUCTION_MFJ_2025: float = 30_000

# ------------------------------------------------------------------
# NIIT / Additional Medicare thresholds (MFJ, 2025, not CPI-indexed)
# ------------------------------------------------------------------
NIIT_THRESHOLD_MFJ: float = 250_000
NIIT_RATE: float = 0.038

MEDICARE_SURTAX_THRESHOLD_MFJ: float = 200_000   # wage threshold for 0.9% add'l
MEDICARE_SURTAX_RATE: float = 0.009

# ------------------------------------------------------------------
# Social Security taxable-income thresholds (not CPI-indexed)
# MFJ: 0% below $32k, 50% from $32k–$44k, 85% above $44k
# ------------------------------------------------------------------
SS_THRESH_LOW_MFJ: float = 32_000
SS_THRESH_HIGH_MFJ: float = 44_000
SS_THRESH_LOW_SINGLE: float = 25_000
SS_THRESH_HIGH_SINGLE: float = 34_000
SS_MAX_TAXABLE_PCT: float = 0.85

# ------------------------------------------------------------------
# RMD — Uniform Lifetime Table (SECURE 2.0, effective 2023)
# Key: age, Value: distribution period (divisor).
# Defined for ages 73–120. Age 75 is first year for SECURE 2.0.
# ------------------------------------------------------------------
RMD_START_AGE: int = 73   # SECURE 2.0 raised from 72 to 73 (further to 75 in 2033)

UNIFORM_LIFETIME_TABLE: dict[int, float] = {
    73: 26.5,
    74: 25.5,
    75: 24.6,
    76: 23.7,
    77: 22.9,
    78: 22.0,
    79: 21.1,
    80: 20.2,
    81: 19.4,
    82: 18.5,
    83: 17.7,
    84: 16.8,
    85: 16.0,
    86: 15.2,
    87: 14.4,
    88: 13.7,
    89: 12.9,
    90: 12.2,
    91: 11.5,
    92: 10.8,
    93: 10.1,
    94: 9.5,
    95: 8.9,
    96: 8.4,
    97: 7.8,
    98: 7.3,
    99: 6.8,
    100: 6.4,
    101: 6.0,
    102: 5.6,
    103: 5.2,
    104: 4.9,
    105: 4.6,
    106: 4.3,
    107: 4.1,
    108: 3.9,
    109: 3.7,
    110: 3.5,
    111: 3.4,
    112: 3.3,
    113: 3.1,
    114: 3.0,
    115: 2.9,
    116: 2.8,
    117: 2.7,
    118: 2.5,
    119: 2.3,
    120: 2.0,
}
