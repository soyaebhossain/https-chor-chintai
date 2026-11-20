# Security baseline

Implemented:

- Raw identifiers and phone numbers are encrypted at rest (AES-256-GCM); lookups use keyed HMACs.
- Public search only matches moderator-approved reports and returns the last four characters.
- Production refuses to start without strong secrets and a database URL.
- Moderator console and evidence files require a signed admin session; login is rate-limited (5 per 15 min per IP).
- Rate limits: search 30/min, report 5/hour, device linking 10/hour per IP.
- Upload type checked from file bytes, not the name or browser-supplied type.
- Security headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- Audit log for every create, link, decision and recovery.

Before a public launch:

- Replace the shared admin password with individual moderator accounts and MFA.
- Add bot protection (e.g. Cloudflare Turnstile) to search and report forms.
- Shared rate limiting (Redis) if running more than one instance.
- Automated encrypted backups with a tested restore.
- Error monitoring (Sentry) with identifiers scrubbed.
- Published privacy policy, terms, retention period and takedown/appeal process.
- Legal review: privacy, defamation, evidence retention and police cooperation.
