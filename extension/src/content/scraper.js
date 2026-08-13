(async function () {
  const url = window.location.href;
  const isAmazon = url.includes('amazon.in') || url.includes('amazon.com');
  const isFlipkart = url.includes('flipkart.com');

  let payload = null;

  function getText(el) {
    if (!el) return '';
    return (el.innerText || el.textContent || '').trim();
  }

  // Wait for a CSS selector to appear in the DOM (for lazy-loaded content)
  async function waitForElements(selector, timeoutMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) return Array.from(els);
      await new Promise(r => setTimeout(r, 500));
    }
    return Array.from(document.querySelectorAll(selector));
  }

  function extractStarRating(el) {
    if (!el) return 0;
    // Try multiple locations Amazon uses for star ratings
    const ratingEl =
      el.querySelector('[data-hook="review-star-rating"] .a-icon-alt') ||
      el.querySelector('[data-hook="cmps-review-star-rating"] .a-icon-alt') ||
      el.querySelector('.a-icon-star .a-icon-alt') ||
      el.querySelector('i[data-hook] .a-icon-alt');
    const text = getText(ratingEl);
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  try {
    if (isAmazon) {
      // Match ASIN from /dp/ or /product-reviews/ URLs
      const asinMatch =
        url.match(/\/dp\/([A-Z0-9]{10})/) ||
        url.match(/\/product-reviews\/([A-Z0-9]{10})/) ||
        url.match(/\/gp\/product\/([A-Z0-9]{10})/);
      const asin = asinMatch ? asinMatch[1] : null;

      if (asin) {
        const title = getText(document.querySelector('#productTitle')) ||
                      getText(document.querySelector('.a-profile-name')) || '';
        const price = getText(document.querySelector('.a-price-whole')) || '';
        const average_rating = parseFloat(
          (document.querySelector('#acrPopover')?.title || '').match(/[\d.]+/)?.[0] || '0'
        );
        const total_ratings_count = parseInt(
          getText(document.querySelector('#acrCustomerReviewText')).replace(/[^\d]/g, '') || '0'
        ) || 0;

        // Wait for review cards to render
        const reviewEls = await waitForElements('[data-hook="review"]', 8000);

        const reviews = reviewEls.map(el => ({
          review_title: getText(el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)')),
          review_text:  getText(el.querySelector('[data-hook="review-body"] span')),
          rating:       extractStarRating(el),
          is_verified:  !!el.querySelector('[data-hook="avp-badge"]'),
          date:         getText(el.querySelector('[data-hook="review-date"]'))
        })).filter(r => r.review_text.length > 5);

        payload = { platform: 'amazon', product_id: asin, title, price, average_rating, total_ratings_count, reviews };
      }

    } else if (isFlipkart) {
      const pIdMatch = url.match(/\/p\/([a-zA-Z0-9]+)/);
      const productId = pIdMatch ? pIdMatch[1] : null;

      if (productId) {
        const title = getText(document.querySelector('.B_NuCI')) ||
                      getText(document.querySelector('h1.yhB1nd')) || '';
        const price = getText(document.querySelector('._30jeq3._16Jk6d')) ||
                      getText(document.querySelector('._30jeq3')) || '';

        const reviewEls = await waitForElements('._27M-vq', 5000);
        const reviews = reviewEls.map(el => ({
          review_text:  getText(el.querySelector('.t-ZTKy p') || el.querySelector('.t-ZTKy')),
          review_title: getText(el.querySelector('._2-N8zT')),
          rating:       parseFloat(getText(el.querySelector('._3LWZlK')) || '0') || 0,
          is_verified:  false,
          date:         ''
        })).filter(r => r.review_text.length > 5);

        payload = { platform: 'flipkart', product_id: productId, title, price, average_rating: 0, total_ratings_count: 0, reviews };
      }
    }
  } catch (err) {
    console.error('Parakh Scraper Error:', err);
  }

  if (payload) {
    chrome.runtime.sendMessage({ type: 'PARAKH_SCRAPE_RESULT', data: payload });
  } else {
    chrome.runtime.sendMessage({ type: 'PARAKH_SCRAPE_RESULT', data: null, error: 'NOT_PRODUCT_PAGE' });
  }
})();
