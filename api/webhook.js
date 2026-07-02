// Stripe webhook — the source of truth for fulfillment. Runs on Vercel
// (or any Node serverless host). Verifies the signature, then on a
// completed checkout generates + emails the branded ticket exactly once.
//
// Body parsing must be OFF so we can verify the raw payload signature.

const Stripe = require("stripe");
const { fulfillCheckout } = require("../lib/tickets");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end("Method not allowed");
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).end(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    try {
      await fulfillCheckout(stripe, event.data.object);
    } catch (err) {
      console.error("Fulfillment failed:", err);
      // 500 tells Stripe to retry the delivery later.
      res.status(500).end("Fulfillment error");
      return;
    }
  }

  res.status(200).json({ received: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
