// Read-only lookup so the success page can greet the buyer by name and
// show their ticket code. Safe to call from the browser: it only returns
// non-sensitive confirmation details for a paid session.

const Stripe = require("stripe");
const { getTicketBySession, extractDistance } = require("../lib/tickets");

// Lazy so a missing key doesn't crash the function at load.
let stripeClient = null;
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!stripeClient) stripeClient = Stripe(key);
  return stripeClient;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const id =
    (req.query && req.query.id) ||
    new URL(req.url, "http://localhost").searchParams.get("id");

  if (!id) {
    res.status(400).json({ error: "Missing session id" });
    return;
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    // Not configured yet — let the success page use its graceful fallback.
    console.error("Session lookup config error:", err.message);
    res.status(200).json({ paid: false, configured: false });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["customer_details"],
    });

    if (session.payment_status !== "paid") {
      res.status(200).json({ paid: false });
      return;
    }

    const ticket = await getTicketBySession(id); // may be null if webhook is mid-flight
    const details = session.customer_details || {};

    res.status(200).json({
      paid: true,
      name: details.name || null,
      email: details.email || null,
      distance: extractDistance(session),
      quantity: ticket ? ticket.quantity : null,
      amountTotal: session.amount_total,
      currency: session.currency,
      ticketCode: ticket ? ticket.ticket_code : null,
    });
  } catch (err) {
    console.error("Session lookup failed:", err.message);
    res.status(404).json({ error: "Session not found" });
  }
};
