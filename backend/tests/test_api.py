import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from services.cache_manager import cache

SAMPLE_PAYLOAD = {
    "product_id": "TEST_ASIN_001",
    "platform": "amazon",
    "title": "Test Headphones",
    "price": "₹2,999",
    "average_rating": 4.1,
    "total_ratings_count": 500,
    "reviews": [
        {"review_title": "Great sound", "review_text": "The audio quality is excellent for the price. Very clear highs and deep bass.", "rating": 5.0, "is_verified": True, "date": "2026-01-15"},
        {"review_title": "Good but hinge issue", "review_text": "Audio is decent but the plastic hinge feels very cheap and broke after a month.", "rating": 3.0, "is_verified": True, "date": "2026-01-20"},
        {"review_title": "Amazing product", "review_text": "Best headphones I have used in this price range. Noise cancellation works perfectly.", "rating": 5.0, "is_verified": False, "date": "2026-02-01"},
        {"review_title": "Disappointed", "review_text": "Battery life is terrible and charging port stopped working after two months of use.", "rating": 2.0, "is_verified": True, "date": "2026-02-10"},
        {"review_title": "Value for money", "review_text": "Comfortable fit, decent sound. Build quality could be better but overall good for the price.", "rating": 4.0, "is_verified": True, "date": "2026-02-15"}
    ]
}

@pytest.fixture(autouse=True)
def clear_cache():
    cache.cache.clear()

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_analyze_product_valid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/analyze", json=SAMPLE_PAYLOAD)
    assert response.status_code == 200
    data = response.json()
    assert "authenticity_score" in data
    assert 0 <= data["authenticity_score"] <= 100
    assert data["cached"] is False

@pytest.mark.asyncio
async def test_analyze_product_empty_reviews():
    payload = dict(SAMPLE_PAYLOAD)
    payload["reviews"] = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["authenticity_label"] == "No Data"
    assert "reviews" in data["buyer_verdict"].lower()

@pytest.mark.asyncio
async def test_analyze_product_caching():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res1 = await ac.post("/api/v1/analyze", json=SAMPLE_PAYLOAD)
        assert res1.json()["cached"] is False
        
        res2 = await ac.post("/api/v1/analyze", json=SAMPLE_PAYLOAD)
        assert res2.json()["cached"] is True
