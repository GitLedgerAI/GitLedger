// scripts/oracle.ts — one-shot CLI runner.
// `bun src/scripts/oracle.ts` resolves all due stakes once and exits.
// For continuous background resolution see the setInterval scheduler in index.ts.

import { resolveDueStakes } from '../services/oracleResolver';

const result = await resolveDueStakes();
console.info('[oracle:cli] done', result);
process.exit(0);
