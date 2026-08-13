const AMAZON_PATTERNS = ['amazon.in', 'amazon.com'];
const FLIPKART_PATTERNS = ['flipkart.com'];
const BACKEND_URL = 'http://localhost:8000';
const ANALYZE_ENDPOINT = `${BACKEND_URL}/api/v1/analyze`;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

function isProductPage(url) {
  if (!url) return false;
  return AMAZON_PATTERNS.some(p => url.includes(p)) ||
         FLIPKART_PATTERNS.some(p => url.includes(p));
}

function extractAsin(url) {
  const m = url.match(/\/dp\/([A-Z0-9]{10})/) ||
            url.match(/\/gp\/product\/([A-Z0-9]{10})/);
  return m ? m[1] : null;
}

// Badge update on product pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (isProductPage(tab.url)) {
    chrome.action.setBadgeText({ text: '✓', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// Message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARAKH_SCRAPE_REQUEST') {
    handleScrapeRequest(sendResponse);
    return true; // keep channel open for async response
  }
  if (message.type === 'PARAKH_ANALYZE_REQUEST') {
    handleAnalyzeRequest(message, sendResponse);
    return true;
  }
});

// Wait for a tab to reach 'complete' status
function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    const listener = (changedTabId, changeInfo) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        setTimeout(resolve, 800); // small grace period for JS to run
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Inline function injected into the reviews page — extracts review cards
function extractReviewsFromPage() {
  function getText(el) {
    if (!el) return '';
    return (el.innerText || el.textContent || '').trim();
  }
  return Array.from(document.querySelectorAll('[data-hook="review"]')).map(el => ({
    review_title: getText(
      el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)') ||
      el.querySelector('[data-hook="review-title"]')
    ),
    review_text: getText(
      el.querySelector('[data-hook="review-body"] span') ||
      el.querySelector('[data-hook="review-body"]')
    ),
    rating: parseFloat(
      (getText(
        el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') ||
        el.querySelector('[data-hook="cmps-review-star-rating"] .a-icon-alt') ||
        el.querySelector('.a-icon-star .a-icon-alt')
      ).match(/[\d.]+/) || ['0'])[0]
    ),
    is_verified: !!el.querySelector('[data-hook="avp-badge"]'),
    date: getText(el.querySelector('[data-hook="review-date"]'))
  })).filter(r => r.review_text.length > 5);
}

// Inline function injected into the product page — extracts metadata only
function extractProductMeta() {
  function getText(el) {
    return (el?.innerText || el?.textContent || '').trim();
  }
  return {
    title: getText(document.querySelector('#productTitle')),
    price:
      getText(document.querySelector('.a-price-whole')) ||
      getText(document.querySelector('#price_inside_buybox')) ||
      getText(document.querySelector('.a-offscreen')),
    average_rating: parseFloat(
      ((document.querySelector('#acrPopover')?.title || '').match(/[\d.]+/) || ['0'])[0]
    ),
    total_ratings_count: parseInt(
      getText(document.querySelector('#acrCustomerReviewText')).replace(/[^\d]/g, '') || '0'
    ) || 0
  };
}

// ── Main scrape handler ──────────────────────────────────────────────────────
async function handleScrapeRequest(sendResponse) {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' });
      return;
    }

    const url = activeTab.url || '';
    const isAmazon   = AMAZON_PATTERNS.some(p => url.includes(p));
    const isFlipkart = FLIPKART_PATTERNS.some(p => url.includes(p));

    if (!isAmazon && !isFlipkart) {
      sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' });
      return;
    }

    // ── Amazon: real navigation to reviews page ─────────────────────────────
    if (isAmazon) {
      const asin = extractAsin(url);
      if (!asin) { sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' }); return; }

      const hostname    = new URL(url).hostname;
      const originalUrl = url;
      const reviewsBase = `https://${hostname}/product-reviews/${asin}`;

      // Step 1: Grab metadata from the product page before navigating
      const metaResult = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractProductMeta
      });
      const meta = metaResult?.[0]?.result || {};
      console.log('[Parakh] Meta extracted:', meta.title?.slice(0, 40), '| ASIN:', asin);

      // Steps 2–4: Navigate up to 3 review pages to collect 20–30 reviews
      // Amazon shows exactly 10 reviews per page; we iterate pages until we have enough.
      const TARGET_REVIEWS = 30;
      const MAX_PAGES      = 3;
      let   allReviews     = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        const pageUrl = `${reviewsBase}?pageNumber=${page}&sortBy=recent`;
        console.log(`[Parakh] Navigating page ${page}:`, pageUrl);
        await chrome.tabs.update(activeTab.id, { url: pageUrl });
        await waitForTabLoad(activeTab.id, 15000);

        // Verify we actually landed on the reviews page (not a sign-in redirect)
        const landedTab  = await chrome.tabs.get(activeTab.id);
        const landedPath = new URL(landedTab.url).pathname;
        console.log(`[Parakh] Page ${page} landed:`, landedPath);

        if (!landedPath.includes('/product-reviews/')) {
          if (page === 1) {
            // Couldn't even get page 1 — bail with helpful error
            await chrome.tabs.update(activeTab.id, { url: originalUrl });
            if (landedTab.url?.includes('/ap/signin')) {
              sendResponse({
                success: false,
                error: '🔐 Amazon requires you to be signed in to view reviews.\n\nPlease sign in to Amazon.in first, then try Parakh again.'
              });
            } else {
              sendResponse({ success: false, error: `Redirected to unexpected page: ${landedPath}` });
            }
            return;
          }
          break; // Partial data OK — use what we have
        }

        // Scrape current page
        let pageResult = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: extractReviewsFromPage
        });
        let pageReviews = pageResult?.[0]?.result || [];

        // Retry once if page hadn't fully rendered
        if (pageReviews.length === 0) {
          await new Promise(r => setTimeout(r, 1500));
          pageResult  = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: extractReviewsFromPage });
          pageReviews = pageResult?.[0]?.result || [];
        }

        console.log(`[Parakh] Page ${page} reviews:`, pageReviews.length);
        allReviews = [...allReviews, ...pageReviews];

        // Stop if this product has fewer reviews than a full page, or we have enough
        if (pageReviews.length < 10 || allReviews.length >= TARGET_REVIEWS) break;
      }

      // Step 5: Navigate back to the original product page
      await chrome.tabs.update(activeTab.id, { url: originalUrl });
      console.log('[Parakh] Total reviews collected:', allReviews.length);

      sendResponse({
        success: true,
        data: {
          platform: 'amazon',
          product_id: asin,
          title: meta.title || '',
          price: meta.price || '',
          average_rating: meta.average_rating || 0,
          total_ratings_count: meta.total_ratings_count || 0,
          reviews: allReviews

        }
      });
      return;
    }


    // ── Flipkart: scrape current page directly ──────────────────────────────
    if (isFlipkart) {
      const result = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          function getText(el) { return (el?.innerText || el?.textContent || '').trim(); }
          const title =
            getText(document.querySelector('.B_NuCI')) ||
            getText(document.querySelector('h1.yhB1nd')) || '';
          const price =
            getText(document.querySelector('._30jeq3._16Jk6d')) ||
            getText(document.querySelector('._30jeq3')) || '';
          const pIdMatch = window.location.href.match(/\/p\/([a-zA-Z0-9]+)/);
          const reviews = Array.from(document.querySelectorAll('._27M-vq')).map(el => ({
            review_text:  getText(el.querySelector('.t-ZTKy p') || el.querySelector('.t-ZTKy')),
            review_title: getText(el.querySelector('._2-N8zT')),
            rating:       parseFloat(getText(el.querySelector('._3LWZlK')) || '0') || 0,
            is_verified:  false,
            date:         ''
          })).filter(r => r.review_text.length > 5);
          return { platform: 'flipkart', product_id: pIdMatch?.[1] || '', title, price, average_rating: 0, total_ratings_count: 0, reviews };
        }
      });
      const data = result?.[0]?.result;
      if (data) {
        sendResponse({ success: true, data });
      } else {
        sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' });
      }
    }

  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── Analyze handler ──────────────────────────────────────────────────────────
async function handleAnalyzeRequest(message, sendResponse) {
  try {
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      sendResponse({ success: false, error: err.detail || `HTTP ${response.status}` });
      return;
    }
    sendResponse({ success: true, data: await response.json() });
  } catch (err) {
    sendResponse({ success: false, error: 'Cannot reach backend at port 8000. Is uvicorn running?' });
  }
}
