# App Store listing — Thresan (iOS public release)

Paste-ready copy for App Store Connect → Thresan → iOS App version page.
Build to attach: **1.1.0 (27)**. Pricing: **Free**. Category: **Games → Board**
(secondary: **Strategy**). Manual release (you pick the go-live moment).

NOTE (Apple compliance): the App Store listing and the app build must NOT
mention or link to the Kickstarter / external purchases (Apple rejects that;
it's exactly why the native build is gated). Keep all of this about the free
game only. Support URL: https://playskyflag.com · Privacy: https://playskyflag.com/privacy

---

## Name (already set)
Thresan   *(30-char limit; leave as-is)*

## Subtitle  (≤30 chars — pick one)
- `Strategy in three dimensions`  (28)
- `3D chess that finally works`   (27)
- `Chess, played upward`          (20)

## Promotional text  (≤170 chars; editable anytime without review)
Three stacked boards, four Lifts, one Nexus. No dice, no cards, no luck — pure strategy. Play free, solo vs AI or head-to-head. Easy to learn, deep to master.

## Keywords  (≤100 chars, comma-separated, no spaces)
chess,strategy,board game,abstract,3D chess,2 player,two player,turn based,tactics,puzzle,nexus

## Description  (≤4000 chars)
Thresan is a two-player strategy game you play UP, not just across.

Three stacked boards — Ground, Sky, and Space — form one arena of 108 squares. Pieces climb between the layers through fixed Lifts, and where you stand in the stack changes what you threaten and what threatens you. No dice, no cards, no hidden information. The only unknown is the mind across the table.

HOW IT PLAYS
• Each side commands four pieces — a Captain, a Soldier, a Rover, and a Pilot — and the Soldier can rise into a second Captain.
• Two ways to win, and you have to threaten both at once:
   – Checkmate: leave your opponent with no Captain and no Soldier who could ever become one.
   – Ascent: send your own Captain through all three of their flags to the Nexus at the very top.
• Perfect information, every time. Learn it in minutes; study it for years.

MODES
• Single-player against a strong AI, at multiple difficulties.
• Two-player: pass-and-play on one device, or online with a friend.
• A daily puzzle to sharpen your tactics.

WHERE IT COMES FROM
Chess gave the world a single flat grid, descended from the ancient eight-footed board of antiquity. Thresan reimagines that geometry entirely — same ancestral DNA, reaching now into a third dimension. It's chess-like in its bones, but the third dimension turns it into something of its own.

Free to play. No interruptions. Just strategy.

---

## Screenshot shot-list  (the gating item — capture these)
Required: **6.7" iPhone** set (1290×2796). Add **iPad 13"** (2048×2732) if the
app ships universal. 3–6 shots, ordered for impact; add a short caption banner
to each (suggested captions below).

1. **The three stacked boards, mid-game** — the hero shot; sells the 3D concept instantly.  → caption: "Three boards. One game."
2. **A Lift in action** — a piece climbing between layers.  → "Climb between worlds."
3. **The Nexus / an ascent threat** — Captain nearing the summit.  → "Two ways to win."
4. **Single-player vs AI** — difficulty select or a sharp position.  → "Play the AI, any level."
5. **Two-player / online** — a head-to-head game.  → "Pass-and-play or online."
6. **Daily puzzle** — the puzzle screen.  → "A new puzzle every day."

Tip: capture from the iOS Simulator (iPhone 16 Pro Max = 6.7") running the
gated build, or a device, then add caption banners in any image tool.

## Review checklist before "Submit for Review"
- [ ] Build 1.1.0 (27) processed + selected
- [ ] Screenshots uploaded (6.7" minimum)
- [ ] Subtitle / promo / keywords / description in
- [ ] App Privacy questionnaire (declare what the app actually collects)
- [ ] Age rating questionnaire
- [ ] Category Games→Board, Price Free, Support + Privacy URLs
- [ ] Export compliance: already set (ITSAppUsesNonExemptEncryption=false)
- [ ] Release option: Manual

---

## App Privacy questionnaire answers (final — native build)
Vercel Analytics is now gated out of native, so the label is the clean version:
**no third-party SDKs, no tracking, no ATT prompt.** Answer the App Store Connect
questionnaire as:

**"Do you collect data from this app?" → Yes.**
For every item below: **Linked to the user = Yes · Used for tracking = No.**

- **Contact Info → Email Address** — purpose: *App Functionality* (account sign-in via magic link; optional, but still declared).
- **Identifiers → User ID** — purpose: *App Functionality* (Supabase account id).
- **Identifiers → Device ID** — purpose: *App Functionality* (APNs push token; only when the user turns on turn-notifications).
- **User Content** (saved games, ELO/ratings, chosen nickname) — purpose: *App Functionality*.

**Not collected:** Usage Data, Diagnostics, Location, Financial, Health, Browsing
History, Search History, Contacts, Sensitive Info, Purchases.

**Tracking:** none → no AppTrackingTransparency prompt required.

**Account deletion:** reachable in-app for every signed-in user via the account
screen (AccountDataSection → "Delete my account" → `delete-account` edge
function). Satisfies Apple Guideline 5.1.1(v). ✅
