// Privacy — plain-language disclosure of what's collected and what
// happens to it. Solo-creator voice. Linked from footers wherever
// the site asks for an email (especially ThresanStore, which is the
// GDPR-relevant surface).

import { useEffect } from 'react';
import './Legal.css';
import { applySurfaceMeta } from './socialMeta';

const LAST_UPDATED = '2026-05-13';
const CONTACT_EMAIL = 'njatel@limnology.ca';

export default function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Privacy — Thresan™: Skyflag',
      description:
        'What Thresan collects, where it lives, and how to ask for it to be deleted. Plain-language privacy policy from a solo developer.',
      canonicalUrl: 'https://playskyflag.com/privacy',
    });
  }, []);

  return (
    <div className="legal">
      <header className="legal-header">
        <div className="legal-header-inner">
          <a href="/" className="legal-back">← Thresan™: Skyflag</a>
          <div className="legal-header-meta">Privacy</div>
        </div>
      </header>

      <main className="legal-main">
        <article className="legal-article">
          <h1 className="legal-title">Privacy</h1>
          <p className="legal-updated">Last updated {LAST_UPDATED}.</p>

          <p className="legal-lead">
            This is a small project run by one person under{' '}
            <strong>Limnology Research Corp.</strong> (British
            Columbia, Canada). The privacy story is short because the
            data story is short.
          </p>

          <h2>What's collected</h2>
          <ul>
            <li>
              <strong>Email address</strong> — only if you give it. Two
              places that ask: the Kickstarter waitlist on{' '}
              <em>thresan.store</em> (and the same offer that appears
              after a game ends on <em>playskyflag.com</em>), and the
              optional sign-in flow inside the game for cross-device
              accounts and online play.
            </li>
            <li>
              <strong>Game state</strong> — only if you sign in: your
              moves, rating, friend list, and active games. Local
              play (solo vs AI, 2P hot-seat) stores nothing on the
              server.
            </li>
            <li>
              <strong>Payment info</strong> — handled entirely by{' '}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Stripe
              </a>
              . Card numbers never touch this server.
            </li>
            <li>
              <strong>Basic request info</strong> — when an email
              signup is submitted, the form records the referrer URL
              and your browser's user-agent string. Used to spot bots
              and abuse, not to track you.
            </li>
          </ul>

          <p>
            Privacy-friendly analytics, no advertising cookies, no
            third-party tracking scripts.{' '}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noreferrer"
            >
              Vercel Web Analytics
            </a>{' '}
            and Speed Insights are enabled to count pageviews and
            measure load performance. They are cookieless, do not
            identify individual visitors, do not use a fingerprint, and
            beacon only to this site's own domain — never to a
            third-party tracker. The data collected is the URL path,
            referrer, country, and broad device class (desktop /
            mobile), aggregated for traffic and Core Web Vitals
            reporting only.
          </p>

          <h2>Where it lives</h2>
          <p>
            The database is hosted by{' '}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Supabase
            </a>{' '}
            (Postgres, US East). The site itself is hosted by{' '}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noreferrer"
            >
              Vercel
            </a>
            , which keeps standard access logs (IP address, request
            URL, timestamp) for a short period. Payments go through{' '}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Stripe
            </a>
            .
          </p>

          <h2>Cookies</h2>
          <p>
            One: the Supabase session cookie, set only after you sign
            in, used to keep you signed in across page loads. No
            tracking cookies, no advertising cookies. The browser's
            standard developer tools will show every cookie this site
            sets — feel free to check.
          </p>

          <h2>How long</h2>
          <p>
            Indefinitely, unless you ask. Waitlist emails are kept
            until the Kickstarter campaign closes (then I'll either
            ship and email you, or refund and apologize). Game
            accounts are kept as long as you have one.
          </p>

          <h2>Asking for it to be deleted</h2>
          <p>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Delete my data`}>
              {CONTACT_EMAIL}
            </a>{' '}
            with the subject <em>"Delete my data"</em> and the
            email address you signed up with. Everything tied to that
            email gets wiped within 30 days, and you'll get a one-line
            confirmation when it's done. No survey, no
            "are-you-sure" loop.
          </p>

          <h2>Children</h2>
          <p>
            Thresan is suitable for ages 12+. If you're under 13,
            don't submit an email address.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            If anything in here materially changes, the{' '}
            <em>"last updated"</em> date at the top will move and the
            previous version will be linked at the bottom of this
            page for at least 30 days. If the change is significant
            (e.g., a new third-party service), I'll also email anyone
            on the waitlist before it takes effect.
          </p>

          <h2>Contact</h2>
          <p>
            Privacy questions, data requests, or just curious —
            email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            I read every message.
          </p>

          <p className="legal-foot">
            See also: <a href="/terms">Terms of use</a> ·{' '}
            <a href="/ai-use">AI use</a>.
          </p>
        </article>
      </main>
    </div>
  );
}
