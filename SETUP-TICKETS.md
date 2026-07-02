# Selling Tickets — Setup Guide

This site sells $20 race tickets with **Stripe Payment Links** (no custom
checkout code) and automatically:

1. Charges the card and emails a Stripe receipt (built in, free).
2. Redirects the buyer to `success.html` — an animated on-screen ticket.
3. Fires a webhook that generates a ticket code, saves the sale to your
   database, and emails a **branded ticket** via Resend.

You track every sale in your **Stripe Dashboard** (name, email, distance,
amount, date — exportable to CSV).

**Cost:** $0 in monthly fees. Stripe takes 2.9% + 30¢ per sale (~$0.88 on
$20). Resend, Neon, and Vercel all run on free tiers at this volume.

---

## What's already built (in this repo)

| Piece | File |
| --- | --- |
| Buy button + distance picker | `index.html` (`#register`) + `script.js` |
| Animated success/ticket page | `success.html` |
| Fulfillment webhook (ticket + email) | `api/webhook.js` |
| Success-page personalization API | `api/session.js` |
| Shared ticket logic (DB, email, codes) | `lib/tickets.js` |
| Hosting config | `vercel.json` |

You only need to plug in accounts + keys below.

---

## 1. Deploy to Vercel (free — replaces GitHub Pages)

The branded email needs a tiny backend, which GitHub Pages can't run. Vercel
hosts the static site **and** the `api/` functions together for free.

1. Push this repo to GitHub (already connected).
2. At <https://vercel.com/new>, import the `elgin-triathlon-website` repo.
   Framework preset: **Other**. No build command needed.
3. Deploy. You'll get a URL like `https://elgin-triathlon.vercel.app`.

## 2. Create the Payment Link (Stripe)

1. In the Stripe Dashboard → **Product catalog** → add product
   "Elgin Triathlon Entry", price **$20 USD**, one-time.
2. **Payment Links** → create link for that product. Turn on:
   - **Collect customer name** (and email — on by default).
   - **Let customers adjust quantity** (for buying multiple entries).
   - *(Optional)* a custom field "Distance" if you'd rather Stripe ask than
     use the on-site picker. The on-site picker already passes distance via
     `client_reference_id`, so this is optional.
3. Under **After payment → Redirect customers to your page**, set:
   ```
   https://YOUR-VERCEL-URL/success.html?session_id={CHECKOUT_SESSION_ID}
   ```
4. Copy the payment link URL (looks like `https://buy.stripe.com/xxxxxxxx`).
5. In `index.html`, replace **both** occurrences of
   `https://buy.stripe.com/REPLACE_WITH_YOUR_LINK` (the `data-payment-link`
   and `href` on the buy button) with your real link.

## 3. Add the webhook (Stripe → your site)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR-VERCEL-URL/api/webhook`
3. Event to send: **`checkout.session.completed`**.
4. Copy the **Signing secret** (`whsec_...`).

## 4. Set up email (Resend — free)

1. Create an account at <https://resend.com>, add + verify a domain (or use
   their test sender to start).
2. Create an API key (`re_...`).
3. Your `TICKET_FROM_EMAIL` must use a verified domain,
   e.g. `Elgin Triathlon <tickets@yourdomain.com>`.

## 5. Database (Neon — free, you may already have this)

Reuses the same `DATABASE_URL` as the interest list. The `tickets` table is
created automatically on first sale. No action needed beyond having the URL.

## 6. Add environment variables in Vercel

Vercel → your project → **Settings → Environment Variables**. Add:

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_live_...` (or `sk_test_...` while testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 3 |
| `RESEND_API_KEY` | `re_...` from step 4 |
| `TICKET_FROM_EMAIL` | `Elgin Triathlon <tickets@yourdomain.com>` |
| `DATABASE_URL` | your Neon connection string |

Redeploy so they take effect.

---

## Test it (use Stripe test mode first)

1. Use test keys + a test Payment Link.
2. Buy a ticket with card `4242 4242 4242 4242`, any future expiry / CVC.
3. Confirm: you land on the animated ticket, get the branded email, and the
   sale shows in Stripe + the `tickets` table.
4. Flip everything to live keys when it works.

## Where your ticket list lives

- **Stripe Dashboard → Payments** — every buyer, exportable to CSV.
- **`tickets` table** in Neon — ticket code ↔ name/email/distance/amount.

## Local development

`npm start` still serves the static site at `http://localhost:4173` for
design work. To exercise the webhook locally, use the Stripe CLI:
`stripe listen --forward-to localhost:3000/api/webhook` with `vercel dev`.
