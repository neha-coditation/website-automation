# Marketing Studio

Multi-tenant content operations SaaS for discovering useful stories, creating brand-aware content, human review, and approved social publishing.

## Five-phase delivery scope

1. **Foundation:** Google sign-in, tenant-scoped workspaces, workspace switching, invitations, role checks, and brand profiles.
2. **Discovery:** secure RSS/Atom fetching, NewsAPI search, URL normalization, tenant-scoped deduplication, saved/dismissed article states, and scheduled discovery.
3. **AI Content Studio:** server-side OpenAI adapter, source-attributed drafts, brand voice, rewriting, rich-text editing, and immutable draft versions.
4. **Review Studio:** assignments, comments, change requests, explicit reviewer approval, and audit events.
5. **Social Publishing:** LinkedIn member-account OAuth, encrypted credentials, approved-only scheduling, publishing queue, attempt history, cancellation, manual retry, and scheduled worker triggers.

## Product safeguards

- AI never approves or publishes content.
- A scheduled post must have a recorded human approval event.
- Every API read/write is scoped to the authenticated user's organization membership.
- Client-supplied organization IDs are never trusted as authorization.
- Feed fetching validates DNS/IP destinations and every redirect to reduce SSRF risk.
- Rich-text HTML is sanitized on the server; unsafe tags and URL schemes are removed.
- Social tokens are encrypted with AES-256-GCM and never returned to the browser.
- Publishing retries are automatic only for an explicit LinkedIn HTTP 429 response. Network/5xx outcomes are treated as uncertain and require manual reconciliation to avoid duplicate posts.
- AI output is a draft, not a source of truth. Source material is treated as untrusted prompt input.

## Stack

- Next.js 15 / React 19 / TypeScript
- PostgreSQL (Neon) + Prisma 6
- NextAuth Google OAuth
- RSS/Atom parser + SSRF-safe fetcher
- NewsAPI.org adapter
- OpenAI Chat Completions adapter (server-side)
- TipTap rich-text editor
- LinkedIn OAuth 2.0 + Posts REST API adapter
- GitHub Actions scheduled triggers for RSS discovery and publishing

## Local setup

Requirements: Node.js 20.9+ and npm.

```bash
git clone https://github.com/neha-coditation/website-automation.git
cd website-automation
git switch feature/marketing-studio-phases-1-5
npm install
cp .env.example .env.local
```

Configure these server-side environment values in `.env.local`:

- `DATABASE_URL`: Neon PostgreSQL pooled connection string.
- `NEXTAUTH_URL` and `NEXTAUTH_SECRET`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth web application credentials; add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
- `OPENAI_API_KEY`: required only for AI generation/rewrite.
- `NEWS_API_KEY`: required only for NewsAPI search.
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI`: LinkedIn developer app credentials; add the callback URL to the LinkedIn app.
- `LINKEDIN_API_VERSION`: a currently supported LinkedIn API version in `YYYYMM` format.
- `SOCIAL_TOKEN_ENCRYPTION_KEY`: generate with `openssl rand -base64 32`.
- `CRON_SECRET`: generate a strong random secret, for example `openssl rand -hex 32`.

Then run:

```bash
npm run db:generate
npm run db:migrate -- --name marketing_studio_phases_1_5
npm run dev
```

Open http://localhost:3000. Sign in with Google. Your first workspace is provisioned after sign-in.

## Scheduled jobs

The GitHub Actions workflow `.github/workflows/marketing-studio-cron.yml` calls:

- `POST /api/cron/publish` every five minutes.
- `POST /api/cron/discovery` twice per hour.

After deploying the application, add these GitHub repository Actions secrets:

- `MARKETING_STUDIO_SITE_URL`: deployed application origin, without a trailing slash.
- `MARKETING_STUDIO_CRON_SECRET`: the same value as the server's `CRON_SECRET`.

Scheduled workflows run only after the workflow is merged into the repository's default branch. The jobs can also be started manually from GitHub Actions.

## Validation

```bash
npm test
npm run db:generate
npm run typecheck
npm run lint
npm run build
```

The automated checks run on pull requests. A successful build does not replace configuring Google, Neon, OpenAI, NewsAPI, LinkedIn, and the scheduled-job secrets.

## Current integration limits

- Initial social publishing supports LinkedIn member profiles with the `w_member_social` permission; organization-page publishing requires additional LinkedIn products/scopes and is not enabled here.
- LinkedIn token refresh is not implemented; reconnect an account when its access token expires.
- NewsAPI results are searched on demand; RSS/Atom sources are scheduled.
- No production database migration or third-party OAuth connection is performed by repository code alone.
- Analytics and multi-channel integrations remain outside this five-phase release scope.
