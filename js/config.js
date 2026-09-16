/**
 * API & Webhook Configuration
 *
 * Centralized configuration for n8n authentication and DNA webhooks.
 * Supports dynamic real/production and test endpoint configuration.
 *
 * Route:    All application routes
 * Trigger:  Loaded on application startup
 * Auth:     n8n Webhook Endpoints
 */

// Retrieve any custom or saved webhook endpoint from storage, defaulting to n8n cloud
const N8N_CLOUD_TEST_URL = "https://aboodjallab.app.n8n.cloud/webhook-test/sign_both";
const N8N_CLOUD_PROD_URL = "https://aboodjallab.app.n8n.cloud/webhook/sign_both";

let DEFAULT_WEBHOOK_URL = N8N_CLOUD_TEST_URL;
if (typeof localStorage !== 'undefined') {
  const saved = localStorage.getItem('custom_webhook_url');
  if (saved) {
    const isSavedLocal = saved.includes('localhost') || saved.includes('127.0.0.1');
    const isCurrentHostLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isSavedLocal || isCurrentHostLocal) {
      DEFAULT_WEBHOOK_URL = saved;
    } else {
      localStorage.removeItem('custom_webhook_url');
    }
  }
}

const API_CONFIG = {
  method: "POST",
  // Base endpoints
  defaultUrl: DEFAULT_WEBHOOK_URL,
  productionUrl: N8N_CLOUD_PROD_URL,
  testUrl: N8N_CLOUD_TEST_URL,
  localUrl: "http://localhost:5678/webhook/sign_both",

  // Authentication endpoints
  auth: {
    method: "POST",
    signIn: DEFAULT_WEBHOOK_URL,
    signUp: DEFAULT_WEBHOOK_URL
  },

  // DNA management endpoints
  dna: {
    method: "POST",
    add: DEFAULT_WEBHOOK_URL
  },

  // Direct access shortcuts
  signIn: DEFAULT_WEBHOOK_URL,
  signUp: DEFAULT_WEBHOOK_URL,

  // Helper method to dynamically update active webhook endpoint
  setWebhookUrl: function (url) {
    if (!url) return;
    const cleanUrl = url.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('custom_webhook_url', cleanUrl);
    }
    this.defaultUrl = cleanUrl;
    this.auth.signIn = cleanUrl;
    this.auth.signUp = cleanUrl;
    this.dna.add = cleanUrl;
    this.signIn = cleanUrl;
    this.signUp = cleanUrl;
  }
};
