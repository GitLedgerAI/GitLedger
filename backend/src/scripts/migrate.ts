import { runMigrations } from '../db/migrate';

await runMigrations();
console.info('[db] migrations complete');
