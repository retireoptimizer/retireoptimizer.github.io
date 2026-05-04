import pytest

from fireopt.engine.inflation import deflate, inflate


def test_inflate_zero_years():
    assert inflate(100, 0.03, 0) == 100.0


def test_inflate_negative_years():
    assert inflate(100, 0.03, -5) == 100.0


def test_inflate_one_year():
    assert inflate(100, 0.03, 1) == pytest.approx(103.0)


def test_inflate_ten_years():
    assert inflate(100, 0.03, 10) == pytest.approx(100 * 1.03**10, rel=1e-9)


def test_inflate_zero_amount():
    assert inflate(0, 0.03, 10) == 0.0


def test_inflate_zero_rate():
    assert inflate(100, 0.0, 10) == 100.0


def test_deflate_zero_years():
    assert deflate(100, 0.03, 0) == 100.0


def test_deflate_one_year():
    assert deflate(103, 0.03, 1) == pytest.approx(100.0, rel=1e-9)


def test_deflate_reverses_inflate():
    for years in [1, 5, 10, 30]:
        original = 50_000.0
        inflated = inflate(original, 0.03, years)
        assert deflate(inflated, 0.03, years) == pytest.approx(original, rel=1e-9)


def test_inflate_large_amount():
    assert inflate(1_000_000, 0.025, 30) == pytest.approx(1_000_000 * 1.025**30, rel=1e-9)
