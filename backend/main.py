"""
FastAPI Backend — Resilience Rewired
Endpoints: /tokenize, /snapshot/{token}, /population, /solana/certify, /solana/verify, /ask
"""

import os
import json
import time
import hashlib
import hmac
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Path configuration ─────────────────────────────────────────────────────────
CACHE_DIR = Path(os.getenv("CACHE_PATH", Path(__file__).parent.parent / "cache"))
SECRET = os.getenv("HMAC_SECRET", "tangerine_hackathon_2026_salt")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Preload in-memory cache at startup (~13 MB total) ─────────────────────────
print("Loading precomputed data into memory...")

with open(CACHE_DIR / "token_map.json") as f:
    TOKEN_MAP: dict[str, str] = json.load(f)   # account_id (str) -> token

REV_MAP = {v: int(k) for k, v in TOKEN_MAP.items()}  # token -> account_id

with open(CACHE_DIR / "population.json") as f:
    POPULATION: list[dict] = json.load(f)

SNAPSHOT_CACHE: dict[str, dict] = {}

def _load_snapshot(token: str) -> dict:
    if token not in SNAPSHOT_CACHE:
        path = CACHE_DIR / "snapshots" / f"{token}.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Account not found.")
        with open(path) as f:
            SNAPSHOT_CACHE[token] = json.load(f)
    return SNAPSHOT_CACHE[token]

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="Resilience Rewired API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ─────────────────────────────────────────────────────────────────────
class TokenizeRequest(BaseModel):
    account_id: int

class CertifyRequest(BaseModel):
    token: str
    shock_params: dict
    plan_outputs: dict
    formula_version: str = "v1.0"

class VerifyRequest(BaseModel):
    tx_signature: str
    expected_hash: Optional[str] = None

class AskRequest(BaseModel):
    token: str
    question: str
    language: Optional[str] = None  # auto-detected by Gemini if None

class ParseTwistRequest(BaseModel):
    token: str
    text: Optional[str] = None
    audio_base64: Optional[str] = None  # MediaRecorder blob -> base64

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "accounts": len(TOKEN_MAP), "snapshots_warm": len(SNAPSHOT_CACHE)}


@app.post("/tokenize")
def tokenize(req: TokenizeRequest):
    """Converts an account_id to a privacy-preserving token."""
    acc_str = str(req.account_id)
    if acc_str not in TOKEN_MAP:
        raise HTTPException(status_code=404, detail=f"Account {req.account_id} not found.")
    return {"token": TOKEN_MAP[acc_str]}


@app.get("/snapshot/{token}")
def get_snapshot(token: str):
    """Returns precomputed snapshot JSON for a tokenized account (<1 ms from memory)."""
    return _load_snapshot(token)


@app.get("/population")
def get_population(segment: Optional[str] = Query(None)):
    """Returns population-wide runway array. Optional segment filter."""
    if segment and segment in ("has_loan", "has_pension"):
        return [r for r in POPULATION if r.get(segment)]
    return POPULATION


@app.post("/solana/certify")
def solana_certify(req: CertifyRequest):
    """
    Writes a tamper-evident SHA-256 receipt to Solana devnet.
    Runs `solana transfer --memo` as a subprocess.
    """
    try:
        from backend.services.solana_cli import certify_plan, ensure_funded
        ensure_funded()
        result = certify_plan(
            token=req.token,
            shock_params=req.shock_params,
            plan_outputs=req.plan_outputs,
            formula_version=req.formula_version,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Solana CLI error: {str(e)}")


@app.post("/solana/verify")
def solana_verify(req: VerifyRequest):
    """Verifies a Solana receipt by re-inspecting the on-chain memo log."""
    try:
        from backend.services.solana_cli import verify_receipt
        return verify_receipt(req.tx_signature, req.expected_hash)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/ask")
async def ask(req: AskRequest):
    """
    Multilingual NL-to-SQL pipeline:
    1. Detect language of question (Gemini).
    2. Translate question to validated SQL (Gemini, schema-grounded).
    3. Execute on in-memory data (no live DB needed for demo).
    4. Summarise result in the user's original language (Gemini).
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured.")

    # Validate token
    if req.token not in REV_MAP:
        raise HTTPException(status_code=404, detail="Unknown token.")

    t0 = time.time()
    from backend.services import gemini_service
    from backend.guardrails.sql_guard import guard, log_query

    try:
        sql_raw = await gemini_service.nl_to_sql(req.question, req.token, req.language)
        sql_safe = guard(sql_raw)
        rows, row_count = gemini_service.execute_in_memory(sql_safe, req.token, POPULATION, SNAPSHOT_CACHE)
        summary = await gemini_service.summarise(req.question, rows, req.language)
        ms = round((time.time() - t0) * 1000, 1)
        log_query(req.question, sql_safe, row_count, ms=ms)
        return {"answer": summary, "sql": sql_safe, "rows": rows[:20], "ms": ms}
    except ValueError as e:
        log_query(req.question, "", 0, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_query(req.question, "", 0, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/parse-twist")
async def parse_twist(req: ParseTwistRequest):
    """
    Parses a spoken or typed twist card into structured shock parameters.
    Accepts text or audio (base64 MediaRecorder blob) — Gemini handles both.
    Returns: {ei_pct, bills_up_pct, one_off_spend_months, duration_months, transcript}
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured.")
    from backend.services import gemini_service
    result = await gemini_service.parse_twist(req.text, req.audio_base64)
    return result

