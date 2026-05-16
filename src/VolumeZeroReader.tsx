// VolumeZeroReader — the web reading experience for Thresan: Skyflag's
// prequel. PAGE-BASED comic reader (one cinematic page at a time, prev/
// next, keyboard arrows, page counter) — deliberately NOT vertical-
// scroll webtoon. Art direction is dark-fantasy / industrial sci-fi;
// the chrome stays out of the art's way.
//
// Manifest-driven (volumeZeroPages.ts). With no pages cleared yet it
// renders an honest "in production" state. Renders standalone at
// /read (full screen) and embedded in VolumeZeroLanding (`embedded`).
// The in-comic CTA after the last page is the conversion hinge:
// reader → player → email subscriber.

import { useCallback, useEffect, useState } from 'react';
import './VolumeZeroReader.css';
import { applySurfaceMeta } from './socialMeta';
import {
  VOLUME_ZERO,
  VOLUME_ZERO_PAGES,
  VOLUME_ZERO_PDF,
} from './volumeZeroPages';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-volume-zero';
const LANDING_URL = '/volume-zero';

function pageLabel(i: number, total: number): string {
  const p = VOLUME_ZERO_PAGES[i];
  if (!p) return '';
  if (p.kind === 'cover') return 'Cover';
  if (p.kind === 'backcover') return 'Back cover';
  if (p.kind === 'backmatter') return 'Backmatter';
  // Story pages are numbered 1..N regardless of cover offset.
  const storyIndex =
    VOLUME_ZERO_PAGES.slice(0, i + 1).filter((q) => q.kind === 'page').length;
  const storyTotal = VOLUME_ZERO_PAGES.filter((q) => q.kind === 'page').length;
  return `Page ${storyIndex} / ${storyTotal || total}`;
}

export default function VolumeZeroReader({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const total = VOLUME_ZERO_PAGES.length;
  const [i, setI] = useState(0);
  const atEnd = i >= total - 1;

  const go = useCallback(
    (delta: number) => {
      setI((prev) => Math.min(Math.max(prev + delta, 0), Math.max(total - 1, 0)));
    },
    [total],
  );

  // Standalone view owns the document <title>; embedded view does not
  // (the landing already set it).
  useEffect(() => {
    if (embedded) return;
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: `${VOLUME_ZERO.shortTitle} — read free · Thresan: Skyflag`,
      description:
        'Read Issue One free — the prequel to Thresan: Skyflag. ' +
        'Grey Ravens, White Stags, the Lifts, the Caelum Nexus.',
      canonicalUrl: 'https://thresan.studio/volume-zero',
      ogImage: 'https://thresan.studio/thresan-og-clans.jpg',
      ogImageAlt:
        'Three stacked boards with Grey Ravens and White Stags arrayed across all three planes.',
    });
  }, [embedded]);

  // Arrow-key paging (standalone only — embedded shares the page's keys).
  useEffect(() => {
    if (embedded || total === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embedded, total, go]);

  // Preload the next page so paging feels instant.
  useEffect(() => {
    const next = VOLUME_ZERO_PAGES[i + 1];
    if (next) {
      const img = new Image();
      img.src = next.src;
    }
  }, [i]);

  if (total === 0) {
    return (
      <div className={embedded ? 'vz vz--embed' : 'vz'}>
        <section className="vz-soon">
          <p className="vz-soon-eyebrow">{VOLUME_ZERO.tagline}</p>
          <h2 className="vz-soon-title">{VOLUME_ZERO.shortTitle} is in production.</h2>
          <p className="vz-soon-lead">{VOLUME_ZERO.synopsis}</p>
          <p className="vz-soon-note">
            {VOLUME_ZERO.subtitle} The pages land here free. Until then,
            the world is already playable.
          </p>
          <a href={GAME_URL} className="vz-cta">
            Play Skyflag now →
          </a>
        </section>
      </div>
    );
  }

  const page = VOLUME_ZERO_PAGES[i];

  return (
    <div className={embedded ? 'vz vz--embed' : 'vz'}>
      {!embedded && (
        <header className="vz-bar">
          <a href={LANDING_URL} className="vz-bar-back">
            ← {VOLUME_ZERO.shortTitle}
          </a>
          <a href={GAME_URL} className="vz-bar-cta">
            Play Skyflag →
          </a>
        </header>
      )}

      <div className="vz-stage">
        <button
          type="button"
          className="vz-nav vz-nav--prev"
          onClick={() => go(-1)}
          disabled={i === 0}
          aria-label="Previous page"
        >
          ‹
        </button>

        <figure className="vz-figure">
          <img
            key={page.src}
            src={page.src}
            alt={page.alt}
            className="vz-page"
            decoding="async"
          />
        </figure>

        <button
          type="button"
          className="vz-nav vz-nav--next"
          onClick={() => go(1)}
          disabled={atEnd}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      <div className="vz-counter" aria-live="polite">
        {pageLabel(i, total)}
      </div>

      {/* In-comic conversion hinge — shown once the reader reaches the
          end. Play Skyflag + Join the Kickstarter list, per the CTA
          plan. */}
      {atEnd && (
        <section className="vz-end">
          <p className="vz-end-eyebrow">That&rsquo;s Issue One.</p>
          <h2 className="vz-end-title">The world is a game you can play right now.</h2>
          <div className="vz-end-actions">
            <a href={GAME_URL} className="vz-cta">
              Play Skyflag at playskyflag.com →
            </a>
            <a href={`${LANDING_URL}#kickstarter`} className="vz-cta vz-cta--ghost">
              Join the Kickstarter list →
            </a>
            {VOLUME_ZERO_PDF && (
              <a href={VOLUME_ZERO_PDF} className="vz-cta vz-cta--ghost" download>
                Download the PDF →
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
