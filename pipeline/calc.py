"""
Resilience Rewired: Mathematical Reference Engine
Adheres strictly to Tangerine Datathon 2026 Judges' calculation standards.
"""

from __future__ import annotations
import math
from typing import Dict, Any, Tuple, Optional


def calculate_runway(buffer_left: float, gap: float) -> float:
    """
    Computes months of financial runway.
    buffer_left = B - one_off_costs
    gap = spend_after - income_after

    if buffer_left <= 0: runway = 0.0
    elif gap <= 0: runway = 120.0 ("no shortfall (120+)")
    else: min(buffer_left / gap, 120.0) rounded to 1 decimal place.
    """
    if buffer_left <= 0:
        return 0.0
    if gap <= 0:
        return 120.0
    val = buffer_left / gap
    return round(min(val, 120.0), 1)


def apply_shock(
    I: float,
    S: float,
    H: float,
    ei_pct: float = 100.0,
    bills_up_pct: float = 0.0,
    one_off_spend_months: float = 0.0,
    one_off_fixed: float = 0.0,
) -> Tuple[float, float, float]:
    """
    Applies personal and macroeconomic shocks to income and spending.
    Returns: (income_after, spend_after, one_off_costs)
    """
    income_after = (ei_pct / 100.0) * I
    spend_after = S + (bills_up_pct / 100.0) * H
    one_off_costs = (one_off_spend_months * S) + one_off_fixed
    return income_after, spend_after, one_off_costs


def survives_shock(runway: float, duration_months: float = 6.0) -> bool:
    """Returns True if the runway lasts at least the duration of the shock."""
    return runway >= duration_months


def calculate_goal_plan(
    I: float,
    S: float,
    B: float,
    target_months: int = 6,
    r: float = 0.5,
) -> Dict[str, Any]:
    """
    Calculates the emergency fund savings plan.
    surplus = I - S
    target = target_months * S
    gap_to_goal = max(target - B, 0)
    monthly_save = r * surplus
    """
    surplus = I - S
    target = target_months * S
    gap_to_goal = max(target - B, 0.0)

    if surplus <= 0:
        return {
            "surplus": round(surplus, 2),
            "target": round(target, 2),
            "gap_to_goal": round(gap_to_goal, 2),
            "has_saving_room": False,
            "monthly_save": 0.0,
            "months_to_goal": None,
            "message": "No saving room currently; backup plan cuts needed to generate surplus.",
        }

    monthly_save = r * surplus
    months_to_goal = math.ceil(gap_to_goal / monthly_save) if (monthly_save > 0 and gap_to_goal > 0) else 0

    return {
        "surplus": round(surplus, 2),
        "target": round(target, 2),
        "gap_to_goal": round(gap_to_goal, 2),
        "has_saving_room": True,
        "monthly_save": round(monthly_save, 2),
        "months_to_goal": months_to_goal,
        "message": f"Saving {int(r * 100)}% of surplus (${monthly_save:.1f}/mo) reaches goal in {months_to_goal} months.",
    }


# Maximum discretionary cut caps based on empirical data & track guidelines
DEFAULT_CUT_CAPS = {
    "card_withdrawals": 0.30,          # 30% discretionary card spend
    "transfers_out_other": 0.25,       # 25% unlabelled transfers
    "cash_withdrawals_genuine": 0.15,  # 15% cash spend (groceries/essentials mix)
    "household_bills": 0.05,           # 5% provider renegotiation / utilities
    "bank_fees": 1.00,                 # 100% avoidable fees if above zero
    "insurance": 0.00,                 # 0% retain coverage
    "loan_payments": 0.00,             # 0% via cuts (handled by loan pause lever)
}


def calculate_backup_plan(
    buffer_left: float,
    gap: float,
    D: float = 6.0,
    category_medians: Optional[Dict[str, float]] = None,
    cut_caps: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Computes required spending reductions to survive a shock of duration D.
    needed_gap = buffer_left / D
    cut_needed = max(0, gap - needed_gap)
    Allocates cut_needed greedily across categories according to max cut caps.
    """
    if D <= 0:
        raise ValueError("Shock duration D must be positive.")

    needed_gap = buffer_left / D
    cut_needed = max(0.0, gap - needed_gap)

    if category_medians is None:
        category_medians = {}
    if cut_caps is None:
        cut_caps = DEFAULT_CUT_CAPS

    allocated_cuts: Dict[str, float] = {}
    remaining_cut = cut_needed

    # Greedily allocate cuts in priority order
    priority_order = [
        "bank_fees",
        "card_withdrawals",
        "transfers_out_other",
        "cash_withdrawals_genuine",
        "household_bills",
    ]

    for cat in priority_order:
        median_val = category_medians.get(cat, 0.0)
        max_pct = cut_caps.get(cat, 0.0)
        max_cut_avail = median_val * max_pct

        if max_cut_avail <= 0:
            continue

        actual_cut = min(remaining_cut, max_cut_avail)
        allocated_cuts[cat] = round(actual_cut, 2)
        remaining_cut -= actual_cut

        if remaining_cut <= 0.001:
            remaining_cut = 0.0
            break

    total_cut_found = sum(allocated_cuts.values())
    shortfall_after_cuts = max(0.0, gap - total_cut_found)
    runway_after_cuts = calculate_runway(buffer_left, shortfall_after_cuts)

    survives = runway_after_cuts >= D or shortfall_after_cuts <= 0

    return {
        "cut_needed": round(cut_needed, 2),
        "total_cut_found": round(total_cut_found, 2),
        "unmet_cut": round(remaining_cut, 2),
        "allocated_cuts": allocated_cuts,
        "runway_after_cuts": runway_after_cuts,
        "survives_with_cuts": survives,
    }


def calculate_levers(
    buffer_left: float,
    gap: float,
    I: float,
    S: float,
    P: float,
    category_medians: Dict[str, float],
    D: float = 6.0,
) -> list[Dict[str, Any]]:
    """
    Evaluates individual policy/personal levers and reports the delta runway months gained.
    """
    base_runway = calculate_runway(buffer_left, gap)
    levers = []

    # Lever 1: Pause or restructure running loan
    if P > 0:
        new_gap = max(0.0, gap - P)
        rw = calculate_runway(buffer_left, new_gap)
        levers.append({
            "name": "Pause / Restructure Loan",
            "delta_spend": -P,
            "new_runway": rw,
            "delta_months": round(rw - base_runway, 1),
            "description": f"Freeze loan payments of ${P:.1f}/mo during shock."
        })

    # Lever 2: 20% Card Spending Cut
    card_med = category_medians.get("card_withdrawals", 0.0)
    if card_med > 0:
        cut = 0.20 * card_med
        rw = calculate_runway(buffer_left, max(0.0, gap - cut))
        levers.append({
            "name": "Cut Card Spending by 20%",
            "delta_spend": -cut,
            "new_runway": rw,
            "delta_months": round(rw - base_runway, 1),
            "description": f"Reduce discretionary card purchases by ${cut:.1f}/mo."
        })

    # Lever 3: 10% Cash Withdrawal Cut
    cash_med = category_medians.get("cash_withdrawals_genuine", 0.0)
    if cash_med > 0:
        cut = 0.10 * cash_med
        rw = calculate_runway(buffer_left, max(0.0, gap - cut))
        levers.append({
            "name": "Trim Cash Spending by 10%",
            "delta_spend": -cut,
            "new_runway": rw,
            "delta_months": round(rw - base_runway, 1),
            "description": f"Trim cash withdrawals by ${cut:.1f}/mo."
        })

    # Lever 4: Part-time / Gig Income (+20% of typical income)
    part_time_inc = 0.20 * I
    if part_time_inc > 0:
        rw = calculate_runway(buffer_left, max(0.0, gap - part_time_inc))
        levers.append({
            "name": "Part-Time / Side Income (+20%)",
            "delta_income": part_time_inc,
            "new_runway": rw,
            "delta_months": round(rw - base_runway, 1),
            "description": f"Earn ${part_time_inc:.1f}/mo through part-time or freelance work."
        })

    # Lever 5: Full backup plan allocation
    bp = calculate_backup_plan(buffer_left, gap, D=D, category_medians=category_medians)
    rw_bp = bp["runway_after_cuts"]
    levers.append({
        "name": "Full Backup Plan Budget Cuts",
        "delta_spend": -bp["total_cut_found"],
        "new_runway": rw_bp,
        "delta_months": round(rw_bp - base_runway, 1),
        "description": f"Execute greedy category spending reductions (${bp['total_cut_found']:.1f}/mo total)."
    })

    levers.sort(key=lambda x: x["delta_months"], reverse=True)
    return levers

