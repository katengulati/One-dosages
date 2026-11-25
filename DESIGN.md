# One Aminos design for Peptide Dosages

November 21, 2026. This specification describes how the Peptide Dosages replica adopts the visual language of One Aminos. It covers the English source routes and the repository's explicit English and Spanish routes.

## References and scope

| Reference | Observed pattern | Application |
| --- | --- | --- |
| [One Aminos home](https://oneaminos.com/) | White masthead, left wordmark, centered navigation, silver announcement band, centered vial and headline, wide silver primary button | Research masthead, center composition, one emphasized action |
| [One Aminos catalog](https://oneaminos.com/shop) | Centered 48 px title, pill rail, four square cards, black image frames, 28 px horizontal spacing | Protocol directories, blog lists, category and search filters |
| [One Aminos product page](https://oneaminos.com/products/retatrutide) | Clean white canvas, strong center title, restrained metric chips, thin borders, wide primary action | Protocol introductions, quick-reference numbers, calculator controls and results |
| Claude's local One Aminos library design | Helvetica Neue, calm reading layouts, silver cards, 18 px phone gutters, one coherent button hierarchy | Educational shell and article, guide and tool components |

The live visual reference was reviewed at 1280 px. Its masthead begins with a 34 px silver band and a white navigation row. The shop uses about 70 px of side gutters at that width. The product page pairs a large square image with a control panel. The educational version scales those rules to dense tables and longer titles. It uses the existing Peptide Dosages wording, links, protocol values and tool workflows. Its persistent comparison baseline is the Git tag `peptidedosages-baseline-2026-11-21` on localhost port 4321.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--oa-paper` | `#fff` | Page, cards and text inputs |
| `--oa-ink` | `#0a0a0a` | Headlines, icons, focused controls and primary borders |
| `--oa-secondary` | `#505050` | Reading copy and descriptions |
| `--oa-muted` | `#6b6b6b` | Dates, explanations, hints and secondary labels |
| `--oa-soft` | `#f2f2f4` | Quiet panels, inactive rows and result groupings |
| `--oa-silver` | `#d6d6dc` | Primary buttons, active tabs, callouts and the footer |
| `--oa-line` | `rgb(0 0 0 / 18%)` | Hairlines, table rules and input edges |
| `--oa-width` | `1248px` | Outer content maximum |
| `--oa-reading` | `740px` | Single-column reading measure |
| `--oa-gutter` | `34px` desktop, `18px` phone | Repeat on content and page chrome |

Clinical warnings use an outlined or soft surface, an explicit heading and text. Calculator errors retain meaningful labels and visible state cues. Color cannot be the only indicator.

### Type

Use Helvetica Neue, Helvetica, Arial, sans-serif. Display headings use weight 700, about −0.05 em letter spacing and 1.03 line height. The main title scales from 36 px to 56 px. Major headings scale from 30 px to 46 px, card headings from 18 px to 22 px, and editorial text from 16 px to 18 px. Limit line lengths instead of reducing body size. Numeric outputs use tabular figures where supported. Nav labels are uppercase on desktop, with letter spacing close to neutral.

### Geometry and spacing

- Desktop content uses a 1248 px container with 34 px gutters. Phone gutters are 18 px.
- Use 8 px corners for buttons and inputs, 12–16 px for grouped content and a full pill radius for tabs and strengths.
- Product-style image frames use a 2 px ink outline and square corners. Editorial images can remain wide when the image carries the subject.
- Use 16–24 px within a card, 20–28 px between grid cells and 54–78 px between major page sections. Phone sections tighten to 42–54 px.
- Hairlines establish hierarchy across the header, footer, dense lists and tables. Shadows belong to floating menus and dialogs.
- Body and title copy stays centered at introductions. Long text, tables and editable forms follow the alignment that makes the information easiest to scan.

## Shared shell

The masthead shows the One Aminos wordmark. A silver research-use bar establishes the purpose. The navigation exposes single peptides, blends, the blog and tools. Guides & Tools opens as one compact column. The menu can scroll independently on phones and the bottom shortcut bar stays legible within safe-area insets.

The footer uses the storefront’s silver background and black text. The One Aminos wordmark and newsletter share the first column, followed by Protocols, Learn, and Company. A thin rule separates the copyright and policy links. The footer link groups become accordions on phones. Page-level Google and Share controls are removed.

## Page patterns

### Home

Center the headline above one Browse Protocols link. The silver action has a traveling ink outline and 18 px type on desktop, 17 px on phones. Follow it with six static article cards in a three-column desktop grid and a two-column phone grid. The first card links to the beginner’s guide. Use monochrome editorial still lifes made with One Aminos vial photography, presented in 8:5 frames above HTML titles. Featured protocols, the reconstitution demo, chart guide, calculator, and FAQ follow the article grid.

The featured row starts with Retatrutide (GLP3-RT), Tirzepatide (GLP2-TZ), and BPC-157 + TB-500 (Wolverine). Each compound name is grouped with its research guide topic, and vial-size links line up across the row. Use the same gray surface and button height throughout the grid.

### Protocol directories and search

Center each directory heading and put the type controls above the grid. The cards use a light gray surface and matching One Aminos storefront photos. Put Lipo C in the alphabetical list with the two catalog formulations. Tabs and strength choices use clear selected styling independent of hover.

### Protocol detail and dosage chart

Center the product reference title, quick links and vial choices on flat light gray. Omit the eyebrow, byline, dates and introductory paragraph in these headers. Present vial-level evidence and numbers in their existing order. Use quiet metrics, clearly differentiated headings and contained chart regions. The master chart keeps its filter controls, protocol types and precision in hits. Tool tables scroll inside their own region at narrow widths to keep all columns available.

### Articles and guides

Center the title and lead with a controlled maximum width, followed by the original article body. Preserve citations, callouts, figures, table of contents, author and dates. Use ink links with underlines in reading copy and a neutral background for informational cards. Native disclosure elements retain their expand/collapse states. Constrain illustrations to their content column.

The six homepage guides and articles use a centered reading column with gray panels and black type. The navigation appears as gray links directly under the title. The Beginner’s Guide uses five short sections and a diagram of an amino-acid chain. The other featured pages show four summary cards in a row on desktop, wrapping on smaller screens. The full reference and citations follow immediately and stay open.

The blog index brings the active articles together under a centered heading. Use matching storefront photos for product covers, monochrome One Aminos art for other covers, and a gray wordmark treatment for supporting diagrams.

### Calculator and reconstitution demo

Separate calculator inputs and outputs. Inputs are white, selected choices are silver with an ink outline, and result areas use a soft gray surface. Keep numerical precision, print and share controls, and explicit error states.

The homepage and legacy reconstitution URLs run the original nine-stage bench animation with One Aminos vial labels. The player pairs a product photograph with nine illustrated chapters, synchronized captions, a seek bar, a speed selector, and English and Spanish MP4 downloads. The chapter list sits beside the film on desktop and below the controls on phones. Reduced motion requires explicit playback. Protocol sections link to the demo. Explorer and game destinations are retired. The footer shows the One Aminos wordmark.


## Interaction and responsive acceptance

- The hero button and current vial strength use the moving outline. The outline holds still with reduced motion.
- Use 44 px targets for the main touch controls. Provide an obvious keyboard focus ring and preserve focus within the existing menu or dialog.
- At 1280 px the frame follows the desktop header and card rhythm. At 390 px navigation collapses, titles wrap, inputs stay readable and only table regions scroll horizontally.
- Compare the home, directory, a protocol, a blog article, the master chart, calculator and reconstitution demo with the baseline. Content parity means page text, protocol links, forms and numeric behavior remain present.
- Check home and inner pages in both language variants. The original unprefixed routes remain the default during this project.

## Implementation map

`public/one-aminos/design.css` defines the shell, typographic scale, controls and layout rules. Branded homepage covers are in `public/one-aminos/article-covers/`. `src/lib/one-aminos-design.ts` adds the common presentation to captured HTML and the two existing localization routes. `src/lib/learning-features.ts` updates the featured copy, chart guide, demo sections, navigation, and retired routes. Search and calculator code retain their existing behavior.
