"use client";

import React, { useState } from "react";

interface MultilingualChatProps {
  token: string;
  apiBaseUrl?: string;
}

export const MultilingualChat: React.FC<MultilingualChatProps> = ({
  token,
  apiBaseUrl = "http://localhost:8000",
}) => {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<{
    answer: string;
    sql: string;
    ms: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const sampleQuestions = [
    { label: "🇬🇧 Biggest Spend Month", q: "What was my biggest spending month last year?" },
    { label: "🇫🇷 Dépenses (Français)", q: "Quel a été mon mois avec les dépenses les plus élevées ?" },
    { label: "🇪🇸 Préstamos (Español)", q: "¿Qué porcentaje de los clientes con préstamos no sobreviven al despido?" },
    { label: "🇨🇳 现金支出 (Mandarin)", q: "这个账户典型的现金提取比例是多少？" },
    { label: "🇮🇳 आपातकालीन फंड (Hindi)", q: "क्या इस ग्राहक का 6 महीने का आपातकालीन फंड सुरक्षित है?" },
  ];

  const handleAsk = async (textToAsk?: string) => {
    const q = textToAsk || question;
    if (!q.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, question: q }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to query advisor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>🌐</span>
            <span>Multilingual Advisor & Natural Language SQL</span>
          </h3>
          <p className="text-xs text-slate-400">
            Ask in any language (English, French, Spanish, Mandarin, Hindi) — Gemini translates to validated SQL and replies in your language.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          sqlglot AST Guardrails Active
        </span>
      </div>

      {/* Suggested Multilingual Questions */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sampleQuestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuestion(s.q);
              handleAsk(s.q);
            }}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Ask a question in any language (e.g. 'Quelle est ma dépense mensuelle moyenne ?')..."
          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-500"
        />
        <button
          onClick={() => handleAsk()}
          disabled={isLoading || !question.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          {isLoading ? "Consulting..." : "Ask"}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2.5 rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* Answer & SQL Display */}
      {response && (
        <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
          <div className="flex justify-between items-start">
            <p className="text-sm text-slate-100 font-medium leading-relaxed">
              {response.answer}
            </p>
            <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-3">
              {response.ms}ms
            </span>
          </div>

          <div>
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-[11px] font-mono text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showSql ? "▼ Hide Generated SQL" : "▶ View Verified SQL Query"}</span>
            </button>

            {showSql && (
              <pre className="mt-2 p-2.5 bg-black/80 rounded-lg text-emerald-400 text-xs font-mono overflow-x-auto border border-slate-800">
                {response.sql}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

