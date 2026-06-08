// Terms — plain-language terms of use. Solo-creator voice; this is a
// hobby project, not a SaaS. Founders Edition refund terms are the
// load-bearing part of this page since that's where actual money
// changes hands.

import { useEffect } from 'react';
import './Legal.css';
import { applySurfaceMeta } from './socialMeta';

const LAST_UPDATED = '2026-05-13';
const CONTACT_EMAIL = 'njatel@limnology.ca';

export default function Terms() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Terms of use — Thresan™: Skyflag',
      description:
        'Plain-language terms of use for Thresan™: Skyflag, the Founders Edition reservation, and the press kit assets.',
      canonicalUrl: 'https://playskyflag.com/terms',
    });
  }, []);

  return (
    <div className="legal">
      <header className="legal-header">
        <div className="legal-header-inner">
          <a href="/" className="legal-back">← Thresan™: Skyflag</a>
          <div className="legal-header-meta">Terms of use</div>
        </div>
      </header>

      <main className="legal-main">
        <article className="legal-article">
          <h1 className="legal-title">Terms of use</h1>
          <p className="legal-updated">Last updated {LAST_UPDATED}.</p>

          <p className="legal-lead">
            This is a small project run by one person under{' '}
            <strong>Limnology Research Corp.</strong> (British
            Columbia, Canada). Plain version: please don't break it
            on purpose, and the refund policy on the Founders Edition
            is generous.
          </p>

          <h2>The game</h2>
          <p>
            Thresan™: Skyflag is free to play in the browser at{' '}
            <em>playskyflag.com</em>. It works most of the time. There
            is no uptime guarantee, no SLA, and no warranty of any
            kind — express or implied. The engine has bugs and they
            get fixed as they're found. Use the game on a device you
            own.
          </p>

          <h2>Fair play</h2>
          <p>
            Don't try to exploit, scrape, automate, or denial-of-service
            the site or the engine. Don't use the multiplayer system
            to harass other players. If you find a security issue,
            please email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Security`}>
              {CONTACT_EMAIL}
            </a>
            ; I'll respond within a few days, and good-faith
            researchers won't get sued.
          </p>

          <h2>Trademark and brand assets</h2>
          <p>
            <strong>Thresan™</strong> is a trademark of Limnology
            Research Corp. The sigil, wordmark, and brand palette are
            also covered. Don't reproduce them in a way that suggests
            endorsement by, partnership with, or affiliation with
            Thresan or Limnology Research Corp.
          </p>
          <p>
            The press kit assets at{' '}
            <a href="/press">playskyflag.com/press</a> are explicitly
            free for <em>editorial</em> use (news articles, reviews,
            content videos, podcast cover art, etc.) — credit is
            appreciated but not required for the renders. The
            rulebook itself is © Limnology Research Corp., free for
            personal and educational use, not for resale.
          </p>

          <h2>Founders Edition reservation</h2>
          <p>
            The Founders Edition reservation on{' '}
            <em>thresan.store</em> is a <strong>$108 USD refundable
            deposit</strong>, held by Stripe. It reserves you a
            production slot when the Kickstarter campaign goes live,
            and the full amount applies as credit toward the eventual
            pledge.
          </p>
          <p>
            <strong>Refunds.</strong> You can request a full refund at
            any time before the Kickstarter campaign launches, by
            emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Refund`}>
              {CONTACT_EMAIL}
            </a>
            . Refunds typically clear in 5–10 business days through
            Stripe. If the Kickstarter campaign fails to fund, all
            reservations are refunded automatically.
          </p>

          <h2>Account use</h2>
          <p>
            If you sign in with an email, the account is for you and
            the devices you own. Don't share credentials. If you
            notice unfamiliar activity (a session listed in the
            Account modal that wasn't you), use the "Sign out
            everywhere" option and email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>Liability</h2>
          <p>
            Use at your own risk. Limnology Research Corp.'s total
            liability for anything connected to this site or the
            game is limited to whatever you paid (which, for free
            play, is zero, and for the Founders Edition deposit, is
            the deposit amount).
          </p>

          <h2>Changes</h2>
          <p>
            If anything material changes, the{' '}
            <em>"last updated"</em> date at the top moves. For
            substantive changes that affect Founders Edition holders
            specifically (e.g., refund terms, shipping timelines),
            you'll get an email before the change takes effect.
          </p>

          <h2>Disputes</h2>
          <p>
            Governed by the laws of British Columbia, Canada. If we
            have a disagreement, please email me first —{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
            — and let's resolve it like adults before anyone needs
            to involve a court.
          </p>

          <p className="legal-foot">
            See also: <a href="/privacy">Privacy policy</a> ·{' '}
            <a href="/ai-use">AI use</a>.
          </p>
          <p className="legal-foot">© {new Date().getFullYear()} Limnology Research Corp.</p>
        </article>
      </main>
    </div>
  );
}
