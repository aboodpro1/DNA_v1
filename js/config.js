/**
 * API & Webhook Configuration
 *
 * Centralized configuration for n8n authentication and DNA webhooks.
 * Supports both GET (query parameters) and POST (JSON body) workflows.
 * Routes through the built-in zero-CORS /api/webhook proxy when hosted.
 *
 * Route:    All application routes
 * Trigger:  Loaded on application startup
 * Auth:     n8n Webhook Endpoints
 */

// Production and test n8n Cloud webhooks
const N8N_CLOUD_URL = "https://aboodjallab.app.n8n.cloud/webhook-test/sign_both";
const N8N_PRODUCTION_URL = "https://aboodjallab.app.n8n.cloud/webhook/sign_both";

// Retrieve any custom or saved webhook endpoint from storage
let initialTargetWebhook = N8N_CLOUD_URL;
if (typeof localStorage !== 'undefined') {
  const saved = localStorage.getItem('custom_webhook_url');
  if (saved) {
    const isSavedLocal = saved.includes('localhost') || saved.includes('127.0.0.1');
    const isCurrentHostLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isSavedLocal || isCurrentHostLocal) {
      initialTargetWebhook = saved.trim();
    } else {
      localStorage.removeItem('custom_webhook_url');
    }
  }
}

// Determine if running from an HTTP/HTTPS web origin
const isWebOrigin = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
const DEFAULT_ENDPOINT = isWebOrigin ? '/api/webhook' : initialTargetWebhook;

const API_CONFIG = {
  // Method configured to GET as requested
  method: "GET",

  // Active target n8n cloud webhook
  targetWebhookUrl: initialTargetWebhook,
  productionUrl: N8N_PRODUCTION_URL,
  testUrl: N8N_CLOUD_URL,
  localUrl: "http://localhost:5678/webhook/sign_both",

  // Primary endpoint used for fetch (points to zero-CORS proxy on web server)
  defaultUrl: DEFAULT_ENDPOINT,

  // Helper to get effective endpoint
  getEndpoint: function (customUrl) {
    if (isWebOrigin) {
      return '/api/webhook';
    }
    return (customUrl || this.targetWebhookUrl || N8N_CLOUD_URL).trim();
  },

  // Helper to build headers including x-target-url for the proxy
  getHeaders: function (customUrl) {
    const target = (customUrl || this.targetWebhookUrl || N8N_CLOUD_URL).trim();
    return {
      'Accept': 'application/json, text/plain, */*',
      'x-target-url': target
    };
  },

  // Helper to construct request url and options for either GET or POST
  buildRequest: function (payload, customUrl, customMethod) {
    const method = customMethod || this.method || "GET";
    const baseEndpoint = this.getEndpoint(customUrl);
    const headers = this.getHeaders(customUrl);

    if (method.toUpperCase() === "GET") {
      const urlObj = new URL(baseEndpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (payload && typeof payload === 'object') {
        Object.keys(payload).forEach(k => {
          if (payload[k] !== undefined && payload[k] !== null) {
            urlObj.searchParams.set(k, String(payload[k]));
          }
        });
      }
      const finalUrl = isWebOrigin ? (urlObj.pathname + urlObj.search) : urlObj.toString();
      return {
        url: finalUrl,
        options: {
          method: 'GET',
          headers: headers
        }
      };
    } else {
      headers['Content-Type'] = 'application/json';
      return {
        url: baseEndpoint,
        options: {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload || {})
        }
      };
    }
  },

  // Authentication endpoints
  auth: {
    method: "GET",
    signIn: DEFAULT_ENDPOINT,
    signUp: DEFAULT_ENDPOINT
  },

  // DNA management endpoints
  dna: {
    method: "GET",
    add: DEFAULT_ENDPOINT
  },

  // Direct access shortcuts
  signIn: DEFAULT_ENDPOINT,
  signUp: DEFAULT_ENDPOINT,

  // Helper method to dynamically update active webhook endpoint
  setWebhookUrl: function (url) {
    if (!url) return;
    const cleanUrl = url.trim();
    this.targetWebhookUrl = cleanUrl;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('custom_webhook_url', cleanUrl);
    }
    if (!isWebOrigin) {
      this.defaultUrl = cleanUrl;
      this.auth.signIn = cleanUrl;
      this.auth.signUp = cleanUrl;
      this.dna.add = cleanUrl;
      this.signIn = cleanUrl;
      this.signUp = cleanUrl;
    }
  }
};
