# Architectural & Backend Data Rules

This document defines the mandatory development rules, architectural boundaries, and response handling standards for the project.

---

## 1. Core Architecture Boundaries

- **Backend Ownership**: n8n is the sole backend. All business logic, authentication decisions, credential verifications, account creations, and database interactions belong exclusively to n8n.
- **Frontend Responsibility**: The frontend (HTML, CSS, JavaScript) is strictly responsible for UI presentation, form input capture, format validation, loading states, HTTP dispatch, and response feedback.
- **No Client Authentication**: The frontend does not determine whether a user exists, whether credentials are valid, or whether account creation succeeded.

---

## 2. Backend Response Rule

- **No Premature Success**: The frontend must never assume backend success.
- **Wait for Real HTTP Response**: Every backend operation must wait for the actual HTTP response to arrive before altering application or interface state.
- **Source of Truth**: The `approved` boolean field returned by n8n is the single source of truth for approval-based operations.
- **Explicit Approval Required**: `approved === true` must be explicitly received and validated from the backend before authentication or account creation is deemed successful.
- **No Entry on Rejection**: If `approved` is `false`, missing, or malformed, access must not be granted and the account must not be treated as created.

---

## 3. Loading State Rule

- **Active Loading**: Every asynchronous backend request must display an active visual loading state.
- **Prevent Duplicate Submissions**: Submit buttons and form inputs must be disabled while a request is pending.
- **No Simulated Delays**: Do not use `setTimeout`, artificial delays, or mock timers in place of actual HTTP request lifecycle events.
- **Synchronized Lifecycle**: Loading states begin when the user submits and end only after the response has been completely received and parsed.

---

## 4. Error Handling Rule

- **Discrete Error Handling**: Network errors, server timeouts, HTTP status errors, rejected authorizations, and malformed responses must be handled distinctly.
- **Graceful Failure**: If an HTTP request fails, the frontend must display clear explanatory feedback without crashing or leaving the interface in a locked state.
- **No Security Assumptions**: Client-side validation is a convenience layer for format checks, not a security boundary.

---

## 5. Returned Data Rule

- **Data Availability**: When the backend returns payload data (e.g. user metadata, tokens, session IDs), the frontend must capture and store it in application session state (`sessionStorage`).
- **No Fabricated Data**: The frontend must never hardcode, simulate, or fabricate user profiles, account records, or backend states.
- **Unidirectional Data Flow**:
  `n8n Backend -> HTTP Response -> Frontend Parser -> Page Session State`.

---

## 6. Minimalist UI & Notification Rule

- **Inline Feedback**: Render direct inline alert states inside the active form container.
- **No Unnecessary Dependencies**: Do not introduce toast notification libraries, popup frameworks, or background daemon services.
- **Scope Discipline**: Build only the components defined in the active project phase.
