# GitLedger Backend

Bun + Hono + tRPC + Drizzle scaffold for GitLedger.

## Run

1. Copy `.env.example` to `.env` and fill values.
2. Install deps: `bun install`
3. Start dev server: `bun run dev`

## Initial endpoints

- `GET /health`
- `POST /webhooks/github`

## Notes

- Webhook signature validation and 30-second dedup are implemented.
- Queueing is currently a stub in `src/services/queue.ts`.
- tRPC routers are scaffolded in `src/routes/trpc.ts` for the PRD surface area.
- CI trigger note: documentation touch-up for deployment pipeline validation.
- CI trigger note 2: additional no-op docs update.
