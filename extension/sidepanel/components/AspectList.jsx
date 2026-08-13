import React, { useState } from 'react';

export default function AspectList({ pros, cons }) {
  const [activeTab, setActiveTab] = useState('pros');
  
  return (
    <div className="aspect-list glass-card">
      <div className="aspect-tabs">
        <button
          className={`aspect-tab ${activeTab === 'pros' ? 'active-pros' : ''}`}
          onClick={() => setActiveTab('pros')}
        >
          ✅ Pros ({pros?.length || 0})
        </button>
        <button
          className={`aspect-tab ${activeTab === 'cons' ? 'active-cons' : ''}`}
          onClick={() => setActiveTab('cons')}
        >
          ❌ Cons ({cons?.length || 0})
        </button>
      </div>
      <ul className="aspect-items">
        {activeTab === 'pros' && (pros || []).map((pro, i) => (
          <li key={i} className="aspect-item aspect-pro">
            <span className="aspect-dot" style={{ background: '#10b981' }} />
            {pro}
          </li>
        ))}
        {activeTab === 'cons' && (cons || []).map((con, i) => (
          <li key={i} className="aspect-item aspect-con">
            <span className="aspect-dot" style={{ background: '#ef4444' }} />
            {con}
          </li>
        ))}
        {activeTab === 'pros' && (!pros || pros.length === 0) && (
          <li className="aspect-empty">No significant pros identified</li>
        )}
        {activeTab === 'cons' && (!cons || cons.length === 0) && (
          <li className="aspect-empty">No significant cons identified</li>
        )}
      </ul>
    </div>
  );
}
