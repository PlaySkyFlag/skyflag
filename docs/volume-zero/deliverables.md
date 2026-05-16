# Issue One — art deliverables

Art direction: **cinematic, page-based, dark-fantasy / industrial
sci-fi.** Proper comic-book pages — **not** vertical-scroll webtoon.
The web reader (`VolumeZeroReader.tsx`) is page-based by design.

## Export folders

### 01_Web_Reader
One JPG or PNG per page, 1600–2200 px wide, reasonable file size.
Naming (drives the reader once added to `src/volumeZeroPages.ts`):

```
TH_VolumeZero_00_Cover.jpg
TH_VolumeZero_01.jpg
TH_VolumeZero_02.jpg
…
TH_VolumeZero_16_Backmatter.jpg
TH_VolumeZero_17_BackCover.jpg
```

Place in `public/volume-zero/`. The backmatter page must carry the
in-comic CTAs: **"Play Skyflag at playskyflag.com"** and **"Join the
Kickstarter list."** Then add one `{ src, alt, kind }` entry per page
to `VOLUME_ZERO_PAGES` in reading order (`kind`: cover / page /
backmatter / backcover). The reader renders only what's listed —
release the first batch free, add the rest later.

### 02_PDF_Digital
One full PDF, RGB, compressed but sharp. For the download button +
email-list capture. Put at `public/volume-zero/` and set
`VOLUME_ZERO_PDF`.

### 03_Print_Master
High-res PDF, 300 DPI, full bleed, CMYK / printer-preferred profile.
Kept **separate** from the online version. Not committed to the web
repo — store with print production.

### 04_Metadata
See `metadata.md` in this folder.

## Lock before generating final pages

Per the AI-comic guidance, lock the visual style and character
references first. Common failure points to guard against:

- **Character drift** — same face/build/wardrobe across every page.
- **Colour drift** — fixed clan palettes (Grey Ravens vs White Stags),
  consistent lighting.
- **Glyph inconsistency** — Thresan sigils, the 3phor mark, board
  glyphs identical wherever they appear.
- **Resolution** — generate above final size; never upscale a weak
  source.

Issue One as published: cover + credits/indicia + 5 story pages +
back cover (8 leaves total), rendered to public/volume-zero/.
"A graphic prequel to the Thresan strategy game."
