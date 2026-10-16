import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const now = new Date();
const report = `# Dragon Ball Clash Action TCG - Release Candidate Report

Generated: ${now.toISOString()}
Version: ${pkg.version || 'unknown'}

## Automated gates

Run:

\`\`\`powershell
npm run rc:check
\`\`\`

Expected automated baseline:

- Core: 7 PASS
- Content: 24 PASS
- Account: 16 PASS
- Multiplayer: 16 PASS
- Raid: 18 PASS
- Social modes: 18 PASS
- Polish: 24 PASS
- Static audit: 0 blockers
- RC verify: 0 FAIL

Total regression tests before RC verify: 123.

## RC acceptance rule

RC1 can be promoted to stable only when:

1. \`npm run rc:check\` is green.
2. Every P0/P1 smoke case in \`RELEASE_CANDIDATE_SMOKE_TESTS.md\` passes.
3. Production environment variables are configured.
4. No console error appears during the main user journeys.
5. No state desync, duplicate reward, duplicate ranked result, lost deck, or reconnect failure is observed.
6. There are zero known release blockers.

## Freeze rule

During RC:
- no new features;
- no balance redesign unless it fixes a release blocker;
- no schema change unless required by a blocker;
- every fix must add or update a regression test.

## Production variables

\`\`\`
NODE_ENV=production
MONGODB_URI=<MongoDB Atlas URI>
AUTH_SECRET=<32+ random characters>
CLIENT_URL=https://<frontend-host>
\`\`\`

Use \`ALLOWED_ORIGINS\` for multiple frontends.
`;

fs.writeFileSync(path.join(root, 'RELEASE_CANDIDATE_REPORT.md'), report, 'utf8');
console.log('PASS RELEASE_CANDIDATE_REPORT.md generated');
