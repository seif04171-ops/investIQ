"""
Curated reputation ratings for known news sources, used to populate
Source.base_reliability_score.

Matching normalizes away spaces/punctuation on both sides before comparing
— real source names from NewsAPI/Marketaux often arrive as bare domains
("businessinsider.com", "seekingalpha.com") rather than display names
("Business Insider", "Seeking Alpha"). A naive substring match against
"business insider" (with a space) never matches "businessinsider.com" (no
space), which is exactly why real-world scoring looked stuck at the
default — this normalization is what fixes that.
"""
import re


def _normalize(text: str) -> str:
    """Lowercase, strip everything except letters/numbers, so 'Business
    Insider' and 'businessinsider.com' compare equal on the substring
    'businessinsider'."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


# Wire services and major outlets with strong fact-checking standards
TIER_1 = [
    "reuters", "associated press", "ap news", "bloomberg", "upi",
]
TIER_1_SCORE = 95

# Major mainstream outlets, generally reliable, occasional editorial slant
TIER_2 = [
    "wall street journal", "financial times", "economist", "bbc",
    "npr", "cnbc", "marketwatch", "barron's", "forbes", "new york times",
    "washington post", "axios", "new yorker", "economic times",
]
TIER_2_SCORE = 82

# Widely-read but more variable editorial rigor
TIER_3 = [
    "cnn", "fox business", "yahoo finance", "business insider",
    "the motley fool", "seeking alpha", "benzinga", "zacks",
    "pymnts", "manila times",
]
TIER_3_SCORE = 65

# Press-release distribution services — these carry a company's own
# unreviewed announcement, not independent reporting, so they're
# deliberately kept at (or below) neutral rather than treated like a
# newsroom, regardless of how often they show up.
PRESS_RELEASE_WIRES = ["prweb", "prnewswire", "businesswire", "globenewswire"]
PRESS_RELEASE_SCORE = 40

# Anything not matched above — genuinely unknown, stays neutral rather
# than penalized, since an unrecognized name isn't necessarily untrustworthy
DEFAULT_SCORE = 50


def get_source_reputation(source_name: str) -> int:
    normalized = _normalize(source_name)

    for known in TIER_1:
        if _normalize(known) in normalized:
            return TIER_1_SCORE
    for known in TIER_2:
        if _normalize(known) in normalized:
            return TIER_2_SCORE
    for known in TIER_3:
        if _normalize(known) in normalized:
            return TIER_3_SCORE
    for known in PRESS_RELEASE_WIRES:
        if _normalize(known) in normalized:
            return PRESS_RELEASE_SCORE
    return DEFAULT_SCORE
