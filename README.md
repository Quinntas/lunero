# Lunero

Freelance hiring platform with **milestone-based payments and gradual release of funds** (TCC, Engenharia de Computação, CEUMAP).

A freelancer or a contractor builds a **draft** split into milestones. Each milestone has a name, a description, a price and an optional deadline. The two sides send the draft back and forth until one of them accepts it. The contractor then pays the full amount up front through Stripe (Pix or card, BRL). Lunero holds the money and releases each milestone's share to the freelancer only after the contractor approves the proof of work.

## Stack

| Layer          | Tech                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Runtime / repo | Bun + Bun workspaces                                                                                    |
| Backend        | Convex (self-hosted): database, functions, Convex Auth, scheduler, HTTP actions                         |
| Web            | TanStack Start (React 19, Vite 8) running on Bun                                                        |
| UI             | shadcn/ui (all components, `packages/ui`) + Tailwind CSS 4, dark mode (next-themes), i18n en-US / pt-BR |
| Payments       | Stripe Checkout (`card` + `pix`, BRL), Stripe Connect transfers                                         |
| Files          | S3 via `Bun.S3Client` (MinIO locally)                                                                   |
| Cache / limits | Redis via `Bun.RedisClient`                                                                             |
| Lint / format  | oxlint / oxfmt                                                                                          |

```
apps/web            TanStack Start app (routes, server functions, Bun prod server)
packages/backend    Convex functions, schema, auth, Stripe integration
packages/ui         shadcn/ui component library (@workspace/ui)
scripts/            setup, env sync and dev runner
docker-compose.yml  Convex backend + dashboard, Redis, MinIO
```

## Getting started

Requirements: Bun ≥ 1.3, Docker, and the [Stripe CLI](https://docs.stripe.com/stripe-cli) for payments.

```sh
bun install
bun run setup   # starts docker, creates the Convex admin key, auth keys and env vars
bun run dev     # convex dev (push + watch) and the web app on http://localhost:3000
```

| Service          | URL                                                                |
| ---------------- | ------------------------------------------------------------------ |
| Web app          | http://localhost:3000                                              |
| Convex dashboard | http://localhost:6791 (admin key in `packages/backend/.env.local`) |
| MinIO console    | http://localhost:9001 (`lunero` / `lunero-secret`)                 |

### Payments (Stripe)

1. Put your **test** secret key in `.env` as `STRIPE_SECRET_KEY`.
2. In the Stripe Dashboard, enable **Pix** under payment methods, plus **Connect** for freelancer payouts.
3. Run `bun run stripe:listen`, copy the `whsec_…` secret into `STRIPE_WEBHOOK_SECRET`.
4. Run `bun run env:sync` to push the values to Convex.

Without Stripe keys the app still works up to the payment step and shows a clear error there.

### Configuration

All settings live in the root `.env` (see `.env.example`). The values used by Convex functions (`SITE_URL`, `LUNERO_FEE_CENTS`, `STRIPE_*`) are pushed with `bun run env:sync`. They are declared and typed in `packages/backend/convex/convex.config.ts`.

**Platform fee:** `LUNERO_FEE_CENTS` is a fixed amount, in centavos, that Lunero keeps from every accepted draft. It is split across the milestones in proportion to their price, and each milestone pays out `price − share`.

## How it works

**Accounts.** Everyone uses the same account type. Turning on _modo freelancer_ in settings (`users.isFreelancer`) lets a user be the freelancer side of a draft and receive payouts through Stripe Connect.

**Proposals** ("drafts" in the code, `convex/drafts.ts`). The other side is optional: invite someone by e-mail, or just send the proposal and share its invite link (`/p/<token>`). Anyone who opens the link can read it signed out, and creating an account lets them accept, decline or propose changes. That person then takes the empty seat.

```
editing ──send──▶ sent ──accept──▶ accepted (creates a contract)
   ▲                │
   └───counter──────┤──reject──▶ rejected
                    └ either side can cancel ──▶ cancelled
```

Only the party whose turn it is (`turnUserId`) can edit, send, accept, reject or counter. A sent proposal with no counterpart is open to whoever opens the link.

**Contracts** (`convex/contracts.ts`): `awaiting_payment → payment_processing (Pix pending) → active → completed`. Accepting a draft snapshots the terms, the fee and each milestone's payout.

**Payments** (`convex/stripe.ts`, webhook at `POST {CONVEX_SITE_URL}/stripe/webhook`):

1. The contractor pays the full value through Checkout (`card` / `pix`, `transfer_group = contractId`).
2. `checkout.session.completed` / `async_payment_succeeded` marks the contract funded. Webhook events are deduplicated.
3. When a milestone is approved, a scheduled action creates a `transfer` to the freelancer's connected account (`source_transaction` = the contract's charge, idempotent per milestone).
4. If the freelancer hasn't finished Connect onboarding, the payout stays **held** and is released automatically once onboarding completes (or with "Tentar repasse novamente").

**Milestones** (`convex/milestones.ts`): `pending → in_progress → submitted → approved`, or `submitted → changes_requested → submitted …`. Every submission keeps its note, files and review note, and every action is written to the activity log.

**Proof files** (`apps/web/src/lib/files.ts`): the browser sends its Convex token to a TanStack Start server function. That function asks Convex whether the user may upload or download (`convex/files.ts`), applies a Redis rate limit, and returns a presigned S3 URL from `Bun.S3Client`. Uploads go straight from the browser to S3. Keys are scoped per contract, milestone and user, and Convex rejects any key outside that prefix. Signed download URLs are cached in Redis.

## Interface

- **Languages:** English (US) and Português (Brasil). The locale comes from a cookie, falling back to the browser language, and is resolved during SSR. Messages live in `apps/web/src/i18n/messages`, and pt-BR is type-checked against en. The backend throws error **codes** (`convex/lib/errors.ts`) and stores activity as `kind` + `data`, so the UI translates everything.
- **Themes:** light, dark and system, via next-themes.
- **UX:**
  - Every proposal and contract page starts with a **next step** card saying whose turn it is and what to do.
  - Contracts show a lifecycle stepper (accepted → funded → in progress → completed), an escrow bar (released vs held) and a milestone timeline with due and overdue dates.
  - The dashboard is an action center listing everything waiting on you.
  - Proposals are created with a 4-step wizard (role → project → milestones → review & send).

## Scripts

| Command                           | What it does                                         |
| --------------------------------- | ---------------------------------------------------- |
| `bun run dev`                     | Convex dev + web dev server                          |
| `bun run build` / `bun run start` | Production build / Bun server (`apps/web/server.ts`) |
| `bun run lint` / `lint:fix`       | oxlint                                               |
| `bun run format` / `format:check` | oxfmt                                                |
| `bun run typecheck`               | TypeScript in every workspace                        |
| `bun test`                        | Unit tests (fee allocation)                          |
| `bun run infra:up` / `infra:down` | Start / stop the docker services                     |
| `bun run env:sync`                | Push `.env` values to Convex                         |
