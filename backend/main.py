from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from models.schemas import HealthResponse, ProductAnalysisRequest, ProductAnalysisResponse
from services.cache_manager import cache
from services.scraper_parser import parse_reviews, compute_sentiment_distribution
from services.authenticity_engine import compute_authenticity
from services.llm_engine import is_llm_available, extract_aspects

app = FastAPI(title="Parakh API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"chrome-extension://.*|http://localhost:\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error", "error": str(exc)})

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        version=app.version,
        llm_available=is_llm_available()
    )

@app.post("/api/v1/analyze", response_model=ProductAnalysisResponse)
async def analyze_product(request: ProductAnalysisRequest):
    cached_resp = cache.get(request.product_id)
    if cached_resp:
        return ProductAnalysisResponse(**cached_resp)
        
    cleaned_reviews = parse_reviews(request.reviews, settings.max_reviews)
    if not cleaned_reviews:
        # Return a graceful response instead of a hard error
        return ProductAnalysisResponse(
            product_id=request.product_id,
            authenticity_score=0,
            authenticity_label="No Data",
            fake_review_percentage=0.0,
            sentiment_distribution={},
            pros=[],
            cons=[],
            dealbreaker_alert="",
            buyer_verdict="No reviews were found on this page. Please scroll down to load reviews, or navigate to the product's dedicated reviews page and try again.",
            cached=False
        )
        
    auth_score, auth_label, fake_pct = compute_authenticity(cleaned_reviews)
    
    aspects = await extract_aspects(request.title, cleaned_reviews)
    
    sentiment_dist = compute_sentiment_distribution(cleaned_reviews)
    
    response = ProductAnalysisResponse(
        product_id=request.product_id,
        authenticity_score=auth_score,
        authenticity_label=auth_label,
        fake_review_percentage=fake_pct,
        sentiment_distribution=sentiment_dist,
        pros=aspects.get("pros", []),
        cons=aspects.get("cons", []),
        dealbreaker_alert=aspects.get("dealbreaker_alert", ""),
        buyer_verdict=aspects.get("buyer_verdict", ""),
        cached=False
    )
    
    resp_dict = response.model_dump()
    resp_dict["cached"] = True
    cache.set(request.product_id, resp_dict)
    
    return response
