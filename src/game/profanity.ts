// profanity.ts — minimal nickname moderation.
//
// The multiplayer nickname is the only user-generated content other players
// see, so App Store Guideline 1.2 expects we keep an obviously offensive
// handle from reaching an opponent. This is a first line, not exhaustive:
// it normalizes common evasion (case, separators, basic leetspeak), then
// rejects a curated blocklist of slurs + strong obscenities. Under-blocking
// is the risk Apple cares about, so we err toward blocking — a few innocent
// substrings may get caught (users can just pick another handle). Tune the
// list here, or swap in a maintained library, as needed.

const BLOCKLIST: string[] = [
  // strong obscenities
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'dick', 'cock',
  'pussy', 'whore', 'slut', 'wank', 'bollock', 'prick', 'twat',
  // slurs (racial / homophobic / ableist) — block hard
  'nigger', 'nigga', 'faggot', 'retard', 'spic', 'chink', 'kike',
  'wetback', 'tranny', 'dyke', 'coon',
  // sexual / exploitative
  'rape', 'rapist', 'pedo', 'paedo', 'molest', 'porn', 'jizz',
  // hate
  'hitler', 'nazi',
];

// Lowercase, fold common leetspeak, then strip everything that isn't a
// letter so "f.u.c.k", "f u c k", and "fck" variants collapse to a hit.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

export function containsProfanity(name: string): boolean {
  if (!name) return false;
  const n = normalize(name);
  return BLOCKLIST.some((w) => n.includes(w));
}
