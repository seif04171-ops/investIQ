# InvestIQ Roadmap

## Status: All 10 MVP phases scaffolded and wired

| Phase | Deliverable | Status |
|---|---|---|
| 0. Setup | Repo, DB models, auth wiring, empty shell | ✅ Done |
| 1. News ingestion (raw) | Pull from NewsAPI + Marketaux, store in `articles` | ✅ Done |
| 2. Clustering & dedup | Group articles into `events` via embedding similarity | ✅ Done |
| 3. Entity extraction + summarization | LLM extracts companies/sectors/countries, writes summary | ✅ Done |
| 4. Credibility scoring | Deterministic score from source + confirmation count | ✅ Done |
| 5. AI opportunity analysis | Opportunity/confidence scores + hedged reasoning | ✅ Done |
| 6. Educational layer | Glossary (10 seeded terms) + lesson listing | ✅ Done |
| 7. AI Tutor (RAG) | Chat grounded in stored events + glossary | ✅ Done |
| 8. Portfolio simulator | Paper trading, concentration warnings | ✅ Done |
| 9. Historical pattern matching | Seed analogues matched via embedding similarity | ✅ Done |
| 10. Dashboard polish | All frontend pages wired to real endpoints | ✅ Done |

## What "scaffolded and wired" means here, honestly

Every phase has real, tested logic — not stub responses. But three things
are still required before this runs against live data and real users,
none of which are code changes:

1. **A running Postgres instance** (recommended: Supabase, per our earlier
   discussion) with the `pgvector` extension enabled, and
   `alembic upgrade head` run against it.
2. **Real API keys** in `backend/.env`: `NEWSAPI_KEY`, `MARKETAUX_KEY`,
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (embeddings only).
3. **Auth provider connected** for real: either Clerk or Supabase Auth,
   with the frontend actually issuing tokens instead of the dev-mode
   token input currently on the Portfolio and Tutor pages.

## What was verified without live infra

- Full backend app imports cleanly with all 6 routers registered
- Every DB-independent endpoint (`/health`, all `/ping` routes) returns 200
- `/auth/me` correctly 401s without a token
- NewsAPI and Marketaux fetchers correctly parse mocked API responses
  into the shared `RawArticle` shape
- Dedup logic correctly catches exact/near-exact duplicate titles, and
  correctly does NOT catch phrasing variants — that gap is intentional,
  covered by Phase 2's embedding clustering instead
- Full pipeline task chain (`run_full_pipeline`) imports and wires
  ingestion → clustering → summarization → credibility → opportunity
  analysis → historical matching in the correct dependency order
- Glossary seed data loads all 10 terms from the product brief

## What was NOT verified (needs live infra to test)

- Actual clustering quality against real duplicate news (needs real
  OpenAI embeddings + real duplicate articles)
- Actual AI analysis quality/tone (needs real Anthropic API calls —
  the prompts are written and structurally enforce hedged language via
  the JSON schema, but only a live run shows if the model reliably
  follows them)
- Frontend ↔ backend integration end-to-end (needs both servers running
  simultaneously with a real DB in between)

## Recommended path from here

1. Provision Supabase Postgres + enable pgvector
2. Get API keys for NewsAPI, Marketaux, Anthropic, OpenAI (embeddings)
3. Run `alembic upgrade head`, then `python -m app.services.education.seed_glossary`
4. Start the backend (`uvicorn app.main:app --reload`) — the scheduler
   will begin polling automatically every `NEWS_POLL_INTERVAL_MINUTES`
5. Manually trigger the first cycle instead of waiting: `POST /news/ingest`
6. Start the frontend, wire real Clerk/Supabase auth into the token
   inputs currently stubbed on Portfolio/Tutor pages
7. Watch the news feed populate over the following pipeline cycles —
   ingestion is instant, but summarization/scoring/analysis depend on
   LLM call latency and the batch limits set in each service (currently
   20-50 items per cycle, tune once you see real volume)
