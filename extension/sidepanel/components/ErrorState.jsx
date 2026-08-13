import React from 'react';

export default function ErrorState({ type, message, onRetry }) {
  if (type === 'not_product_page') {
    return (
      <div className="error-state">
        <div className="error-icon">🔍</div>
        <h2 className="error-title">Navigate to a Product Page</h2>
        <p className="error-desc">Open an Amazon or Flipkart product listing to analyze its reviews.</p>
        <div className="error-sites">
          <span className="site-chip">📦 amazon.in</span>
          <span className="site-chip">📦 amazon.com</span>
          <span className="site-chip">🛒 flipkart.com</span>
        </div>
      </div>
    );
  }
  return (
    <div className="error-state">
      <div className="error-icon">⚡</div>
      <h2 className="error-title">Analysis Failed</h2>
      <p className="error-desc">{message || 'Could not connect to the Parakh backend. Make sure it is running on port 8000.'}</p>
      <button className="btn-primary" onClick={onRetry}>Try Again</button>
    </div>
  );
}
