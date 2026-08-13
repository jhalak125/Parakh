# Parakh (परख) — AI-Powered Review Intelligence

> **परख** (Parakh) — Hindi for "to examine closely, to test, to evaluate."

A Chrome Extension + FastAPI backend that analyzes Amazon and Flipkart product listings in real time — detecting fake reviews, scoring authenticity, and surfacing actionable pros, cons, and dealbreaker alerts using NLP + Gemini AI.

---

## Architecture

```
Chrome Extension (React + Vite)          FastAPI Backend (Python)
┌─────────────────────────────────┐      ┌──────────────────────────────┐
│  Content Script (scraper.js)    │      │  POST /api/v1/analyze        │
│    └─ Extracts reviews from DOM │      │    ├─ authenticity_engine.py │
│                                 │      │    │    • TextBlob NLP       │
│  Service Worker                 │─────▶│    │    • Verified ratio     │
│    └─ Injects scraper           │      │    │    • Sentiment alignment│
│    └─ Calls FastAPI             │      │    └─ llm_engine.py          │
│                                 │      │         • Gemini 2.0 Flash   │
│  Side Panel (React)             │◀─────│         • Structured JSON out│
│    ├─ ScoreGauge (SVG radial)   │      │                              │
│    ├─ Pros/Cons Accordion       │      │  Cache: TTLCache (24h, ASIN) │
│    └─ Dealbreaker Alert         │      └──────────────────────────────┘
└─────────────────────────────────┘
```

---

## Features

- 🎯 **Authenticity Score (0–100%)** — Composite NLP score from verified purchase ratio, sentiment-rating alignment, and review quality analysis
- 🤖 **AI Aspect Extraction** — Gemini 2.0 Flash extracts top Pros, Cons, and a Dealbreaker Alert from review corpus
- ⚡ **24-Hour Caching** — Product ASIN keyed TTLCache cuts repeat-visit latency to <50ms
- 🛡️ **Heuristic Fallback** — Full TextBlob-based extraction when Gemini API is unavailable
- 📦 **Amazon + Flipkart Support** — DOM scrapers for both platforms
- 🎨 **Premium Dark UI** — Glassmorphism React side panel with animated SVG gauge

---

## API Reference

### `GET /health`
```json
{ "status": "ok", "version": "1.0.0", "llm_available": true }
```

### `POST /api/v1/analyze`

**Request:**
```json
{
  "product_id": "B08N5WRWNW",
  "platform": "amazon",
  "title": "Wireless ANC Headphones",
  "price": "₹4,999",
  "average_rating": 4.3,
  "total_ratings_count": 1240,
  "reviews": [
    {
      "review_title": "Great sound but poor hinge",
      "review_text": "Audio quality is crystal clear for the price, but the plastic hinge broke after 3 weeks.",
      "rating": 3.0,
      "is_verified": true,
      "date": "2026-06-14"
    }
  ]
}
```

**Response:**
```json
{
  "product_id": "B08N5WRWNW",
  "authenticity_score": 84,
  "authenticity_label": "High Confidence",
  "fake_review_percentage": 16.0,
  "sentiment_distribution": { "5_star": 540, "4_star": 310, "3_star": 220, "2_star": 100, "1_star": 70 },
  "pros": ["High-clarity audio and deep bass", "Effective noise cancellation"],
  "cons": ["Plastic hinge prone to snapping", "Mic picks up background noise"],
  "dealbreaker_alert": "Multiple verified buyers report the plastic hinge fracturing after 1-2 months.",
  "buyer_verdict": "Great sound performance if handled gently, but durability concerns make it risky for rough daily commutes.",
  "cached": false
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension UI | React 18, Vite 5, CSS Custom Properties |
| Extension Runtime | Chrome Manifest V3, Side Panel API |
| Backend Framework | FastAPI (async) |
| NLP | TextBlob (sentiment analysis) |
| LLM | Google Gemini 2.0 Flash |
| Caching | cachetools TTLCache (in-memory) |
| Testing | pytest, httpx, pytest-asyncio |
