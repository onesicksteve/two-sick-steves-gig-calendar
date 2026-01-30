const STORAGE_KEY = "tssGigCalendar_v1";

const PEOPLE = { A: "Steve White", B: "Steve Watson-Jones" };
const SETTINGS = {
  base: "Colwyn Bay",
  mileageRate: 0.45,
  upcomingCount: 3,
  bands: [
    { name: "Local", min: 0, max: 20, minimumFee: 250 },
    { name: "Travel", min: 21, max: 50, minimumFee: 300 },
    { name: "Destination", min: 51, max: Infinity, minimumFee: 350 },
  ],
};

/* ------------------ Helpers ------------------ */

function isoToDDMMYYYY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function money(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return `£${Math.round(n)}`;
}

function roundToNearest10(n) {
  return Math.round(n / 10) * 10;
}

function getBand(oneWayMiles) {
  const m = Math.max(0, Math.round(oneWayMiles || 0));
  return SETTINGS.bands.find(b => m >= b.min && m <= b.max);
}

/* ------------------ Storage ------------------ */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { venues: [], gigs: [], ui: {} };
    return JSON.parse(raw);
  } catch {
    return { venues: [], gigs: [], ui: {} };
  }
}

const state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ------------------ DOM helpers ------------------ */

const el = id => document.getElementById(id);

/* ------------------ Venue helpers ------------------ */

function venueNameById(id) {
  return state.venues.find(v => v.id === id)?.name || "(unknown venue)";
}

/* ------------------ Gig maths ------------------ */

function calcGig({ fee, oneWayMiles, driver }) {
  const feeInt = Math.round(fee);
  const rt = oneWayMiles * 2;
  const mileage = Math.round(rt * SETTINGS.mileageRate);
  const remaining = feeInt - mileage;
  const baseSplit = remaining / 2;

  const driverKey = driver === "B" ? "B" : "A";
  const driverTotal = roundToNearest10(mileage + baseSplit);
  const otherTotal = feeInt - driverTotal;

  return {
    roundTripMiles: rt,
    mileagePayout: mileage,
    driverKey,
    payoutA: driverKey === "A" ? driverTotal : otherTotal,
    payoutB: driverKey === "B" ? driverTotal : otherTotal,
  };
}

/* ------------------ Rendering ------------------ */

function renderUpcoming() {
  const today = todayIso();

  const gigs = state.gigs
    .filter(g => g.date >= today && !g.cancelled)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, SETTINGS.upcomingCount);

  const list = el("upcomingList");
  list.innerHTML = "";

  if (!gigs.length) {
    list.innerHTML = `<div class="muted tiny">No upcoming gigs</div>`;
    return;
  }

  for (const g of gigs) {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="top">
        <div>
          <div class="title">${isoToDDMMYYYY(g.date)}</div>
          <div class="meta">${venueNameById(g.venueId)}</div>
        </div>
        ${g.isFree ? `<div class="tag-free">FREE</div>` : `<div class="pill">£${g.fee}</div>`}
      </div>
      <div class="nums">
        ${
          g.isFree
            ? "<strong>Free gig</strong>"
            : `${PEOPLE.A}: <strong>£${g.payoutA}</strong> • ${PEOPLE.B}: <strong>£${g.payoutB}</strong>`
        }
      </div>
    `;

    list.appendChild(div);
  }
}

/* ------------------ WhatsApp (FULL LIST) ------------------ */

function buildWhatsAppMessage() {
  const gigs = state.gigs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));


  if (!gigs.length) {
    return "Two Sick Steves – Gig list\n\n(No gigs saved)";
  }

  const lines = [];
  lines.push("Two Sick Steves – Gig list");
  lines.push("");

  for (const g of gigs) {
    const cancelled = g.cancelled ? " (CANCELLED)" : "";
    lines.push(`${isoToDDMMYYYY(g.date)}${cancelled}`);
    lines.push(venueNameById(g.venueId));

    if (g.isFree) {
      lines.push("Free gig");
    } else {
      lines.push(`Your share: £${g.payoutB}`);
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

/* ------------------ Events ------------------ */

el("btnShareWhatsApp")?.addEventListener("click", () => {
  const msg = buildWhatsAppMessage();
  window.open(
    "https://wa.me/447544147085?text=" + encodeURIComponent(msg),
    "_blank"
  );
});

/* ------------------ Init ------------------ */

renderUpcoming();
