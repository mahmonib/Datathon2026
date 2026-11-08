"use client";

import React, { useState } from "react";

export const PopulationOverview: React.FC = () => {
  const [selectedSegment, setSelectedSegment] = useState<"all" | "loans" | "pensions" | "cards">("all");

  const segmentsData = {
    loans: [
      { name: "With Active Loan (P > 0)", survivePct: 36.0, count: 682, risk: "High Risk" },
      { name: "No Active Loan", survivePct: 68.0, count: 3818, risk: "Baseline" },
    ],
    pensions: [
      { name: "Pension Recipients", survivePct: 98.8, count: 215, risk: "Ultra Resilient" },
      { name: "Standard Income", survivePct: 63.2, count: 4285, risk: "Standard" },
    ],
    cards: [
      { name: "Gold Card Holders", survivePct: 77.0, count: 180, risk: "High Buffer" },
      { name: "Junior Card", survivePct: 62.0, count: 145, risk: "Moderate" },
      { name: "Classic Card", survivePct: 56.0, count: 567, risk: "Fragile" },
      { name: "No Card", survivePct: 66.0, count: 3608, risk: "Average" },
    ],
  };

  const histogramBands = [
    { label: "< 3 mo (Critical Risk)", pct: 21.2, count: 954, color: "bg-red-500", overdraftRate: "18.8%" },
    { label: "3–6 mo (Vulnerable)", pct: 13.9, count: 624, color: "bg-amber-500", overdraftRate: "4.0%" },
    { label: "6–12 mo (Resilient)", pct: 18.5, count: 832, color: "bg-sky-500", overdraftRate: "2.2%" },
    { label: "12+ mo (No Shortfall)", pct: 46.4, count: 2090, color: "bg-emerald-500", overdraftRate: "1.6%" },
  ];

  return (
    <div className="space-y-6">
      {/* Headline Findings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Bank Accounts
          </div>
          <div className="text-3xl font-black text-white mt-1">4,500</div>
          <div className="text-xs text-slate-400 mt-1">185,326 monthly records</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            6-Month Layoff Survival
          </div>
          <div className="text-3xl font-black text-amber-400 mt-1">64.9%</div>
          <div className="text-xs text-red-400 mt-1 font-semibold">
            35.1% cannot survive on EI
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Loan Holders Fragility
          </div>
          <div className="text-3xl font-black text-rose-400 mt-1">36.0%</div>
          <div className="text-xs text-slate-400 mt-1">Survive vs 68% without loans</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Predictive Validation
          </div>
          <div className="text-3xl font-black text-sky-400 mt-1">12× Higher</div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            Runway &lt; 3mo predicts real 2025 overdrafts
          </div>
        </div>
      </div>

      {/* Runway Distribution & Validation Evidence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Population Runway Distribution */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-base font-bold text-white mb-1">
            📊 Bank-Wide Layoff Runway Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            Evaluated on all 4,500 accounts under EI 55% shock
          </p>

          <div className="space-y-4">
            {histogramBands.map((band, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-300">{band.label}</span>
                  <span className="text-slate-400 font-mono">
                    {band.count} accounts ({band.pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                  <div
                    className={`${band.color} h-full rounded-full transition-all duration-700`}
                    style={{ width: `${band.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Predictive Validation (F3 - Out of time validation) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-white">
              🎯 Proof that Runway Metric Works
            </h3>
            <span className="px-2 py-0.5 text-[10px] bg-sky-950 text-sky-300 border border-sky-800 rounded font-semibold">
              Data Use 25%
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Freeze data at 2024-12, compute runway, and measure real 2025 overdraft days:
          </p>

          <div className="space-y-2.5">
            {histogramBands.map((band, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{band.label}</div>
                  <div className="text-[10px] text-slate-400">Calculated through Dec 2024</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-rose-400">
                    {band.overdraftRate}
                  </div>
                  <div className="text-[10px] text-slate-400">Overdrafted in 2025</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 italic bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
            Customers with &lt;3 months of runway had an <strong>18.8% overdraft rate</strong> in 2025 compared to only <strong>1.6%</strong> for customers with 12+ months — confirming our engine is strongly predictive.
          </p>
        </div>
      </div>

      {/* Segment Breakdown */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white">
              🔍 Vulnerability by Customer Segment
            </h3>
            <p className="text-xs text-slate-400">
              Identify which customer cohorts need proactive intervention
            </p>
          </div>

          <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(["loans", "pensions", "cards"] as const).map((seg) => (
              <button
                key={seg}
                onClick={() => setSelectedSegment(seg)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                  selectedSegment === (seg as string)
                    ? "bg-orange-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(segmentsData[selectedSegment as keyof typeof segmentsData] || segmentsData.loans).map(
            (item, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{item.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    {item.count} accounts · {item.risk}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {item.survivePct}%
                  </div>
                  <div className="text-[10px] text-slate-400">Survive 6-mo Layoff</div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

