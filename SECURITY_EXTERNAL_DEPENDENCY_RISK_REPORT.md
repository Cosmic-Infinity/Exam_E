# Security Review: External Dependency and Third-Party Call Risks

Date: 2026-03-22
Scope: Frontend runtime calls, backend-rendered frontend assets, and URL resolution paths that can trigger browser requests outside first-party infrastructure.

## Why This Matters

The current behavior allows at least one direct third-party script load and several conditional pathways where external URLs can be fetched if untrusted values enter application data. This creates supply-chain, integrity, privacy, and availability risk.

## Executive Summary

- Confirmed direct third-party runtime include: 1
- Confirmed Google Fonts external runtime include: 1 (already known)
- Conditional external-call pathways via absolute URL pass-through: multiple
- Immediate recommendation: remove all direct third-party runtime includes and enforce same-origin URL policy.

## Confirmed Risk Vectors

### 1) Direct third-party script execution via CDN (High)

- File: `docker/backend/core/templates/admin/core/stats_dashboard.html`
- Evidence: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`

Risk:

- Remote code execution in browser context if CDN script is compromised.
- Outage and dependency drift risk if third-party host is unavailable or changes behavior.
- Harder CSP enforcement and weaker compliance posture.

Suggested fix:

- Vendor and self-host Chart.js from first-party static assets.
- Remove direct CDN script references from templates.
- Pin version in repository and update through normal release process.

### 2) Absolute URL pass-through in asset resolution (High)

- File: `docker/frontend/src/app/utils/assetResolver.ts`
- Behavior: absolute `http://` and `https://` paths are returned as-is.

Risk:

- If backend data includes external URLs, frontend will fetch third-party resources.
- Enables deceptive content rendering and privacy leakage through remote hosts.

Suggested fix:

- Reject external absolute URLs by default.
- Accept only same-origin relative paths and explicit internal prefixes.
- Add explicit allowlist only if a business requirement is approved.

### 3) Absolute URL pass-through in evaluation service helpers (High)

- File: `docker/frontend/src/app/services/evaluationService.ts`
- Behavior: absolute URLs are preserved in path normalization and download utilities.

Risk:

- External URL values can bypass first-party routing controls.
- Browser can fetch attacker-controlled endpoints during document access and download flows.

Suggested fix:

- Enforce strict same-origin and internal-path normalization.
- Fail closed for invalid or external paths.

### 4) Viewer components fetch resolved document paths (Medium to High)

- Files:
  - `docker/frontend/src/app/pages/evaluation/EvaluationViewer.tsx`
  - `docker/frontend/src/app/pages/mobile/EvaluationViewerMobile.tsx`
- Behavior: components fetch resolved URLs and cache blobs for viewing/export.

Risk:

- If resolver permits external URLs, these views become active outbound request points.

Suggested fix:

- Keep fetch flows unchanged, but guarantee resolver can only return first-party URLs.

### 5) Frontend Nginx missing strict CSP headers (Medium)

- File: `docker/frontend/nginx.conf`
- Current status: no strict CSP header enforcement at frontend serving layer.

Risk:

- Reduced defense-in-depth against accidental reintroduction of external script/style/resource calls.

Suggested fix:

- Add strict security headers including CSP.
- Start with a practical CSP baseline and tighten over time.

## Known External Runtime Include (Already Identified)

### Google Fonts include (High)

- File: `docker/frontend/src/index.css`
- Evidence: `@import url('https://fonts.googleapis.com/...')`

Suggested fix:

- Self-host fonts and remove runtime Google Fonts import.

## Items Reviewed but Not Counted as Runtime Third-Party Risks

- Build/install dependency URLs in lockfiles (for example npm registry) are build-time, not browser runtime.
- Localhost references in security scripts are local testing behavior, not production third-party calls.
- Documentation/comment links inside vendored assets are references, not active network calls by themselves.

## Prioritized Remediation Plan

### Phase 1: Immediate (same day)

1. Remove CDN Chart.js include and self-host locally.
2. Remove Google Fonts runtime import and self-host fonts.
3. Add strict CSP and core security headers in `docker/frontend/nginx.conf`.

### Phase 2: Core Hardening (1 to 2 days)

1. Update `assetResolver.ts` to reject external absolute URLs.
2. Update `evaluationService.ts` normalization/download logic to reject external URLs.
3. Add backend validation to reject external asset paths before persistence and before API response serialization.

### Phase 3: Regression Prevention (1 to 2 days)

1. Add CI guardrails to fail on new runtime external references in source/templates.
2. Add security tests for rejected external asset URLs.
3. Update security documentation and team development checklist.

## Recommended CSP Baseline

Example baseline policy for first-party-only runtime behavior:

`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`

Notes:

- Keep `'unsafe-inline'` for styles only if currently required by framework output; move to nonce/hash strategy later.
- Tighten directives incrementally after validation in staging.

## Team Discussion Points

1. Are there any approved use-cases that truly require third-party runtime URLs?
2. Should external URL support be fully removed or converted to strict allowlist policy?
3. What rollout window is safe for potentially breaking changes in document path handling?
4. Who owns CSP monitoring and exception approvals?

## Breaking-Change Warning

Enforcing same-origin-only asset/document URLs may break existing flows that currently rely on absolute external URLs. This is a system-level behavior change and should be communicated to the full team before merge.

## Suggested Owner Actions

- Backend owner: path validation and serializer hardening.
- Frontend owner: resolver hardening, CDN removal, and self-hosted assets.
- DevOps owner: CSP and security header rollout, staging verification.
- QA/security owner: regression tests and verification checklist.
