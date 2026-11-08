import os
import pandas as pd, numpy as np

DATA_DIR = os.getenv("DATASET_PATH", os.path.join(os.path.dirname(__file__), "Datasets", "Tangerine", "data"))
ms = pd.read_csv(os.path.join(DATA_DIR, "monthly_summary.csv")).sort_values(["account_id", "month"])
loans = pd.read_csv(os.path.join(DATA_DIR, "loans.csv"))
acc = pd.read_csv(os.path.join(DATA_DIR, "accounts.csv"))
disp = pd.read_csv(os.path.join(DATA_DIR, "dispositions.csv"))
cards = pd.read_csv(os.path.join(DATA_DIR, "cards.csv"))
dist = pd.read_csv(os.path.join(DATA_DIR, "districts.csv"))
so = pd.read_csv(os.path.join(DATA_DIR, "standing_orders.csv"))

print("months range", ms.month.min(), ms.month.max(), "accounts", ms.account_id.nunique())
print("rows/account", ms.groupby("account_id").size().describe().round(1).to_dict())

g = ms.groupby("account_id")
snap = pd.DataFrame({
    "I": g.money_in.median(),
    "S": g.money_out.median(),
    "F": g.apply(lambda d: (d.household_bills + d.insurance + d.loan_payments).median()),
    "H": g.household_bills.median(),
    "B": g.apply(lambda d: d.avg_daily_balance.tail(6).mean()),
    "n_months": g.size(),
    "last_month": g.month.max(),
})
running = loans[loans.status.isin(["C", "D"])].set_index("account_id").monthly_payment
snap["P"] = running.reindex(snap.index).fillna(0)

def runway(B, inc, spend, one_off=0):
    bl = B - one_off
    gap = spend - inc
    return np.where(bl <= 0, 0, np.where(gap <= 0, 120, np.minimum(bl / np.where(gap > 0, gap, 1), 120)))

snap["rw_base"] = runway(snap.B, snap.I, snap.S)
snap["rw_layoff"] = runway(snap.B, 0.55 * snap.I, snap.S)
snap["rw_combo"] = runway(snap.B, 0.55 * snap.I, snap.S + 0.15 * snap.H)
snap["rw_furnace"] = runway(snap.B, snap.I, snap.S, snap.S)
print(snap[["I", "S", "F", "H", "B", "P"]].describe().round(0).T)
print("base no shortfall %:", (snap.rw_base >= 120).mean().round(3))
for c in ["rw_layoff", "rw_combo"]:
    print(c, "survive 6mo %:", (snap[c] >= 6).mean().round(3), "median:", np.median(snap[c]).round(1))
print("furnace no shortfall %:", (snap.rw_furnace >= 120).mean().round(3), "zero %:", (snap.rw_furnace == 0).mean().round(3))

# spending mix share
cols = ["household_bills", "insurance", "loan_payments", "bank_fees", "cash_withdrawals_genuine", "card_withdrawals", "transfers_out_other"]
tot = ms[cols].sum()
print("spend mix %:\n", (tot / tot.sum() * 100).round(1))
flex = g[["card_withdrawals", "cash_withdrawals_genuine", "transfers_out_other"]].median().sum(axis=1)
print("median flexible share of S:", (flex / snap.S.replace(0, np.nan)).median().round(2))
inc_mix = ms[["cash_deposits", "transfers_in", "pension_in", "interest_in"]].sum()
print("income mix %:\n", (inc_mix / inc_mix.sum() * 100).round(1))
# income volatility
cv = g.money_in.std() / g.money_in.mean()
print("income CV median:", cv.median().round(2))

# segments
snap["has_loan"] = snap.P > 0
snap["pension"] = g.pension_in.median() > 0
own = disp[disp.type == "owner"].merge(cards, on="disposition_id", how="left")
ct = own.groupby("account_id").card_type.first()
snap["card"] = ct.reindex(snap.index).fillna("none")
snap = snap.join(acc.set_index("account_id").district_id).join(dist.set_index("district_id")[["region", "unemployment_rate_2023", "average_salary"]], on="district_id")
snap["surv"] = snap.rw_layoff >= 6
for seg in ["has_loan", "pension", "card", "region"]:
    print(seg, snap.groupby(seg).surv.agg(["mean", "size"]).round(3).to_dict())
snap["unemp_q"] = pd.qcut(snap.unemployment_rate_2023, 4, labels=["low", "mid", "midhi", "high"])
print("unemp", snap.groupby("unemp_q", observed=True).surv.mean().round(3).to_dict())

# validation: runway computed through 2024-12, outcomes in 2025
pre = ms[ms.month <= "2024-12"]; post = ms[ms.month >= "2025-01"]
gp = pre.groupby("account_id")
v = pd.DataFrame({"I": gp.money_in.median(), "S": gp.money_out.median(),
                  "B": gp.apply(lambda d: d.avg_daily_balance.tail(6).mean())})
v["rw"] = runway(v.B, 0.55 * v.I, v.S)
v["neg2025"] = post.groupby("account_id").days_below_zero.sum().reindex(v.index) > 0
v = v.dropna(subset=["neg2025"])
v["rw_band"] = pd.cut(v.rw, [-0.1, 3, 6, 12, 1000], labels=["<3", "3-6", "6-12", "12+"])
print("validation neg days 2025 by layoff runway band:", v.groupby("rw_band", observed=True).neg2025.agg(["mean", "size"]).round(3).to_dict())
dl = loans.set_index("account_id").defaulted
snap["defaulted"] = dl.reindex(snap.index)
lv = snap.dropna(subset=["defaulted"]).copy()
lv["band"] = pd.cut(lv.rw_layoff, [-0.1, 3, 6, 12, 1000], labels=["<3", "3-6", "6-12", "12+"])
print("default by band (same-period, not predictive):", lv.groupby("band", observed=True).defaulted.agg(["mean", "size"]).round(3).to_dict())
print("ever negative overall %:", (g.days_below_zero.sum() > 0).mean().round(3))
print("standing orders purposes:", so.purpose.fillna("other").value_counts().to_dict())
print("sample account 20111:", snap.loc[20111, ["I", "S", "F", "H", "B", "P", "rw_base", "rw_layoff", "rw_combo"]].round(1).to_dict())
