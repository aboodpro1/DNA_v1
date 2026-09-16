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

// Retrieve any custom or saved webhook endpoint from storage, defaulting to real production
const savedWebhookUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_webhook_url') : null;
const DEFAULT_WEBHOOK_URL = savedWebhookUrl || "http://localhost:5678/webhook/sign_both";

const API_CONFIG = {
  // Base endpoints
  defaultUrl: DEFAULT_WEBHOOK_URL,
  productionUrl: "http://localhost:5678/webhook/sign_both",
  testUrl: "http://localhost:5678/webhook-test/sign_both",

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
