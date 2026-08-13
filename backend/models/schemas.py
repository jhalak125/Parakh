from pydantic import BaseModel

class ReviewItem(BaseModel):
    review_title: str = ""
    review_text: str
    rating: float  # 1.0 to 5.0
    is_verified: bool = False
    date: str = ""

class ProductAnalysisRequest(BaseModel):
    product_id: str
    platform: str = "amazon"  # "amazon" | "flipkart"
    title: str = ""
    price: str = ""
    average_rating: float = 0.0
    total_ratings_count: int = 0
    reviews: list[ReviewItem]

class ProductAnalysisResponse(BaseModel):
    product_id: str
    authenticity_score: int  # 0-100
    authenticity_label: str  # "High Confidence" | "Moderate Confidence" | "Low Confidence"
    fake_review_percentage: float
    sentiment_distribution: dict[str, int]  # {"5_star": N, "4_star": N, ...}
    pros: list[str]
    cons: list[str]
    dealbreaker_alert: str  # empty string if none
    buyer_verdict: str
    cached: bool = False

class HealthResponse(BaseModel):
    status: str
    version: str
    llm_available: bool
