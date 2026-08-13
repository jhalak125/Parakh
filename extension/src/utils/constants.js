export const AMAZON_PRODUCT_PATTERNS = [
  /amazon\.(in|com)\/.*\/dp\//,
  /amazon\.(in|com)\/dp\//,
  /amazon\.(in|com)\/gp\/product\//,
];

export const FLIPKART_PRODUCT_PATTERNS = [
  /flipkart\.com\/.*\/p\//,
];

export const BACKEND_URL = 'http://localhost:8000';
export const ANALYZE_ENDPOINT = `${BACKEND_URL}/api/v1/analyze`;
export const HEALTH_ENDPOINT = `${BACKEND_URL}/health`;

export const MESSAGES = {
  SCRAPE_REQUEST: 'PARAKH_SCRAPE_REQUEST',
  SCRAPE_RESULT: 'PARAKH_SCRAPE_RESULT',
  SCRAPE_ERROR: 'PARAKH_SCRAPE_ERROR',
  ANALYZE_REQUEST: 'PARAKH_ANALYZE_REQUEST',
  ANALYZE_RESULT: 'PARAKH_ANALYZE_RESULT',
  ANALYZE_ERROR: 'PARAKH_ANALYZE_ERROR',
};
