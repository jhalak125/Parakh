from textblob import TextBlob
from models.schemas import ReviewItem

def compute_authenticity(reviews: list[ReviewItem]) -> tuple[int, str, float]:
    """Returns (authenticity_score, label, fake_review_percentage)"""
    if not reviews:
        return 0, "Low Confidence", 100.0

    total_reviews = len(reviews)
    
    # 1. Verified purchase ratio
    verified_count = sum(1 for r in reviews if r.is_verified)
    verified_ratio = verified_count / total_reviews
    score1 = verified_ratio * 35

    # 2. Sentiment-rating alignment
    alignments = []
    for r in reviews:
        blob = TextBlob(r.review_text)
        polarity = blob.sentiment.polarity
        normalized_polarity = (polarity + 1) / 2
        expected_polarity = (r.rating - 1) / 4
        alignment = 1 - abs(normalized_polarity - expected_polarity)
        alignments.append(alignment)
    
    mean_alignment = sum(alignments) / len(alignments) if alignments else 0
    score2 = mean_alignment * 30

    # 3. Review quality score
    word_counts = [len(r.review_text.split()) for r in reviews]
    avg_word_count = sum(word_counts) / len(word_counts) if word_counts else 0
    
    if avg_word_count < 10:
        base_score3 = 0
    else:
        base_score3 = min(35, (avg_word_count / 30) * 25)
    
    score3 = base_score3 + 10 # heuristic for non-repetitive

    final_score = int(score1 + score2 + score3)
    final_score = max(0, min(100, final_score))

    if final_score >= 80:
        label = "High Confidence"
    elif final_score >= 60:
        label = "Moderate Confidence"
    else:
        label = "Low Confidence"
        
    fake_review_percentage = 100.0 - final_score

    return final_score, label, fake_review_percentage
