import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import ScoreGauge from './components/ScoreGauge.jsx';
import AspectList from './components/AspectList.jsx';
import DealbreakAlert from './components/DealbreakAlert.jsx';
import SentimentBar from './components/SentimentBar.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorState from './components/ErrorState.jsx';

export default function App() {
  const [state, setState] = useState('idle'); // idle | loading | success | error | not_product_page
  const [analysisData, setAnalysisData] = useState(null);
  const [productMeta, setProductMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const runAnalysis = useCallback(async () => {
    setState('loading');
    setAnalysisData(null);
    setErrorMessage('');

    try {
      // Step 1: Ask service worker to scrape the active tab
      const scrapeResponse = await chrome.runtime.sendMessage({ type: 'PARAKH_SCRAPE_REQUEST' });
      
      if (!scrapeResponse.success) {
        if (scrapeResponse.error === 'NOT_PRODUCT_PAGE') {
          setState('not_product_page');
          return;
        }
        throw new Error(scrapeResponse.error || 'Failed to scrape page');
      }

      const scrapedData = scrapeResponse.data;
      if (!scrapedData) {
        setState('not_product_page');
        return;
      }

      setProductMeta({ title: scrapedData.title, price: scrapedData.price, platform: scrapedData.platform });

      // Step 2: Send to backend via service worker
      const analyzeResponse = await chrome.runtime.sendMessage({
        type: 'PARAKH_ANALYZE_REQUEST',
        payload: scrapedData,
      });

      if (!analyzeResponse.success) {
        throw new Error(analyzeResponse.error || 'Analysis failed');
      }

      setAnalysisData(analyzeResponse.data);
      setState('success');
    } catch (err) {
      setErrorMessage(err.message);
      setState('error');
    }
  }, []);

  // Auto-run on mount
  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  return (
    <div className="app">
      <div className="app-header">
        <div className="brand">
          <div className="brand-icon">परख</div>
          <div>
            <div className="brand-name">Parakh</div>
            <div className="brand-tagline">Review Intelligence</div>
          </div>
        </div>
        {state === 'success' && (
          <button className="btn-refresh" onClick={runAnalysis} title="Re-analyze">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>
        )}
      </div>

      <div className="app-body">
        {state === 'idle' && <LoadingState />}
        {state === 'loading' && <LoadingState />}
        {state === 'not_product_page' && <ErrorState type="not_product_page" />}
        {state === 'error' && <ErrorState type="error" message={errorMessage} onRetry={runAnalysis} />}
        {state === 'success' && analysisData && (
          <div className="results fade-in">
            <Header
              title={productMeta?.title || analysisData.product_id}
              price={productMeta?.price}
              platform={productMeta?.platform}
            />
            <ScoreGauge
              score={analysisData.authenticity_score}
              label={analysisData.authenticity_label}
              fakePercentage={analysisData.fake_review_percentage}
            />
            {analysisData.dealbreaker_alert && (
              <DealbreakAlert message={analysisData.dealbreaker_alert} />
            )}
            <SentimentBar distribution={analysisData.sentiment_distribution} />
            <AspectList pros={analysisData.pros} cons={analysisData.cons} />
            <div className="verdict-card glass-card">
              <div className="verdict-label">🧠 Buyer Verdict</div>
              <p className="verdict-text">{analysisData.buyer_verdict}</p>
              {analysisData.cached && <div className="cache-badge">⚡ Cached result</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
