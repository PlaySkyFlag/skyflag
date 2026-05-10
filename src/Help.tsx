type Props = {
  // When true, skip the <details>/<summary> chrome and render just the
  // body — used by Sidebar tab panels which own their own open/close
  // state via tab selection.
  inline?: boolean;
};

export default function Help({ inline = false }: Props) {
  const body = (
    <div className="help-body">
        <ol>
          <li>
            <strong>Pick a mode</strong> from the gear menu (⚙) in the
            top-right corner — <em>1P · Ravens</em> (you're the Grey
            Ravens, AI plays the White Stags), <em>1P · Stags</em> (the
            reverse), or <em>2P</em> (two humans on one device).
          </li>
          <li>
            <strong>Click "New game"</strong> in the toolbar above the
            boards to begin. The Grey Ravens move first.
          </li>
          <li>
            <strong>Each turn you have 2 activations.</strong> An
            activation is either deploying a new piece from your tray or
            moving a piece already on the board.
          </li>
          <li>
            <strong>Deploy.</strong> Tap a piece in your tray (Captain
            ♚, Soldier ♟, Rover ♜, or Pilot ♝). The dashed pad on
            Ground will glow — tap it to drop your piece there.
          </li>
          <li>
            <strong>Move.</strong> Tap any of your pieces already on the
            board. Gold dots will appear on every legal destination —
            tap a dot to move there.
          </li>
          <li>
            <strong>Lifts</strong> let pieces travel between layers. Move
            onto a lift cell (↕ at r1/c1, r1/c4, r4/c1, r4/c4). On your
            next activation, tap the matching cell on the layer above or
            below to ascend / descend.
          </li>
          <li>
            <strong>Turns end automatically</strong> once you've used both
            activations or have no legal action left — you don't need to
            press anything.
          </li>
          <li>
            <strong>Stuck?</strong> Tap <em>💡 Hint</em> in the toolbar
            and the AI will suggest a move with a gold arrow.
          </li>
          <li>
            <strong>Win:</strong> capture all three of your opponent's
            flags (<span className="help-glyph">⚑</span> on each layer)
            with your Captain (or a promoted Soldier), then land a
            Captain on the Nexus{' '}
            <span className="help-glyph">◎</span> at Space (r3, c3).
          </li>
        </ol>
        <p>
          <strong>Piece moves.</strong> Captain — 1 square in any of 8
          directions. Soldier — forward only; first move up to 2 squares;
          captures diagonal-forward; promotes to Captain on the far
          Ground row. Rover — orthogonal up to 2 squares. Pilot — diagonal
          up to 2 squares. None may jump. Capture by landing on an
          opponent.
        </p>
        <p className="help-rulebook">
          Want the full story and complete rules?{' '}
          <a
            href="/skyflag-rulebook.pdf"
            download="3xedra-Rulebook.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download the 3xedra rulebook (PDF)
          </a>
          .
        </p>
      </div>
  );
  if (inline) return body;
  return (
    <details className="help">
      <summary className="help-summary">Getting started</summary>
      {body}
    </details>
  );
}
