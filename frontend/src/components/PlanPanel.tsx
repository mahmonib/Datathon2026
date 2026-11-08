"use client";

import React, { useState } from "react";
import {
  AccountSnapshot,
  ShockParams,
  calculateGoalPlan,
  calculateBackupPlan,
  calculateLevers,
} from "../lib/calc";

interface PlanPanelProps {
  snapshot: AccountSnapshot;
  shockParams: ShockParams;
  onApplyCuts: (totalCuts: number) => void;
}

export const PlanPanel: React.FC<PlanPanelProps> = ({
  snapshot,
  shockParams,
  onApplyCuts,
}) => {
  const [savingsRate, setSavingsRate] = useState(0.5); // 50% default
  const [activeTab, setActiveTab] = useState<"backup" | "goal" | "levers">("backup");
  const [enabledCuts, setEnabledCuts] = useState<Record<string, boolean>>({
    bank_fees: true,
    card_withdrawals: true,
    transfers_out_other: true,
    cash_withdrawals_genuine: true,
    household_bills: true,
  });

  // Goal Plan
  const goal = calculateGoalPlan(snapshot.I, snapshot.S, snapshot.B, savingsRate);

  // Buffer and Gap under active shock
  const incomeAfter = (shockParams.eiPct / 100.0) * snapshot.I;
  const spendAfter = snapshot.S + (shockParams.billsUpPct / 100.0) * snapshot.H;
  const oneOff = shockParams.repairMonths * snapshot.S + shockParams.oneOffFixed;
  const bufferLeft = snapshot.B - oneOff;
  const gap = spendAfter - incomeAfter;

  // Backup Plan
  const backup = calculateBackupPlan(
    bufferLeft,
    gap,
    shockParams.durationMonths,
    snapshot.spend_medians
  );

  // Levers
  const levers = calculateLevers(snapshot, shockParams);

  // Calculate sum of active toggled cuts
  const activeCutSum = Object.entries(backup.allocatedCuts)
    .filter(([cat]) => enabledCuts[cat] ?? true)
    .reduce((sum, [, amt]) => sum + amt, 0);

  // Notify parent of total cuts whenever toggled
  const handleToggleCut = (cat: string) => {
    const updated = { ...enabledCuts, [cat]: !enabledCuts[cat] };
    setEnabledCuts(updated);
    const newSum = Object.entries(backup.allocatedCuts)
      .filter(([c]) => updated[c] ?? true)
      .reduce((sum, [, amt]) => sum + amt, 0);
    onApplyCuts(newSum);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("backup")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "backup"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            🛡️ Backup Plan (Cuts)
          </button>
          <button
            onClick={() => setActiveTab("goal")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "goal"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            🎯 Goal Plan (Savings)
          </button>
          <button
            onClick={() => setActiveTab("levers")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "levers"
                ? "bg-sky-600 text-white shadow-lg shadow-sky-900/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            ⚖️ Policy Levers
          </button>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400">
            Active Cut: <strong className="text-rose-400 font-mono">${activeCutSum.toFixed(0)}/mo</strong>
          </span>
        </div>
      </div>

      {/* ── 1. BACKUP PLAN PANEL ────────────────────────────────────────── */}
      {activeTab === "backup" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div>
              <div className="text-xs font-semibold text-slate-300">
                Monthly Cut Needed to Survive {shockParams.durationMonths} Months:
              </div>
              <div className="text-2xl font-black text-rose-400 mt-1">
                ${backup.cutNeeded.toFixed(0)}
                <span className="text-xs text-slate-400 font-normal"> / month</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Found via Discretionary Caps:</div>
              <div className="text-lg font-bold text-emerald-400">
                ${backup.totalCutFound.toFixed(0)} / mo
              </div>
              {backup.unmetCut > 0 && (
                <div className="text-[11px] text-amber-400 font-medium">
                  (${backup.unmetCut.toFixed(0)} shortfall remains)
                </div>
              )}
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">
            Greedy Category Spending Reductions (Click to toggle):
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(backup.allocatedCuts).map(([cat, amount]) => {
              const isEnabled = enabledCuts[cat] ?? true;
              const medianVal = snapshot.spend_medians[cat as keyof typeof snapshot.spend_medians] || 0;
              const labels: Record<string, { title: string; desc: string }> = {
                card_withdrawals: { title: "Discretionary Card Spend", desc: "Max 30% cut" },
                transfers_out_other: { title: "Unlabelled Transfers", desc: "Max 25% cut" },
                cash_withdrawals_genuine: { title: "Cash Withdrawals", desc: "Max 15% cut (76% of spend)" },
                household_bills: { title: "Bills Renegotiation", desc: "Max 5% provider cut" },
                bank_fees: { title: "Bank Overdraft Fees", desc: "100% avoidable" },
              };

              const info = labels[cat] || { title: cat, desc: "" };

              return (
                <div
                  key={cat}
                  onClick={() => handleToggleCut(cat)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                    isEnabled
                      ? "bg-slate-950/80 border-slate-700 hover:border-rose-500"
                      : "bg-slate-950/20 border-slate-900 opacity-40"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{isEnabled ? "✓" : "✗"}</span>
                      <span>{info.title}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {info.desc} · Median ${medianVal.toFixed(0)}/mo
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-rose-400">
                      -${amount.toFixed(0)}/mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 text-xs text-slate-400 flex items-center justify-between">
            <span>
              💡 <em>Note:</em> Cash withdrawals account for <strong>76% of customer spending</strong>. Trimming even 15% of cash is often enough to survive.
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                backup.survivesWithCuts
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/50"
                  : "bg-red-950/80 text-red-300 border border-red-700/50"
              }`}
            >
              Runway with Cuts: {backup.runwayAfterCuts} mo
            </span>
          </div>
        </div>
      )}

      {/* ── 2. GOAL PLAN PANEL ──────────────────────────────────────────── */}
      {activeTab === "goal" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Surplus</div>
              <div className={`text-xl font-bold mt-1 ${goal.surplus > 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${goal.surplus.toFixed(0)}
              </div>
              <div className="text-[10px] text-slate-400">I − S normal times</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">3-Month Target</div>
              <div className="text-xl font-bold text-white mt-1">
                ${goal.target3mo.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">3 × typical spend</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">6-Month Target</div>
              <div className="text-xl font-bold text-white mt-1">
                ${goal.target6mo.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">Full resilience goal</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Months to 6-mo Goal</div>
              <div className="text-xl font-bold text-sky-400 mt-1">
                {goal.monthsTo6mo !== null ? `${goal.monthsTo6mo} mo` : "—"}
              </div>
              <div className="text-[10px] text-slate-400">At {(savingsRate * 100).toFixed(0)}% saving rate</div>
            </div>
          </div>

          {/* Savings Rate Slider */}
          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Comfortable Savings Rate (% of monthly surplus):
              </label>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {(savingsRate * 100).toFixed(0)}% (${goal.monthlySave.toFixed(0)}/mo)
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={savingsRate}
              onChange={(e) => setSavingsRate(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>10% (Gentle)</span>
              <span>50% (Realistic Default)</span>
              <span>100% (Maximum Speed)</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 italic bg-slate-950/30 p-3 rounded-lg border border-slate-800/40">
            {goal.message}
          </p>
        </div>
      )}

      {/* ── 3. POLICY LEVERS PANEL ──────────────────────────────────────── */}
      {activeTab === "levers" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Ranked by impact on extending customer runway under active shock:
          </p>
          {levers.map((lever, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span>{lever.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {lever.description}
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 text-xs font-bold font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 rounded-lg">
                  +{lever.deltaMonths} mo
                </span>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  New: {lever.newRunway} mo
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

