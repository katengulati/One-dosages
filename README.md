# Peptide Dosages with the One Aminos design

This worktree of `katengulati/One-dosages` uses the One Aminos design system for the public pages and browser tools captured from peptidedosages.com on November 21, 2026. The original page paths and editorial content are retained. The existing bilingual site remains available under `/en/` and `/es/`.

```sh
npm ci
npm run dev
```

Open http://localhost:4322/. To run the production build locally, use `npm run build` followed by `npm run start`. Both launch commands bind to loopback. Read `DESIGN.md` for the storefront measurements, tokens, page patterns, and file map. The archived baseline is tagged `peptidedosages-baseline-2026-11-21` and runs on http://localhost:4321/ as a macOS user LaunchAgent.

| Where | What it contains |
| --- | --- |
| `site/replica/` | 276 captured page documents organized by original URL |
| `public/wp-content/` | Styles, images, and page interaction scripts |
| `public/one-aminos/` | Shared styles, wordmark, article covers and reconstitution video |
| `public/data/` | Search suggestions |
| `src/app/` | Next.js routes for the replica, bilingual pages, and preview forms |
| `search-template.html` and `search-corpus.json` | Preview search results layout and index |
| `capture.json` and `verification.json` | Page inventory and verification results |

The public replica uses a local search index and local test submissions for contact and newsletter forms. Test submissions stay in `.preview-data/`. Sign-in and registration use the live service. Feed and reference links also point to their original destinations. A complete standalone migration of the WordPress services would require the site's backend source and configuration.

The bilingual pages use the repository's existing `site/manifest.json`, `site/en/`, `site/es/`, `translations/`, and `scripts/clone/` files. The path without a language prefix serves the original public replica.
