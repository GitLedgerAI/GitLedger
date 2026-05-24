# CODELEDGER — Frontend Build Guide

> **Your Review Has Skin in the Game.**
> BUILD DOCUMENT v0.1-ALPHA · May 2026

---

## Project Overview

**CodeLedger** is a GitHub App that transforms PR code reviews into staked EAS attestations on Base L2.

When a reviewer approves a pull request, they lock USDC via Coinbase Agentic Wallet into an escrow smart contract. A Chainlink Function monitors the repo for 30 days. If a hotfix targeting the merged code is detected, the stake is slashed. If the window closes clean, the reviewer earns yield. Every outcome is written as a permanent EAS attestation on Base — building a verifiable, monetizable reputation record queryable by hiring tools, DeFi protocols, and AI agents via x402.

**Core mechanic:** Approve code that breaks production → you pay. Approve code that ships clean → you earn.

---

## Scope — Frontend Only

This repository contains **only the frontend**. The backend (Bun + tRPC + Drizzle), smart contracts (Solidity/Foundry), Chainlink Functions oracle, and GitHub App webhook server are separate services.

The frontend connects to:
- A deployed tRPC API (backend service)
- Base L2 via OnchainKit + Viem
- EAS SDK on Base
- Coinbase CDP Agentic Wallet

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Onchain | OnchainKit (Coinbase), Viem v2 |
| Auth | Dynamic.xyz (JWT + Basename) |
| API client | tRPC v11 |
| Identity | Basenames (name.base.eth) |
| Chain | Base L2 (chainId: 8453) |

---

## Design System

### Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#111214` | Page background |
| `--color-surface` | `#1a1c1f` | Cards, panels |
| `--color-border` | `#2a2d32` | Borders, dividers |
| `--color-text` | `#FFFFFF` | Primary text |
| `--color-text-muted` | `rgba(255,255,255,0.35)` | Secondary text |
| `--color-text-dim` | `rgba(255,255,255,0.20)` | Dimmed / label text |
| `--color-border` | `rgba(255,255,255,0.06)` | Default border |
| `--color-border-hover` | `rgba(255,255,255,0.14)` | Hover border |
| accent cells | white opacity scale | 5 levels from 4%→38% opacity |

### Typography
- Brand logo: **CODE** (white, heavy) + **LEDGER** (green, heavy) with left green border bar
- Tagline: *"Your Review Has Skin in the Game."* — muted gray, regular weight
- Body: Inter or system-ui

### Badge Style
Outlined badges with colored top border accent (1px colored top border + dark bg + uppercase text):
- `EAS ATTESTATION` → green border
- `BASENAME ID` → blue border
- `USDC STAKE` → amber border
- `SLASH / YIELD` → red border

### Grid Background
Subtle dark grid overlay on hero/landing sections (CSS `background-image` grid lines).

---

## Routes & Pages

| Route | Component | Description |
|---|---|---|
| `/` | `LandingPage` | Hero, live attestation feed, metrics, how-it-works, CTA |
| `/reviewer/[basename]` | `ReviewerProfile` | Public EAS history, score, accuracy, yield earned |
| `/dashboard` | `MyDashboard` | Active stakes, pending windows, yield history |
| `/dashboard/stake/[prId]` | `StakeFlow` | Stake confirmation, Agentic Wallet prompt, EAS preview |
| `/explore` | `LeaderBoard` | Top reviewers by score, yield, accuracy, language |
| `/repo/[slug]` | `RepoReviews` | All staked reviews on a repo + codebase trust score |

---

## Key Onchain Components

### ReviewerCard
Uses `Identity`, `Name`, `Avatar`, `Badge`, `Address` from `@coinbase/onchainkit/identity`.
Resolves `name.base.eth` Basenames. Falls back to shortened `0x...` address.

### StakeTransaction
Uses `Transaction`, `TransactionButton` from `@coinbase/onchainkit/transaction`.
Calls `stakeReview(basename, repoSlug, prId, amount)` on `CodeLedger.sol` at chainId `8453`.

---

## Environment Variables (Frontend)

```env
NEXT_PUBLIC_DYNAMIC_ENV_ID=...
NEXT_PUBLIC_CODELEDGER_CONTRACT=0x...
NEXT_PUBLIC_EAS_SCHEMA_UID=0x...
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_CHAIN_ID=8453
```

---

## Agent Progress Log

> **INSTRUCTIONS FOR ALL AGENTS:**
> When you complete work on this project, append an entry below under the current sprint.
> Format: `- [DONE] Short description of what was built/changed — affected files`
> Never remove existing entries. Keep them in chronological order.

---

### Sprint 0 — Setup
- [DONE] Scaffold Next.js 14 project manually — `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`
- [DONE] Design system: color tokens, grid-bg, cell animations, glow utilities — `app/globals.css`, `tailwind.config.ts`
- [DONE] Coming Soon / Landing page built — `app/page.tsx`
- [DONE] Components: `LogoMark`, `FloatingLogo` (3D rotate + chip float), `CellGrid` (GitHub-green contributions), `Countdown`, `EmailSignup`, `TechBadges`, `HowItWorks`, `StatsBar`, `Footer`, `Reveal` (scroll animation)
- [DONE] Framer Motion scroll-reveal on all sections, parallax hero, staggered cards — `components/Reveal.tsx`, `app/page.tsx`
- [DONE] Coming Soon bubble with shimmer + ping animation — `app/page.tsx`
- [ ] Configure Basenames + Dynamic.xyz auth
- [ ] Set up tRPC client

### Sprint 5 — Frontend (per roadmap Days 13–15)
_Next.js: Landing, Reviewer Profile, Dashboard, StakeFlow, Leaderboard. OnchainKit Identity + Transaction._

- [DONE] Backend integration: `lib/api.ts` (tRPC batch-link client), `lib/hooks.ts` (React Query hooks), `.env.local` — all procedures wired
- [DONE] `/` Landing page — live feed now uses `useLiveFeed()` with mock fallback — `app/page.tsx`
- [DONE] `/reviewer/[basename]` — real data via `useReviewer` + `useReviewerAttestations` — `app/reviewer/[basename]/page.tsx`
- [DONE] `/dashboard` — real stakes + reviewer stats from API, auth-gated unauthenticated state — `app/dashboard/page.tsx`
- [DONE] `/dashboard/stake/[prId]` — reviewer multiplier from real API score — `app/dashboard/stake/[prId]/page.tsx`
- [DONE] `/explore` — real leaderboard via `useLeaderboard()`, accuracy computed from counts — `app/explore/page.tsx`
- [DONE] `/repo/[slug]` — real data via `useRepo` + `useRepoAttestations` — `app/repo/[slug]/page.tsx`
- [DONE] Auth flow: GitHub-first, null wallet handled in callback, ConnectButton updated — `app/auth/callback/page.tsx`, `components/ConnectButton.tsx`

---

## Notes
- Logos will be provided by the project owner — do not generate placeholder logos, leave `<Logo />` component slots.
- All monetary values are USDC on Base L2 (6 decimal units).
- Reputation scores range 0–1000. Score > 700 = 1.5x yield multiplier.
- Attestation verdicts: `ACTIVE` | `CLEAN` | `SLASHED`.
