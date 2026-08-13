import React from 'react';

export default function ScoreGauge({ score, label, fakePercentage }) {
  // SVG arc: radius 54, stroke-width 10
  // Circumference of 270° arc (not full circle)
  const radius = 54;
  const strokeWidth = 10;
  const center = 70;
  // 270-degree arc — from 135° to 405°
  // Using a standard SVG circle with stroke-dasharray trick
  const circumference = 2 * Math.PI * radius; // full circle
  // We'll use 75% of the circle (270°) as the gauge range
  const gaugeArcLength = circumference * 0.75;
  const fillLength = (score / 100) * gaugeArcLength;
  const gapLength = circumference - gaugeArcLength; // 25%
  
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const glowColor = score >= 80 ? 'rgba(16,185,129,0.4)' : score >= 60 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';

  // Rotation: start arc at bottom-left (225° = 225deg rotation offset)
  // SVG circle starts at 3 o'clock (right). We offset by rotating -225deg to start at bottom-left
  const rotation = -225; // degrees

  return (
    <div className="score-gauge-container">
      <svg width="140" height="140" viewBox="0 0 140 140" className="gauge-svg">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track arc */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${gaugeArcLength} ${gapLength}`}
          strokeLinecap="round"
          transform={`rotate(${rotation}, ${center}, ${center})`}
        />
        {/* Fill arc */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${fillLength} ${circumference - fillLength}`}
          strokeLinecap="round"
          transform={`rotate(${rotation}, ${center}, ${center})`}
          filter="url(#glow)"
          style={{ transition: 'stroke-dasharray 1s ease-out, stroke 0.5s ease' }}
        />
        {/* Score text */}
        <text x={center} y={center - 6} textAnchor="middle" className="gauge-score" fill={color} fontSize="28" fontWeight="700" fontFamily="Inter, sans-serif">
          {score}%
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="Inter, sans-serif">
          Genuine
        </text>
      </svg>
      <div className="gauge-label" style={{ color }}>{label}</div>
      <div className="gauge-fake-pct">
        <span style={{ color: '#ef4444' }}>{fakePercentage?.toFixed(1)}%</span> potentially inauthentic
      </div>
    </div>
  );
}
