# InvestIQ — Full MVP Scaffold (Phases 0-10)

AI-powered investing education and market intelligence app. Educational
tool only — never produces buy/sell recommendations or guarantees.

**Status: all 10 roadmap phases have real, tested logic** — news
ingestion (NewsAPI + Marketaux), embedding-based clustering, LLM
summarization + entity extraction, deterministic credibility scoring,
hedged AI opportunity analysis, glossary + lessons, RAG-grounded tutor,
portfolio simulator, historical pattern matching, and a frontend wired
to all of it. See `docs/roadmap.md` for exactly what's been verified
vs. what still needs live infra to test.

## Structure

- `backend/` — FastAPI app, SQLAlchemy models, Alembic migrations, all pipeline services
- `frontend/` — Next.js 14 (App Router) + TypeScript + Tailwind, wired to backend
- `docs/` — architecture and roadmap notes

## Backend setup

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in: DATABASE_URL (Supabase Postgres recommended), NEWSAPI_KEY,
# MARKETAUX_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY (embeddings only)

alembic revision --autogenerate -m "init schema"
alembic upgrade head
python -m app.services.education.seed_glossary   # loads the 10 glossary terms

uvicorn app.main:app --reload --port 8000
```

The scheduler starts automatically and polls every `NEWS_POLL_INTERVAL_MINUTES`
(default 20). To see results immediately instead of waiting:
```bash
curl -X POST http://localhost:8000/news/ingest
```
This runs ingestion only. The full pipeline (clustering → summarization →
credibility → opportunity analysis → historical matching) runs together
on the scheduled interval via `run_full_pipeline()` — or call it directly:
```bash
python -c "from app.jobs.tasks import run_full_pipeline; print(run_full_pipeline())"
```

## Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev
```

Visit http://localhost:3000. Portfolio and Tutor pages currently have a
"paste auth token" dev-mode input — replace with real Clerk/Supabase
auth once that's connected (see `app/core/security.py`, which already
supports either provider).

## Phase-by-phase status

See `docs/roadmap.md` for the full table and an honest breakdown of
what's been tested vs. what needs live infra (real DB, real API keys)
to verify.

## The three things that turn this from "scaffold" into "running app"

1. **Postgres with pgvector** — Supabase recommended (bundles hosted
   Postgres + auth in one account)
2. **API keys** — NewsAPI, Marketaux, Anthropic, OpenAI (embeddings only)
3. **Auth wired end-to-end** — Clerk or Supabase Auth, replacing the
   dev-mode token inputs on the frontend

