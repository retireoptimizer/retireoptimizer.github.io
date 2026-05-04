import pytest

from fireopt.engine.constants import FEDERAL_BRACKETS_ORDINARY_MFJ_2025, STANDARD_DEDUCTION_MFJ_2025
from fireopt.engine.conversion import planned_roth_conversion
from fireopt.schemas.conversion import ManualConversionEntry, RothConversionConfig

_ORD = FEDERAL_BRACKETS_ORDINARY_MFJ_2025
_STD = STANDARD_DEDUCTION_MFJ_2025


# ---------------------------------------------------------------------------
# mode: off
# ---------------------------------------------------------------------------


def test_mode_off_always_zero():
    cfg = RothConversionConfig(mode="off")
    assert planned_roth_conversion(cfg, 2025, 100_000, 50_000, _ORD, _STD) == 0.0


# ---------------------------------------------------------------------------
# mode: manual
# ---------------------------------------------------------------------------


def test_manual_matching_year():
    cfg = RothConversionConfig(
        mode="manual", manual_entries=[ManualConversionEntry(year=2025, amount=20_000)]
    )
    assert planned_roth_conversion(cfg, 2025, 100_000, 0, _ORD, _STD) == pytest.approx(20_000)


def test_manual_non_matching_year():
    cfg = RothConversionConfig(
        mode="manual", manual_entries=[ManualConversionEntry(year=2026, amount=20_000)]
    )
    assert planned_roth_conversion(cfg, 2025, 100_000, 0, _ORD, _STD) == 0.0


def test_manual_capped_by_pretax_balance():
    cfg = RothConversionConfig(
        mode="manual", manual_entries=[ManualConversionEntry(year=2025, amount=50_000)]
    )
    assert planned_roth_conversion(cfg, 2025, 10_000, 0, _ORD, _STD) == pytest.approx(10_000)


def test_manual_multiple_entries_selects_correct_year():
    cfg = RothConversionConfig(
        mode="manual",
        manual_entries=[
            ManualConversionEntry(year=2025, amount=10_000),
            ManualConversionEntry(year=2026, amount=20_000),
        ],
    )
    assert planned_roth_conversion(cfg, 2026, 100_000, 0, _ORD, _STD) == pytest.approx(20_000)


# ---------------------------------------------------------------------------
# mode: bracket_fill
# ---------------------------------------------------------------------------


def test_bracket_fill_24pct():
    # Ordinary $100k → AGI = $70k; 24% bracket top = $383,900
    # room = $383,900 − $70,000 = $313,900
    cfg = RothConversionConfig(mode="bracket_fill", bracket_fill_target_rate=0.24)
    result = planned_roth_conversion(cfg, 2025, 500_000, 100_000, _ORD, _STD)
    assert result == pytest.approx(313_900, rel=1e-6)


def test_bracket_fill_no_room_when_agi_above_bracket():
    # Ordinary $430k → AGI = $400k > $383,900 → no room
    cfg = RothConversionConfig(mode="bracket_fill", bracket_fill_target_rate=0.24)
    result = planned_roth_conversion(cfg, 2025, 500_000, 430_000, _ORD, _STD)
    assert result == 0.0


def test_bracket_fill_capped_by_pretax_balance():
    cfg = RothConversionConfig(mode="bracket_fill", bracket_fill_target_rate=0.24)
    result = planned_roth_conversion(cfg, 2025, 5_000, 100_000, _ORD, _STD)
    assert result == pytest.approx(5_000)


def test_bracket_fill_top_rate_no_ceiling():
    # 37% top bracket has no upper → returns 0
    cfg = RothConversionConfig(mode="bracket_fill", bracket_fill_target_rate=0.37)
    result = planned_roth_conversion(cfg, 2025, 500_000, 100_000, _ORD, _STD)
    assert result == 0.0


def test_bracket_fill_12pct():
    # Ordinary $40k → AGI = $10k; 12% bracket top = $94,300
    # room = $94,300 − $10,000 = $84,300
    cfg = RothConversionConfig(mode="bracket_fill", bracket_fill_target_rate=0.12)
    result = planned_roth_conversion(cfg, 2025, 500_000, 40_000, _ORD, _STD)
    assert result == pytest.approx(84_300, rel=1e-6)


# ---------------------------------------------------------------------------
# mode: bracket_cap
# ---------------------------------------------------------------------------


def test_bracket_cap_limits_to_cap():
    # fill = $313,900, cap = $50,000 → $50,000
    cfg = RothConversionConfig(
        mode="bracket_cap", bracket_fill_target_rate=0.24, bracket_cap_max_amount=50_000
    )
    result = planned_roth_conversion(cfg, 2025, 500_000, 100_000, _ORD, _STD)
    assert result == pytest.approx(50_000)


def test_bracket_cap_fill_less_than_cap():
    # pretax_balance = $10,000 → fill = $10,000 < cap $50,000 → $10,000
    cfg = RothConversionConfig(
        mode="bracket_cap", bracket_fill_target_rate=0.24, bracket_cap_max_amount=50_000
    )
    result = planned_roth_conversion(cfg, 2025, 10_000, 100_000, _ORD, _STD)
    assert result == pytest.approx(10_000)


# ---------------------------------------------------------------------------
# start_year / end_year gates
# ---------------------------------------------------------------------------


def test_start_year_gate_before():
    cfg = RothConversionConfig(
        mode="manual",
        manual_entries=[ManualConversionEntry(year=2025, amount=20_000)],
        start_year=2026,
    )
    assert planned_roth_conversion(cfg, 2025, 100_000, 0, _ORD, _STD) == 0.0


def test_start_year_gate_at():
    cfg = RothConversionConfig(
        mode="manual",
        manual_entries=[ManualConversionEntry(year=2026, amount=20_000)],
        start_year=2026,
    )
    assert planned_roth_conversion(cfg, 2026, 100_000, 0, _ORD, _STD) == pytest.approx(20_000)


def test_end_year_gate_after():
    cfg = RothConversionConfig(
        mode="manual",
        manual_entries=[ManualConversionEntry(year=2030, amount=20_000)],
        end_year=2029,
    )
    assert planned_roth_conversion(cfg, 2030, 100_000, 0, _ORD, _STD) == 0.0


def test_end_year_gate_at():
    cfg = RothConversionConfig(
        mode="manual",
        manual_entries=[ManualConversionEntry(year=2029, amount=20_000)],
        end_year=2029,
    )
    assert planned_roth_conversion(cfg, 2029, 100_000, 0, _ORD, _STD) == pytest.approx(20_000)
