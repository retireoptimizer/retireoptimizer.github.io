from fireopt.schemas.conversion import RothConversionConfig
from fireopt.schemas.tax import TaxBracket


def _bracket_fill_amount(
    ordinary_income: float,
    target_rate: float,
    pretax_balance: float,
    brackets: list[TaxBracket],
    std_deduction: float,
) -> float:
    """Conversion amount that fills ordinary AGI to the top of the target bracket."""
    agi = max(0.0, ordinary_income - std_deduction)
    for b in brackets:
        if b.rate == target_rate:
            if b.upper is None:
                return 0.0  # top bracket has no ceiling to fill toward
            room = max(0.0, b.upper - agi)
            return min(room, pretax_balance)
    return 0.0


def planned_roth_conversion(
    cfg: RothConversionConfig,
    year: int,
    pretax_balance: float,
    ordinary_income: float,
    brackets: list[TaxBracket],
    std_deduction: float,
) -> float:
    """Roth conversion amount for `year` based on conversion config."""
    if cfg.mode == "off":
        return 0.0
    if cfg.start_year is not None and year < cfg.start_year:
        return 0.0
    if cfg.end_year is not None and year > cfg.end_year:
        return 0.0

    if cfg.mode == "manual":
        for entry in cfg.manual_entries:
            if entry.year == year:
                return min(entry.amount, pretax_balance)
        return 0.0

    fill = _bracket_fill_amount(
        ordinary_income, cfg.bracket_fill_target_rate, pretax_balance, brackets, std_deduction
    )
    if cfg.mode == "bracket_fill":
        return fill
    return min(fill, cfg.bracket_cap_max_amount)  # bracket_cap
