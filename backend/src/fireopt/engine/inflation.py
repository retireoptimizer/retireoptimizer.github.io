def inflate(amount: float, rate: float, years: int) -> float:
    """Compound growth: amount × (1 + rate)^years."""
    if years <= 0:
        return amount
    return amount * (1 + rate) ** years


def deflate(amount: float, rate: float, years: int) -> float:
    """Remove compound growth: amount / (1 + rate)^years."""
    if years <= 0:
        return amount
    return amount / (1 + rate) ** years
