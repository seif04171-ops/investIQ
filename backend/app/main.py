"""
InvestIQ backend entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import auth, news, analysis, tutor, portfolio, education, watchlist, market, briefing, opportunities
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.services import news_live


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ingestion runs in-process on a schedule (see app/jobs/scheduler.py).
    # Disabled automatically outside of real request handling (e.g. tests)
    # by simply not calling this app factory in test setups that don't want it.
    start_scheduler()
    if settings.REFRESH_ON_STARTUP:
        news_live.start_refresh(force=True)
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered investing education and market intelligence API",
    version="0.1.0",
    lifespan=lifespan,
)

# MVP: allow any localhost port for the Next.js dev server, since `next dev`
# silently picks a different port (3001, 3002...) if 3000 is already taken
# by a leftover process — hardcoding just 3000 caused real signup failures.
# Lock this down to a specific production domain before deploying anywhere real.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(news.router)
app.include_router(analysis.router)
app.include_router(tutor.router)
app.include_router(portfolio.router)
app.include_router(education.router)
app.include_router(watchlist.router)
app.include_router(market.router)
app.include_router(briefing.router)
app.include_router(opportunities.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "env": settings.ENV}
