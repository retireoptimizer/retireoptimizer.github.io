from dataclasses import dataclass

from fireopt.schemas.plan_input import BucketBalances, WithdrawalPolicy


@dataclass
class WithdrawalBreakdown:
    taxable: float = 0.0
    pretax: float = 0.0
    roth: float = 0.0
    shortfall: float = 0.0

    @property
    def total(self) -> float:
        return self.taxable + self.pretax + self.roth


def withdraw_to_cover(
    need: float,
    policy: WithdrawalPolicy,
    balances: BucketBalances,
) -> WithdrawalBreakdown:
    """Withdraw `need` from buckets according to policy.

    shortfall is positive when all buckets are exhausted before need is met.
    """
    if need <= 0:
        return WithdrawalBreakdown()

    result = WithdrawalBreakdown()
    avail = {"taxable": balances.taxable, "pretax": balances.pretax, "roth": balances.roth}

    if policy.mode in ("default_order", "optimized"):
        remaining = need
        for ord_bucket in policy.default_order:
            taken = min(remaining, avail[ord_bucket])
            setattr(result, ord_bucket, taken)
            remaining -= taken
            if remaining <= 0:
                break
        result.shortfall = max(0.0, remaining)

    elif policy.mode == "split" and policy.split_pct is not None:
        for split_bucket, pct in policy.split_pct.items():
            target = need * pct
            taken = min(target, avail.get(split_bucket, 0.0))
            setattr(result, split_bucket, getattr(result, split_bucket) + taken)
        result.shortfall = max(0.0, need - result.total)

    else:
        result.shortfall = need

    return result
