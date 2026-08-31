# চোর ছিনতাই — Trusted Product Registry MVP

চুরি/ছিনতাই হওয়া পণ্যের Serial, IMEI, VIN বা Service Tag রিপোর্ট ও যাচাইয়ের একটি runnable MVP। বর্তমান UI demo data ব্যবহার করে; production integrations-এর interfaces ও data model scaffold করা আছে।

## Included

- Public identifier search with safe redacted results
- Theft/loss claim form and evidence upload UI
- User claim-status dashboard
- Admin verification queue demo
- Drizzle schema for users, products, identifiers, claims, documents and audit logs
- NestJS API and BullMQ worker reference services under `services/`
- Docker Compose for PostgreSQL, Redis and MinIO
- Security, API and architecture notes under `docs/`

## Run the web app

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. Demo reported IMEI: `356938035643809`.

## Production gate

The frontend builds independently with `npm run build`. The reference API and worker are intentionally separate deployables; install and run them from their own service folders when wiring PostgreSQL, Redis, Auth0 and object storage.

## Important

This is an MVP foundation, not a legally approved production registry. Obtain jurisdiction-specific privacy, defamation, evidence-retention and law-enforcement advice before launch.
