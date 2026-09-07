const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const form = document.querySelector("[data-interest-form]");
const formNote = document.querySelector("[data-form-note]");
const countdown = document.querySelector("[data-countdown]");
const buyLink = document.querySelector("[data-buy-link]");
const buyDistance = document.querySelector("[data-buy-distance]");

// Route to a per-distance Stripe Payment Link (Sprint is capacity-limited,
// Bike + Run is unlimited), and carry the distance via client_reference_id so
// it flows through to the completed session and the fulfillment webhook.
if (buyLink) {
  const links = {
    sprint: buyLink.dataset.linkSprint,
    "bike-run": buyLink.dataset.linkBikerun,
  };
  const updateBuyLink = () => {
    const distance = (buyDistance && buyDistance.value) || "sprint";
    const base = links[distance] || links.sprint;
    const separator = base.includes("?") ? "&" : "?";
    buyLink.href = `${base}${separator}client_reference_id=${encodeURIComponent(distance)}`;
  };
  updateBuyLink();
  if (buyDistance) buyDistance.addEventListener("change", updateBuyLink);
}

if (navToggle && nav) {
  const closeNav = () => {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation");
    document.body.classList.remove("nav-open");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("nav-open", isOpen);
  });

  // Close when a link is tapped (closest handles nested markup) or the X.
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a") || event.target.closest("[data-nav-close]")) {
      closeNav();
    }
  });

  // Escape key also closes the menu.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) closeNav();
  });
}

if (form && formNote) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      distance: String(data.get("distance") || "").trim(),
    };

    if (!payload.name || !payload.email || !payload.distance) {
      formNote.textContent = "Please add your name, email, and preferred distance.";
      return;
    }

    formNote.textContent = "Saving...";
    submitButton.disabled = true;

    const successMessage = `Got it, ${payload.name}. You're on the ${payload.distance} interest list.`;

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        formNote.textContent = successMessage;
        form.reset();
        return;
      }

      formNote.textContent = result.message || "Something went wrong on our end. Try again in a moment.";
    } catch (error) {
      console.error("Interest submission failed", error);
      formNote.textContent = "Couldn't reach the server. Check your connection and try again.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (countdown) {
  const raceDay = new Date("2026-08-29T07:00:00-05:00").getTime();
  const daysEl = countdown.querySelector("[data-countdown-days]");
  const hoursEl = countdown.querySelector("[data-countdown-hours]");
  const minutesEl = countdown.querySelector("[data-countdown-minutes]");

  const pad = (value) => String(value).padStart(2, "0");

  const updateCountdown = () => {
    const remaining = Math.max(0, raceDay - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    daysEl.textContent = pad(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
  };

  updateCountdown();
  window.setInterval(updateCountdown, 60000);
}

/* ============================================================
   Post-event: "Do it again?" vote counter.
   Uses abacus.jasoncameron.dev — a free, no-auth public counter.
   localStorage guards against repeat clicks on the same browser.
   ============================================================ */
(function initVote() {
  const panel = document.querySelector("[data-vote-panel]");
  if (!panel) return;
  const button = panel.querySelector("[data-vote-button]");
  const label = panel.querySelector("[data-vote-label]");
  const countEl = panel.querySelector("[data-vote-count]");
  const NS = "elgin-triathlon";
  const KEY = "do-it-again-2027";
  const STORAGE = "et-voted-2027";
  const BASE = "https://abacus.jasoncameron.dev";

  const fmt = (n) => `${n} ${n === 1 ? "vote" : "votes"} so far`;

  const setVoted = () => {
    button.disabled = true;
    button.classList.add("voted");
    label.textContent = "Thanks — vote counted ✓";
  };

  const alreadyVoted = () => {
    try { return localStorage.getItem(STORAGE) === "1"; } catch { return false; }
  };
  const markVoted = () => {
    try { localStorage.setItem(STORAGE, "1"); } catch {}
  };

  const readCount = async () => {
    try {
      const r = await fetch(`${BASE}/get/${NS}/${KEY}`);
      if (r.status === 404) { countEl.textContent = fmt(0); return; }
      if (!r.ok) throw new Error("bad status");
      const data = await r.json();
      countEl.textContent = fmt(data.value ?? 0);
    } catch {
      countEl.textContent = "";
    }
  };

  const submitVote = async () => {
    button.disabled = true;
    label.textContent = "Counting…";
    try {
      const r = await fetch(`${BASE}/hit/${NS}/${KEY}`);
      if (!r.ok) throw new Error("bad status");
      const data = await r.json();
      markVoted();
      setVoted();
      countEl.textContent = fmt(data.value ?? 0);
    } catch {
      button.disabled = false;
      label.textContent = "Try again";
      countEl.textContent = "Couldn't reach the counter — refresh and retry.";
    }
  };

  if (alreadyVoted()) {
    setVoted();
  }
  button.addEventListener("click", () => {
    if (alreadyVoted()) return;
    submitVote();
  });
  readCount();
})();
