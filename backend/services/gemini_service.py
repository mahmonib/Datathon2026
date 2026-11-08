"""
Gemini API service — multilingual NL-to-SQL, twist card parsing, and plan narration.
All numbers come from the database; Gemini only translates, parses, and narrates.
"""

import os
import json
import re
import statistics
from typing import Optional, Any

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

MODEL = "gemini-2.0-flash"

# ── Schema context injected into every NL-to-SQL prompt ───────────────────────
_SCHEMA = """
Views available (read-only, SELECT only, LIMIT enforced):

v_account_snapshot: token TEXT, I NUMERIC, S NUMERIC, F NUMERIC, H NUMERIC,
  B NUMERIC, P NUMERIC, base_runway NUMERIC, layoff_runway NUMERIC,
  combo_runway NUMERIC, survives_layoff_6mo BOOLEAN,
  has_loan BOOLEAN, has_pension BOOLEAN, card_type TEXT, region TEXT

v_account_month: token TEXT, month TEXT (YYYY-MM), money_in NUMERIC,
  money_out NUMERIC, cash_deposits NUMERIC, transfers_in NUMERIC,
  pension_in NUMERIC, interest_in NUMERIC, household_bills NUMERIC,
  insurance NUMERIC, loan_payments NUMERIC, bank_fees NUMERIC,
  cash_withdrawals_genuine NUMERIC, card_withdrawals NUMERIC,
  transfers_out_other NUMERIC, avg_daily_balance NUMERIC,
  month_end_balance NUMERIC, days_below_zero INTEGER

v_population: token TEXT, I NUMERIC, S NUMERIC, B NUMERIC, H NUMERIC, P NUMERIC,
  base_runway NUMERIC, layoff_runway NUMERIC, combo_runway NUMERIC,
  has_loan BOOLEAN, has_pension BOOLEAN, card_type TEXT, region TEXT,
  unemployment_rate NUMERIC

Rules:
- For account-specific questions, always filter: WHERE token = '<TOKEN>'
- Use LIMIT 1000 maximum
- SELECT only — no INSERT, UPDATE, DELETE, DROP
- Quote string values (e.g. card_type = 'gold')
"""

_EXAMPLE_QA = """
Examples (English → SQL):
Q: "What was my biggest spending month last year?"
A: SELECT month, money_out FROM v_account_month WHERE token = '<TOKEN>' AND month LIKE '2024%' ORDER BY money_out DESC LIMIT 1;

Q: "How much do I spend on bills on average?"
A: SELECT AVG(household_bills) AS avg_bills FROM v_account_month WHERE token = '<TOKEN>';

Q: "What share of loan holders can't survive a layoff?"
A: SELECT AVG(CASE WHEN layoff_runway < 6 THEN 1.0 ELSE 0.0 END) * 100 AS pct_at_risk FROM v_population WHERE has_loan = true;

Q: "Which region has the lowest average runway?"
A: SELECT region, AVG(layoff_runway) AS avg_runway FROM v_population GROUP BY region ORDER BY avg_runway ASC LIMIT 10;

French example:
Q: "Quel était mon mois avec les dépenses les plus élevées en 2024 ?"
A: SELECT month, money_out FROM v_account_month WHERE token = '<TOKEN>' AND month LIKE '2024%' ORDER BY money_out DESC LIMIT 1;

Spanish example:
Q: "¿Cuánto gasto en facturas del hogar en promedio?"
A: SELECT AVG(household_bills) AS promedio_facturas FROM v_account_month WHERE token = '<TOKEN>';
"""


async def nl_to_sql(question: str, token: str, language: Optional[str] = None) -> str:
    """Translate a natural language question (any language) to a PostgreSQL SELECT query."""
    model = genai.GenerativeModel(MODEL)
    prompt = f"""You are a SQL generator for a financial resilience database.
{_SCHEMA}
{_EXAMPLE_QA}

The current user's token is: {token}
Detected or specified language: {language or 'auto-detect'}

User question: {question}

Respond with ONLY a single valid SQL SELECT statement, no explanation, no markdown, no backticks.
Replace <TOKEN> with the actual token value shown above.
"""
    response = model.generate_content(prompt)
    sql = response.text.strip().strip("`").strip()
    # Strip any "sql" language hint from code blocks
    sql = re.sub(r"^sql\s*", "", sql, flags=re.IGNORECASE).strip()
    return sql


async def summarise(question: str, rows: list, language: Optional[str] = None) -> str:
    """Generate a 2-sentence plain-language answer in the user's original language."""
    if not rows:
        return "No data found for that question." if not language else _no_data_msg(language)
    model = genai.GenerativeModel(MODEL)
    prompt = f"""You are a helpful bank advisor. Answer the following question in 2 sentences maximum.
Quote exact numbers from the data. Do NOT invent numbers.
Respond in the same language as the question.

Question: {question}
Data: {json.dumps(rows[:20], default=str)}

Answer:"""
    response = model.generate_content(prompt)
    return response.text.strip()


async def parse_twist(text: Optional[str] = None, audio_base64: Optional[str] = None) -> dict:
    """
    Parse a spoken or typed twist card into structured shock parameters.
    Returns: {ei_pct, bills_up_pct, one_off_spend_months, duration_months, transcript}
    """
    model = genai.GenerativeModel(MODEL)

    function_declaration = {
        "name": "set_shock",
        "description": "Set the financial shock parameters from the twist card.",
        "parameters": {
            "type": "object",
            "properties": {
                "ei_pct": {"type": "number", "description": "EI replacement rate as percent (e.g. 55 for 55%). Use 100 if no job loss."},
                "bills_up_pct": {"type": "number", "description": "Household bills increase as percent (e.g. 15 for +15%). 0 if no change."},
                "one_off_spend_months": {"type": "number", "description": "One-off emergency cost as number of months of spending (e.g. 1 for one month of spend). 0 if none."},
                "duration_months": {"type": "integer", "description": "Duration of the shock in months (e.g. 6)."},
            },
            "required": ["ei_pct", "bills_up_pct", "one_off_spend_months", "duration_months"],
        },
    }

    if audio_base64:
        import base64
        audio_bytes = base64.b64decode(audio_base64)
        # Gemini multimodal: send audio blob inline
        content = [
            {"mime_type": "audio/webm", "data": audio_bytes},
            "Transcribe this twist card and extract the shock parameters using the set_shock function."
        ]
    else:
        content = f"""Parse this financial shock scenario into parameters using set_shock:
"{text}"

Examples:
- "They lose their job, EI at 55% for 6 months" → ei_pct=55, bills_up_pct=0, one_off_spend_months=0, duration_months=6
- "Furnace dies, costs one month of spending" → ei_pct=100, bills_up_pct=0, one_off_spend_months=1, duration_months=6
- "Laid off (EI 55%) and bills go up 15%" → ei_pct=55, bills_up_pct=15, one_off_spend_months=0, duration_months=6
"""

    response = model.generate_content(
        content,
        tools=[{"function_declarations": [function_declaration]}],
        tool_config={"function_calling_config": {"mode": "ANY"}},
    )

    params = {"ei_pct": 100, "bills_up_pct": 0, "one_off_spend_months": 0, "duration_months": 6}
    transcript = text or ""

    for part in response.candidates[0].content.parts:
        if hasattr(part, "function_call") and part.function_call.name == "set_shock":
            args = dict(part.function_call.args)
            params.update(args)
        elif hasattr(part, "text") and part.text:
            transcript = part.text

    return {**params, "transcript": transcript}


async def narrate_plan(token: str, snapshot: dict, plan: dict, language: Optional[str] = "English") -> str:
    """Generate a 3-sentence plain-language narration of the resilience plan."""
    model = genai.GenerativeModel(MODEL)
    prompt = f"""You are a friendly Canadian bank advisor. In 3 sentences, explain this customer's resilience plan.
Use their actual numbers. Be encouraging but honest. Respond in {language or 'English'}.

Customer snapshot: I=${snapshot.get('I', 0):.0f}/mo income, S=${snapshot.get('S', 0):.0f}/mo spending,
Buffer=${snapshot.get('B', 0):.0f}, Runway={snapshot.get('layoff_runway', 0)} months under a layoff shock.

Plan: {json.dumps(plan, default=str)}

Narration:"""
    response = model.generate_content(prompt)
    return response.text.strip()


def execute_in_memory(sql: str, token: str, population: list, snapshot_cache: dict) -> tuple[list, int]:
    """
    Lightweight in-memory SQL executor for demo/offline mode.
    Handles simple SELECT from v_population and v_account_snapshot.
    Falls back gracefully for complex queries.
    """
    sql_up = sql.upper()

    # v_account_snapshot — single account lookup
    if "V_ACCOUNT_SNAPSHOT" in sql_up:
        snap = snapshot_cache.get(token)
        if not snap:
            return [], 0
        row = {
            "token": snap["token"], "I": snap["I"], "S": snap["S"], "F": snap["F"],
            "H": snap["H"], "B": snap["B"], "P": snap["P"],
            "base_runway": snap["base_runway"], "layoff_runway": snap["layoff_runway"],
            "has_loan": snap["segments"]["has_loan"],
            "has_pension": snap["segments"]["has_pension"],
            "card_type": snap["segments"]["card_type"],
            "region": snap["segments"]["region"],
        }
        return [row], 1

    # v_account_month — history lookup
    if "V_ACCOUNT_MONTH" in sql_up:
        snap = snapshot_cache.get(token)
        if not snap:
            return [], 0
        rows = snap.get("history", [])
        # Apply simple ORDER BY money_out DESC / money_in DESC
        if "ORDER BY MONEY_OUT DESC" in sql_up:
            rows = sorted(rows, key=lambda r: r.get("money_out", 0), reverse=True)
        elif "ORDER BY MONEY_IN DESC" in sql_up:
            rows = sorted(rows, key=lambda r: r.get("money_in", 0), reverse=True)
        # Apply LIMIT
        m = re.search(r"LIMIT\s+(\d+)", sql_up)
        limit = int(m.group(1)) if m else 20
        rows = rows[:limit]
        return rows, len(rows)

    # v_population — bank-wide queries
    if "V_POPULATION" in sql_up:
        rows = population
        # Filter has_loan / has_pension
        if "HAS_LOAN = TRUE" in sql_up:
            rows = [r for r in rows if r.get("has_loan")]
        if "HAS_PENSION = TRUE" in sql_up:
            rows = [r for r in rows if r.get("has_pension")]
        # Survival share
        if "LAYOFF_RUNWAY < 6" in sql_up and "AVG" in sql_up:
            at_risk = sum(1 for r in rows if r.get("layoff_runway", 0) < 6)
            pct = round(at_risk / len(rows) * 100, 1) if rows else 0
            return [{"pct_at_risk": pct, "total_accounts": len(rows)}], 1
        # Group by region
        if "GROUP BY REGION" in sql_up:
            by_region: dict = {}
            for r in rows:
                reg = r.get("region", "Unknown")
                by_region.setdefault(reg, []).append(r.get("layoff_runway", 0))
            result = [
                {"region": reg, "avg_runway": round(statistics.mean(vals), 1), "count": len(vals)}
                for reg, vals in by_region.items()
            ]
            result.sort(key=lambda x: x["avg_runway"])
            return result[:10], len(result)
        m = re.search(r"LIMIT\s+(\d+)", sql_up)
        limit = int(m.group(1)) if m else 1000
        return rows[:limit], len(rows[:limit])

    return [], 0


def _no_data_msg(language: str) -> str:
    msgs = {
        "fr": "Aucune donnée trouvée pour cette question.",
        "es": "No se encontraron datos para esa pregunta.",
        "zh": "未找到相关数据。",
        "hi": "इस प्रश्न के लिए कोई डेटा नहीं मिला।",
    }
    lang_code = language.lower()[:2] if language else "en"
    return msgs.get(lang_code, "No data found for that question.")

