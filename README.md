# n8n AI Workflow Web Client

A lightweight, zero-build web client interface powered by an authoritative n8n automation backend.

---

## 1. Project Overview

This project provides a clean, responsive frontend client for an AI-powered automation system. All business logic, user authentication, DNA ingestion, workflows, and data processing are managed authoritatively by n8n via webhook endpoints.

---

## 2. Architecture

```text
+-------------------------+              HTTP Request (GET/POST)             +-------------------------+
|                         | -----------------------------------------------> |                         |
|   Frontend Web Client   |                                                  |   n8n Automation Engine |
|   (HTML / CSS / JS)     | <----------------------------------------------- |   (Auth & DNA Workflows)|
|                         |             JSON Response (approved: true)       |                         |
+-------------------------+                                                  +-------------------------+
```

### Components

- **Frontend**: Standard Vanilla HTML5, CSS3, and JavaScript (ES6+). Zero build tools, zero external UI frameworks.
- **Backend**: n8n workflow engine handling authentication, credential verification, and DNA ingestion.
- **Communication Protocol**: HTTP requests (configurable as GET with query parameters or POST with JSON body).

---

## 3. Project File Structure

```text
n8n-generate img/
|-- index.html            # Sign In page (Entry point)
|-- signup.html           # Sign Up / Registration page
|-- dashboard.html        # Authenticated MVP Dashboard & DNA interface
|-- css/
|   `-- style.css         # Unified stylesheet (Dark theme, forms, sidebar, dropzone)
|-- js/
|   |-- config.js         # Centralized n8n endpoint and HTTP method configuration
|   |-- signin.js         # Sign In form logic, validation, loading, and response handling
|   |-- signup.js         # Sign Up form logic, validation, loading, and response handling
|   `-- dashboard.js      # Dashboard navigation, Drag & Drop, and DNA API dispatch
|-- docs/
|   |-- PLAN.md           # Project roadmap and milestone tracking
|   |-- PRODUCT.md        # Product truth and core principles
|   `-- DESIGN.md         # Visual design tokens and UI specifications
|-- RULES.md              # Architectural constraints and backend response rules
`-- README.md             # Project documentation and developer guide
```

---

## 4. n8n Webhook Integration

### Endpoint Configuration

All webhook URLs and the HTTP transport method are centralized in `js/config.js`:

```javascript
const API_CONFIG = {
  method: "GET", // Supports "GET" or "POST"
  auth: {
    signIn: "http://localhost:5678/webhook-test/sign_both",
    signUp: "http://localhost:5678/webhook-test/sign_both"
  },
  dna: {
    add: "http://localhost:5678/webhook-test/sign_both"
  }
};
```

### DNA Upload Payload Specification

When a user selects or drops a `DNA.md` file, the frontend dispatches:

#### POST Request (JSON):
```json
{
  "action": "add_dna",
  "email": "user@example.com",
  "fileName": "DNA.md",
  "fileType": "text/markdown",
  "fileSize": 1420,
  "fileContent": "# Brand DNA\n\n## 1. Brand Foundation\n...",
  "timestamp": "2026-09-15T16:00:00.000Z"
}
```

#### GET Request (Query Parameters):
```text
http://localhost:5678/webhook-test/sign_both?action=add_dna&fileName=DNA.md&fileSize=1420&timestamp=2026-09-15T16%3A00%3A00.000Z
```

#### Expected n8n Response:
```json
{
  "approved": true,
  "message": "DNA successfully processed and verified"
}
```

---

## 5. DNA Structure (The 5 Pillars)

The brand intelligence ingested by the AI engine consists of:
1. **Brand Foundation**: Role, mission, positioning, audience, and personality.
2. **Content Strategy**: Objectives, asset scope, pillars, and copywriting rules.
3. **Content Matrix**: Deliverables, angles, and slide templates.
4. **Design System**: Visual references, design language, palette, and typography.
5. **Content Generation**: Master reference, consistency rules, and topic formats.

---

## 6. How to Run Locally

```bash
# Using Python
python -m http.server 8080
```

Open your browser at:
- **Sign In**: `http://localhost:8080/index.html`
- **Sign Up**: `http://localhost:8080/signup.html`
- **Dashboard**: `http://localhost:8080/dashboard.html`

---

## 7. Current Project Status

### Implemented (Phases 1 - 4)
- [x] Sign In & Sign Up pages (`index.html`, `signup.html`)
- [x] Strict backend response rules (`approved === true`)
- [x] Asynchronous loading states and duplicate submission prevention
- [x] MVP Dashboard shell with sidebar navigation (`dashboard.html`, `js/dashboard.js`)
- [x] `+ Add DNA` action and `Your DNA` view
- [x] Real Drag & Drop file dropzone with native file selection
- [x] Markdown `.md` validation and content preview
- [x] DNA API request preparation and dispatch to n8n webhook
- [x] Complete project organization (`css/`, `js/`, `docs/`)

### Planned (Future Phases)
- [ ] DNA Creation Agent & Automated Questionnaire
- [ ] AI Content Generation Engine & Webhook Dispatch
- [ ] Asset Preview, Visual Direction, & Content Matrix
