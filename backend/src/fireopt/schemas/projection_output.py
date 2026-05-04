
from pydantic import BaseModel


class YearRow(BaseModel):
    year: int
    age_a: int
    age_b: int
    both_alive: bool
    gross_income: float
    ordinary_taxable_income: float
    ltcg_income: float
    ss_a_taxable: float
    ss_b_taxable: float
    rmd_a: float
    rmd_b: float
    roth_conversion: float
    federal_tax: float
    state_tax: float
    niit: float
    medicare_surtax: float
    total_tax: float
    expenses: float
    withdrawal_taxable: float
    withdrawal_pretax: float
    withdrawal_roth: float
    end_balance_taxable: float
    end_balance_pretax: float
    end_balance_roth: float
    end_balance_total: float
    effective_tax_rate: float
    marginal_tax_rate: float


class ProjectionSummary(BaseModel):
    lifetime_taxes_nominal: float
    lifetime_taxes_pv: float
    final_balance_nominal: float
    final_balance_pv: float
    success: bool
    first_failure_year: int | None
    avg_effective_rate: float


class ProjectionResult(BaseModel):
    plan_hash: str
    rows: list[YearRow]
    summary: ProjectionSummary
