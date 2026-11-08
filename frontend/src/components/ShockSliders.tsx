"use client";

import React from "react";
import { ShockParams } from "../lib/calc";

interface ShockSlidersProps {
  params: ShockParams;
  onChange: (params: ShockParams) => void;
  onVoiceClick?: () => void;
  isListening?: boolean;
}

export const ShockSliders: React.FC<ShockSlidersProps> = ({
  params,
  onChange,
  onVoiceClick,
  isListening,
}) => {
  const update = (patch: Partial<ShockParams>) => {
    onChange({ ...params, ...patch });
  };

  const applyPreset = (name: string) => {
    if (name === "layoff") {
      update({ eiPct: 55, billsUpPct: 0, repairMonths: 0, oneOffFixed: 0, durationMonths: 6 });
    } else if (name === "furnace") {
      update({ eiPct: 100, billsUpPct: 0, repairMonths: 1, oneOffFixed: 0, durationMonths: 6 });
    } else if (name === "combo") {
      update({ eiPct: 55, billsUpPct: 15, repairMonths: 0, oneOffFixed: 0, durationMonths: 6 });
    } else if (name === "reset") {
      update({ eiPct: 100, billsUpPct: 0, repairMonths: 0, oneOffFixed: 0, durationMonths: 6 });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            ⚡ Twist Shock Simulator
          </h3>
          <p className="text-xs text-slate-400">
            Real-time client-side calculation under 16ms
          </p>
        </div>

        {/* Voice Trigger Button */}
        {onVoiceClick && (
          <button
            onClick={onVoiceClick}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isListening
                ? "bg-red-500/20 border-red-500 text-red-300 animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
            }`}
          >
            <span>🎙️</span>
            <span>{isListening ? "Listening to Twist..." : "Speak Twist Card"}</span>
          </button>
        )}
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs text-slate-400 self-center font-medium mr-1">
          Scenarios:
        </span>
        <button
          onClick={() => applyPreset("layoff")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-orange-950/60 hover:bg-orange-900/60 border border-orange-700/60 text-orange-200 transition-colors cursor-pointer"
        >
          💼 Layoff (EI 55%)
        </button>
        <button
          onClick={() => applyPreset("furnace")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 text-amber-200 transition-colors cursor-pointer"
        >
          🔧 Furnace Repair (1 mo spend)
        </button>
        <button
          onClick={() => applyPreset("combo")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700/60 text-rose-200 transition-colors cursor-pointer"
        >
          🌪️ Layoff + Bills +15%
        </button>
        <button
          onClick={() => applyPreset("reset")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
        >
          ↺ Normal Times
        </button>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Slider 1: EI Income % */}
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-medium text-slate-300">
              Employment Income (% normal)
            </label>
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                params.eiPct < 100 ? "text-amber-400 bg-amber-950/50" : "text-slate-300"
              }`}
            >
              {params.eiPct}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={params.eiPct}
            onChange={(e) => update({ eiPct: Number(e.target.value) })}
            className="w-full accent-orange-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0% (Job loss, no EI)</span>
            <span>55% (Judges&apos; EI)</span>
            <span>100% (Working)</span>
          </div>
        </div>

        {/* Slider 2: Household Bills Spike % */}
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-medium text-slate-300">
              Household Bills Spike (+%)
            </label>
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                params.billsUpPct > 0 ? "text-red-400 bg-red-950/50" : "text-slate-300"
              }`}
            >
              +{params.billsUpPct}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={params.billsUpPct}
            onChange={(e) => update({ billsUpPct: Number(e.target.value) })}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>+0%</span>
            <span>+15% (Twist standard)</span>
            <span>+50% (Extreme)</span>
          </div>
        </div>

        {/* Slider 3: Emergency One-Off Cost */}
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-medium text-slate-300">
              One-Off Emergency Cost (Months of Spend)
            </label>
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                params.repairMonths > 0 ? "text-amber-400 bg-amber-950/50" : "text-slate-300"
              }`}
            >
              {params.repairMonths} mo
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="0.5"
            value={params.repairMonths}
            onChange={(e) => update({ repairMonths: Number(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>$0</span>
            <span>1 Month of Spend (Furnace)</span>
            <span>3 Months</span>
          </div>
        </div>

        {/* Slider 4: Shock Duration */}
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-medium text-slate-300">
              Shock Duration Target (D)
            </label>
            <span className="text-sm font-bold font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded">
              {params.durationMonths} months
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="18"
            step="1"
            value={params.durationMonths}
            onChange={(e) => update({ durationMonths: Number(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>3 mo</span>
            <span>6 mo (Judges&apos; benchmark)</span>
            <span>12+ mo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

