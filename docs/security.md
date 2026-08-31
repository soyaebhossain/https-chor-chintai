# Security baseline

- Require MFA and short sessions for reviewers and administrators.
- Apply role and claim-level authorization in the API, never only in the UI.
- Keep raw identity numbers, police reports and ownership evidence private.
- Use presigned upload/download URLs with short expiry and quarantine new files.
- Rate-limit by IP, account and identifier HMAC; add bot protection to public search.
- Redact identifiers from logs, traces, analytics, errors and support exports.
- Record consent, retention reason and deletion/takedown outcomes.
- Require dual control for bulk export and destructive moderation operations.
- Back up encrypted data and test restoration; rotate secrets and encryption keys.
- Run dependency, container, SAST, DAST and access-control tests before launch.

Legal review is required for privacy, defamation, evidence retention, child data, cross-border transfers and police cooperation in each jurisdiction.
