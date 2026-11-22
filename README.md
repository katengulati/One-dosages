# Peptide Dosages local replica

This worktree of `katengulati/One-dosages` serves the original public page paths, copy, layouts, and browser tools captured from peptidedosages.com on November 21, 2026. The existing bilingual site remains available under `/en/` and `/es/`.

```sh
npm ci
npm run dev
```

Open http://localhost:4321/. To run the production build locally, use `npm run build` followed by `npm run start`. Both launch commands bind to loopback.

| Where | What it contains |
| --- | --- |
| `site/replica/` | 276 captured page documents organized by original URL |
| `public/wp-content/` | Styles, images, and page interaction scripts |
| `public/preview/` | Simulator and Explorer documents and local form handler |
| `public/data/` | Search suggestions and simulator presets |
| `src/app/` | Next.js routes for the replica, bilingual pages, and preview forms |
| `search-template.html` and `search-corpus.json` | Preview search results layout and index |
| `capture.json` and `verification.json` | Page inventory and verification results |

The public replica uses a local search index and local test submissions for contact and newsletter forms. Test submissions stay in `.preview-data/`. Sign-in, registration, and the three Break Room games use the live service. Feed and reference links also point to their original destinations. A complete standalone migration of the WordPress services would require the site's backend source and configuration.

The bilingual pages use the repository's existing `site/manifest.json`, `site/en/`, `site/es/`, `translations/`, and `scripts/clone/` files. The path without a language prefix serves the original public replica.
