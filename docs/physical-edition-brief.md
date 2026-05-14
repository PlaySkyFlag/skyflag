# Thresan: Skyflag — Physical Edition Design Brief

**Status:** Draft v1 · 2026-05-12
**Target output:** Hobbyist-printable prototype (one-off for video footage, playtest, Founders bonus STL pack) — NOT manufactured fulfillment, which is a separate spec.

---

## 1. Vision

Three stacked 6×6 grids — Terran, Meridian, Empyrean — held in a round structural frame, four perimeter pillars rising through cutouts in the upper boards. The play surfaces are square (faithful to the digital game's mechanics); the outer rings are circular (clean grippable edge, supports kept clear of the corner cells where Flags live). When set on a table the object reads as an instrument: deliberate, weighted, worn-in by intent.

**Brand alignment.** This is the *prototype* expression of the same product the Founders renders (Layout C fan-spread, Layout D terrace tower) promise — manufactured premium with acrylic, brass, illuminated base. The 3D-printed prototype's job is to make the design *physical* before the tooling exists. Marketing video, BoardGameGeek photos, playtest, and a digital STL pack we can give Founders to print at home while the manufactured edition is in production.

---

## 2. Aesthetic — "monastery, not tech"

The Thresan voice (Origins, Story, all current copy) is contemplative, mythic, patient. The physical object should feel like an *artifact*, not a console accessory. Specific direction:

**Materials & finish:**
- **Body (boards, pillars, base):** matte black or charcoal PLA — Polymaker PolyTerra Charcoal Black, or Bambu Matte Black PLA. Sand lightly post-print to soften FDM layer lines; optional matte clear coat (Krylon Matte Finish) for a unified velvet finish.
- **Pieces, sigil, layer-name engravings:** metallic gold PLA — Bambu PLA Silk "Bronze" or Polymaker PolyLite PLA Galaxy Gold. Resin alternative (Anycubic Aqua Gray + gold paint mask) for the pieces gives a sharper edge if you have a resin printer.
- **No gloss anywhere.** Glossy reads as plastic-toy; matte reads as wood/stone/cast metal.

**Form language:**
- Crisp geometry, never rounded organic shapes. Beveled corners (1mm chamfer) on every visible edge — not sharp, not soft.
- Subtle weight through ballast: a **steel washer inset in the base of each piece** (M10 washer, ~4g) gives playing pieces a satisfying heft that costs $0.10 per piece. Trust me — this is the single biggest "premium" lever in any printed game.
- Embossed/debossed brand details rather than printed graphics. The Thresan sigil, the layer names, the seal markers — all geometric reliefs, not painted-on labels.

**Aesthetic references** to keep in mind:
- House of Staunton tournament chess sets (matte ebony with gold-leaf detail)
- Frostpunk physical edition (textured matte components, restrained color)
- Daniel Libeskind architectural models (monumental, clean, intentional negative space)
- Japanese minimalism — MUJI, Nendo — function-driven, monochrome, decoration only where it serves
- *Avoid* the visual register of: tech gadgets, neon RGB peripherals, plastic stadium-souvenir trophies, anything LED-lit (the manufactured edition gets light; the print does not)

---

## 3. Form factor

**Per-layer board (×3, identical perimeter; Sky board has pillar cutouts):**
- Outer disc: **240mm OD** × **5mm thick**, with a 1mm top chamfer
- Inner play grid: **6×6 cells, 28mm × 28mm each** = 168mm × 168mm play surface, centered
- Outer ring (radius ~36mm wide): outer rim hosts the engraved layer name in 8mm caps along the top arc — `TERRAN`, `MERIDIAN`, `EMPYREAN`. Bottom arc hosts a discreet Thresan sigil (12mm diameter, debossed 0.6mm).
- Cell grid: relief lines 0.4mm deep at 28mm spacing — not deep enough to catch pieces, deep enough to read from above.
- Sky board only: four **18mm-diameter cutouts** at cardinal positions (N/S/E/W on the ring, well outside the play grid) for the long pillars to pass through. The label "shaft holes in Sky visible" in your v6 render — same idea, executed cleanly.

**Pillars (×4):**
- 16mm diameter, **170mm long**, with 8mm stub tenons at top and bottom for socket fits in base and Space board
- Cardinal positions on the ring (N/S/E/W of the 240mm disc, so 12mm from outer edge)
- Pass *through* the Sky board cutouts (no contact with the Sky board surface; structural support comes from base + Space board only)

**Base (×1):**
- 220mm OD × 18mm thick, low-profile shallow dome
- 4 pillar sockets at cardinal positions, 8mm diameter × 10mm deep
- Top surface: Thresan sigil at center (40mm diameter, debossed 1.5mm) so it reads when peeking under the Ground board
- Bottom: hollow with structural ribs to save filament and add weight via insert (optional M3 steel weights)

**Vertical stack:**
- Base height 18mm → Ground board sits *on* base (its bottom face flush) → 80mm clearance → Sky board → 80mm clearance → Space board → top of Space at **~189mm above table**
- Tallest playing piece (Captain at 60mm) has 20mm clearance below the next board, plenty of finger room

---

## 4. Pieces

Per the rulebook **v20** (and v19.1 — unchanged across versions): **5 pieces per player**, one of each type. Total 10 player pieces across both clans (Captain, Soldier, Promoted Soldier Captain, Rover, Pilot — the Promoted Soldier Captain is a swap-in piece that enters play when a Soldier promotes at the far rank).

**Silhouettes — distinct enough to read at table distance:**
| Piece | Height | Form | Read |
|---|---|---|---|
| Captain | 60mm | Crowned spire — single tallest, ornate top relief | The leader |
| Pilot | 50mm | Swept aerodynamic profile, asymmetric — leans forward | Diagonal transit, ≤2 sq |
| Rover | 45mm | Lower wide-base body with banded cylinder — grounded | Orthogonal transit, ≤2 sq |
| Soldier | 40mm | Squat geometric body, simple cap | Forward-only mass, promotes |
| Promoted Soldier Captain | 55mm | Soldier base, Captain crown — clear "soldier who became captain" silhouette | Soldier that has promoted at the far rank |

Each piece is monochrome. **Player 1 (Grey Ravens) in slate gray PLA; Player 2 (White Stags) in ivory PLA.** Bottom of each piece has a 12mm × 2mm-deep recess for an M10 steel washer ballast.

**Confirmed count per side (per rulebook v20):**
- Captain ×1
- Soldier ×1
- Promoted Soldier Captain ×1 (swap-in piece — enters play when a Soldier promotes)
- Rover ×1
- Pilot ×1
- Total ×5 per side, **×10 across the game**

**Starting positions** (from rulebook v20, all pieces start in hand and deploy onto Ground):
- P1 Captain deploys at Ground(0,3)
- P2 Captain deploys at Ground(5,2)
- (Other pieces deploy onto adjacent cells per the deploy rules; no fixed setup beyond Captains)

---

## 5. Markers

**Engraved into the boards (non-moving, fixed positions per rulebook v20):**
- **Lifts (12 total) — same 4 cells on every layer:** (1,1), (1,4), (4,1), (4,4). Subtle gold relief ring, 22mm diameter, raised 0.8mm. Painted gold after print (or filament-swap at Z height if using AMS).
- **Nexus (Space board only, 1 total) at Space(3,3):** distinctive 6-point relief, slightly larger than Lift rings. Gold-painted after print.
- **Layer name on each board's outer ring:** `TERRAN`, `MERIDIAN`, `EMPYREAN`, 8mm caps, debossed.
- **Thresan sigil on each board's outer ring (opposite the layer name):** 12mm diameter, debossed 0.6mm.

**Tokens (separate printed parts that can be removed when captured):**
- **Flag tokens — 6 total, 3 per player.** Per rulebook v20:
  - P1 (Grey Ravens, slate): Ground(0,0), Sky(0,5), Space(0,0)
  - P2 (White Stags, ivory): Ground(5,5), Sky(5,0), Space(5,5)
  - Form: small geometric pennant token, ~15mm tall, sits in cell. Removable when captured (the visual "you've been seal-broken" feedback).
  - Color: matches player — 3 slate flag tokens, 3 ivory flag tokens.

**Clan glyphs** (decided per rulebook lore — Grey Ravens vs. White Stags):
- Player 1 pieces carry a small **raven** glyph debossed into the front face (5mm relief, 2mm depth)
- Player 2 pieces carry a small **stag** glyph in the same position
- Optional but recommended — it's the kind of detail that separates "boutique" from "generic chess analog"

---

## 6. Component manifest (total parts)

| Part | Qty | Material | Color | Notes |
|---|---|---|---|---|
| Ground board | 1 | PLA matte | Charcoal | Lifts + sigil + label engraved; gold-painted accents |
| Sky board | 1 | PLA matte | Charcoal | 4 pillar cutouts; Lifts + sigil + label engraved |
| Space board | 1 | PLA matte | Charcoal | Lifts + Nexus + sigil + label engraved; gold-painted |
| Pillar | 4 | PLA matte | Charcoal | 170mm long, 16mm OD, 8mm tenons |
| Base | 1 | PLA matte | Charcoal | Sigil deboss, pillar sockets |
| Captain (P1) | 1 | PLA matte | Slate | Steel washer ballast; raven glyph |
| Soldier (P1) | 1 | PLA matte | Slate | Steel washer ballast; raven glyph |
| Promoted Soldier Captain (P1) | 1 | PLA matte | Slate | Steel washer ballast; raven glyph + promotion mark |
| Rover (P1) | 1 | PLA matte | Slate | Steel washer ballast; raven glyph |
| Pilot (P1) | 1 | PLA matte | Slate | Steel washer ballast; raven glyph |
| Captain (P2) | 1 | PLA matte | Ivory | Steel washer ballast; stag glyph |
| Soldier (P2) | 1 | PLA matte | Ivory | Steel washer ballast; stag glyph |
| Promoted Soldier Captain (P2) | 1 | PLA matte | Ivory | Steel washer ballast; stag glyph + promotion mark |
| Rover (P2) | 1 | PLA matte | Ivory | Steel washer ballast; stag glyph |
| Pilot (P2) | 1 | PLA matte | Ivory | Steel washer ballast; stag glyph |
| Flag token (P1) | 3 | PLA matte | Slate | Pennant form, ~15mm tall |
| Flag token (P2) | 3 | PLA matte | Ivory | Pennant form, ~15mm tall |
| **Total parts:** | **24** | | | + 10 × M10 washers (hardware) |

**Build plate fit (Bambu A1 / Prusa MK4 / similar, 256×256mm):** Each board fits comfortably; one board per plate. Pillars print 4-up. All 5 P1 pieces + 3 P1 flag tokens fit on one plate (slate filament); same for P2 (ivory).

**Estimated total print time:** 14–18 hrs on a fast FDM (Bambu A1 0.2mm layers). Filament: ~500g charcoal + ~60g slate + ~60g ivory + ~5g gold (for accents, optional) = ~$20 in materials.

**Four print runs (single-extruder workflow):**
1. **Charcoal:** Ground + Sky + Space boards + 4 Pillars + Base (~8 hrs, one filament)
2. **Slate:** 5 P1 pieces + 3 P1 flag tokens (~3.5 hrs)
3. **Ivory:** 5 P2 pieces + 3 P2 flag tokens (~3.5 hrs)
4. **(Optional) Gold accent:** small post-print painting pass on Lifts/Nexus/Sigil/Layer names, ~30 min

---

## 7. Final design decision — base motto

One remaining call: **inscribe "Three worlds. One proof." around the base perimeter?** Engraved in 5mm caps, runs the circumference of the base ring (~660mm of text). Adds maybe 30 min to design and prints unchanged.

Recommendation: yes. The rally line lives on every other surface; the physical artifact deserves it too. Subtle, debossed, only visible to someone who looks closely — which is exactly when an artifact rewards the looker.

---

## 8. Sequence after this brief is approved

1. ✅ **This brief** — design vision, form factor, component manifest, aesthetic direction
2. **OpenSCAD parametric source** — one `.scad` file per part (board, pillar, base, each piece). User runs OpenSCAD → exports `.stl` per part. Free, cross-platform, text-based — the closest thing to "AI generates the print files."
3. **Print profile guide** — slicer settings per part (orientation, supports, layer height, infill, color-swap Z heights for two-tone parts)
4. **Box design brief** — exterior box artwork spec for either DIY printable cardboard or manufactured printer
5. **Founder digital STL pack** — final packaged distribution: the STL files, the print guide, an assembly diagram, a one-page leaflet linking back to the digital game and the Kickstarter

---

## Open question for the user

**Two-color via filament swap, or single-color paint accent?**

- **Two-color print** (Bambu AMS or filament-swap at Z-height): board name, sigil, markers visible in gold without painting. More setup; one-shot done.
- **Single-color print + painted accents:** monochrome dark print, hand-paint the sigil/labels with gold acrylic paint or gold leaf. More work but more controlled finish.

For premium feel, single-color print + careful hand-painted gold accents on the markers and sigil actually looks BETTER than filament-swap, because the paint catches light differently and reads as deliberate craft. But it's more work per unit. If Founders print at home (STL pack), they'd choose for themselves.

Default recommendation: design for **single-color print**, document the painting step in the print guide. Founders who want two-color can swap filament at the Z-height markers we'll specify.
