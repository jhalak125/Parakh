import re
from models.schemas import ReviewItem

def clean_review_text(text: str) -> str:
    """Strip HTML, normalize whitespace, remove non-ASCII junk."""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    return text.strip()

def parse_reviews(reviews: list[ReviewItem], max_reviews: int = 40) -> list[ReviewItem]:
    """Deduplicate, clean, truncate to max_reviews."""
    seen_texts = set()
    cleaned = []
    for r in reviews:
        c_text = clean_review_text(r.review_text)
        if c_text not in seen_texts and c_text:
            seen_texts.add(c_text)
            r.review_text = c_text
            cleaned.append(r)
        if len(cleaned) >= max_reviews:
            break
    return cleaned

def compute_sentiment_distribution(reviews: list[ReviewItem]) -> dict[str, int]:
    """Returns {"5_star": N, "4_star": N, "3_star": N, "2_star": N, "1_star": N}."""
    dist = {"5_star": 0, "4_star": 0, "3_star": 0, "2_star": 0, "1_star": 0}
    for r in reviews:
        star = int(round(r.rating))
        star = max(1, min(5, star))
        dist[f"{star}_star"] += 1
    return dist
