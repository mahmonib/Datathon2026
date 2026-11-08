# Resilience Rewired: Prototype Plan (Tangerine Track)

> Working plan for Claude Code. Sections marked **🔧 REFINE** are open decisions for the team.
> Every number below comes from running `analyze.py` on the provided data (4,500 accounts, 185,326 monthly rows, 2020-01 to 2025-12).

---

## 0. What we are building (one paragraph)

A web app where a judge types an `account_id`, sees that customer's money at a glance, applies a shock with sliders (or by **speaking the twist card**), and gets a goal plan and a backup plan, all computed in the browser in under 16 ms per slider move. A second tab shows the whole bank: how many customers survive a layoff, who is most at risk, and proof that our runway metric predicts real overdrafts.

---

## 1. Findings already in the data (use these in the pitch)

| # | Finding | Number | Use for |
|---|---|---|---|
| F1 | Share of customers who survive a 6-month layoff at EI 55% (judges' formula) | **64.5%** (so **35.5% don't**) | Headline |
| F2 | Same, plus household bills +15% | **61.1%** survive | Twist card prep |
| F3 | **Runway predicts real trouble.** Runway computed on data up to Dec 2024, outcome = any overdraft day in 2025 | Runway < 3 mo: **18.8%** overdrafted; 3–6: 4.0%; 6–12: 2.2%; 12+: **1.6%** → about **12× higher risk** | Validation (Data Use 25%) |
| F4 | Loan holders are fragile | Survive layoff: **36%** with a running loan vs **68%** without | Segment |
| F5 | Pensioners almost always survive | **98.8%** survive, because pension income doesn't stop | Segment, and a fix to the formula (see §2.3) |
| F6 | Card type | Gold 77%, junior 62%, none 66%, classic **56%** | Segment |
| F7 | Region and district unemployment barely matter | Region 59–70%; unemployment quartiles 63–67%, no trend | Honest "null" finding |
| F8 | **"Flexible" spending is mostly cash** | Cash withdrawals = **76%** of all money out; card = 0.6%; bills 16.5%; other transfers 3.9% | Changes the backup plan (see §2.5) |
| F9 | Income is mostly cash deposits | Cash 75%, transfers 19%, pension 5% | Explains volatility |
| F10 | Income is irregular | Median coefficient of variation of `money_in` = **0.25** | Optional fan chart |
| F11 | Defaults cluster at low runway | Loan default rate: runway < 3 mo **25%**, 12+ mo **5%** (same period, so descriptive, not predictive) | Supporting evidence |

Population medians: I ≈ $7,568, S ≈ $7,389, H ≈ $1,537, B ≈ $22,325. 78.7% of accounts have no shortfall in normal times.

> **Caveat to say out loud:** this is the PKDD'99 Czech bank dataset relabelled in CAD and shifted to 2020–2025. Patterns (cash-heavy spending) reflect 1990s Czech banking, not modern Canada.

---

## 2. Formulas

### 2.1 Judges' definitions (must match exactly)

All from `monthly_summary.csv`, rows sorted by `month` per account.

```
I = median(money_in)
S = median(money_out)
F = median(household_bills + insurance + loan_payments)   # display only
H = median(household_bills)
B = mean(avg_daily_balance over the account's LAST 6 rows)
P = loans.monthly_payment if loans.status in {C, D} (running at end of 2025), else 0
```

```
buffer_left = B - one_off_costs
gap         = spend_after - income_after
runway      = 0                       if buffer_left <= 0
            = "no shortfall (120+)"   if gap <= 0
            = min(buffer_left / gap, 120)   otherwise
round to 1 decimal
```

Shock mapping:

| Twist | income_after | spend_after | one_off |
|---|---|---|---|
| Layoff, EI x% | (x/100)·I | S | 0 |
| Bills +y% | I | S + (y/100)·H | 0 |
| Repair = k months of spending | I | S | k·S |
| Combo | apply all | apply all | apply all |

**Survives** a shock of D months if `runway >= D`.

Check against a known account: **20111** → I 6,339.4 · S 8,599.6 · F 2,330.1 · H 0 · B 17,611.9 · P 2,330.2 · runway today 7.8 · layoff 3.4.

### 2.2 Edge cases (unit-test every one)

- Fewer than 6 rows: mean of whatever rows exist (minimum in data is 12, so it never actually happens, but code it).
- B ≤ 0 (minimum B is −17,267): runway 0.
- I = 0 and S = 0 (dormant accounts): "no shortfall", but flag as **"inactive, insufficient data"**.
- H = 0 (at least 25% of accounts): a bills shock changes nothing. Say so on screen rather than showing an unchanged number silently.
- Quiet months are included in medians (they count as 0). Don't drop them, because judges don't.

### 2.3 Our improved definitions (shown next to the judges' numbers, never replacing them)

| Ours | Formula | Why |
|---|---|---|
| **EI on job income only** | income_after = pension_med + interest_med + x·(I − pension_med − interest_med) | A layoff doesn't stop a pension (F5). |
| **EI cap** | job_income_after = min(x·job_income, EI_weekly_max·52/12) | Real EI has a weekly maximum. 🔧 REFINE: look up the 2026 max on canada.ca and link it. |
| **Essential spend** | E = median(household_bills + insurance + loan_payments) + α·median(cash + card + other) | Lets the plan say what they *must* spend. 🔧 REFINE α (start at 0.6). |
| **Stress runway** | use the 75th percentile of money_out instead of the median | Irregular spenders (F10). |
| **Recovery after EI** | after month D, income = I (rehired) or 0 (still unemployed) | Drives the drawdown chart. |

### 2.4 Goal plan

```
surplus        = I - S
target_k       = k · S                      for k in {3, 6}   # 🔧 REFINE: or k · E
gap_to_goal_k  = max(target_k - B, 0)
monthly_save   = r · surplus                r = user-chosen share, default 0.5
months_to_k    = ceil(gap_to_goal_k / monthly_save)
```

- If surplus ≤ 0: show **"no saving room yet"** and switch to the backup plan first (cuts create the surplus).
- Always show two timelines: r = 50% (realistic) and r = 100% (fastest possible).
- **Custom goal (your idea):** the user enters a goal name, amount A and target date T.
  `required_monthly = (A − allocated_savings) / months_until(T)`. Feasible if ≤ r·surplus; otherwise show the date they *can* hit.
- Goal intake (🔧 REFINE wording): ask "How much of your monthly surplus ($X) are you comfortable setting aside?" (slider 10–100%), then "What are you saving for?" (emergency fund / big purchase / debt payoff / custom). The emergency fund is always filled first, then the remainder goes to the custom goal.

### 2.5 Backup plan (where to cut)

Required cut to survive D months:

```
needed_gap  = buffer_left / D
cut_needed  = max(0, gap - needed_gap)
```

Allocate `cut_needed` greedily across the customer's own categories, using each category's median and a maximum realistic cut:

| Category (column) | Type | Max cut % (default) | Why |
|---|---|---|---|
| card_withdrawals | flexible | 30% | discretionary purchases |
| transfers_out_other | flexible | 25% | unlabelled, often discretionary |
| cash_withdrawals_genuine | semi-flexible | 15% | **76% of spending (F8)**, so it likely includes groceries and essentials |
| household_bills | hard | 5% | switch providers, energy savings |
| insurance | hard | 0% | don't advise dropping cover |
| loan_payments | hard | 0% via cuts | handled by the "pause or restructure loan" lever |
| bank_fees | avoidable | 100% | penalty interest disappears if they stay above zero |

🔧 REFINE: cut caps are assumptions. Expose them as advanced sliders, and cite StatCan household spending if used.

Output: "Cut **$X/month**: $a from cash, $b from other transfers… Runway goes from **4.0 → 6.1 months**." If the caps are exhausted and still short, say so honestly and point to levers (§2.6).

### 2.6 Lever comparison

Each lever is a recalculation of runway under the active shock; show Δ months.

| Lever | Change |
|---|---|
| Cut card 20% | spend − 0.2·card_med |
| Cut cash 10% | spend − 0.1·cash_med |
| Pause or restructure loan | spend − P (only if P > 0) |
| Part-time income | income + $X (default 20% of job income; slider) |
| Use backup plan | spend − cut_needed |

Render as a sorted horizontal bar or waterfall: "Best single move: pause loan, +2.8 months."

### 2.7 Drawdown projection

```
bal_0 = buffer_left
bal_t = bal_{t-1} + income_after_t - spend_after_t
income_after_t = shock income for t <= D, then I (rehired) or 0 (not rehired)
```

Mark t = D (EI ends) and the first t where bal_t < 0. Optional fan band using monthly money_in percentiles (P25–P75).

### 2.8 Population and validation

- Population: compute runway for all 4,500 accounts in the browser from a precomputed array (4,500 × ~10 numbers ≈ 200 KB). Sliders recompute the histogram instantly.
- Validation (F3): **freeze** inputs at 2024-12, compute the layoff runway, and compare to any `days_below_zero > 0` in 2025. Report by band. This is out-of-time, so it is a fair test.

---

## 3. Feature-by-feature build spec

| # | Feature | Data | Viz (SOTA option) | Notes |
|---|---|---|---|---|
| 1 | Snapshot card | snapshot JSON | Big-number tiles + **runway gauge** (green ≥ D, amber within 1 mo, red below) | Judges' and our numbers side by side, with a formula tooltip |
| 2 | Money in vs out | monthly rows | Line or area chart, median I and S as dashed reference lines, overdraft months shaded red | Brush to zoom |
| 3 | Spending breakdown | category medians | **Sankey** (income sources → spending categories) or a donut split into fixed vs flexible | Sankey makes "76% is cash" obvious |
| 4 | Shock controls | client-side calc | Sliders + **before/after runway bars** with a D-month line | Also driven by voice (§6) |
| 5 | Drawdown | §2.7 | Line chart with zero line, EI-end marker, rehired vs not-rehired branches, optional fan band | The "they run out in month 4" moment |
| 6 | Plan panel | §2.4–2.5 | **Jug and plant** (§4) + progress bars toward 3 and 6 months | |
| 7 | Population | population array | Histogram or **beeswarm** of runway, D line, "X% survive" headline | |
| 8 | Segments | population + joins | Small multiples or ridgeline of runway by segment | loan / pension / card / region / unemployment quartile |
| 9 | Validation | §2.8 | Bar of overdraft rate by runway band (1.6% → 18.8%) | The credibility slide |
| 10 | Levers | §2.6 | Sorted bar or waterfall of Δ months | |

Charting library 🔧 REFINE: **Observable Plot or D3** (most control, best for the plant), **Apache ECharts** (fast canvas rendering and built-in Sankey), or **visx** if React. Animate with **Framer Motion**. For the plant, use **procedural SVG** or **Rive** (state-machine animation driven by numbers).

---

## 4. Jug-and-plant visualization

The metaphor: **savings are water in a jug, the plant is the customer's resilience.** Cuts pour more water; shocks drain it.

| Visual element | Driven by | Mapping |
|---|---|---|
| Water level in jug | buffer_left / target_6mo | 0–100% fill; turns red below the shock need |
| Water poured per month (stream thickness) | monthly_save + cuts | thicker stream as cuts increase |
| Leak at the bottom (drip rate) | gap under the shock | faster drip = bigger shortfall |
| Plant height | min(runway / D, 2) | grows as runway passes the shock length |
| Leaves | whole months of runway (capped at 12) | one leaf per month survived |
| Plant health | runway vs D | wilting (brown, drooping) < D; upright green ≥ D; flowering ≥ 6-month emergency fund |
| Pot cracks | B ≤ 0 | runway 0 |

Interaction: each backup-plan cut is a toggle chip ("−15% cash", "pause loan"). Toggling one animates water pouring, the jug rising, and the plant growing, with the runway number counting up. A timeline scrubber plays the drawdown: the jug drains month by month, and the plant wilts at the month it hits zero.

Implementation: one SVG component whose props are `{fill, inflow, leak, height, leaves, health}`. Tween with Framer Motion springs. Keep the numbers visible next to it, because judges need the numbers, not just the metaphor.

---

## 5. Architecture and the stack

Three services only: **Gemini API, Tiger Data, Solana.** The app ships as one Docker image, deployed on a small VM (for example Vultr) with the same image running on our laptop as a fallback (§5.3).

```
 Browser (React / Next.js)
  ├─ shock + plan math (pure TypeScript, mirrors the Python reference)
  ├─ encrypted IndexedDB cache (WebCrypto AES-GCM)
  ├─ mic → audio blob (MediaRecorder)
  └─ calls API with TOKENS only (never raw account_id after lookup)
        │ HTTPS (VM) or localhost (laptop fallback)
 FastAPI backend (in-memory cache, preloaded at startup)
  ├─ /tokenize          account_id → token (HMAC vault)
  ├─ /snapshot/{token}  precomputed JSON from memory (≈ 1 ms)
  ├─ /population        precomputed array
  ├─ /ask               audio or text → Gemini → SQL → Tiger Data → Gemini summary
  ├─ /parse-twist       audio or text → Gemini function call → shock params
  └─ /receipt           plan hash → Solana devnet memo
        │                         │                        │
 Tiger Data                  Gemini API                 Solana (devnet)
 (Postgres + TimescaleDB)    speech → text,             tamper-evident
 per-account time series,    NL → SQL,                  advice receipts
 population + segment views, twist parsing,             (hash only)
 continuous aggregates       plan narration
```

### Role of each tool (and honest notes)

| Tool | Role | Honest note |
|---|---|---|
| **Gemini API** | (1) **Speech → text**: send the recorded audio straight to Gemini (it accepts audio input), so no separate speech service is needed; (2) NL → SQL; (3) parse a spoken twist card into shock JSON via function calling; (4) narrate the plan in plain language | Numbers always come from our code, never from the LLM. Gemini only transcribes, translates questions into SQL and explains results. One model for everything keeps setup to one API key. |
| **Tiger Data** | The only database. `monthly_summary` and `transactions` as hypertables; continuous aggregates for per-account snapshots; plain views for population, segments and validation; the target for **all** NL→SQL questions (per-account and bank-wide) | Postgres underneath, so standard SQL, `sqlglot` and read-only roles all work. 185K monthly rows is tiny for it. |
| **Solana** | **Tamper-evident advice receipt:** SHA-256 of (token, inputs, outputs, formula version) written as a memo on devnet. A "verify" button re-hashes the plan and checks it against the chain | **Never put customer data on chain**, even tokenized. Hash only. Pitch it as auditability: "the bank can prove exactly what advice it gave, and when." Still the first thing to cut if time runs short. |

### 5.1 Speed (caching layers)

1. **Precompute at build time:** a Python job reads Tiger Data and writes `snapshot/{token}.json` (I, S, F, H, B, P, category medians, monthly series, percentiles) and `population.bin` (Float32Array of per-account inputs + segment codes).
2. **Server cache:** a plain Python dict (or `functools.lru_cache`) keyed by token, loaded into memory at startup. 4,500 snapshots ≈ 13 MB, which fits easily. **No Redis:** the data is small and never changes during the demo, so an in-process dict is faster and has one less thing to break. Each worker keeping its own copy is fine. Tiger Data is only hit for NL→SQL questions.
3. **Browser cache:** encrypted IndexedDB; the second view of an account is instant and works offline.
4. **All shock and plan math runs client-side** in a pure function, so sliders never hit the network. Target < 16 ms per update (one frame); 4,500-account population recompute is < 5 ms in plain JS.
5. Optional: preload the whole snapshot set (≈ 3 MB gzipped) on app start if the venue Wi-Fi allows, so any account a judge picks is already in the browser.

### 5.2 Privacy: tokenization and browser encryption

- **Tokenization:** `token = base32(HMAC-SHA256(server_secret, account_id))[:16]`. The vault table (account_id ↔ token) lives only on the server. After the first lookup, the browser, cache keys, logs and Solana receipts use only the token.
- **Browser encryption:** generate a non-extractable AES-GCM `CryptoKey` per session with WebCrypto; encrypt every cached snapshot before writing to IndexedDB; the key disappears when the tab closes.
- **LLM calls:** send Gemini aggregated numbers and the token only; never raw transactions or birth dates.
- **SQL safety:** see §6.3 for the four POC guardrails (read-only DB user, SELECT-only plus LIMIT, query timeout, logging). Per-account questions are also automatically scoped with `WHERE token = :token`.
- **Be honest in the pitch:** the data is already anonymized, and anything shown on screen is visible to the viewer. This demonstrates privacy by design, not a security audit.

### 5.3 Deployment (Docker on a VM, laptop fallback)

One Docker image, run in two places:

```
docker-compose.yml
  app    FastAPI backend + built frontend (static files), snapshot cache in memory
  caddy  reverse proxy with automatic HTTPS (VM only)
Tiger Data stays as its managed cloud database; we don't run Postgres ourselves.
```

- **VM:** one small instance (1–2 vCPU, 2–4 GB RAM), for example on Vultr. `docker compose up -d` gives judges a real link and makes the repo reproducible.
- **Keep a local fallback.** If venue Wi-Fi fails during the live twist, a remote server is useless, so have the **same Docker image** running on the laptop (`docker compose up app`, open `localhost`). Before judging:
  - start the laptop copy and open one account to warm the cache;
  - the precomputed snapshots and population array are baked into the image, so the account screen, shocks, plan and population tab all work **fully offline**;
  - Gemini (voice, NL→SQL, narration), Tiger Data (NL→SQL) and Solana need internet. Offline, hide those buttons and use the manual sliders.
  - Optional: a phone hotspot as a middle option.
- **Keep secrets out of the image.** Put the Gemini API key, Tiger Data password (both the owner role and the read-only `nl_reader` role) and the Solana wallet key in **environment variables** or a `.env` file passed at runtime (`env_file: .env` in compose).
  - Add `.env` to `.gitignore` **and** `.dockerignore`, so it never lands in git or inside the image.
  - Commit a `.env.example` with the variable names and empty values, so teammates know what to fill in.
  - The HMAC tokenization secret (§5.2) goes in `.env` too.
  - Use a **devnet** Solana wallet with no real funds.
  - Quick check before pushing: `git grep -i "api_key\|password\|secret"` and `docker history <image>` should show no secrets.

---

## 6. Natural language and voice

### 6.1 NL → SQL → summary

```
question (typed, or spoken → Gemini transcribes the audio)
 → Gemini prompt: schema of whitelisted views + 5 example Q→SQL pairs + "return SQL only"
 → validate (sqlglot: SELECT only, whitelisted tables, LIMIT ≤ 1000)
 → run on Tiger Data (per-account and bank-wide views live in the same database)
 → Gemini: "summarize these rows in 2 sentences for a bank customer; quote numbers exactly"
 → show answer + the SQL (collapsible) + a small chart if rows are a time series
```

Views to expose (🔧 REFINE): `v_account_month(token, month, money_in, money_out, categories…)`, `v_account_snapshot(token, I, S, F, H, B, P, runway…)`, `v_population(token, segment fields, runway_layoff…)`.

Example questions to seed and demo:
- "What was my biggest spending month last year?"
- "How much do I spend on bills on average?"
- "What share of loan holders can't survive a layoff?"
- "Which region has the lowest runway?"

### 6.2 Voice for the live twist (best demo moment)

The judge reads the twist card, we press the mic, and the sliders move by themselves:

```
audio → Gemini (audio input, one call does both steps):
   transcript: "they lose their job, EI at 55%, and bills go up 15%"
   function call: set_shock({ei_pct: 55, duration_months: 6, bills_up_pct: 15, one_off: 0, one_off_months_of_spend: 0})
 → UI animates sliders → runway, drawdown and plant update → Gemini narrates
```

Always show the transcript and the parsed parameters so we can correct them by hand in one tap if Gemini mishears. Record 5–10 sample twist cards during rehearsal to test it. Keep manual sliders as the fallback.

### 6.3 SQL guardrails (minimum for a POC, about 30 minutes)

Gemini writes the SQL, so assume it will occasionally write something wrong or bad. These four guards protect the live demo. Skip full audit trails, per-user permissions and injection test suites.

1. **Read-only database user (most important, one line of setup).**
   Connect the NL→SQL path with a role that can only read. Even if Gemini writes something bad, it cannot delete or change data.
   ```sql
   -- Postgres / Tiger Data
   CREATE ROLE nl_reader LOGIN PASSWORD '...';
   GRANT SELECT ON v_account_month, v_account_snapshot, v_population TO nl_reader;
   ```
   The app's NL→SQL connection uses this role and nothing else; the precompute job and admin scripts use a separate owner role.

2. **SELECT only, and always add a LIMIT.**
   A few lines with `sqlglot`, or at minimum check that the query starts with `SELECT`. This stops a runaway query from freezing the demo.
   ```python
   import sqlglot
   from sqlglot import exp

   def guard(sql: str, max_rows: int = 1000) -> str:
       tree = sqlglot.parse_one(sql)                    # raises on multiple statements or junk
       if not isinstance(tree, exp.Select):
           raise ValueError("Only SELECT is allowed")
       if not tree.args.get("limit"):
           tree = tree.limit(max_rows)
       return tree.sql()
   ```
   Fallback if short on time: `assert sql.strip().lower().startswith("select")` and append `LIMIT 1000` when no limit is present.

3. **Query timeout (for example 5 seconds).**
   Same purpose as the LIMIT: one slow query must not stall the live round.
   ```sql
   -- Tiger Data (Postgres), set on the role
   ALTER ROLE nl_reader SET statement_timeout = '5s';
   ```
   On timeout, show a friendly message ("That question was too big, try narrowing it") instead of an error.

4. **Basic logging.**
   Log the question, the generated SQL, the row count and any error, to the console or a file. During rehearsal, this is how you find out why a query failed and fix the prompt.
   ```python
   import logging, json, time
   logging.basicConfig(filename="nl2sql.log", level=logging.INFO)

   def log_query(question, sql, rows, error=None, ms=None):
       logging.info(json.dumps({"q": question, "sql": sql, "rows": rows, "error": error, "ms": ms, "ts": time.time()}))
   ```
   Never log raw account IDs; use the token (§5.2).

**Bonus:** show the generated SQL in a collapsible panel next to the answer. It doubles as a safety feature and a selling point, because judges can see the AI's work is not a black box. In the pitch, one sentence is enough: "Read-only, SELECT-only, time-limited, and every query is logged."

---

## 7. Build phases (about 24 hours)

| Phase | Hours | Deliverable | Done when |
|---|---|---|---|
| P0 | 0–2 | `calc.py` reference (judges' formulas) + pytest for edge cases; `calc.ts` port with identical outputs on 50 random accounts | Python and TS match to 0.1 |
| P1 | 2–6 | Precompute job → snapshot JSONs + population array; FastAPI `/snapshot`, `/population` from an in-memory cache; load CSVs into Tiger Data | 4,500 snapshots served < 10 ms |
| P2 | 6–12 | Account screen: features 1–5 | Live twist works end to end with sliders |
| P3 | 12–15 | Plan panel (6) + jug-and-plant + levers (10) | Cuts animate the plant |
| P4 | 15–18 | Overview tab: 7, 8, 9 | Headline numbers match §1 |
| P5 | 18–21 | Voice twist parsing + NL→SQL + Gemini narration + SQL guardrails (§6.3) | Demo questions work; a `DROP TABLE` test question is rejected; failures appear in `nl2sql.log` |
| P6 | 21–22 | Tokenization, encrypted cache, Solana receipt | Optional; cut first if late |
| P7 | 22–24 | Deploy the Docker image to the VM, start the same image on the laptop as fallback, rehearse 5-min run with 10 random accounts, record video, write-up | Rehearsed 3 times |

**Cut order if late:** Solana → NL→SQL → voice. Never cut: the judges' formulas, shock sliders, plan, population headline.

---

## 8. Repo layout (suggested)

```
/data            (gitignored) raw CSVs
/pipeline        calc.py, precompute.py, validate.py, tests/
/api             FastAPI app, gemini.py (transcribe, nl2sql, parse_twist, narrate), solana_receipt.py
/web             Next.js app: lib/calc.ts, components/{Snapshot,Shock,Drawdown,Plan,JugPlant,Population}
/sql             Tiger Data schema, continuous aggregates, views, read-only role
Dockerfile, docker-compose.yml, Caddyfile
.env.example     variable names only; real .env is gitignored and dockerignored
analyze.py       exploration that produced §1
```

---

## 9. Pitch script (1 minute)

1. "35% of this bank's customers can't survive a 6-month layoff on EI."
2. "Our runway score isn't just a formula: customers under 3 months of runway were 12× more likely to overdraft the following year."
3. "Loan holders are most at risk: only 36% survive. Pensioners almost all survive, so the standard EI formula overstates their risk, and we fix that."
4. "For any customer, we show what to cut, from their own spending, to make it, and the plant shows them growing."

---

## 10. Open questions for the team (🔧 REFINE)

1. React/Next.js or Streamlit? (Next.js is needed for the plant animation and client-side speed.)
2. Which VM provider and size (1–2 vCPU, 2–4 GB RAM is enough)? Domain name for the Caddy HTTPS certificate?
3. Is Solana worth the time, or should it go in the write-up as future work?
4. Cut caps and α for essential spending: assumptions or sourced?
5. Emergency fund target based on S (judges' style) or essential spend E?
6. EI weekly maximum for 2026: look up and cite.
7. Default savings share r: 50%?

## Sources to cite

- PKDD'99 Discovery Challenge Financial dataset, CTU Prague: https://relational.fel.cvut.cz/dataset/Financial
- EI regular benefits: https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit.html
- StatCan CPI, rents, LFS, average weekly earnings (links in the track brief), if used
