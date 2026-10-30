# Marketing Studio

AI-assisted content operations platform for discovering topics, generating brand-aware content, reviewing and revising drafts with humans in the loop, and publishing approved content to social channels.

## Product principles

- Human approval is required before any content can be published.
- Every generated draft retains links to its source material.
- Each organization is isolated from every other organization.
- Content revisions, review decisions, and publishing attempts are auditable.
- AI providers are accessed through a replaceable server-side adapter.

## Initial product scope

### Release 1 — Content intelligence and creation
1. Multi-tenant workspace foundation and roles.
2. Brand profiles and editorial guidelines.
3. RSS/blog/news ingestion and source attribution.
4. Article normalization, deduplication, and topic discovery.
5. AI-assisted content briefs and platform-specific drafts.

### Release 2 — Human review and publishing
1. Rich-text editorial workspace with inline AI assistance.
2. Comments, assignments, change requests, and version history.
3. Configurable approval workflows and immutable audit events.
4. LinkedIn account connection, scheduling, and publishing status.

### Release 3 — Marketing operations
1. Editorial calendar and campaigns.
2. Additional social platform integrations.
3. Performance analytics and recommendations.

## Proposed technology

- Next.js + TypeScript for the web application.
- PostgreSQL (Neon) + Prisma for persistence.
- Server-side AI provider adapter (OpenAI first; other providers optional).
- RSS/Atom parser and one licensed news/search API.
- Background queue and scheduled jobs for ingestion and publishing.
- TipTap or Lexical for the editorial experience.
- Cloudflare services where appropriate for deployment, queues, and object storage.

## Architecture boundaries

- **Discovery:** fetch, normalize, deduplicate, and score source material.
- **Brand context:** store organization-specific voice, audience, terminology, and restrictions.
- **AI gateway:** prompt templates, provider adapters, schema validation, usage/cost logging.
- **Editorial workflow:** drafts, versions, comments, review assignments, approvals, audit events.
- **Publishing:** authorized platform connections, scheduling, idempotency, retries, and result tracking.
- **Analytics:** persist only metrics available through the connected platform APIs.

## Non-negotiable safeguards

- AI cannot approve or publish content.
- Only authorized users can approve or publish.
- All organization-owned records must be tenant-scoped and authorization-checked.
- Never expose provider or social-platform secrets to the browser.
- Publishing retries must be idempotent and must account for uncertain prior outcomes.
- AI quality scores are advisory, not proof of factual accuracy.
- Treat source webpages and uploaded documents as untrusted input.

## Development approach

Build and test one vertical slice at a time. Start with the application foundation and workspace/brand configuration, then add discovery, generation, review, and publishing. Do not add advanced agents or multiple model vendors until the basic workflow is reliable.

## Local development

The application scaffold and exact setup commands will be added with the first implementation commit.
