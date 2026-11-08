"""
Unit tests for the Resilience Rewired calculation engine.
Validates judges' formulas, edge cases, and known account benchmark (20111).
"""

import pytest
from pipeline.calc import (
    calculate_runway,
    apply_shock,
    survives_shock,
    calculate_goal_plan,
    calculate_backup_plan,
    calculate_levers,
)


def test_benchmark_account_20111():
    """
    Check against known account from README:
    Account 20111:
      I = 6339.4, S = 8599.6, F = 2330.1, H = 0, B = 17611.9, P = 2330.2
      Base runway: 7.8
      Layoff 6mo (EI 55%): 3.4
    """
    I = 6339.4
    S = 8599.6
    H = 0.0
    B = 17611.9

    # 1. Base runway (no shock)
    # gap = S - I = 8599.6 - 6339.4 = 2260.2
    # runway = 17611.9 / 2260.2 = 7.792... -> 7.8
    base_inc, base_spend, one_off = apply_shock(I, S, H)
    base_gap = base_spend - base_inc
    base_rw = calculate_runway(B - one_off, base_gap)
    assert base_rw == 7.8

    # 2. Layoff shock (EI 55%, 6 months)
    # income_after = 0.55 * 6339.4 = 3486.67
    # spend_after = S = 8599.6
    # gap = 8599.6 - 3486.67 = 5112.93
    # runway = 17611.9 / 5112.93 = 3.444... -> 3.4
    layoff_inc, layoff_spend, layoff_one_off = apply_shock(I, S, H, ei_pct=55.0)
    layoff_gap = layoff_spend - layoff_inc
    layoff_rw = calculate_runway(B - layoff_one_off, layoff_gap)
    assert layoff_rw == 3.4
    assert not survives_shock(layoff_rw, duration_months=6.0)


def test_edge_cases():
    # 1. Negative or zero buffer: runway must be 0.0
    assert calculate_runway(-500.0, 1000.0) == 0.0
    assert calculate_runway(0.0, 1000.0) == 0.0

    # 2. No shortfall (gap <= 0, surplus): runway capped at 120.0 ("no shortfall")
    assert calculate_runway(5000.0, -200.0) == 120.0
    assert calculate_runway(5000.0, 0.0) == 120.0

    # 3. Buffer larger than 120 months of gap: capped at 120.0
    assert calculate_runway(200000.0, 100.0) == 120.0

    # 4. Zero bills (H = 0): bills shock changes nothing
    inc, spend, one_off = apply_shock(I=5000, S=4000, H=0, bills_up_pct=25.0)
    assert spend == 4000


def test_goal_plan():
    # With surplus: I=6000, S=4000 -> surplus=2000. B=10000. Target=6*4000 = 24000.
    # gap = 14000. r=0.5 -> save 1000/mo -> 14 months to goal.
    plan = calculate_goal_plan(I=6000, S=4000, B=10000, target_months=6, r=0.5)
    assert plan["has_saving_room"] is True
    assert plan["surplus"] == 2000.0
    assert plan["monthly_save"] == 1000.0
    assert plan["months_to_goal"] == 14

    # Deficit account: I=3000, S=4000 -> surplus = -1000
    deficit_plan = calculate_goal_plan(I=3000, S=4000, B=5000)
    assert deficit_plan["has_saving_room"] is False
    assert deficit_plan["months_to_goal"] is None


def test_backup_plan():
    # Account needs $500 cut to survive 6 months
    buffer = 6000.0  # can support $1000/mo gap for 6 months
    gap = 1500.0     # current gap is $1500/mo -> needs $500/mo cut
    medians = {
        "bank_fees": 50.0,
        "card_withdrawals": 500.0,       # 30% = 150
        "transfers_out_other": 400.0,    # 25% = 100
        "cash_withdrawals_genuine": 2000.0, # 15% = 300
        "household_bills": 1000.0,       # 5% = 50
    }
    bp = calculate_backup_plan(buffer_left=buffer, gap=gap, D=6.0, category_medians=medians)
    assert bp["cut_needed"] == 500.0
    # Cuts allocated: 50 + 150 + 100 + 200 (from cash) = 500
    assert bp["total_cut_found"] == 500.0
    assert bp["unmet_cut"] == 0.0
    assert bp["survives_with_cuts"] is True


def test_levers():
    medians = {
        "card_withdrawals": 500.0,
        "cash_withdrawals_genuine": 1000.0,
    }
    levers = calculate_levers(
        buffer_left=10000.0,
        gap=2000.0,
        I=5000.0,
        S=7000.0,
        P=500.0,
        category_medians=medians,
        D=6.0,
    )
    assert len(levers) > 0
    # Every lever should provide non-negative delta_months
    for lev in levers:
        assert lev["delta_months"] >= 0.0

