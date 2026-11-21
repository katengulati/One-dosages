# One Dosages

A Next.js site in **English and Spanish**.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

## Languages

- Every page exists at `/en/...` and `/es/...`. Spanish pages can have Spanish slugs, e.g. `/en/calculator/` ↔ `/es/calculadora/`.
- Visiting `/` sends people to their saved language (the `NEXT_LOCALE` cookie), otherwise to their browser language, otherwise English (`src/middleware.ts`).
- The language switcher in the header goes to the same page in the other language and remembers the choice.
- Each page outputs `canonical` and `hreflang` links. Set `NEXT_PUBLIC_SITE_URL` to the production domain.
- If a page has no Spanish version yet, `/es/` shows the English text with a notice.

| What | Where |
| --- | --- |
| Language list, default language | `src/i18n/config.ts` |
| Interface text (menus, calculator, footer) | `src/i18n/dictionaries/en.json`, `es.json`. The build fails if `es.json` is missing a key. |
| Built-in page slugs (calculator, dosages, blog) | `builtinRoutes` in `src/lib/content.ts` |
| Page content | `content/en/<key>.json`, `content/es/<key>.json` |

## Content files

```json
{
  "key": "disclaimer",
  "slug": "aviso-legal",
  "type": "page",
  "title": "Aviso legal",
  "description": "…",
  "html": "<p>…</p>"
}
```

`key` is the same in both languages and links the two versions. `slug` is the URL for that language.

## Importing the WordPress site

1. In WordPress admin go to **Tools → Export → All content** and save the `.xml` file in `wordpress-export/`. That folder is git-ignored.
2. Run `npm run import:wordpress -- wordpress-export/<file>.xml`. This writes `content/en/*.json` with the original URL paths.
3. Copy `wp-content/uploads/` into `public/wp-content/uploads/` so images load.
4. Run `npm run i18n:status` to list pages that still need a Spanish file in `content/es/`.
5. To make the design match the original, port the theme's CSS from `wp-content/themes/<theme>/` into `src/app/globals.css`.
