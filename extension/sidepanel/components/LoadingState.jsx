import React from 'react';

export default function LoadingState() {
  return (
    <div className="loading-state">
      <div className="loading-header">
        <div className="shimmer shimmer-circle" />
      </div>
      <div className="shimmer shimmer-bar wide" />
      <div className="shimmer shimmer-bar medium" />
      <div className="loading-cards">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer shimmer-card" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      <p className="loading-text">Analyzing reviews with AI...</p>
    </div>
  );
}
