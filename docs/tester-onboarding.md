# Tester onboarding note

Personalize per recipient (replace `[Name]`, add an optional time window and call-outs for their specific expertise), then send via email / DM. Tone is intentionally direct, no marketing fluff — testers respond better to "honest about what's rough" than to polish.

---

**Subject**: Test pilot for Thresan: Skyflag — would love your eyes on it

Hey [Name],

I've been building a strategy game I'd love your read on — **Thresan: Skyflag**, a two-player tactical race across three stacked boards. It's at playable-but-rough stage and ready for a small private test.

**Try it**: https://playskyflag.com — works in any modern browser, no download.

**Signing in**: Enter your email, then type the 6–8 digit code from the email you get. (You can also click the link in the email, but only if you're reading the email on the same device as the app.)

**What's useful to hear about**:
- Did sign-in work cleanly?
- Did the rules click after the tutorial, or are there moments where you weren't sure what to do?
- Play a few games **Solo vs AI** — does it feel like a real opponent, or trivially easy / brutally hard?
- Anywhere the visual layout broke or felt off on your device
- Any "what just happened?" moments

**How to send feedback**:
- **Easiest**: scroll to the footer of the app, click **💬 Send feedback**. It auto-captures the page URL, your browser, and viewport size — so you don't need to describe context, just describe what happened.
- Or reply to this email.

**What I'd skip**: don't worry about typos, missing illustrations, or asking for features that are obviously next-version. Tell me what *broke* or *confused you*.

Thanks for being on this. The game's mechanics are locked in (those are in the rulebook on the Help page), but UI polish, balance, and copy are all going to get reshaped based on what you say.

— Nelson
*Thresan™: Skyflag*

---

## Per-recipient customization checklist

- [ ] Replace `[Name]` with their name (or "Hi everyone" if group blast)
- [ ] Optional: add a time window — `"Would love thoughts in the next two weeks"`
- [ ] Optional: add a specific ask if they have relevant expertise
  - Game designer: *"Especially curious how the three-layer interactions feel — does verticality matter, or do players treat it as one big board?"*
  - UI/UX person: *"Particularly interested in whether the layered boards read clearly on first glance, before the tutorial."*
  - AI/ML person: *"The AI is iterative-deepening minimax with PSTs and a tuned opening book — I'd love a calibration check on Hard difficulty."*
  - Strategy gamer: *"How fast do you converge on a 'right' opening? Does the game feel solved, or does each match feel different?"*
- [ ] If you want a structured response: link a Tally/Google form here AND mention the in-app button (give them options)

## Where tester feedback lands

- **In-app form** → Supabase Dashboard → Table Editor → `feedback` table
- **Email reply** → `njatel@limnology.ca`
- **Direct DM/Slack** → wherever you DM'd the invite

Triage rhythm suggestion: skim the `feedback` table once per day during the active test window. Use `resolved_at` and `resolved_notes` columns to mark items as handled.
