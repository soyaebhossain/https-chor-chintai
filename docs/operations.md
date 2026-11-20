# Operations

## Backups

Two things must be backed up, and both are useless without the keys:

| What | How | Keep |
| --- | --- | --- |
| PostgreSQL | Managed provider's daily snapshots + point-in-time recovery, **plus** `npm run db:backup` nightly to separate storage | 30 days |
| Evidence bucket | Enable object versioning / replication on the S3 bucket | 30 days of versions |
| `FIELD_ENCRYPTION_KEY`, `IDENTIFIER_HMAC_SECRET` | Password manager or secrets manager, two people with access | Forever |

```bash
npm run db:backup                 # needs pg_dump on PATH, writes backups/registry-<time>.dump
npm run db:backup -- --docker     # local: runs pg_dump inside the docker-compose container
```

## Restore test

CI runs a backup and restore on every push. Before launch and then once a month,
also run it against a **production** backup on a staging server:

```bash
npm run db:restore-test -- backups/registry-<time>.dump --allow-drift
```

It restores into a temporary database, compares every table, decrypts a stored
identifier with the current key, then drops the copy. The database user needs
`CREATEDB`. Record the date and result in the launch checklist.

Full restore, when it is real:

```bash
createdb registry_restored
pg_restore --no-owner --no-privileges --dbname=postgresql://…/registry_restored backups/registry-<time>.dump
# point DATABASE_URL at it, restart the app, run: npm run db:migrate
```

## Data retention

`npm run data:purge` enforces `lib/retention.ts` (the privacy page shows the same
numbers). Schedule it daily. Use `-- --dry-run` to preview.

## Bot protection

Create a Cloudflare Turnstile widget for the production domain and set
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. Search, login-code
sending and report submission require a valid token in production. Locally,
leave both empty to skip the check.
