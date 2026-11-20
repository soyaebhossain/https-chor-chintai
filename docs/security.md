# Security baseline

## Implemented

- Server refuses to boot without strong secrets, storage and (in production) SMTP settings.
- Identifiers stored as HMAC (lookup) + AES-256-GCM ciphertext (reviewers only) + last four (public).
- Evidence files encrypted in the app before upload; served only to MFA-verified staff; every view audited.
- Email-code login, hashed single-use codes, DB sessions with `__Host-` httpOnly cookies; staff sessions last 12 h.
- TOTP MFA mandatory for REVIEWER/ADMIN, with replay protection.
- Reviewers cannot decide their own claims; every decision and sensitive view goes to `audit_logs`.
- PostgreSQL-backed rate limits on search, login, MFA and report submission; keys hashed, no raw IPs/emails stored. The client IP comes only from `CLIENT_IP_HEADER`, which must be a header the reverse proxy overwrites.
- CSP, HSTS, frame denial, nosniff, referrer and permissions policies; private pages noindex.
- Cloudflare Turnstile on public search, login-code sending and report submission (required in production).
- Nightly backup script with an automated restore test in CI; retention purge job (`docs/operations.md`).
- Published privacy policy, terms and takedown/appeal process (`/privacy`, `/terms`, `/takedown`).
- CI: lint, typecheck, unit, E2E, Lighthouse on every PR; CodeQL and Dependabot.

## Still required before launch

- Require MFA and short sessions for reviewers and administrators.
- Apply role and claim-level authorization in the API, never only in the UI.
- Keep raw identity numbers, police reports and ownership evidence private.
- Use presigned upload/download URLs with short expiry and quarantine new files.
- Redact identifiers from logs, traces, analytics, errors and support exports.
- Record consent, retention reason and deletion/takedown outcomes.
- Require dual control for bulk export and destructive moderation operations.
- Rotate secrets and encryption keys; run the restore test against a real production backup.
- Run dependency, container, SAST, DAST and access-control tests before launch.

Legal review is required for privacy, defamation, evidence retention, child data, cross-border transfers and police cooperation in each jurisdiction.
