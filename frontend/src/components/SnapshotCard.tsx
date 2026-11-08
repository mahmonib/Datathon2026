"use client";

import React from "react";
import { AccountSnapshot } from "../lib/calc";

interface SnapshotCardProps {
  snapshot: AccountSnapshot;
  accountIdInput: string;
  onAccountIdChange: (val: string) => void;
  onLoadAccount: () => void;
  isLoading: boolean;
}

export const SnapshotCard: React.FC<SnapshotCardProps> = ({
  snapshot,
  accountIdInput,
  onAccountIdChange,
  onLoadAccount,
  isLoading,
}) => {
  const getRunwayColor = (rw: number) => {
    if (rw >= 6) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";
    if (rw >= 3) return "text-amber-400 border-amber-500/40 bg-amber-950/40";
    return "text-red-400 border-red-500/40 bg-red-950/40";
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Account Selector & Token Vault Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Account ID:
            </label>
            <input
              type="text"
              value={accountIdInput}
              onChange={(e) => onAccountIdChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onLoadAccount()}
              placeholder="e.g. 20111"
              className="w-28 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={onLoadAccount}
              disabled={isLoading}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {isLoading ? "Loading..." : "Load"}
            </button>
          </div>

          <div className="flex gap-1.5">
            {[20111, 1000, 2450, 4200].map((id) => (
              <button
                key={id}
                onClick={() => {
                  onAccountIdChange(id.toString());
                }}
                className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
                  accountIdInput === id.toString()
                    ? "bg-slate-700 border-slate-500 text-white font-medium"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                #{id}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Token Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            Vault Token: <strong className="text-orange-400">{snapshot.token}</strong>
          </span>
          <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded font-semibold border border-slate-700">
            🔒 Privacy-by-Design
          </span>
        </div>
      </div>

      {/* Customer Segment Badges */}
      <div className="flex flex-wrap gap-2 my-4">
        <span className="px-2.5 py-1 text-xs font-medium bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700">
          💳 Card: <strong className="text-white capitalize">{snapshot.segments.card_type}</strong>
        </span>
        <span className="px-2.5 py-1 text-xs font-medium bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700">
          📍 Region: <strong className="text-white">{snapshot.segments.region}</strong>
        </span>
        <span
          className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${
            snapshot.segments.has_loan
              ? "bg-red-950/40 border-red-800/50 text-red-300"
              : "bg-slate-800/80 border-slate-700 text-slate-400"
          }`}
        >
          {snapshot.segments.has_loan ? "⚠️ Active Loan Obligation" : "✓ No Running Loan"}
        </span>
        {snapshot.segments.has_pension && (
          <span className="px-2.5 py-1 text-xs font-medium bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg">
            🛡️ Pension Protected
          </span>
        )}
      </div>

      {/* Primary KPI Grid (Judges' Standard Numbers) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
        {/* I - Monthly Income */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Income (I)
          </div>
          <div className="text-xl font-bold text-white mt-1">
            ${snapshot.I.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Median money in</div>
        </div>

        {/* S - Monthly Spending */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Spending (S)
          </div>
          <div className="text-xl font-bold text-white mt-1">
            ${snapshot.S.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Median money out</div>
        </div>

        {/* F - Fixed Costs */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Fixed Costs (F)
          </div>
          <div className="text-xl font-bold text-white mt-1">
            ${snapshot.F.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Bills + ins. + loan</div>
        </div>

        {/* H - Household Bills */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Bills (H)
          </div>
          <div className="text-xl font-bold text-white mt-1">
            ${snapshot.H.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Shock sensitive</div>
        </div>

        {/* B - Buffer */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Buffer (B)
          </div>
          <div className="text-xl font-bold text-sky-400 mt-1">
            ${snapshot.B.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Last 6 mo avg bal</div>
        </div>

        {/* Baseline Runway */}
        <div
          className={`border rounded-xl p-3 flex flex-col justify-between ${getRunwayColor(
            snapshot.base_runway
          )}`}
        >
          <div className="text-[11px] font-medium uppercase tracking-wide">
            Baseline Runway
          </div>
          <div className="text-2xl font-black mt-1">
            {snapshot.base_runway}{" "}
            <span className="text-xs font-normal text-slate-400">mo</span>
          </div>
          <div className="text-[10px] font-semibold">
            {snapshot.base_runway >= 120
              ? "✓ No shortfall"
              : snapshot.base_runway >= 6
              ? "✓ Safe buffer"
              : "⚠️ Vulnerable"}
          </div>
        </div>
      </div>
    </div>
  );
};

