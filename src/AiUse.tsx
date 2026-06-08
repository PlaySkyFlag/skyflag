// AI use — one canonical disclosure, linked from every footer (next to
// Privacy / Terms) instead of repeated inline across the site. The text
// of the core statement is kept identical to the disclosure printed on
// the published comic's credits/indicia page so the site and the
// ISBN'd publication never diverge.

import { useEffect } from 'react';
import './Legal.css';
import { applySurfaceMeta } from './socialMeta';

const LAST_UPDATED = '2026-05-17';
const CONTACT_EMAIL = 'njatel@limnology.ca';

// Verbatim core statement — identical to the comic's printed credits
// page. Do not reword one without rewording the other.
export const AI_USE_STATEMENT =
  'This issue includes AI-generated and AI-assisted artwork and ' +
  'production assets. Story direction, worldbuilding, continuity, ' +
  'selection, editing, page sequencing, and publication assembly were ' +
  'directed by Nelson Jatel, Limnology Research Corp., and Thresan ' +
  'Studio. AI image-generation and editing tools were used as ' +
  'production instruments for visual draft generation, illustration ' +
  'refinement, and cover development. This disclosure is included for ' +
  'transparency.';

export default function AiUse() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'AI use — Thresan™: Skyflag',
      description:
        'Where AI was and was not used across Thresan: Skyflag — the game engine, the website, and the published comic. Plain-language disclosure from a solo creator.',
      canonicalUrl: 'https://playskyflag.com/ai-use',
    });
  }, []);

  return (
    <div className="legal">
      <header className="legal-header">
        <div className="legal-header-inner">
          <a href="/" className="legal-back">← Thresan™: Skyflag</a>
          <div className="legal-header-meta">AI use</div>
        </div>
      </header>

      <main className="legal-main">
        <article className="legal-article">
          <h1 className="legal-title">AI use</h1>
          <p className="legal-updated">Last updated {LAST_UPDATED}.</p>

          <p className="legal-lead">
            One person makes this, under{' '}
            <strong>Limnology Research Corp.</strong> Here is the honest,
            specific account of where AI is and isn&rsquo;t used — kept
            in one place rather than repeated across every page.
          </p>

          <h2>The comic</h2>
          <p>{AI_USE_STATEMENT}</p>
          <p>
            The same statement is printed on the credits / indicia page
            of the published edition (ISBN 978-1-7388485-4-6), so the
            disclosure travels with the book itself, not just the
            website.
          </p>

          <h2>The game</h2>
          <p>
            The Skyflag rules, board design, and the opponent AI&rsquo;s
            search and evaluation are hand-written code — a classic
            alpha-beta engine, not a generative model. AI coding
            assistants were used as a development tool while building
            the app, the same way many software projects use them; the
            game you play is deterministic, runs entirely on your
            device for solo and 2-player, and does not call any external
            AI service.
          </p>

          <h2>The website</h2>
          <p>
            Copy, layout, and code across this site were written by a
            human with AI assistance used as a drafting and editing
            tool. No page content is auto-generated or served from a
            model at request time.
          </p>

          <h2>Why disclose at all</h2>
          <p>
            Because it&rsquo;s a fair question and you shouldn&rsquo;t
            have to guess. The short version: a human directs every
            creative and design decision; AI tools assist execution,
            especially the comic&rsquo;s visual production. If that
            distinction matters to you, this page is the straight
            answer.
          </p>

          <h2>Questions</h2>
          <p>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=AI use question`}>
              {CONTACT_EMAIL}
            </a>
            . I read every message.
          </p>

          <p className="legal-foot">
            See also: <a href="/privacy">Privacy</a> ·{' '}
            <a href="/terms">Terms of use</a>.
          </p>
          <p className="legal-foot">© {new Date().getFullYear()} Limnology Research Corp.</p>
        </article>
      </main>
    </div>
  );
}
