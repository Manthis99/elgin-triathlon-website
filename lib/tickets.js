// Shared ticketing logic — framework-agnostic so it can run from a Vercel
// serverless function or the local dev server. Handles: ticket-code
// generation, Neon persistence (idempotent per Stripe session), and the
// branded confirmation email via Resend.

const { neon } = require("@neondatabase/serverless");
const { Resend } = require("resend");

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

// Verified sender for the ticket email, e.g. "Elgin Triathlon <tickets@yourdomain.com>".
const fromEmail =
  process.env.TICKET_FROM_EMAIL || "Elgin Triathlon <tickets@example.com>";

const BRAND = {
  coral: "#ee5b48",
  coralDark: "#c9402f",
  ink: "#1a1612",
  paper: "#f6efe2",
  muted: "#5f686c",
};

let tableReady = false;

async function ensureTicketsTable() {
  if (!sql || tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ticket_code TEXT NOT NULL UNIQUE,
      stripe_session_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      distance TEXT,
      quantity INT NOT NULL DEFAULT 1,
      amount_total INT,
      currency TEXT,
      emailed BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
  tableReady = true;
}

// Human-friendly code like ELG-7KQ4M9 (no ambiguous 0/O/1/I/L).
function generateTicketCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `ELG-${code}`;
}

// Map the distance slugs our site sends via client_reference_id to labels.
const DISTANCE_LABELS = {
  sprint: "Sprint",
  olympic: "Olympic",
  "bike-run": "Bike + Run (no swim)",
};

// Pull the chosen distance out of a Stripe session. Prefers a Stripe custom
// field (if the Payment Link was configured with one), then falls back to the
// client_reference_id slug our own form appends to the checkout URL.
function extractDistance(session) {
  if (!session) return null;

  const fields = session.custom_fields;
  if (Array.isArray(fields)) {
    const field = fields.find(
      (f) => f.key === "distance" || /distance/i.test(f.key || "")
    );
    if (field) {
      if (field.dropdown && field.dropdown.value) return field.dropdown.value;
      if (field.text && field.text.value) return field.text.value;
    }
  }

  const ref = session.client_reference_id;
  if (ref) return DISTANCE_LABELS[ref] || ref;

  return null;
}

function formatMoney(amountTotal, currency) {
  if (typeof amountTotal !== "number") return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amountTotal / 100);
  } catch {
    return `$${(amountTotal / 100).toFixed(2)}`;
  }
}

async function getTicketBySession(sessionId) {
  if (!sql) return null;
  await ensureTicketsTable();
  const rows = await sql`
    SELECT * FROM tickets WHERE stripe_session_id = ${sessionId} LIMIT 1
  `;
  return rows[0] || null;
}

// Insert a ticket for this session if one doesn't already exist.
// Idempotent: repeated webhook deliveries return the existing row.
async function recordTicket({
  sessionId,
  name,
  email,
  distance,
  quantity,
  amountTotal,
  currency,
}) {
  if (!sql) {
    // No DB configured — still generate a code so email/tests can proceed.
    return { ticket_code: generateTicketCode(), emailed: false, isNew: true };
  }
  await ensureTicketsTable();

  const existing = await getTicketBySession(sessionId);
  if (existing) return { ...existing, isNew: false };

  const ticketCode = generateTicketCode();
  const rows = await sql`
    INSERT INTO tickets
      (ticket_code, stripe_session_id, name, email, distance, quantity, amount_total, currency)
    VALUES
      (${ticketCode}, ${sessionId}, ${name}, ${email}, ${distance}, ${quantity}, ${amountTotal}, ${currency})
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING *
  `;
  if (rows[0]) return { ...rows[0], isNew: true };

  // Lost an insert race — return whatever landed.
  const settled = await getTicketBySession(sessionId);
  return { ...settled, isNew: false };
}

async function markEmailed(sessionId) {
  if (!sql) return;
  await sql`UPDATE tickets SET emailed = TRUE WHERE stripe_session_id = ${sessionId}`;
}

function ticketEmailHtml({ name, ticketCode, distance, quantity, amountTotal, currency }) {
  const money = formatMoney(amountTotal, currency);
  const qty = quantity && quantity > 1 ? `${quantity} entries` : "1 entry";
  const distanceRow = distance
    ? `<tr><td style="padding:6px 0;color:${BRAND.muted};font-size:14px;">Distance</td>
         <td style="padding:6px 0;text-align:right;font-weight:700;color:${BRAND.ink};">${distance}</td></tr>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;background:${BRAND.paper};font-family:Georgia,'Times New Roman',serif;color:${BRAND.ink};">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <p style="font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:${BRAND.coralDark};margin:0 0 4px;">Elgin Triathlon</p>
      <h1 style="font-size:30px;margin:0 0 8px;">You're in, ${name}! 🎉</h1>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.muted};margin:0 0 24px;">
        Your spot for the August 29, 2026 Elgin Triathlon is confirmed. Here's your ticket — bring this code (or just your name) to check-in.
      </p>

      <div style="background:#fffdf7;border:2px dashed ${BRAND.coral};border-radius:16px;padding:24px;text-align:center;">
        <p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin:0 0 6px;">Confirmation code</p>
        <p style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:3px;color:${BRAND.coralDark};margin:0;">${ticketCode}</p>
      </div>

      <table style="width:100%;margin:24px 0;font-family:Arial,sans-serif;border-collapse:collapse;">
        ${distanceRow}
        <tr><td style="padding:6px 0;color:${BRAND.muted};font-size:14px;">Entries</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;">${qty}</td></tr>
        ${money ? `<tr><td style="padding:6px 0;color:${BRAND.muted};font-size:14px;">Paid</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;">${money}</td></tr>` : ""}
      </table>

      <div style="background:#fff;border:1px solid #e6ddc9;border-radius:12px;padding:18px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
        <strong style="display:block;margin-bottom:6px;">Race-day details</strong>
        Check-in 6:30 AM in front of the Elgin Center — bring your bike.<br>
        Swim starts 7:00 AM at the Elgin Lap Pool.
      </div>

      <p style="font-family:Arial,sans-serif;font-size:12px;color:${BRAND.muted};margin:24px 0 0;line-height:1.6;">
        A separate payment receipt has been sent by Stripe. Questions? Just reply to this email. See you at the finish line.
      </p>
    </div>
  </body>
</html>`;
}

async function sendTicketEmail({ name, email, ticketCode, distance, quantity, amountTotal, currency }) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping ticket email for", email);
    return { skipped: true };
  }
  return resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `🎟️ You're in! Elgin Triathlon ticket ${ticketCode}`,
    html: ticketEmailHtml({ name, ticketCode, distance, quantity, amountTotal, currency }),
  });
}

// Full fulfillment for a completed checkout session: retrieve full details,
// persist the ticket, and email it exactly once.
async function fulfillCheckout(stripe, session) {
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items", "customer_details"],
  });

  const details = full.customer_details || {};
  const email = details.email || full.customer_email;
  const name = details.name || "Racer";
  const distance = extractDistance(full);
  const quantity =
    (full.line_items &&
      full.line_items.data.reduce((n, li) => n + (li.quantity || 0), 0)) ||
    1;

  const ticket = await recordTicket({
    sessionId: full.id,
    name,
    email,
    distance,
    quantity,
    amountTotal: full.amount_total,
    currency: full.currency,
  });

  if (ticket.emailed) return ticket; // already handled by an earlier delivery

  if (email) {
    await sendTicketEmail({
      name,
      email,
      ticketCode: ticket.ticket_code,
      distance,
      quantity,
      amountTotal: full.amount_total,
      currency: full.currency,
    });
    await markEmailed(full.id);
  }

  return ticket;
}

module.exports = {
  ensureTicketsTable,
  generateTicketCode,
  extractDistance,
  formatMoney,
  getTicketBySession,
  recordTicket,
  markEmailed,
  ticketEmailHtml,
  sendTicketEmail,
  fulfillCheckout,
};
