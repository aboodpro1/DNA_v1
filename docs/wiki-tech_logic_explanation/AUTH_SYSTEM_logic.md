# Full Authorization System Specification & Logic

## Overview

The authorization system provides end-to-end client-to-backend authentication and route authorization powered authoritatively by n8n and Notion. It enforces client-side route guards, backend verification, session retention, dynamic user badges, and secure sign-out flows.

## Architecture & Authentication Lifecycle

```text
[UNAUTHENTICATED VISITOR]
         │
         ▼
[dashboard.html] ──── (No active session) ───► Redirect to [index.html]
         │
         ▼
   [SIGN IN / SIGN UP]
         │
         ▼ (POST payload to n8n webhook)
   [n8n Workflow] ────► [Notion Users DB]
         │
         ├── Credentials invalid or unapproved (available: "no account")
         │     └── Return { approved: false, message: "Invalid credentials" }
         │
         └── Credentials valid & approved (available: "active")
               └── Return { approved: true, email, user_id, name }
                     │
                     ▼
         [Client Session Storage]
         Store: auth_user_data = { email, user_id, name }
                     │
                     ▼
         Redirect to [dashboard.html]
                     │
                     ▼
         [Refresh Validation Flow]
         Send: { action: "get_dna_record", email }
                     │
                     ├── User unapproved / "no account" -> Show Inactive / No Account badge & Halt
                     └── User approved -> Show Active badge & load complete DNA record
```

## Action Payloads

### 1. Sign Up (`action: "signup"`)
Dispatched by `signup.html` (`js/signup.js`):
```json
{
  "action": "signup",
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "timestamp": "2026-09-16T08:00:00.000Z"
}
```

### 2. Sign In (`action: "signin"`)
Dispatched by `index.html` (`js/signin.js`):
```json
{
  "action": "signin",
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "timestamp": "2026-09-16T08:00:00.000Z"
}
```

### 3. Get DNA Record & Authorize Session (`action: "get_dna_record"`)
Dispatched automatically by `dashboard.html` (`js/dashboard.js`) on load / refresh:
```json
{
  "action": "get_dna_record",
  "email": "user@example.com",
  "timestamp": "2026-09-16T08:00:00.000Z"
}
```

### 4. Sign Out
Triggered when the user clicks the "Sign Out" button in the sidebar footer:
- Clears `auth_user_data`, `user_dna_data`, `user_dna_record`, and `hasDNA` from `sessionStorage`.
- Navigates immediately to `index.html`.

## Notion Database Field Mapping

### Users Database (`3dc6fd16-45b0-80ff-8435-c255ed191886`)
- `Email Address` (Email): Unique user email address.
- `Password` (Text): Password string.
- `available` (Select / Status): Account status (`active` or `no account`).
- `User ID` (Text): Unique user identifier.
- `Name` (Text): Optional display name.
