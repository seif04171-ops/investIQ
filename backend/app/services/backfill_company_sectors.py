"""
One-time backfill: fetches real sector data for every Company row that
doesn't have one yet (created before the sector-lookup fix, or where the
lookup failed at creation time). Run once via:

    python -m app.services.backfill_company_sectors
"""
import time

from app.core.db import SessionLocal
from app.models.news import Company
from app.services.market_data import get_company_profile


def backfill():
    db = SessionLocal()
    try:
        companies = db.query(Company).filter(Company.sector.is_(None)).all()
        updated = 0
        failed = []
        for company in companies:
            if not company.ticker:
                # News-extracted "companies" sometimes have no known ticker
                # (private companies, or the AI just didn't identify one) —
                # nothing to look up for these, skip rather than crash.
                continue
            try:
                profile = get_company_profile(company.ticker)
                sector = profile.get("finnhubIndustry")
                if sector:
                    company.sector = sector
                    if profile.get("name"):
                        company.name = profile["name"]
                    updated += 1
            except Exception as exc:
                failed.append(f"{company.ticker}: {exc}")
            time.sleep(1.1)  # stay comfortably under Finnhub's free-tier rate limit
        db.commit()
        return {"checked": len(companies), "updated": updated, "failed": failed}
    finally:
        db.close()


if __name__ == "__main__":
    print(backfill())
