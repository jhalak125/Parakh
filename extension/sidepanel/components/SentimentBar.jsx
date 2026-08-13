import React from 'react';

export default function SentimentBar({ distribution }) {
  if (!distribution) return null;
  const stars = ['5_star', '4_star', '3_star', '2_star', '1_star'];
  const total = stars.reduce((sum, k) => sum + (distribution[k] || 0), 0);
  const colors = { '5_star': '#10b981', '4_star': '#34d399', '3_star': '#f59e0b', '2_star': '#fb923c', '1_star': '#ef4444' };
  const labels = { '5_star': '5★', '4_star': '4★', '3_star': '3★', '2_star': '2★', '1_star': '1★' };
  
  return (
    <div className="sentiment-bar-container glass-card">
      <div className="section-title">Rating Distribution</div>
      {stars.map(star => {
        const count = distribution[star] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="star-row">
            <span className="star-label">{labels[star]}</span>
            <div className="star-bar-track">
              <div
                className="star-bar-fill"
                style={{ width: `${pct}%`, background: colors[star] }}
              />
            </div>
            <span className="star-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
