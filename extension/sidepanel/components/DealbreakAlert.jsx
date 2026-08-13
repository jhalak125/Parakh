import React from 'react';

export default function DealbreakAlert({ message }) {
  if (!message) return null;
  return (
    <div className="dealbreak-alert pulse-border">
      <div className="dealbreak-icon">⚠️</div>
      <div>
        <div className="dealbreak-title">Dealbreaker Alert</div>
        <p className="dealbreak-message">{message}</p>
      </div>
    </div>
  );
}
