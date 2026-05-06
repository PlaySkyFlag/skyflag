export default function Help() {
  return (
    <details className="help">
      <summary className="help-summary">How to play</summary>
      <div className="help-body">
        <p>
          <strong>Goal.</strong> Capture all three of your opponent's flags
          (<span className="help-glyph">⚑</span> on Ground & Sky,{' '}
          <span className="help-glyph">★</span> on Space) by landing your{' '}
          <strong>Captain</strong> (or a promoted Soldier) on each one. Then land a
          Captain on the <strong>Nexus</strong>{' '}
          <span className="help-glyph">◎</span> at Space&nbsp;(r3,&nbsp;c3) to win.
        </p>
        <p>
          <strong>Each turn.</strong> You have 2 activations. Spend each one to
          either <em>deploy</em> a piece from your tray onto the dashed pad on
          Ground, or <em>move</em> a piece you've already deployed. Click <em>End
          turn</em> to forfeit any unused activations.
        </p>
        <p>
          <strong>Selecting and moving.</strong> Click a tray tile or an on-board
          piece to select it — gold dots appear on every legal target.
          Click any dot to move there. Click empty space or another piece to
          change your selection.
        </p>
        <p>
          <strong>Pieces.</strong>{' '}
          <strong>C</strong>aptain — 1 square in any of 8 directions.{' '}
          <strong>S</strong>oldier — forward only; first move ≤2&nbsp;sq, captures
          diagonal-forward, promotes to Captain on the far Ground row.{' '}
          <strong>R</strong>over — orthogonal ≤2&nbsp;sq.{' '}
          <strong>P</strong>ilot — diagonal ≤2&nbsp;sq. None may jump. Capture by
          landing on an opponent.
        </p>
        <p>
          <strong>Lifts.</strong> Move a piece onto a lift cell{' '}
          <span className="help-glyph">⬆</span> at (1,1)/(1,4)/(4,1)/(4,4); on a
          later activation click the same cell on the adjacent board to ascend or
          descend. Destination on the new layer must be empty — lifts can't
          capture.
        </p>
        <p>
          <strong>Single-player vs hot-seat.</strong> AI plays Ivory (P2) by
          default. Click the <em>AI: Ivory</em> button in the HUD to switch to
          hot-seat for two humans on one machine.
        </p>
      </div>
    </details>
  );
}
