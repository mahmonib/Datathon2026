"""
Resilience Rewired: Precomputation Pipeline (Pure Python - no pandas/numpy DLL required)
Generates instant in-memory JSON snapshots and population summary from Datasets/Tangerine/data.
"""

import os
import csv
import json
import hashlib
import statistics
import math
from typing import Dict, List, Any, Optional

DATA_DIR = os.getenv("DATASET_PATH", os.path.join(os.path.dirname(__file__), "..", "Datasets", "Tangerine", "data"))
CACHE_DIR = os.getenv("CACHE_PATH", os.path.join(os.path.dirname(__file__), "..", "cache"))
SECRET_SALT = os.getenv("HMAC_SECRET", "tangerine_hackathon_2026_salt")


def get_account_token(account_id: int) -> str:
    h = hashlib.sha256(f"{SECRET_SALT}:{account_id}".encode()).hexdigest()
    return h[:16]


def csv_load(filename: str) -> List[Dict[str, str]]:
    with open(os.path.join(DATA_DIR, filename), "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def calc_runway(B: float, gap: float) -> float:
    if B <= 0:
        return 0.0
    if gap <= 0:
        return 120.0
    return round(min(B / gap, 120.0), 1)


def run_precompute():
    os.makedirs(os.path.join(CACHE_DIR, "snapshots"), exist_ok=True)

    print("Loading datasets...")
    # Load monthly_summary grouped by account_id
    rows_by_acc: Dict[int, List[Dict]] = {}
    with open(os.path.join(DATA_DIR, "monthly_summary.csv"), "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            acc = int(row["account_id"])
            rows_by_acc.setdefault(acc, []).append(row)

    # Sort all rows once
    for acc in rows_by_acc:
        rows_by_acc[acc].sort(key=lambda r: r["month"])

    # Load loans - running loans (status C or D)
    running_loan_payment: Dict[int, float] = {}
    running_loan_id: Dict[int, int] = {}
    for row in csv_load("loans.csv"):
        if row["status"] in ("C", "D"):
            running_loan_payment[int(row["account_id"])] = float(row["monthly_payment"])
            running_loan_id[int(row["account_id"])] = int(row["loan_id"])

    # Load accounts -> district_id
    acc_district: Dict[int, int] = {}
    for row in csv_load("accounts.csv"):
        acc_district[int(row["account_id"])] = int(row["district_id"])

    # Load districts -> region, unemployment
    district_info: Dict[int, Dict] = {}
    for row in csv_load("districts.csv"):
        did = int(row["district_id"])
        district_info[did] = {
            "region": row["region"],
            "unemployment_rate": float(row["unemployment_rate_2023"]) if row["unemployment_rate_2023"] else 0.0,
            "average_salary": float(row["average_salary"]) if row["average_salary"] else 0.0,
        }

    # Load dispositions -> account_id mapping for card lookup
    disp_to_acc: Dict[int, int] = {}
    for row in csv_load("dispositions.csv"):
        if row["type"] == "owner":
            disp_to_acc[int(row["disposition_id"])] = int(row["account_id"])

    # Load cards -> card_type per account
    card_by_acc: Dict[int, str] = {}
    for row in csv_load("cards.csv"):
        did = int(row["disposition_id"])
        if did in disp_to_acc:
            card_by_acc[disp_to_acc[did]] = row["card_type"]

    print(f"Building snapshots for {len(rows_by_acc)} accounts...")

    token_map: Dict[str, str] = {}
    population_records: List[Dict] = []

    SPEND_COLS = ["card_withdrawals", "transfers_out_other", "cash_withdrawals_genuine",
                  "household_bills", "insurance", "loan_payments", "bank_fees"]
    INC_COLS = ["cash_deposits", "transfers_in", "pension_in", "interest_in"]

    for account_id, rows in rows_by_acc.items():
        token = get_account_token(account_id)
        token_map[str(account_id)] = token

        in_vals  = [float(r["money_in"])  for r in rows]
        out_vals = [float(r["money_out"]) for r in rows]
        h_vals   = [float(r["household_bills"]) for r in rows]
        f_vals   = [float(r["household_bills"]) + float(r["insurance"]) + float(r["loan_payments"]) for r in rows]
        b_last6  = [float(r["avg_daily_balance"]) for r in rows[-6:]]

        I = statistics.median(in_vals)
        S = statistics.median(out_vals)
        H = statistics.median(h_vals)
        F = statistics.median(f_vals)
        B = statistics.mean(b_last6)
        P = running_loan_payment.get(account_id, 0.0)

        spend_medians = {c: statistics.median([float(r[c]) for r in rows]) for c in SPEND_COLS}
        income_medians = {c: statistics.median([float(r[c]) for r in rows]) for c in INC_COLS}

        # Runway calculations
        base_rw   = calc_runway(B, S - I)
        layoff_rw = calc_runway(B, S - 0.55 * I)
        combo_rw  = calc_runway(B, (S + 0.15 * H) - 0.55 * I)
        furnace_rw = calc_runway(B - S, S - I)  # one-off = 1 month of spending

        # Segments
        district_id = acc_district.get(account_id, 0)
        dinfo = district_info.get(district_id, {"region": "Unknown", "unemployment_rate": 0.0, "average_salary": 0.0})

        # Monthly history (last 24 months for charts)
        history = [
            {
                "month": r["month"],
                "money_in": round(float(r["money_in"]), 2),
                "money_out": round(float(r["money_out"]), 2),
                "avg_daily_balance": round(float(r["avg_daily_balance"]), 2),
                "days_below_zero": int(float(r["days_below_zero"])),
            }
            for r in rows[-24:]
        ]

        snapshot = {
            "token": token,
            "account_id": account_id,
            "I": round(I, 2),
            "S": round(S, 2),
            "F": round(F, 2),
            "H": round(H, 2),
            "B": round(B, 2),
            "P": round(P, 2),
            "n_months": len(rows),
            "base_runway": base_rw,
            "layoff_runway": layoff_rw,
            "combo_runway": combo_rw,
            "furnace_runway": furnace_rw,
            "survives_layoff_6mo": bool(layoff_rw >= 6.0),
            "spend_medians": {k: round(v, 2) for k, v in spend_medians.items()},
            "income_medians": {k: round(v, 2) for k, v in income_medians.items()},
            "segments": {
                "has_loan": bool(P > 0),
                "has_pension": bool(income_medians["pension_in"] > 0),
                "card_type": card_by_acc.get(account_id, "none"),
                "region": dinfo["region"],
                "unemployment_rate": dinfo["unemployment_rate"],
                "district_id": district_id,
            },
            "history": history,
        }

        with open(os.path.join(CACHE_DIR, "snapshots", f"{token}.json"), "w") as f:
            json.dump(snapshot, f, separators=(",", ":"))

        population_records.append({
            "token": token,
            "I": round(I, 1), "S": round(S, 1), "B": round(B, 1),
            "H": round(H, 1), "P": round(P, 1),
            "base_runway": base_rw, "layoff_runway": layoff_rw,
            "combo_runway": combo_rw,
            "has_loan": bool(P > 0),
            "has_pension": bool(income_medians["pension_in"] > 0),
            "card_type": card_by_acc.get(account_id, "none"),
            "region": dinfo["region"],
            "unemployment_rate": dinfo["unemployment_rate"],
        })

    # Save token map
    with open(os.path.join(CACHE_DIR, "token_map.json"), "w") as f:
        json.dump(token_map, f)

    # Save full population JSON (for in-memory API loading)
    with open(os.path.join(CACHE_DIR, "population.json"), "w") as f:
        json.dump(population_records, f, separators=(",", ":"))

    # Quick sanity stats
    survivals = sum(1 for r in population_records if r["layoff_runway"] >= 6.0)
    pct = round(survivals / len(population_records) * 100, 1)
    print(f"Done! {len(population_records)} snapshots written to {CACHE_DIR}/snapshots/")
    print(f"Survive layoff (6mo): {survivals}/{len(population_records)} = {pct}%")
    print(f"(Expected ≈ 64.5% per README findings)")

    # Verify account 20111
    test_token = get_account_token(20111)
    with open(os.path.join(CACHE_DIR, "snapshots", f"{test_token}.json")) as f:
        snap = json.load(f)
    print(f"\nAccount 20111 verification:")
    print(f"  I={snap['I']}, S={snap['S']}, F={snap['F']}, H={snap['H']}, B={snap['B']}, P={snap['P']}")
    print(f"  Base runway: {snap['base_runway']}, Layoff runway: {snap['layoff_runway']}")
    print(f"  Token: {test_token}")


if __name__ == "__main__":
    run_precompute()
