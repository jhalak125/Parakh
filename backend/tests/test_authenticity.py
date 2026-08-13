from models.schemas import ReviewItem
from services.authenticity_engine import compute_authenticity

def test_authenticity_all_verified():
    reviews = [
        ReviewItem(review_text="This is fantastic and works really well.", rating=5.0, is_verified=True),
        ReviewItem(review_text="Great quality and I love using it everyday.", rating=5.0, is_verified=True),
        ReviewItem(review_text="Good value for money.", rating=4.0, is_verified=True)
    ]
    score, label, pct = compute_authenticity(reviews)
    assert score > 60  # Moderate-to-High confidence for all-verified, aligned reviews
    assert 0 <= score <= 100
    assert label in ["High Confidence", "Moderate Confidence", "Low Confidence"]
    assert pct == 100.0 - score

def test_authenticity_zero_verified():
    reviews = [
        ReviewItem(review_text="ok", rating=5.0, is_verified=False),
        ReviewItem(review_text="nice", rating=5.0, is_verified=False),
        ReviewItem(review_text="good", rating=5.0, is_verified=False)
    ]
    score, label, pct = compute_authenticity(reviews)
    assert score < 50
    assert 0 <= score <= 100
    assert label in ["High Confidence", "Moderate Confidence", "Low Confidence"]
    assert pct == 100.0 - score
