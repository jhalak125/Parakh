import React from 'react';

export default function Header({ title, price, platform }) {
  return (
    <div className="product-header">
      <div className="platform-badge">
        {platform === 'flipkart' ? '🛒 Flipkart' : '📦 Amazon'}
      </div>
      <h1 className="product-title">{title || 'Product Analysis'}</h1>
      {price && <div className="product-price">{price}</div>}
    </div>
  );
}
