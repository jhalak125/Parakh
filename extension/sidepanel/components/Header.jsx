import React from 'react';

const PLATFORM_LABELS = {
  amazon:   '📦 Amazon',
  flipkart: '🛒 Flipkart',
  shopsy:   '🛍️ Shopsy',
  myntra:   '👗 Myntra',
  meesho:   '🏷️ Meesho',
  snapdeal: '🔖 Snapdeal',
  nykaa:    '💄 Nykaa',
  ajio:     '✨ Ajio',
  tatacliq: '🏬 Tata Cliq',
};

export default function Header({ title, price, platform }) {
  const label = PLATFORM_LABELS[platform] || '🛒 ' + (platform || 'Store');
  return (
    <div className="product-header">
      <div className="platform-badge">{label}</div>
      <h1 className="product-title">{title || 'Product Analysis'}</h1>
      {price && <div className="product-price">{price}</div>}
    </div>
  );
}
