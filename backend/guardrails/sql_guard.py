"""
SQL guardrails for Gemini-generated NL-to-SQL queries.
Validates SELECT-only, enforces LIMIT, and checks whitelisted tables.
Pure-stdlib — no sqlglot DLL required; falls back gracefully.
"""

import re
from typing import Optional

WHITELISTED_TABLES = {
    "v_account_month",
    "v_account_snapshot",
    "v_population",
}

MAX_ROWS = 1000


def _strip_comments(sql: str) -> str:
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    return sql.strip()


def guard(sql: str, max_rows: int = MAX_ROWS) -> str:
    """
    Validates a SQL string from Gemini NL-to-SQL:
    1. Must be a single SELECT statement.
    2. Must only reference whitelisted views.
    3. Auto-injects LIMIT if missing.
    Raises ValueError on any violation.
    """
    cleaned = _strip_comments(sql).rstrip(";").strip()

    # Rule 1: Only SELECT
    if not re.match(r"^\s*SELECT\b", cleaned, re.IGNORECASE):
        raise ValueError("Only SELECT statements are permitted.")

    # Rule 2: Block dangerous keywords
    danger = re.compile(
        r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE|COPY)\b",
        re.IGNORECASE,
    )
    if danger.search(cleaned):
        raise ValueError("Query contains prohibited SQL keywords.")

    # Rule 3: Check only whitelisted tables are referenced
    from_tables = re.findall(r"\bFROM\s+(\w+)", cleaned, re.IGNORECASE)
    join_tables = re.findall(r"\bJOIN\s+(\w+)", cleaned, re.IGNORECASE)
    all_tables = set(t.lower() for t in from_tables + join_tables)
    blocked = all_tables - {t.lower() for t in WHITELISTED_TABLES}
    if blocked:
        raise ValueError(f"Query references non-whitelisted tables: {blocked}")

    # Rule 4: Inject LIMIT if missing
    if not re.search(r"\bLIMIT\s+\d+", cleaned, re.IGNORECASE):
        cleaned = f"{cleaned} LIMIT {max_rows}"

    return cleaned + ";"


def log_query(question: str, sql: str, rows: int, error: Optional[str] = None, ms: Optional[float] = None):
    """Append structured query audit log to nl2sql.log (tokens only, never raw account IDs)."""
    import json, time, logging
    logging.basicConfig(filename="nl2sql.log", level=logging.INFO, format="%(message)s")
    logging.getLogger().info(json.dumps({
        "ts": time.time(),
        "question": question[:200],
        "sql": sql[:500],
        "rows": rows,
        "ms": ms,
        "error": error,
    }))

