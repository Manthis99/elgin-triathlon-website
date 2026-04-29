const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const form = document.querySelector("[data-interest-form]");
const formNote = document.querySelector("[data-form-note]");
const countdown = document.querySelector("[data-countdown]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
    }
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

    try {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save your interest.");
      }

      formNote.textContent = `Got it, ${payload.name}. You're on the ${payload.distance} interest list.`;
      form.reset();
    } catch (error) {
      formNote.textContent =
        error instanceof Error ? error.message : "Could not save your interest.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (countdown) {
  const raceDay = new Date("2026-08-02T07:00:00-05:00").getTime();
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
