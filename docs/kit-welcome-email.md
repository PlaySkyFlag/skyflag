# Welcome email — Thresan launch list

**Status (2026-06-01):** Not yet live. The signup pipeline creates and tags
the Kit subscriber, but nothing sends a welcome. New signups currently
receive **no email**. This document is the copy + the setup to fix that.

---

## How to make it send (pick one)

**Option A — Kit Visual Automation (recommended, no code).**
In Kit: *Automations → New Visual Automation → Trigger: "Subscriber added
to a tag" → `src:website` (and/or the per-surface src tags) → Action: Send
the email below.* Set it to send immediately. Because every consented
signup is already tagged by source, this fires automatically. Kit handles
unsubscribe, the required physical-address footer, and deliverability.

**Option B — Sequence enrollment from the DB trigger (code).**
Create a one-email *Sequence* in Kit with the copy below, note its numeric
ID, and I'll extend `sync_waitlist_to_kit()` to also
`POST /v4/sequences/{id}/subscribers` for consented rows. Kit then sends
the sequence automatically. (The trigger already reads the Kit key from
Vault, so no secret handling changes.)

Either way the copy lives in Kit, not in the app.

## Best-practice settings

- **From:** `Nelson Jatel` — a real name, not "no-reply". Lifts opens + trust.
- **Reply-to:** a monitored address (`njatel@limnology.ca`). The email
  invites replies; they must reach you.
- **Send timing:** immediately on signup. Welcome emails see the highest
  open rates of anything you'll send — don't delay.
- **Format:** text-forward, one primary CTA. Avoid heavy images (better
  inboxing). One optional small board render at most.
- **Personalization:** we only collect email, no name — so greet with
  "Hi there," (don't fake a first-name token that would render blank).
- **Cadence promise:** set expectations so they don't unsubscribe later.
- **Compliance:** Kit auto-appends unsubscribe + mailing address (CASL/
  CAN-SPAM). Don't remove them.

---

## Subject line (A/B these)

1. `Welcome to the world of Thresan`
2. `You're in — and your free game is inside`

**Preheader:** `A bit of history, your free game, and where to go next.`

## Body

> **Welcome to the world of Thresan.**
>
> Hi there,
>
> Thanks for joining the launch list — I'm really glad you're here.
>
> A little about what you've just stepped into. Thresan is a two-player
> strategy game I've been building for several years. No dice, no cards,
> no luck — just pure geometry across three stacked boards: a lower deck,
> a mid, and the summit. Pieces travel between the layers through Lifts,
> and there are two ways to win: capture your opponent's Captain, the way
> chess ends a game — or march your own Captain up through all three of
> their flags to the Nexus at the very top. It's chess-like in its bones,
> but that third dimension turns it into something of its own.
>
> **Skyflag** is the first edition — a premium, three-tier physical object
> coming to Kickstarter this fall. But you don't have to wait for any of
> that:
>
> **▶ You can play Thresan online, free, anytime, at [playskyflag.com](https://playskyflag.com).**
>
> If you're curious where it comes from, I wrote about the 2,500-year-old
> board hiding beneath your chessboard — the ancestor this whole thing
> grew out of:
> [The 2,500-year-old board beneath your chessboard](https://boardgamegeek.com/thread/3717531/the-2500-year-old-board-beneath-your-chessboard-as).
>
> And if you'd like to go deeper, I keep a build journal — engine notes,
> opening theory, and honest write-ups of what's working and what isn't —
> over at **[thresan.io](https://www.thresan.io)**. Wander in whenever.
>
> I'll only email when there's something real to share: the Kickstarter
> launch, early-backer pricing, and the occasional note from the
> workshop. No noise.
>
> Welcome aboard. And if you play a game, I'd genuinely love to know what
> you think — just hit reply, it comes straight to me.
>
> — Nelson
> *Creator, Thresan*

---

*Plain-text version: keep the same words, links as bare URLs, same
sign-off. Kit generates this automatically but proof it once.*
