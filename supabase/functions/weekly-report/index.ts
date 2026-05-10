// Supabase Edge Function — generates the weekly KPI report and
// emails it to the project owner. Two ways to invoke:
//   1. Cron-triggered (pg_cron + pg_net) — fully automatic, runs
//      every Monday morning. Set up after Resend is configured.
//   2. HTTP POST from the admin (Authorization: Bearer <jwt>) —
//      useful for ad-hoc "what does this week look like?" pulls.
//
// Auth: the kpi_snapshot() Postgres function is the actual gate —
// it raises if the caller isn't is_admin(). When invoked by cron
// we use the service-role client which bypasses that check (cron
// has no JWT to validate); when invoked via HTTP we forward the
// caller's JWT and let the function reject non-admins.
//
// Email transport: Resend's HTTP API. Single fetch, no SMTP plumbing
// needed in Deno. RESEND_API_KEY secret required.
//
// Deployment:
//   supabase functions deploy weekly-report --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_xxx \
//                        REPORT_FROM_EMAIL='3phor reports <reports@3phor.io>' \
//                        REPORT_TO_EMAIL=njatel@limnology.ca

// @ts-expect-error — Deno-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);

const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;
const RESEND_API_KEY = env('RESEND_API_KEY') ?? '';
const REPORT_FROM_EMAIL = env('REPORT_FROM_EMAIL') ?? '3phor reports <reports@3phor.io>';
const REPORT_TO_EMAIL = env('REPORT_TO_EMAIL') ?? 'njatel@limnology.ca';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type KpiSnapshot = {
  generated_at: string;
  period: { window_start: string; window_end: string; days: number };
  acquisition: Record<string, number>;
  engagement: Record<string, number>;
  monetization: Record<string, number>;
  network: Record<string, number>;
};

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  // Two invocation modes — a cron job hits us with the
  // service-role key and skips JWT validation; a human admin
  // invokes from a signed-in browser with their own JWT and
  // is_admin() inside kpi_snapshot is the real gate.
  let body: { mode?: 'cron' | 'manual'; cron_secret?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const mode = body.mode ?? 'manual';

  let sb;
  if (mode === 'cron') {
    // Cron caller must present the shared secret stored in DB
    // alongside the cron job. Without this, anyone could POST
    // mode=cron and trigger the report. The service-role key
    // bypass is the most privileged action this function can
    // take, so the gate has to be real.
    const expected = env('CRON_SECRET') ?? '';
    if (!expected || body.cron_secret !== expected) {
      return json({ ok: false, error: 'cron-secret-invalid' }, 401);
    }
    sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } else {
    // Human caller — forward their JWT so kpi_snapshot's
    // is_admin() check sees the real auth.uid().
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
  }

  const { data: snapshot, error: snapErr } = await sb.rpc('kpi_snapshot');
  if (snapErr) return json({ ok: false, error: snapErr.message }, 500);
  if (!snapshot) return json({ ok: false, error: 'no-snapshot' }, 500);

  const md = renderReport(snapshot as KpiSnapshot);

  if (!RESEND_API_KEY) {
    // No email config yet — return the report inline so an admin
    // can copy it manually until Resend is set up.
    return json({ ok: true, snapshot, report_markdown: md, email_sent: false, reason: 'no-resend-key' });
  }

  const subject = `3phor weekly report · ${formatDateOnly(snapshot.period.window_end)}`;
  const html = markdownToHtml(md);

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: REPORT_FROM_EMAIL,
      to: [REPORT_TO_EMAIL],
      subject,
      html,
      text: md,
    }),
  });
  if (!emailRes.ok) {
    const errText = await emailRes.text();
    return json({ ok: false, error: `resend-failed: ${errText}`, snapshot }, 500);
  }
  const emailJson = await emailRes.json();

  return json({ ok: true, snapshot, email_sent: true, message_id: emailJson?.id });
});

// ─── Report rendering ─────────────────────────────────────────────
function renderReport(s: KpiSnapshot): string {
  const a = s.acquisition;
  const e = s.engagement;
  const m = s.monetization;
  const n = s.network;

  const start = formatDateOnly(s.period.window_start);
  const end = formatDateOnly(s.period.window_end);

  // Pairing-rate health: how many MP rooms started this week
  // actually got a second player. Below ~50% suggests matchmaking /
  // discoverability problems.
  const pairingRate =
    e.rooms_created_week > 0
      ? Math.round((100 * e.rooms_paired_week) / e.rooms_created_week)
      : 0;

  return [
    `# 3phor weekly report`,
    `**Period:** ${start} → ${end}`,
    `**Generated:** ${s.generated_at}`,
    ``,
    `---`,
    ``,
    `## Acquisition`,
    `- **Total users:** ${a.total_users}  (verified ${a.total_verified} · email-linked ${a.total_with_email} · guests ${a.total_anon})`,
    `- **New this week:** ${a.new_users_week} ${deltaArrow(a.new_users_week, a.new_users_prev_week)} (prev ${a.new_users_prev_week})`,
    `- **New with email:** ${a.new_with_email_week} of ${a.new_users_week} new this week`,
    `- **New last 30 days:** ${a.new_users_30d}`,
    ``,
    `## Engagement`,
    `- **DAU:** ${e.dau}`,
    `- **WAU:** ${e.wau}`,
    `- **MAU:** ${e.mau}`,
    `- **MP games this week:** ${e.new_games_week} ${deltaArrow(e.new_games_week, e.new_games_prev_week)} (prev ${e.new_games_prev_week})`,
    `- **MP games (cumulative):** ${e.total_mp_games}  (draws ${e.total_draws})`,
    `- **MP games last 30 days:** ${e.new_games_30d}`,
    `- **Distinct game-active users this week:** ${e.game_active_users_week}`,
    `- **MP rooms created this week:** ${e.rooms_created_week}  ·  paired ${e.rooms_paired_week}  →  pairing rate ${pairingRate}%`,
    ``,
    `## Monetization`,
    `- **Plus subscribers:** ${m.plus_total}`,
    `- **New Plus this week:** ${m.new_plus_week} ${deltaArrow(m.new_plus_week, m.new_plus_prev_week)} (prev ${m.new_plus_prev_week})`,
    `- **Plus profile churn this week:** ${m.plus_changed_week} (subs flipping is_plus on/off)`,
    ``,
    `## Network`,
    `- **Friendships total:** ${n.total_friendships} (accepted ${n.accepted_friendships})`,
    `- **New friendships this week:** ${n.new_friendships_week}`,
    `- **Tournaments active:** ${n.active_tournaments} (cumulative ${n.total_tournaments}, user-created ${n.user_created_tournaments})`,
    `- **New tournaments this week:** ${n.new_tournaments_week}`,
    `- **Tournament entries:** ${n.total_tournament_entries} cumulative · ${n.new_tournament_entries_week} this week`,
    `- **Push opt-ins:** ${n.total_push_subs} (web ${n.push_web} · iOS ${n.push_ios})`,
    ``,
    `---`,
    ``,
    `_Server-side counts cover online MP only — 1P and 2P hot-seat games live in localStorage and aren't in this report._`,
  ].join('\n');
}

function deltaArrow(curr: number, prev: number): string {
  if (prev === 0 && curr === 0) return '↔';
  if (prev === 0) return `↗ (∞%)`;
  const delta = curr - prev;
  const pct = Math.round((100 * delta) / prev);
  if (delta === 0) return '↔';
  return delta > 0 ? `↗ (+${pct}%)` : `↘ (${pct}%)`;
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// Tiny markdown → HTML for the email body. Not a full parser —
// just enough to render headings, bullets, bold, and horizontal
// rules nicely in an email client.
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = ['<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;line-height:1.55;color:#1a1c18;">'];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '---') {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push('<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />');
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1 style="font-size:1.6rem;margin:0 0 8px 0;">${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2 style="font-size:1.15rem;margin:18px 0 6px 0;color:#7a5b00;">${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) { html.push('<ul style="padding-left:20px;margin:6px 0;">'); inList = true; }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }
    if (line === '') {
      if (inList) { html.push('</ul>'); inList = false; }
      continue;
    }
    if (inList) { html.push('</ul>'); inList = false; }
    html.push(`<p style="margin:6px 0;">${renderInline(line)}</p>`);
  }
  if (inList) html.push('</ul>');
  html.push('</div>');
  return html.join('\n');
}

function renderInline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
