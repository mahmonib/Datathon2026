"use client";

import React, { useState } from "react";

interface SolanaBadgeProps {
  token: string;
  shockParams: Record<string, unknown>;
  planOutputs: Record<string, unknown>;
  apiBaseUrl?: string;
}

export const SolanaBadge: React.FC<SolanaBadgeProps> = ({
  token,
  shockParams,
  planOutputs,
  apiBaseUrl = "http://localhost:8000",
}) => {
  const [isCertifying, setIsCertifying] = useState(false);
  const [certData, setCertData] = useState<{
    tx_signature: string;
    hash: string;
    explorer_url: string;
    timestamp: number;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCertify = async () => {
    setIsCertifying(true);
    setError(null);
    setVerifyResult(null);

    try {
      const res = await fetch(`${apiBaseUrl}/solana/certify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          shock_params: shockParams,
          plan_outputs: planOutputs,
          formula_version: "v1.0",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setCertData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to certify on Solana.");
    } finally {
      setIsCertifying(false);
    }
  };

  const handleVerify = async () => {
    if (!certData) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`${apiBaseUrl}/solana/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_signature: certData.tx_signature,
          expected_hash: certData.hash,
        }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerifyResult("✓ Verified directly against Solana Devnet Memo program logs!");
      } else {
        setVerifyResult("⚠️ Memo verification returned unconfirmed or mismatch.");
      }
    } catch (err: unknown) {
      setVerifyResult(err instanceof Error ? err.message : "Verification error.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⛓️</span>
            <h3 className="text-base font-bold text-white">
              Solana Audit Receipt (CLI Memo Program)
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-950/80 border border-purple-700/60 text-purple-300 rounded-full">
              Devnet
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident advice proof: SHA-256 digest of customer token + inputs + plan output.
          </p>
        </div>

        {!certData ? (
          <button
            onClick={handleCertify}
            disabled={isCertifying}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isCertifying ? (
              <>
                <span className="animate-spin">🔄</span>
                <span>Writing Memo to Solana CLI...</span>
              </>
            ) : (
              <>
                <span>🔒</span>
                <span>Certify Plan on Solana</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              {isVerifying ? "Verifying..." : "🔍 Re-verify On-Chain"}
            </button>
            <a
              href={certData.explorer_url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-purple-500/40 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>View Explorer</span>
              <span>↗</span>
            </a>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-400 bg-red-950/30 border border-red-800/40 p-2.5 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {certData && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-400 font-mono">Plan SHA-256 Digest:</span>
              <div className="font-mono text-purple-300 font-bold text-[11px] mt-0.5 break-all">
                {certData.hash}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400">Timestamp</span>
              <div className="text-slate-300 font-mono text-[11px]">
                {new Date(certData.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-mono truncate max-w-[280px]">
              Signature: {certData.tx_signature}
            </span>
            <span className="text-emerald-400 font-semibold">✓ Certified by Bank Auditor</span>
          </div>

          {verifyResult && (
            <div className="mt-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 p-2 rounded-lg font-medium">
              {verifyResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

