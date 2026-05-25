"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import LogoMark from "@/components/LogoMark";

type Block =
  | { kind: "text"; body: string }
  | { kind: "heading"; title: string; tagline?: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "kv"; rows: [string, string][] }
  | { kind: "code"; lang?: string; body: string };

type Section = {
  id: string;
  label: string;
  tagline?: string;
  blocks: Block[];
};

const SECTIONS: Section[] = [
  {
    id: "abstract",
    label: "00 — Abstract",
    tagline: "Build Document · v0.1-ALPHA",
    blocks: [
      {
        kind: "text",
        body: `GitLedger is a GitHub App that transforms PR code reviews into staked EAS attestations on Base L2.

When a reviewer approves a pull request, they lock USDC via Coinbase Agentic Wallet into an escrow smart contract. A Chainlink Function monitors the repo for 30 days. If a hotfix targeting the merged code is detected, the stake is slashed. If the window closes clean, the reviewer earns yield. Every outcome is written as a permanent EAS attestation on Base — building a verifiable, monetizable reputation record queryable by hiring tools, DeFi protocols, and AI agents via x402.

Core mechanic: approve code that breaks production → you pay. Approve code that ships clean → you earn.`,
      },
    ],
  },
  {
    id: "overview",
    label: "01 — Overview & Thesis",
    tagline: "Concept",
    blocks: [
      { kind: "heading", title: "What is GitLedger?" },
      {
        kind: "text",
        body: `GitLedger is a GitHub App that transforms PR code reviews into staked EAS attestations on Base L2. When a reviewer approves a pull request, they lock USDC via Coinbase Agentic Wallet into an escrow contract. A Chainlink Function monitors the repo for 30 days. If a hotfix targeting the merged code is detected, the stake slashes. If the window closes clean, the reviewer earns yield. Every outcome is written as a permanent EAS attestation on Base — building a verifiable, monetizable reputation record queryable by any hiring tool, DeFi protocol, or AI agent via x402.`,
      },
      { kind: "heading", title: "The Problem" },
      {
        kind: "text",
        body: `Code review is the last line of defense before production — but reviewers carry zero financial accountability. A January 2026 study found agent-generated code introduces more technical debt per change than human code, yet reviewers feel better approving it. More than one in five GitHub code reviews now involve an AI agent. GitHub Copilot alone processed 60 million reviews growing 10x in under a year. Volume is outpacing human oversight. GitLedger fixes the incentive layer: approve code that breaks production and you pay. Approve code that ships clean and you earn.`,
      },
      { kind: "heading", title: "Ecosystem Integration" },
      {
        kind: "kv",
        rows: [
          ["GitHub App", "Webhook on pull_request_review events. One-click install, zero workflow disruption."],
          ["Agentic Wallet (CDP)", "MPC-secured wallet, gasless USDC on Base. Launched Feb 11, 2026. Session spend caps."],
          ["EAS on Base", "Ethereum Attestation Service — permanent, revocable, onchain reviewer track record."],
          ["x402 Protocol", "HTTP-native payment protocol. Reviewer reputation sold per-query. No API key needed."],
          ["Chainlink Functions", "Decentralized bug oracle. Polls GitHub API, detects hotfix PRs, fires slash/yield."],
          ["Basenames", "name.base.eth as reviewer identity across profiles, attestations, and leaderboard."],
          ["OnchainKit", "Coinbase's React library — Identity, Avatar, Name, Transaction components on Base."],
        ],
      },
    ],
  },
  {
    id: "mechanics",
    label: "02 — Protocol Mechanics",
    tagline: "Economics + Logic",
    blocks: [
      { kind: "heading", title: "Stake Lifecycle" },
      {
        kind: "table",
        headers: ["Step", "Actor", "Action", "Result"],
        rows: [
          ["1", "Reviewer", "Submits Approved on GitHub PR", "GitHub webhook fires to GitLedger"],
          ["2", "Backend", "Prompts reviewer to stake USDC", "CDP Agentic Wallet popup in browser"],
          ["3", "Reviewer", "Confirms stake (above repo minimum)", "USDC transferred to escrow on Base"],
          ["4", "Contract", "Locks stake, starts 30-day window", "Emits StakeLocked(reviewer, prId, amount)"],
          ["5", "Contract", "Calls EAS.attest() with schema", "Attestation UID stored in mapping"],
          ["6", "Chainlink", "Upkeep polls GitHub every 24h", "Detects qualifying hotfix PRs"],
          ["7a", "Oracle", "Hotfix detected within window", "slashReview() — 70% reporter, 30% treasury"],
          ["7b", "Oracle", "Window closed, no hotfix", "releaseYield() — stake + yield to reviewer"],
        ],
      },
      { kind: "heading", title: "Reputation Score Formula" },
      {
        kind: "kv",
        rows: [
          ["Base Score", "500 on first EAS attestation minted"],
          ["Clean Review", "+5 points per clean 30-day window"],
          ["High-Stake Clean", "+10 points if stake was ≥ $500 USDC"],
          ["Slash", "−50 points per slash event"],
          ["High-Stake Slash", "−100 points if staked ≥ $500 and slashed"],
          ["Score Range", "0 to 1000. Decay: −1 per 30 days inactive. Score > 700 earns 1.5x yield."],
          ["Yield Rate", "treasury_apy × elapsed_days / 365 × stake. APY target 12–24%."],
        ],
      },
    ],
  },
  {
    id: "contracts",
    label: "03 — Smart Contracts",
    tagline: "Solidity 0.8 · Base L2",
    blocks: [
      { kind: "heading", title: "GitLedger.sol — Core Logic" },
      {
        kind: "code",
        lang: "solidity",
        body: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GitLedger {
    IEAS    public immutable eas;
    IERC20  public immutable usdc;
    bytes32 public immutable schema;
    address public immutable chainlinkOracle;

    uint256 public constant ORACLE_WINDOW   = 30 days;
    uint256 public constant REPORTER_SHARE  = 7000; // 70% bps
    uint256 public constant TREASURY_SHARE  = 3000; // 30% bps

    struct StakeRecord {
        address reviewer;
        bytes32 basename;       // keccak256("name.base.eth")
        string  repoSlug;
        uint256 prId;
        uint256 amount;
        uint256 stakedAt;
        bytes32 attestationUID;
        StakeState state;
    }

    enum StakeState { Active, Slashed, Released }

    mapping(bytes32 => StakeRecord) public stakes;     // keccak256(reviewer + prId)
    mapping(bytes32 => uint256)     public reputation; // basename => score
    address public treasury;

    event StakeLocked(bytes32 stakeId, address reviewer, uint256 amount);
    event ReviewSlashed(bytes32 stakeId, address reporter, uint256 reporterAmt);
    event YieldReleased(bytes32 stakeId, address reviewer, uint256 total);

    function stakeReview(
        bytes32 basename, string calldata repoSlug, uint256 prId, uint256 amount
    ) external returns (bytes32 stakeId) {
        usdc.transferFrom(msg.sender, address(this), amount);
        stakeId = keccak256(abi.encodePacked(msg.sender, prId));
        stakes[stakeId] = StakeRecord(msg.sender, basename, repoSlug, prId,
            amount, block.timestamp, bytes32(0), StakeState.Active);
        bytes32 uid = eas.attest(buildAttestation(basename, repoSlug, prId, amount, "ACTIVE"));
        stakes[stakeId].attestationUID = uid;
        emit StakeLocked(stakeId, msg.sender, amount);
    }

    function slashReview(bytes32 stakeId, address reporter) external onlyOracle {
        StakeRecord storage s = stakes[stakeId];
        require(s.state == StakeState.Active);
        s.state = StakeState.Slashed;
        uint256 rAmt = (s.amount * REPORTER_SHARE) / 10000;
        usdc.transfer(reporter, rAmt);
        usdc.transfer(treasury, s.amount - rAmt);
        reputation[s.basename] = reputation[s.basename] >= 50
            ? reputation[s.basename] - 50 : 0;
        eas.revoke(s.attestationUID);
        eas.attest(buildAttestation(s.basename, s.repoSlug, s.prId, s.amount, "SLASHED"));
        emit ReviewSlashed(stakeId, reporter, rAmt);
    }

    function releaseYield(bytes32 stakeId) external onlyOracle {
        StakeRecord storage s = stakes[stakeId];
        require(s.state == StakeState.Active);
        require(block.timestamp > s.stakedAt + ORACLE_WINDOW);
        s.state = StakeState.Released;
        uint256 yld = computeYield(s);
        usdc.transfer(s.reviewer, s.amount + yld);
        reputation[s.basename] = min(reputation[s.basename] + 5, 1000);
        eas.revoke(s.attestationUID);
        eas.attest(buildAttestation(s.basename, s.repoSlug, s.prId, s.amount, "CLEAN"));
        emit YieldReleased(stakeId, s.reviewer, s.amount + yld);
    }

    function computeYield(StakeRecord storage s) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - s.stakedAt;
        uint256 base    = (s.amount * 1800 * elapsed) / (365 days * 10000); // 18% APY
        uint256 mult    = reputation[s.basename] > 700 ? 15000 : 10000;
        return min((base * mult) / 10000, s.amount * 3);
    }

    modifier onlyOracle() { require(msg.sender == chainlinkOracle); _; }
    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}`,
      },
    ],
  },
  {
    id: "schema",
    label: "04 — EAS Attestation Schema",
    tagline: "Ethereum Attestation Service",
    blocks: [
      { kind: "heading", title: "Schema String (registered on Base)" },
      {
        kind: "code",
        lang: "solidity",
        body: `string public constant SCHEMA =
    "bytes32 basename,"          // keccak256(name.base.eth)
    "string  repoSlug,"          // 'org/repo'
    "uint256 prId,"              // GitHub PR number
    "uint256 stakeAmount,"       // USDC 6-decimal units
    "string  verdict,"           // ACTIVE | CLEAN | SLASHED
    "uint256 reviewedAt,"        // block.timestamp
    "uint256 resolvedAt,"        // 0 if still active
    "uint256 reputationDelta,"   // +5, -50 etc.
    "string  repoLanguages";     // 'Solidity,TypeScript'`,
      },
      { kind: "heading", title: "TypeScript Attestation Call" },
      {
        kind: "code",
        lang: "ts",
        body: `import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';

const eas = new EAS(EAS_CONTRACT_BASE); eas.connect(signer);
const encoder = new SchemaEncoder(SCHEMA_STRING);

const encoded = encoder.encodeData([
  { name: 'basename',        value: keccak256(toUtf8Bytes('vitalik.base.eth')), type: 'bytes32' },
  { name: 'repoSlug',        value: 'uniswap/v4-core',           type: 'string'  },
  { name: 'prId',            value: 4821n,                        type: 'uint256' },
  { name: 'stakeAmount',     value: 500_000_000n,                 type: 'uint256' },
  { name: 'verdict',         value: 'ACTIVE',                     type: 'string'  },
  { name: 'reviewedAt',      value: BigInt(Math.floor(Date.now()/1000)), type: 'uint256' },
  { name: 'resolvedAt',      value: 0n,                           type: 'uint256' },
  { name: 'reputationDelta', value: 0n,                           type: 'uint256' },
  { name: 'repoLanguages',   value: 'Solidity,TypeScript',        type: 'string'  },
]);

const tx  = await eas.attest({
  schema: SCHEMA_UID,
  data: { recipient: reviewerAddress, revocable: true, data: encoded },
});
const uid = await tx.wait();`,
      },
      { kind: "heading", title: "Attestation States" },
      {
        kind: "table",
        headers: ["State", "Trigger", "EAS Action", "Revocable"],
        rows: [
          ["ACTIVE", "stakeReview() called", "attest() — UID stored onchain", "Yes"],
          ["CLEAN", "Oracle: window passed", "revoke(uid) + re-attest verdict=CLEAN", "Yes"],
          ["SLASHED", "Oracle: hotfix found", "revoke(uid) + re-attest verdict=SLASHED", "No"],
        ],
      },
    ],
  },
  {
    id: "x402",
    label: "05 — x402 Paywall API",
    tagline: "Reviewer Reputation as a Service",
    blocks: [
      {
        kind: "text",
        body: `Reviewer reputation is exposed behind an x402 HTTP paywall — 0.001 USDC per query, settled on Base. No API key, no account. Any client presents a signed payment header and receives the full attestation history. AI agents, hiring tools, and DeFi protocols all use the same endpoint.`,
      },
      { kind: "heading", title: "Endpoint Flow" },
      {
        kind: "code",
        lang: "http",
        body: `// 1. Client hits endpoint — receives 402
GET /api/reviewer/vitalik.base.eth
HTTP/1.1 402 Payment Required
X-Payment-Requirements: {
  "scheme": "exact", "network": "base-mainnet",
  "maxAmountRequired": "1000",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "payTo": "0xGitLedger...Treasury",
  "description": "GitLedger reviewer reputation query"
}

// 2. Client signs payment and retries with X-PAYMENT header
// 3. Server verifies + settles, returns full profile
HTTP/1.1 200 OK
{
  "basename": "vitalik.base.eth",
  "score": 847, "percentile": 94, "accuracyRate": 0.993,
  "cleanCount": 282, "slashCount": 2,
  "totalYield": "2184000000",
  "attestations": [{ "uid": "0x...", "repo": "uniswap/v4-core",
    "pr": 4821, "verdict": "CLEAN", "stake": 500000000 }]
}`,
      },
      { kind: "heading", title: "Next.js x402 Middleware" },
      {
        kind: "code",
        lang: "ts",
        body: `// src/app/api/reviewer/[basename]/route.ts
import { withPaymentRequired } from '@coinbase/x402-next';

export const GET = withPaymentRequired(
  async (req, { params }) => {
    const { basename } = params;
    const profile = await db.query.reviewers.findFirst({
      where: eq(reviewers.basename, basename),
      with: { attestations: { limit: 50, orderBy: desc(attestations.createdAt) } }
    });
    return profile ? Response.json(formatProfile(profile)) : Response.json({}, { status: 404 });
  },
  { amount: '1000', asset: USDC_BASE, network: 'base-mainnet' }
);`,
      },
    ],
  },
  {
    id: "backend",
    label: "06 — Backend Spec",
    tagline: "Bun + tRPC + Drizzle",
    blocks: [
      {
        kind: "kv",
        rows: [
          ["Runtime", "Bun 1.x — native TypeScript, fast webhook throughput, built-in test runner"],
          ["API", "tRPC v11 — end-to-end type safety, WebSocket for live attestation feed"],
          ["ORM", "Drizzle ORM — typed queries, TimescaleDB hypertable for events"],
          ["Cache", "Redis 7 — webhook dedup 30s TTL, rate limiting, x402 receipt cache"],
          ["Chain", "Viem v2 — Base L2 RPC, contract writes, EAS SDK integration"],
          ["GitHub", "GitHub App (Octokit) — webhook listener for pull_request_review events"],
          ["Wallet", "Coinbase CDP SDK — stake collection, USDC transfers, gasless on Base"],
          ["Auth", "Dynamic.xyz JWT + Basename verification for reviewer dashboard"],
        ],
      },
      { kind: "heading", title: "tRPC Router" },
      {
        kind: "code",
        lang: "ts",
        body: `export const appRouter = router({
  reviewer: router({
    profile:     publicProcedure.input(z.string()).query(getReviewerProfile),
    leaderboard: publicProcedure.query(getLeaderboard),
    myStakes:    protectedProcedure.query(getMyStakes),
  }),
  attestation: router({
    byReviewer: publicProcedure.input(z.string()).query(getAttestationsByReviewer),
    byRepo:     publicProcedure.input(z.string()).query(getAttestationsByRepo),
    live:       publicSubscription.subscription(liveAttestationFeed),
  }),
  stake: router({
    initiate: protectedProcedure.input(stakeSchema).mutation(initiateStake),
    status:   protectedProcedure.input(z.string()).query(getStakeStatus),
    history:  protectedProcedure.query(getStakeHistory),
  }),
  repo: router({
    install:  webhookProcedure.mutation(handleGitHubInstall),
    settings: protectedProcedure.input(z.string()).query(getRepoSettings),
  }),
});`,
      },
      { kind: "heading", title: "GitHub Webhook Handler (simplified)" },
      {
        kind: "code",
        lang: "ts",
        body: `app.post('/webhooks/github', async (req, res) => {
  if (!verifyGH(req.headers['x-hub-signature-256'], req.rawBody)) return res.status(401).end();

  const dedup = 'gh:' + req.headers['x-github-delivery'];
  if (await redis.exists(dedup)) return res.status(200).send('dup');
  await redis.set(dedup, 1, 'EX', 30);

  const { review, pull_request, repository } = req.body;
  if (req.headers['x-github-event'] === 'pull_request_review'
      && req.body.action === 'submitted'
      && review.state === 'approved') {

    const repo = await db.query.repos.findFirst({
      where: eq(repos.slug, repository.full_name)
    });

    if (repo?.stakeEnabled) {
      await queue.add('prompt-stake', {
        reviewerId: review.user.login,
        repoSlug:   repository.full_name,
        prId:       pull_request.number,
        minStake:   repo.minStakeUsdc,
      });
    }
  }
  res.status(200).send('ok');
});`,
      },
    ],
  },
  {
    id: "frontend",
    label: "07 — Frontend Spec",
    tagline: "Next.js 14 + OnchainKit",
    blocks: [
      {
        kind: "table",
        headers: ["Route", "Component", "Description"],
        rows: [
          ["/", "LandingPage", "Hero, live feed, metrics, how-it-works, CTA"],
          ["/reviewer/[basename]", "ReviewerProfile", "Public EAS history, score, accuracy, yield earned"],
          ["/dashboard", "MyDashboard", "Active stakes, pending windows, yield history"],
          ["/dashboard/stake/[prId]", "StakeFlow", "Stake confirmation, Agentic Wallet prompt, EAS preview"],
          ["/explore", "LeaderBoard", "Top reviewers by score, yield, accuracy, language"],
          ["/repo/[slug]", "RepoReviews", "All staked reviews on a repo. Codebase trust score."],
          ["/api/reviewer/[basename]", "x402 Handler", "0.001 USDC per query via x402 middleware"],
        ],
      },
      { kind: "heading", title: "OnchainKit Identity Components" },
      {
        kind: "code",
        lang: "tsx",
        body: `// ReviewerCard.tsx
import { Identity, Name, Avatar, Badge, Address } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export function ReviewerCard({ address, stakeAmount, verdict }) {
  return (
    <Identity address={address} chain={base} schemaId={GL_EAS_SCHEMA}>
      <Avatar />
      <Name />     {/* Resolves name.base.eth */}
      <Address />  {/* Shortened 0x... fallback */}
      <Badge />    {/* Coinbase verification badge */}
    </Identity>
  );
}

// StakeTransaction.tsx
import { Transaction, TransactionButton } from '@coinbase/onchainkit/transaction';

export function StakeTransaction({ amount, prId, basename, repoSlug }) {
  const contracts = [{
    address: GITLEDGER_ADDRESS, abi: GitLedgerABI,
    functionName: 'stakeReview',
    args: [basename, repoSlug, BigInt(prId), parseUnits(amount, 6)],
  }];
  return (
    <Transaction contracts={contracts} chainId={8453}>
      <TransactionButton text={"Stake $" + amount + " USDC"} />
    </Transaction>
  );
}`,
      },
    ],
  },
  {
    id: "chainlink",
    label: "08 — Chainlink Functions",
    tagline: "Bug Oracle",
    blocks: [
      { kind: "heading", title: "JavaScript Source (runs on Chainlink DON)" },
      {
        kind: "code",
        lang: "js",
        body: `const [prId, repoSlug, stakeId, stakedAt] = args;
const windowEnd = parseInt(stakedAt) + 30 * 24 * 3600;

if (Math.floor(Date.now()/1000) < windowEnd) {
  return Functions.encodeString('WATCHING');
}

const res = await Functions.makeHttpRequest({
  url: 'https://api.github.com/search/issues',
  params: {
    q: 'repo:' + repoSlug + ' is:pr is:merged "' + prId + '" in:body',
    sort: 'created', order: 'asc', per_page: 10,
  },
  headers: { Authorization: 'Bearer ' + secrets.GITHUB_TOKEN }
});

const hotfixRE = /^(fix|hotfix|revert|patch):/i;
const hits = (res.data.items || []).filter(pr => {
  const createdAt = new Date(pr.created_at).getTime() / 1000;
  return hotfixRE.test(pr.title) && createdAt <= windowEnd;
});

if (hits.length > 0) {
  return Functions.encodeString('SLASH:' + stakeId + ':' + hits[0].user.login);
}
return Functions.encodeString('CLEAN:' + stakeId);`,
      },
      { kind: "heading", title: "Automation Upkeep Contract" },
      {
        kind: "code",
        lang: "solidity",
        body: `function checkUpkeep(bytes calldata) external view returns (bool, bytes memory) {
    bytes32[] memory due = getStakesDueCheck();
    return (due.length > 0, abi.encode(due));
}

function performUpkeep(bytes calldata performData) external onlyForwarder {
    bytes32[] memory stakeIds = abi.decode(performData, (bytes32[]));
    for (uint i = 0; i < stakeIds.length; i++) {
        _sendFunctionsRequest(stakeIds[i]);
    }
}

function fulfillRequest(bytes32, bytes memory response, bytes memory) internal override {
    string memory result = string(response);
    if (startsWith(result, 'SLASH:')) {
        (bytes32 stakeId, address reporter) = parseSlash(result);
        gitLedger.slashReview(stakeId, reporter);
    } else if (startsWith(result, 'CLEAN:')) {
        gitLedger.releaseYield(parseClean(result));
    }
}`,
      },
    ],
  },
  {
    id: "db",
    label: "09 — Database Schema",
    tagline: "Drizzle + TimescaleDB",
    blocks: [
      {
        kind: "code",
        lang: "ts",
        body: `// src/db/schema.ts
export const repos = pgTable('repos', {
  id:           uuid('id').primaryKey().defaultRandom(),
  slug:         text('slug').unique().notNull(),
  ghInstallId:  bigint('gh_install_id', { mode: 'number' }),
  minStakeUsdc: integer('min_stake_usdc').default(10_000_000),
  stakeEnabled: boolean('stake_enabled').default(true),
  installedAt:  timestamp('installed_at').defaultNow(),
});

export const reviewers = pgTable('reviewers', {
  address:          text('address').primaryKey(),
  basename:         text('basename').unique(),
  githubLogin:      text('github_login').unique(),
  reputationScore:  integer('reputation_score').default(500),
  totalStakedUsdc:  numeric('total_staked_usdc').default('0'),
  totalYieldUsdc:   numeric('total_yield_usdc').default('0'),
  totalSlashedUsdc: numeric('total_slashed_usdc').default('0'),
  cleanCount:       integer('clean_count').default(0),
  slashCount:       integer('slash_count').default(0),
  languages:        text('languages').array(),
  lastActiveAt:     timestamp('last_active_at'),
  createdAt:        timestamp('created_at').defaultNow(),
});

export const stakes = pgTable('stakes', {
  id:              uuid('id').primaryKey().defaultRandom(),
  stakeId:         text('stake_id').unique().notNull(),
  reviewerAddr:    text('reviewer_addr').notNull(),
  repoId:          uuid('repo_id').references(() => repos.id),
  prId:            integer('pr_id').notNull(),
  prTitle:         text('pr_title'),
  amountUsdc:      integer('amount_usdc').notNull(),
  state:           text('state').default('active'),
  attestationUid:  text('attestation_uid'),
  txHashStake:     text('tx_hash_stake'),
  txHashResolve:   text('tx_hash_resolve'),
  yieldEarned:     integer('yield_earned').default(0),
  windowEndsAt:    timestamp('window_ends_at'),
  stakedAt:        timestamp('staked_at').defaultNow(),
  resolvedAt:      timestamp('resolved_at'),
});

// TimescaleDB hypertable
// SELECT create_hypertable('attestation_events', 'time');
export const attestationEvents = pgTable('attestation_events', {
  time:           timestamp('time').defaultNow(),
  reviewerAddr:   text('reviewer_addr'),
  repoSlug:       text('repo_slug'),
  prId:           integer('pr_id'),
  eventType:      text('event_type'),
  amountUsdc:     integer('amount_usdc'),
  attestationUid: text('attestation_uid'),
  txHash:         text('tx_hash'),
});`,
      },
    ],
  },
  {
    id: "github-app",
    label: "10 — GitHub App Spec",
    tagline: "Octokit + Webhook",
    blocks: [
      {
        kind: "kv",
        rows: [
          ["App Name", "GitLedger — Staked Code Reviews"],
          ["Permissions", "pull_requests: read, issues: read, metadata: read"],
          ["Webhook Events", "pull_request_review, pull_request (merged), installation"],
          ["Install Flow", "OAuth → repo select → min-stake config → enable. Stores install ID in DB."],
          ["Review Hook", "On approved → queue stake-prompt → notify reviewer via browser notification"],
          ["Merge Hook", "On PR merged → register Chainlink upkeep for the stakeId"],
          ["Bot Comment", "Posts to approved PR: GitLedger: stake $X USDC to back this review [Stake Now]"],
          ["Slash Comment", "On slash: bot comments: Slash triggered — reviewer staked $X, $Y paid to reporter"],
        ],
      },
    ],
  },
  {
    id: "roadmap",
    label: "11 — Sprint Roadmap",
    tagline: "6-Week Delivery",
    blocks: [
      {
        kind: "table",
        headers: ["Sprint", "Days", "Focus", "Description"],
        rows: [
          ["Sprint 1", "1–3", "Chain Foundation", "GitLedger.sol + EAS schema on Base Sepolia. Slash/yield flow. Chainlink Function script. Viem client."],
          ["Sprint 2", "4–6", "GitHub App", "GitHub App registration. Webhook handler for pull_request_review. Bot comment system. Install flow + repo config DB."],
          ["Sprint 3", "7–9", "Stake Flow", "Coinbase Agentic Wallet + CDP integration. Stake UI. USDC transfer. EAS attestation mint. Session keys."],
          ["Sprint 4", "10–12", "Oracle Integration", "Chainlink Automation upkeep deploy. performUpkeep + fulfillRequest. Slash/yield trigger. End-to-end testnet test."],
          ["Sprint 5", "13–15", "Frontend", "Next.js: Landing, Reviewer Profile, Dashboard, StakeFlow, Leaderboard. OnchainKit Identity + Transaction."],
          ["Sprint 6", "16–18", "x402 + Launch", "x402 paywall middleware on /api/reviewer. Reputation monetization. Security audit. Base Mainnet deploy."],
        ],
      },
    ],
  },
  {
    id: "monetization",
    label: "12 — Monetization",
    tagline: "Revenue Model",
    blocks: [
      {
        kind: "kv",
        rows: [
          ["Repo Subscriptions", "$29/mo Starter, $79/mo Pro, $299/mo Enterprise. Funds treasury yield pool."],
          ["x402 Query Revenue", "0.001 USDC per reputation query. No API key. Paid by hiring tools, agents, protocols."],
          ["Slash Protocol Fee", "30% of every slashed stake retained in treasury. Substantial at scale."],
          ["Premium Features", "Custom oracle windows, multi-reviewer staking pools, private repo support."],
          ["LEDGER Token", "Future: governance + 2x yield multiplier. Distributed to early stakers."],
        ],
      },
      { kind: "heading", title: "Revenue Projection — Year 1" },
      {
        kind: "table",
        headers: ["Metric", "Q1", "Q2", "Q3", "Q4"],
        rows: [
          ["Repos installed", "500", "2,000", "6,000", "14,000"],
          ["Reviews staked/day", "80", "350", "1,200", "3,000"],
          ["Avg stake (USDC)", "$45", "$60", "$80", "$100"],
          ["Slash rate", "8%", "7%", "6%", "5.5%"],
          ["Repo subscriptions", "$14.5K", "$58K", "$174K", "$406K"],
          ["x402 query revenue", "$200", "$1.5K", "$6K", "$18K"],
          ["Slash fees (30%)", "$300", "$1.7K", "$7.7K", "$22K"],
          ["TOTAL MONTHLY", "~$15K", "~$61K", "~$188K", "~$446K"],
        ],
      },
    ],
  },
  {
    id: "infra",
    label: "13 — Environment & Infra",
    tagline: "Secrets + Deployment",
    blocks: [
      { kind: "heading", title: "Environment Variables" },
      {
        kind: "code",
        lang: "env",
        body: `# CHAIN
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC=https://sepolia.base.org
GITLEDGER_DEPLOYER_PK=0x...
GITLEDGER_CONTRACT=0x...
EAS_CONTRACT_BASE=0x4200000000000000000000000000000000000021
EAS_SCHEMA_UID=0x...

# COINBASE CDP
CDP_API_KEY_NAME=...
CDP_API_KEY_PRIVATE_KEY=...

# CHAINLINK
CL_FUNCTIONS_ROUTER=0xf9B8fc078197181C841c296C876945aaa425B278
CL_FUNCTIONS_SUBSCRIPTION_ID=...
CL_DON_ID=fun-base-mainnet-1
CL_AUTOMATION_REGISTRY=0x...
CL_GITHUB_TOKEN_SECRET=...

# GITHUB APP
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA...
GITHUB_WEBHOOK_SECRET=...

# DATABASE
DATABASE_URL=postgresql://gitledger:...@db:5432/gitledger
REDIS_URL=redis://cache:6379

# SERVICES
NEXT_PUBLIC_DYNAMIC_ENV_ID=...
NEXT_PUBLIC_GITLEDGER_CONTRACT=0x...
X402_TREASURY_ADDRESS=0x...`,
      },
      { kind: "heading", title: "Deployment Stack" },
      {
        kind: "kv",
        rows: [
          ["Frontend", "Vercel — Next.js 14, edge runtime for x402 routes, preview deploys on PR"],
          ["Backend", "Railway — Bun process, auto-scale, TimescaleDB (Postgres 16) + Redis add-ons"],
          ["Contracts", "Foundry + forge deploy to Base Sepolia then Mainnet. Verified on Basescan. 2/3 multisig owner."],
          ["Chainlink", "Functions subscription on Base mainnet. Automation upkeep via registry. DON: fun-base-mainnet-1."],
          ["CI/CD", "GitHub Actions: forge test + lint + deploy contracts + deploy API + deploy frontend. Under 10 min."],
          ["Monitor", "Sentry errors, Datadog APM, Basescan event alerts for slashes, Chainlink upkeep health dashboard."],
        ],
      },
    ],
  },
];

function CodeBlock({ body, lang }: { body: string; lang?: string }) {
  return (
    <div className="border border-white/08 bg-black/40 my-4 overflow-hidden">
      {lang && (
        <div className="px-4 py-2 border-b border-white/06 flex items-center justify-between">
          <span className="text-[9px] font-mono tracking-[0.24em] text-white/30 uppercase">
            {lang}
          </span>
          <span className="text-[9px] font-mono tracking-[0.2em] text-emerald-400/60 uppercase">
            source
          </span>
        </div>
      )}
      <pre className="px-4 py-4 overflow-x-auto text-[12.5px] leading-[1.65] text-white/65 font-mono">
        <code>{body}</code>
      </pre>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="border border-white/08 my-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/06 bg-white/[0.02]">
            {headers.map((h) => (
              <th
                key={h}
                className="text-[9px] font-mono tracking-[0.22em] text-white/35 uppercase px-4 py-3 align-top"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/06 last:border-b-0 hover:bg-white/[0.015] transition-colors"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="text-[13px] text-white/55 font-light px-4 py-3 align-top leading-[1.6]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KVTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="border border-white/08 my-4">
      <table className="w-full text-left">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr
              key={i}
              className="border-b border-white/06 last:border-b-0 hover:bg-white/[0.015] transition-colors"
            >
              <td className="text-[11px] font-mono tracking-[0.12em] text-white/70 uppercase px-4 py-3 align-top w-[36%] sm:w-[28%] border-r border-white/06">
                {k}
              </td>
              <td className="text-[13px] text-white/55 font-light px-4 py-3 align-top leading-[1.65]">
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: Block, i: number) {
  switch (block.kind) {
    case "text":
      return (
        <p
          key={i}
          className="text-white/55 text-[15px] leading-[1.8] font-light whitespace-pre-line"
        >
          {block.body}
        </p>
      );
    case "heading":
      return (
        <h3
          key={i}
          className="text-emerald-400/80 text-[12px] font-mono tracking-[0.22em] uppercase mt-8 mb-3"
        >
          {block.title}
        </h3>
      );
    case "table":
      return <DataTable key={i} headers={block.headers} rows={block.rows} />;
    case "kv":
      return <KVTable key={i} rows={block.rows} />;
    case "code":
      return <CodeBlock key={i} body={block.body} lang={block.lang} />;
  }
}

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="print-hide border-b border-white/06 px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <LogoMark size={28} />
          <span className="font-mono font-bold tracking-[0.14em] text-sm text-white/80 uppercase">
            GitLedger
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] uppercase bg-emerald-500 text-black hover:bg-emerald-400 transition-colors px-4 py-2 font-bold shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]"
            aria-label="Download whitepaper as PDF"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 1.5v9m0 0L4.5 7m3.5 3.5L11.5 7M2 13.5h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
          <Link
            href="/roadmap"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono tracking-[0.2em] text-white/30 uppercase hover:text-white/60 transition-colors"
          >
            Roadmap ↗
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase mb-4">
            Build Document · v0.1-ALPHA · May 2026
          </p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.02] mb-6">
            GitLedger<br />
            <span className="text-white/25 font-light italic">Protocol Overview</span>
          </h1>
          <p className="text-white/35 text-lg font-light leading-relaxed max-w-xl">
            Your review has skin in the game. Staked, on-chain code review accountability on Base L2.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              "BASE L2",
              "EAS ATTESTATIONS",
              "x402 PROTOCOL",
              "CHAINLINK FUNCTIONS",
            ].map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase px-2.5 py-1 border border-white/08"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Table of contents */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="border border-white/08 p-6 mb-16"
        >
          <p className="text-[10px] font-mono tracking-[0.24em] text-white/30 uppercase mb-4">
            Contents
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-white/40 text-sm font-light hover:text-white/75 transition-colors flex items-baseline gap-2"
                >
                  <span>{s.label}</span>
                  {s.tagline && (
                    <span className="text-white/20 text-[10px] font-mono tracking-wide uppercase">
                      · {s.tagline}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Sections */}
        <div className="flex flex-col gap-20">
          {SECTIONS.map((section, i) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.05 + Math.min(i, 4) * 0.05 }}
              className="scroll-mt-24"
            >
              <div className="hr mb-6" />
              <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
                <h2 className="text-[11px] font-mono tracking-[0.26em] text-white/45 uppercase">
                  {section.label}
                </h2>
                {section.tagline && (
                  <span className="text-[9px] font-mono tracking-[0.24em] text-emerald-400/50 uppercase">
                    {section.tagline}
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                {section.blocks.map((b, j) => renderBlock(b, j))}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-24 pt-8 border-t border-white/06 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-white/18 text-xs font-mono tracking-wide">
            © 2026 GitLedger · Build Document v0.1-ALPHA · Internal · Subject to change
          </p>
          <Link
            href="/roadmap"
            target="_blank"
            rel="noopener noreferrer"
            className="print-hide text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase hover:text-white/50 transition-colors"
          >
            View Roadmap ↗
          </Link>
        </div>
      </div>
    </main>
  );
}
