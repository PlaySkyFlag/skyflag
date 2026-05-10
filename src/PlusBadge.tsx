// Small gold star badge shown next to nicknames belonging to Plus
// subscribers. Renders nothing when the user isn't Plus, so callers
// can drop it inline without guarding themselves.
//
// Visual: filled gold star, sized to the surrounding text's
// line-height. Hover tooltip explains the badge to non-subscribers.

type Props = {
  isPlus: boolean | null | undefined;
  // Visual size override. 'inline' (default) matches the surrounding
  // text size; 'large' is for profile headers where the badge is the
  // hero element.
  size?: 'inline' | 'large';
  // Override the default tooltip text — useful for first-person uses
  // ("You're a Plus subscriber") vs third-person ("Plus subscriber").
  title?: string;
};

export default function PlusBadge({ isPlus, size = 'inline', title }: Props) {
  if (!isPlus) return null;
  return (
    <span
      className={`plus-badge plus-badge-${size}`}
      title={title ?? 'Plus subscriber'}
      aria-label="Plus subscriber"
    >
      ★
    </span>
  );
}
