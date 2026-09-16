# Useful Commands

This document contains commands for running, testing, and verifying the application locally.

## Local Server Execution

### Python HTTP Server
Run the local HTTP server on port 8080:
```bash
python -m http.server 8080
```

Access the application routes:
- Sign In: `http://localhost:8080/index.html`
- Sign Up: `http://localhost:8080/signup.html`
- Dashboard: `http://localhost:8080/dashboard.html`

## n8n Authorization Webhook Testing

### 1. Test Ping Endpoint
```bash
curl -X POST http://localhost:5678/webhook/sign_both \
  -H "Content-Type: application/json" \
  -d '{"action": "ping", "timestamp": "2026-09-16T08:00:00.000Z"}'
```

### 2. Test Sign Up (`action: "signup"`)
```bash
curl -X POST http://localhost:5678/webhook/sign_both \
  -H "Content-Type: application/json" \
  -d '{"action": "signup", "email": "newuser@example.com", "password": "Password123!", "timestamp": "2026-09-16T08:00:00.000Z"}'
```

### 3. Test Sign In (`action: "signin"`)
```bash
curl -X POST http://localhost:5678/webhook/sign_both \
  -H "Content-Type: application/json" \
  -d '{"action": "signin", "email": "alex@example.com", "password": "Password123!", "timestamp": "2026-09-16T08:00:00.000Z"}'
```

### 4. Test Session Authorization & DNA Fetch (`action: "get_dna_record"`)
```bash
curl -X POST http://localhost:5678/webhook/sign_both \
  -H "Content-Type: application/json" \
  -d '{"action": "get_dna_record", "email": "ajjallab@gmail.com", "timestamp": "2026-09-16T08:00:00.000Z"}'
```
