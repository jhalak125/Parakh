import json
import asyncio
from typing import Dict, List
from config import settings
from models.schemas import ReviewItem
from textblob import TextBlob

# Use new google-genai SDK
try:
    from google import genai
    from google.genai import types as genai_types
    _genai_available = True
except ImportError:
    _genai_available = False

def is_llm_available() -> bool:
    return bool(settings.gemini_api_key) and _genai_available

def _get_client():
    return genai.Client(api_key=settings.gemini_api_key)

async def extract_aspects(product_title: str, reviews: List[ReviewItem]) -> Dict:
    if not is_llm_available():
        return _heuristic_extract(reviews)

    reviews_text = ""
    for r in reviews[:30]:
        reviews_text += f"[{r.rating} stars] {r.review_text[:120].strip()}...\n"

    prompt = f"""Analyze the following customer reviews for the product: '{product_title}'.
Extract the most important insights and return ONLY valid JSON in this exact format:
{{
  "pros": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "cons": ["specific weakness 1", "specific weakness 2"],
  "dealbreaker_alert": "most serious recurring defect mentioned, or empty string if none",
  "buyer_verdict": "One concise sentence recommending who should or should not buy this product."
}}

Customer Reviews:
{reviews_text}

Return ONLY the JSON object, no markdown, no explanation."""

    try:
        client = _get_client()
        # Run the synchronous Gemini call in a thread executor to avoid blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
        )
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
        return _heuristic_extract(reviews)
    except Exception as e:
        print(f"LLM extraction failed: {e}")
        return _heuristic_extract(reviews)

def _heuristic_extract(reviews: List[ReviewItem]) -> Dict:
    """
    Heuristic pros/cons extraction used when LLM is unavailable.
    Strategy:
    1. TextBlob sentence-level sentiment (loosened thresholds)
    2. If TextBlob finds nothing, fall back to star-rating buckets
    """
    pros_raw: List[str] = []
    cons_raw: List[str] = []

    for r in reviews:
        try:
            blob = TextBlob(r.review_text)
            for s in blob.sentences:
                pol  = s.sentiment.polarity
                text = str(s).strip()
                if len(text) < 15:
                    continue
                if pol > 0.15:                    # was 0.3 — too strict
                    pros_raw.append(text)
                elif pol < -0.10:                 # was -0.2 — missed mild complaints
                    cons_raw.append(text)
        except Exception:
            continue

    # Fallback: use star ratings when TextBlob finds no signal
    if not pros_raw:
        pros_raw = [r.review_text[:120] for r in reviews if r.rating >= 4.0]
    if not cons_raw:
        cons_raw = [r.review_text[:120] for r in reviews if r.rating <= 2.0]

    # Deduplicate by keeping unique leading phrases
    def dedup(lst: List[str]) -> List[str]:
        seen, out = set(), []
        for t in lst:
            key = t[:40].lower()
            if key not in seen:
                seen.add(key)
                out.append(t)
        return out

    pros = dedup(pros_raw)[:4]
    cons = dedup(cons_raw)[:4]

    # Pick dealbreaker: shortest, most impactful con (if any)
    dealbreaker = ""
    if cons:
        dealbreaker = min(cons, key=len)   # shortest = most pithy complaint

    # Generate a simple verdict summary
    avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else 0
    if avg_rating >= 4.0:
        verdict_tone = "a solid buy"
    elif avg_rating >= 3.0:
        verdict_tone = "a decent option with some caveats"
    else:
        verdict_tone = "worth approaching with caution"

    buyer_verdict = (
        f"With an average rating of {avg_rating:.1f}★, "
        f"this product appears to be {verdict_tone}."
    )

    return {
        "pros":             pros,
        "cons":             cons,
        "dealbreaker_alert": dealbreaker,
        "buyer_verdict":    buyer_verdict,
    }
