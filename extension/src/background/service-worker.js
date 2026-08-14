// ── Platform registry ────────────────────────────────────────────────────────
const PLATFORMS = {
  amazon:    ['amazon.in', 'amazon.com'],
  flipkart:  ['flipkart.com'],
  shopsy:    ['shopsy.in'],
  myntra:    ['myntra.com'],
  meesho:    ['meesho.com'],
  snapdeal:  ['snapdeal.com'],
  nykaa:     ['nykaa.com', 'nykaafashion.com'],
  ajio:      ['ajio.com'],
  tatacliq:  ['tatacliq.com'],
};

const BACKEND_URL    = 'https://parakh-5ql2.onrender.com';
const ANALYZE_ENDPOINT = `${BACKEND_URL}/api/v1/analyze`;

function detectPlatform(url) {
  if (!url) return null;
  for (const [platform, domains] of Object.entries(PLATFORMS)) {
    if (domains.some(d => url.includes(d))) return platform;
  }
  return null;
}

function extractProductId(url, platform) {
  try {
    switch (platform) {
      case 'amazon':
        return (url.match(/\/dp\/([A-Z0-9]{10})/) ||
                url.match(/\/gp\/product\/([A-Z0-9]{10})/))?.[1] || null;
      case 'flipkart':
      case 'shopsy':
        return url.match(/\/p\/([a-zA-Z0-9]+)/)?.[1] || null;
      case 'myntra':
        return url.match(/\/(\d+)\/buy/)?.[1] ||
               url.match(/[/-](\d{7,})/)?.[1] || null;
      case 'meesho':
        return url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] || null;
      case 'snapdeal':
        return url.match(/\/product\/[^/]+\/(\d+)/)?.[1] ||
               url.match(/\/(\d{10,})\/?$/)?.[1] || null;
      case 'nykaa':
        return url.match(/\/p\/(\d+)/)?.[1] ||
               url.match(/[?&]productId=(\d+)/)?.[1] || null;
      case 'ajio':
        return url.match(/\/p\/([A-Z0-9]{10,})/i)?.[1] || null;
      case 'tatacliq':
        return url.match(/\/p-([A-Za-z0-9]+)/)?.[1] || null;
      default:
        return null;
    }
  } catch { return null; }
}

// ── Chrome setup ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (detectPlatform(tab.url)) {
    chrome.action.setBadgeText({ text: '✓', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARAKH_SCRAPE_REQUEST') { handleScrapeRequest(sendResponse); return true; }
  if (message.type === 'PARAKH_ANALYZE_REQUEST') { handleAnalyzeRequest(message, sendResponse); return true; }
});

// ── Tab load helper ───────────────────────────────────────────────────────────
function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        setTimeout(resolve, 800);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Amazon-specific helpers (injected into review pages) ──────────────────────
function extractReviewsFromPage() {
  function getText(el) { return (el?.innerText || el?.textContent || '').trim(); }
  return Array.from(document.querySelectorAll('[data-hook="review"]')).map(el => ({
    review_title: getText(el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)') || el.querySelector('[data-hook="review-title"]')),
    review_text:  getText(el.querySelector('[data-hook="review-body"] span') || el.querySelector('[data-hook="review-body"]')),
    rating: parseFloat((getText(
      el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') ||
      el.querySelector('[data-hook="cmps-review-star-rating"] .a-icon-alt') ||
      el.querySelector('.a-icon-star .a-icon-alt')
    ).match(/[\d.]+/) || ['0'])[0]),
    is_verified: !!el.querySelector('[data-hook="avp-badge"]'),
    date: getText(el.querySelector('[data-hook="review-date"]'))
  })).filter(r => r.review_text.length > 5);
}

function extractProductMeta() {
  function getText(el) { return (el?.innerText || el?.textContent || '').trim(); }
  return {
    title: getText(document.querySelector('#productTitle')),
    price: getText(document.querySelector('.a-price-whole')) ||
           getText(document.querySelector('#price_inside_buybox')) ||
           getText(document.querySelector('.a-offscreen')),
    average_rating: parseFloat(((document.querySelector('#acrPopover')?.title || '').match(/[\d.]+/) || ['0'])[0]),
    total_ratings_count: parseInt(getText(document.querySelector('#acrCustomerReviewText')).replace(/[^\d]/g, '') || '0') || 0
  };
}

// ── Universal in-page scraper for non-Amazon platforms ────────────────────────
// This function is serialized and injected directly into the product page.
function inPageScraper(platform, productId) {
  return new Promise(async resolve => {

    function getText(el) { return (el?.innerText || el?.textContent || '').trim(); }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function waitFor(selector, ms) {
      const t = Date.now();
      while (Date.now() - t < ms) {
        const els = document.querySelectorAll(selector);
        if (els.length) return Array.from(els);
        await sleep(500);
      }
      return Array.from(document.querySelectorAll(selector));
    }

    function scrollToReviews(...selectors) {
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) { el.scrollIntoView({ behavior: 'instant' }); return el; }
      }
      return null;
    }

    async function progressiveScroll() {
      for (const pct of [0.4, 0.6, 0.75, 0.9, 1.0]) {
        window.scrollTo({ top: document.body.scrollHeight * pct, behavior: 'instant' });
        await sleep(350);
      }
      await sleep(1000);
    }

    try {
      // ── Flipkart / Shopsy ──────────────────────────────────────────────────
      if (platform === 'flipkart' || platform === 'shopsy') {
        const title = getText(document.querySelector('.B_NuCI, h1.yhB1nd, span.B_NuCI'));
        const price = getText(document.querySelector('._30jeq3._16Jk6d, ._30jeq3'));
        scrollToReviews('._3UAT2v, [class*="review"], ._1YokD2');
        await progressiveScroll();
        const reviewEls = await waitFor('._27M-vq', 5000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('.t-ZTKy p') || el.querySelector('.t-ZTKy')),
          review_title: getText(el.querySelector('._2-N8zT')),
          rating:       parseFloat(getText(el.querySelector('._3LWZlK')) || '0') || 0,
          is_verified:  false, date: ''
        })).filter(r => r.review_text.length > 5);
        const m = window.location.href.match(/\/p\/([a-zA-Z0-9]+)/);
        return resolve({ platform, product_id: m?.[1] || productId, title, price, average_rating: 0, total_ratings_count: 0, reviews });
      }

      // ── Myntra ────────────────────────────────────────────────────────────
      if (platform === 'myntra') {
        const title = getText(document.querySelector('h1.pdp-title, h1.pdp-name, .pdp-title'));
        const price = getText(document.querySelector('.pdp-price strong, .pdp-discounted-price, .pdp-srp'));
        scrollToReviews('#ratings-and-reviews, .detailed-reviews, [class*="ratings"]');
        await progressiveScroll();
        const reviewEls = await waitFor('.user-review', 6000);
        const reviews = reviewEls.map(el => {
          const filledStars = el.querySelectorAll('.star-active, .user-review-userInfo-ratings .star.myntraweb-sprite.star-active');
          const rating = filledStars.length ||
            parseFloat(getText(el.querySelector('.user-review-userInfo-ratings')) || '0');
          return {
            review_title: getText(el.querySelector('.user-review-title')),
            review_text:  getText(el.querySelector('.user-review-reviewTextWrapper, .user-review-main')),
            rating, is_verified: false,
            date: getText(el.querySelector('.user-review-reviewerInfo span:last-child'))
          };
        }).filter(r => r.review_text.length > 5);
        const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
        return resolve({ platform: 'myntra', product_id: productId, title, price, average_rating: avg, total_ratings_count: 0, reviews });
      }

      // ── Meesho ────────────────────────────────────────────────────────────
      if (platform === 'meesho') {
        const title = getText(document.querySelector('h1'));
        const price = getText(document.querySelector('[class*="price"] h4, [class*="Price"] h4'));
        scrollToReviews('[class*="Review"], [class*="review"], [class*="rating"]');
        await progressiveScroll();
        // Meesho uses dynamic class names; try multiple patterns
        const reviewEls = await waitFor('[class*="ReviewCard"], [class*="review-card"], [class*="ratingReview"]', 6000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('p, [class*="reviewText"], [class*="comment"]')),
          review_title: getText(el.querySelector('h5, h6, [class*="title"]')),
          rating: parseFloat(getText(el.querySelector('[class*="rating"] span, [class*="star"]')) || '0') || 0,
          is_verified: false, date: ''
        })).filter(r => r.review_text.length > 5);
        const m = window.location.href.match(/\/p\/([A-Za-z0-9_-]+)/);
        return resolve({ platform: 'meesho', product_id: m?.[1] || productId, title, price, average_rating: 0, total_ratings_count: 0, reviews });
      }

      // ── Snapdeal ──────────────────────────────────────────────────────────
      if (platform === 'snapdeal') {
        const title = getText(document.querySelector('h1.pdp-e-i-head, h1'));
        const price = getText(document.querySelector('.payBlkBig, .product-price, .price-val'));
        scrollToReviews('#reviews, [class*="review"], .user-review-wrapper');
        await progressiveScroll();
        const reviewEls = await waitFor('.user-review-wrapper, .review-description', 6000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('.rev-desc, .user-review-description, .review-desc')),
          review_title: getText(el.querySelector('.rev-title, .review-title')),
          rating: parseFloat(getText(el.querySelector('.rat-num, .filled-stars, .stars-count')) || '0') || 0,
          is_verified: !!el.querySelector('.verified-badge, .verified-purchaser'),
          date: getText(el.querySelector('.user-review-date, .review-date'))
        })).filter(r => r.review_text.length > 5);
        const m = window.location.href.match(/\/product\/[^/]+\/(\d+)/);
        return resolve({ platform: 'snapdeal', product_id: m?.[1] || productId, title, price, average_rating: 0, total_ratings_count: 0, reviews });
      }

      // ── Nykaa ─────────────────────────────────────────────────────────────
      if (platform === 'nykaa') {
        const title = getText(document.querySelector('h1'));
        const price = getText(document.querySelector('[class*="price"] span, [class*="Price"] span'));
        scrollToReviews('[class*="review"], [class*="Review"], [class*="rating"]');
        await progressiveScroll();
        const reviewEls = await waitFor('[class*="review-card"], [class*="ReviewCard"], [class*="customer-review"]', 6000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('[class*="reviewText"], [class*="comment"], p')),
          review_title: getText(el.querySelector('[class*="title"], h5, h6')),
          rating: parseFloat(getText(el.querySelector('[class*="rating"], [class*="star"]')) || '0') || 0,
          is_verified: !!el.querySelector('[class*="verified"]'),
          date: getText(el.querySelector('[class*="date"], time'))
        })).filter(r => r.review_text.length > 5);
        const m = window.location.href.match(/\/p\/(\d+)/);
        return resolve({ platform: 'nykaa', product_id: m?.[1] || productId, title, price, average_rating: 0, total_ratings_count: 0, reviews });
      }

      // ── Ajio ──────────────────────────────────────────────────────────────
      if (platform === 'ajio') {
        const title = getText(document.querySelector('h1.prod-name, h1'));
        const price = getText(document.querySelector('.prod-sp, .price, [class*="price"]'));
        scrollToReviews('[class*="review"], [class*="Review"], .review-section');
        await progressiveScroll();
        const reviewEls = await waitFor('[class*="review-item"], [class*="reviewItem"], .review-block', 6000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('[class*="review-text"], [class*="reviewText"], p')),
          review_title: getText(el.querySelector('[class*="review-title"], h5')),
          rating: parseFloat(getText(el.querySelector('[class*="rating"], [class*="star"]')) || '0') || 0,
          is_verified: false,
          date: getText(el.querySelector('time, [class*="date"]'))
        })).filter(r => r.review_text.length > 5);
        const m = window.location.href.match(/\/p\/([A-Z0-9]+)/i);
        return resolve({ platform: 'ajio', product_id: m?.[1] || productId, title, price, average_rating: 0, total_ratings_count: 0, reviews });
      }

      // ── Tata Cliq ─────────────────────────────────────────────────────────
      if (platform === 'tatacliq') {
        const title = getText(document.querySelector('h1, [class*="product-name"], [class*="ProductName"]'));
        const price = getText(document.querySelector('[class*="product-price"], [class*="ProductPrice"], [class*="price"]'));
        scrollToReviews('[class*="review"], [class*="Review"], [class*="rating"]');
        await progressiveScroll();
        const reviewEls = await waitFor('[class*="review-item"], [class*="ReviewItem"], [class*="customer-review"]', 6000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('[class*="review-text"], [class*="reviewText"], p')),
          review_title: getText(el.querySelector('[class*="title"], h5, h6')),
          rating: parseFloat(getText(el.querySelector('[class*="rating"]')) || '0') || 0,
          is_verified: false,
          date: getText(el.querySelector('time, [class*="date"]'))
        })).filter(r => r.review_text.length > 5);
        const m = window.location.href.match(/\/p-([A-Za-z0-9]+)/);
        return resolve({ platform: 'tatacliq', product_id: m?.[1] || productId, title, price, average_rating: 0, total_ratings_count: 0, reviews });
      }

    } catch (e) {
      console.error('[Parakh inPageScraper]', e);
    }
    resolve(null);
  });
}

// ── Main scrape handler ───────────────────────────────────────────────────────
async function handleScrapeRequest(sendResponse) {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) { sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' }); return; }

    const url      = activeTab.url || '';
    const platform = detectPlatform(url);
    if (!platform)  { sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' }); return; }

    const productId = extractProductId(url, platform);

    // ── Amazon: navigate to /product-reviews/ pages ───────────────────────
    if (platform === 'amazon') {
      if (!productId) { sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' }); return; }

      const hostname    = new URL(url).hostname;
      const originalUrl = url;
      const reviewsBase = `https://${hostname}/product-reviews/${productId}`;

      const metaResult = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: extractProductMeta });
      const meta = metaResult?.[0]?.result || {};
      console.log('[Parakh] Amazon ASIN:', productId, '| Title:', meta.title?.slice(0, 30));

      const TARGET = 30; const MAX_PAGES = 3;
      let allReviews = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        await chrome.tabs.update(activeTab.id, { url: `${reviewsBase}?pageNumber=${page}&sortBy=recent` });
        await waitForTabLoad(activeTab.id, 15000);

        const landed = await chrome.tabs.get(activeTab.id);
        const landedPath = new URL(landed.url).pathname;
        console.log(`[Parakh] Page ${page} path:`, landedPath);

        if (!landedPath.includes('/product-reviews/')) {
          if (page === 1) {
            await chrome.tabs.update(activeTab.id, { url: originalUrl });
            sendResponse({ success: false, error: landed.url?.includes('/ap/signin')
              ? '🔐 Please sign in to Amazon.in first, then try Parakh again.'
              : `Unexpected redirect: ${landedPath}` });
            return;
          }
          break;
        }

        let r = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: extractReviewsFromPage });
        let pageReviews = r?.[0]?.result || [];
        if (!pageReviews.length) {
          await new Promise(res => setTimeout(res, 1500));
          r = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: extractReviewsFromPage });
          pageReviews = r?.[0]?.result || [];
        }
        console.log(`[Parakh] Page ${page}:`, pageReviews.length, 'reviews');
        allReviews = [...allReviews, ...pageReviews];
        if (pageReviews.length < 10 || allReviews.length >= TARGET) break;
      }

      await chrome.tabs.update(activeTab.id, { url: originalUrl });
      console.log('[Parakh] Total:', allReviews.length);
      sendResponse({ success: true, data: { platform: 'amazon', product_id: productId, title: meta.title || '', price: meta.price || '', average_rating: meta.average_rating || 0, total_ratings_count: meta.total_ratings_count || 0, reviews: allReviews } });
      return;
    }

    // ── All other platforms: inject scraper into current page ─────────────
    const result = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: inPageScraper,
      args: [platform, productId || '']
    });
    const data = result?.[0]?.result;
    if (data) {
      sendResponse({ success: true, data });
    } else {
      sendResponse({ success: false, error: 'NOT_PRODUCT_PAGE' });
    }

  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── Analyze handler ───────────────────────────────────────────────────────────
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
    sendResponse({ success: false, error: 'Cannot reach backend. Is uvicorn running on port 8000?' });
  }
}
