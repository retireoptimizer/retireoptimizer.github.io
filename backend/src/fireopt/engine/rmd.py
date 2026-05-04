from fireopt.engine.constants import RMD_START_AGE, UNIFORM_LIFETIME_TABLE


def uniform_lifetime_factor(age: int) -> float:
    """Return SECURE 2.0 ULT distribution period for given age (73–120)."""
    if age not in UNIFORM_LIFETIME_TABLE:
        raise ValueError(f"ULT not defined for age {age}; valid range 73–120")
    return UNIFORM_LIFETIME_TABLE[age]


def required_min_distribution(pretax_balance_eoy_prior: float, age: int) -> float:
    """RMD = prior year-end balance / ULT factor. Zero if below RMD start age."""
    if age < RMD_START_AGE:
        return 0.0
    return pretax_balance_eoy_prior / uniform_lifetime_factor(age)
