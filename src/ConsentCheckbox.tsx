// ConsentCheckbox — the shared CASL/GDPR express-opt-in control used by
// every email-capture form (store, studio, post-game, Volume Zero,
// Kickstarter). Centralizing it keeps the consent wording legally
// consistent and editable in one place. Styles are self-contained inline
// so it drops into any form layout; flexBasis:100% makes it take its own
// line inside a wrapping flex form.

type Props = {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export default function ConsentCheckbox({ checked, onChange, disabled }: Props) {
  return (
    <label
      className="consent-checkbox"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        textAlign: 'left',
        fontSize: '0.78rem',
        lineHeight: 1.45,
        width: '100%',
        flexBasis: '100%',
        opacity: 0.92,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        required
        style={{ marginTop: 3, flexShrink: 0 }}
      />
      <span>
        Yes, email me about Thresan: Skyflag and the Kickstarter launch from
        Limnology Research Corp. I can unsubscribe anytime. See our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </span>
    </label>
  );
}
