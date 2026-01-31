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

/* ------------------ UI / Manage view ------------------ */

function showManage(show) {
  const manage = el("manageView");
  if (manage) manage.classList.toggle("hidden", !show);

  const homeCard = el("homeCard"); // added in HTML fix
  if (homeCard) homeCard.classList.toggle("hidden", show);

  // Update button label
  const btnManage = el("btnManage");
  if (btnManage) btnManage.textContent = show ? "Home" : "Edit";
}

function populateVenues() {
  const sel = el("venueSelect");
  if (!sel) return;

  sel.innerHTML = "";
  const venues = [...state.venues].sort((a, b) => a.name.localeCompare(b.name));
  for (const v of venues) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name;
    sel.appendChild(opt);
  }
}

function renderGigList() {
  const list = el("gigList");
  if (!list) return;

  const q = (el("search")?.value || "").trim().toLowerCase();
  const sort = el("sort")?.value || "dateDesc";

  let gigs = [...state.gigs];

  if (q) {
    gigs = gigs.filter(g => {
      const vName = venueNameById(g.venueId).toLowerCase();
      const notes = (g.notes || "").toLowerCase();
      return vName.includes(q) || notes.includes(q);
    });
  }

  if (sort === "dateAsc") gigs.sort((a, b) => a.date.localeCompare(b.date));
  if (sort === "dateDesc") gigs.sort((a, b) => b.date.localeCompare(a.date));
  if (sort === "venueAsc") gigs.sort((a, b) => venueNameById(a.venueId).localeCompare(venueNameById(b.venueId)));

  list.innerHTML = "";

  if (!gigs.length) {
    list.innerHTML = `<div class="muted tiny">No gigs yet.</div>`;
    return;
  }

  for (const g of gigs) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="row space">
        <div>
          <strong>${isoToDDMMYYYY(g.date)}${g.cancelled ? " (CANCELLED)" : ""}</strong>
          <div class="tiny muted">${venueNameById(g.venueId)}${g.notes ? " • " + escapeHtml(g.notes) : ""}</div>
        </div>
        <button class="btn btn-secondary" type="button" data-edit="${g.id}">Edit</button>
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => startEditGig(btn.getAttribute("data-edit")));
  });
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function resetForm() {
  state.ui.editingId = null;

  el("formTitle") && (el("formTitle").textContent = "New gig");
  if (el("gigDate")) el("gigDate").value = "";
  if (el("startTime")) el("startTime").value = "";
  if (el("endTime")) el("endTime").value = "";
  if (el("feeType")) el("feeType").value = "paid";
  if (el("fee")) el("fee").value = "";
  if (el("paymentMethod")) el("paymentMethod").value = "Cash";
  if (el("cancelled")) el("cancelled").value = "no";
  if (el("driver")) el("driver").value = "A";
  if (el("notes")) el("notes").value = "";
  if (el("useOverrideMiles")) el("useOverrideMiles").checked = false;
  if (el("oneWayMiles")) el("oneWayMiles").value = "";

  updateCalcUI();
}

function startEditGig(id) {
  const g = state.gigs.find(x => x.id === id);
  if (!g) return;

  state.ui.editingId = id;
  el("formTitle") && (el("formTitle").textContent = "Edit gig");

  if (el("gigDate")) el("gigDate").value = g.date || "";
  if (el("venueSelect")) el("venueSelect").value = g.venueId || "";
  if (el("startTime")) el("startTime").value = g.startTime || "";
  if (el("endTime")) el("endTime").value = g.endTime || "";
  if (el("feeType")) el("feeType").value = g.isFree ? "free" : "paid";
  if (el("fee")) el("fee").value = g.fee ?? "";
  if (el("paymentMethod")) el("paymentMethod").value = g.paymentMethod || "Cash";
  if (el("cancelled")) el("cancelled").value = g.cancelled ? "yes" : "no";
  if (el("driver")) el("driver").value = g.driver || "A";
  if (el("notes")) el("notes").value = g.notes || "";
  if (el("useOverrideMiles")) el("useOverrideMiles").checked = !!g.overrideMiles;
  if (el("oneWayMiles")) el("oneWayMiles").value = (g.overrideMiles ?? g.oneWayMiles ?? "");

  updateCalcUI();

  el("formCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getSelectedVenue() {
  const vid = el("venueSelect")?.value;
  return state.venues.find(v => v.id === vid) || null;
}

function getOneWayMiles() {
  const venue = getSelectedVenue();
  const overrideOn = !!el("useOverrideMiles")?.checked;
  const overrideVal = parseFloat(el("oneWayMiles")?.value || "");
  const venueMiles = venue?.miles ?? 0;

  if (overrideOn && Number.isFinite(overrideVal)) return Math.max(0, Math.round(overrideVal));
  return Math.max(0, Math.round(venueMiles));
}

function updateCalcUI() {
  const feeType = el("feeType")?.value || "paid";
  const fee = parseFloat(el("fee")?.value || "0");
  const driver = el("driver")?.value || "A";
  const oneWayMiles = getOneWayMiles();

  const bandPill = el("distanceBandPill");
  if (bandPill) {
    const band = SETTINGS.bands.find(b => oneWayMiles >= b.min && oneWayMiles <= b.max);
    bandPill.textContent = band ? band.name : "—";
  }

  if (feeType === "free" || !Number.isFinite(fee) || fee <= 0) {
    el("roundTripMiles") && (el("roundTripMiles").textContent = `${oneWayMiles * 2}`);
    el("mileagePayout") && (el("mileagePayout").textContent = money(Math.round((oneWayMiles * 2) * SETTINGS.mileageRate)));
    el("remainingAfterMileage") && (el("remainingAfterMileage").textContent = "—");
    el("baseSplitRaw") && (el("baseSplitRaw").textContent = "—");
    el("personAAmount") && (el("personAAmount").textContent = "—");
    el("personBAmount") && (el("personBAmount").textContent = "—");
    return;
  }

  const calc = calcGig({ fee, oneWayMiles, driver });

  el("roundTripMiles") && (el("roundTripMiles").textContent = `${calc.roundTripMiles}`);
  el("mileagePayout") && (el("mileagePayout").textContent = money(calc.mileagePayout));
  el("remainingAfterMileage") && (el("remainingAfterMileage").textContent = money(Math.round(fee) - calc.mileagePayout));
  el("baseSplitRaw") && (el("baseSplitRaw").textContent = money((Math.round(fee) - calc.mileagePayout) / 2));

  el("personALabel") && (el("personALabel").textContent = PEOPLE.A);
  el("personBLabel") && (el("personBLabel").textContent = PEOPLE.B);
  el("personAAmount") && (el("personAAmount").textContent = money(calc.payoutA));
  el("personBAmount") && (el("personBAmount").textContent = money(calc.payoutB));
}

function saveGigFromForm() {
  const date = el("gigDate")?.value;
  const venueId = el("venueSelect")?.value;
  if (!date || !venueId) {
    alert("Please choose a date and venue.");
    return;
  }

  const isFree = (el("feeType")?.value || "paid") === "free";
  const fee = isFree ? 0 : Math.max(0, Math.round(parseFloat(el("fee")?.value || "0")));
  const cancelled = (el("cancelled")?.value || "no") === "yes";
  const driver = el("driver")?.value || "A";
  const oneWayMiles = getSelectedVenue()?.miles ?? 0;
  const overrideMiles = el("useOverrideMiles")?.checked ? getOneWayMiles() : null;

  const calc = (!isFree && fee > 0) ? calcGig({ fee, oneWayMiles: overrideMiles ?? oneWayMiles, driver }) : null;

  const gig = {
    id: state.ui.editingId || uid(),
    date,
    venueId,
    startTime: el("startTime")?.value || "",
    endTime: el("endTime")?.value || "",
    isFree,
    fee,
    paymentMethod: el("paymentMethod")?.value || "Cash",
    cancelled,
    driver,
    notes: el("notes")?.value || "",
    oneWayMiles,
    overrideMiles,
    roundTripMiles: calc?.roundTripMiles ?? (getOneWayMiles() * 2),
    mileagePayout: calc?.mileagePayout ?? Math.round((getOneWayMiles() * 2) * SETTINGS.mileageRate),
    payoutA: calc?.payoutA ?? 0,
    payoutB: calc?.payoutB ?? 0,
  };

  const existingIndex = state.gigs.findIndex(g => g.id === gig.id);
  if (existingIndex >= 0) state.gigs[existingIndex] = gig;
  else state.gigs.push(gig);

  saveState();
  renderUpcoming();
  renderGigList();
  renderDebtForecast();

  // Simple "saved" message
  const msg = el("saveMsg");
  if (msg) {
    msg.textContent = "Saved";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 1200);
  }

  resetForm();
}

function exportJson() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tss-gig-calendar.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      if (!parsed || !Array.isArray(parsed.gigs) || !Array.isArray(parsed.venues)) {
        alert("That file doesn't look like a valid export.");
        return;
      }
      state.gigs = parsed.gigs;
      state.venues = parsed.venues;
      state.ui = parsed.ui || {};
      saveState();
      populateVenues();
      renderUpcoming();
      renderGigList();
  renderDebtForecast();
      resetForm();
      alert("Import complete.");
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
}


/* ------------------ Debt forecast ------------------ */

function ensureDebtState() {
  state.debts ??= {
    capitalOne: { name: "Capital One", balance: 1389.72, apr: 24, minType: "percent", minValue: 3 },
    mbna: { name: "MBNA", balance: 4105.74, apr: 24, minType: "fixed", minValue: 181.91 }
  };
  state.extraPayments ??= []; // [{id,date,amount,target,note,cancelled,createdAt}]
  state.debtStartIso ??= todayIso();
}

function monthKeyFromIso(iso) {
  return (iso || "").slice(0, 7); // YYYY-MM
}

function clampMoney(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function addMonthlyInterest(balance, apr) {
  if (balance <= 0) return 0;
  const r = clampMoney(apr) / 100 / 12; // monthly approx
  return clampMoney(balance * r);
}

function computeMinimum(balance, debt) {
  if (balance <= 0) return 0;
  if (debt.minType === "fixed") return Math.min(balance, clampMoney(debt.minValue));
  const pct = clampMoney(debt.minValue);
  return Math.min(balance, clampMoney((balance * pct) / 100));
}

function sumGigIncomeByMonth() {
  const byMonth = {};
  for (const g of state.gigs || []) {
    if (!g?.date) continue;
    if (g.cancelled) continue;
    if (g.isFree) continue;

    const k = monthKeyFromIso(g.date);
    const amt = clampMoney(g.payoutA ?? 0); // Steve is always A
    if (amt <= 0) continue;

    byMonth[k] = (byMonth[k] || 0) + amt;
  }
  return byMonth;
}

function sumExtraPaymentsByMonthAndTarget() {
  const byMonth = {}; // { "YYYY-MM": { capitalOne: 0, mbna: 0 } }

  for (const p of state.extraPayments || []) {
    if (!p?.date) continue;
    if (p.cancelled) continue;

    const k = monthKeyFromIso(p.date);
    const amt = clampMoney(p.amount ?? 0);
    if (amt <= 0) continue;

    const t = p.target;
    if (t !== "capitalOne" && t !== "mbna") continue;

    byMonth[k] ??= { capitalOne: 0, mbna: 0 };
    byMonth[k][t] = clampMoney(byMonth[k][t] + amt);
  }

  return byMonth;
}

function allocateGigs(extra, capBal, mbnaBal) {
  // Rule: gig money -> Capital One first, then MBNA
  let capPay = 0;
  let mbnaPay = 0;

  if (extra > 0 && capBal > 0) {
    capPay = Math.min(extra, capBal);
    extra -= capPay;
  }
  if (extra > 0 && mbnaBal > 0) {
    mbnaPay = Math.min(extra, mbnaBal);
    extra -= mbnaPay;
  }

  return { capPay: clampMoney(capPay), mbnaPay: clampMoney(mbnaPay) };
}

function forecastMonthly({ startIso, maxMonths = 240 } = {}) {
  ensureDebtState();

  const start = (startIso || state.debtStartIso || todayIso()).slice(0, 7); // YYYY-MM
  const gigByMonth = sumGigIncomeByMonth();
  const extraByMonth = sumExtraPaymentsByMonthAndTarget();

  const cap = state.debts.capitalOne;
  const mbn = state.debts.mbna;

  let capBal = clampMoney(cap.balance);
  let mbnaBal = clampMoney(mbn.balance);

  const rows = [];

  let y = parseInt(start.slice(0, 4), 10);
  let m = parseInt(start.slice(5, 7), 10); // 1..12

  let capClearMonth = null;
  let mbnaClearMonth = null;

  for (let i = 0; i < maxMonths; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;

    // interest first (approx)
    const capInt = addMonthlyInterest(capBal, cap.apr);
    const mbnaInt = addMonthlyInterest(mbnaBal, mbn.apr);
    capBal = clampMoney(capBal + capInt);
    mbnaBal = clampMoney(mbnaBal + mbnaInt);

    // then minimums
    const capMin = computeMinimum(capBal, cap);
    const mbnaMin = computeMinimum(mbnaBal, mbn);
    capBal = clampMoney(capBal - capMin);
    mbnaBal = clampMoney(mbnaBal - mbnaMin);

    // manual extras (targeted)
    const targeted = extraByMonth[key] || { capitalOne: 0, mbna: 0 };
    const capManual = Math.min(clampMoney(targeted.capitalOne), capBal);
    capBal = clampMoney(capBal - capManual);

    const mbnaManual = Math.min(clampMoney(targeted.mbna), mbnaBal);
    mbnaBal = clampMoney(mbnaBal - mbnaManual);

    // gigs (auto rule)
    const gigIncome = clampMoney(gigByMonth[key] || 0);
    const alloc = allocateGigs(gigIncome, capBal, mbnaBal);
    capBal = clampMoney(capBal - alloc.capPay);
    mbnaBal = clampMoney(mbnaBal - alloc.mbnaPay);

    if (!capClearMonth && capBal <= 0.01) capClearMonth = key;
    if (!mbnaClearMonth && mbnaBal <= 0.01) mbnaClearMonth = key;

    rows.push({
      month: key,
      gigIncome,
      capMin,
      mbnaMin,
      capManualExtra: capManual,
      mbnaManualExtra: mbnaManual,
      capExtraFromGigs: alloc.capPay,
      mbnaExtraFromGigs: alloc.mbnaPay,
      capBalance: Math.max(0, capBal),
      mbnaBalance: Math.max(0, mbnaBal),
    });

    if (capBal <= 0.01 && mbnaBal <= 0.01) break;

    m++;
    if (m === 13) { m = 1; y++; }
  }

  return { rows, capClearMonth, mbnaClearMonth };
}

function addExtraPayment({ date, amount, target, note = "" }) {
  ensureDebtState();
  const amt = clampMoney(amount);
  if (!date || amt <= 0) return;
  if (target !== "capitalOne" && target !== "mbna") return;

  state.extraPayments.push({
    id: uid(),
    date,
    amount: amt,
    target,
    note,
    cancelled: false,
    createdAt: Date.now()
  });

  saveState();
}

function renderDebtForecast() {
  ensureDebtState();

  const box = el("debtForecast");
  if (!box) return;

  const out = forecastMonthly();
  const capDate = out.capClearMonth || "—";
  const mbnaDate = out.mbnaClearMonth || "—";

  box.innerHTML = `
    <div class="item">
      <div class="top">
        <div>
          <div class="title">Estimated payoff dates</div>
          <div class="meta">Monthly approximation. Updates when you add gigs or payments.</div>
        </div>
      </div>
      <div class="nums">
        <div>Capital One: <strong>${capDate}</strong></div>
        <div>MBNA: <strong>${mbnaDate}</strong></div>
      </div>
    </div>
  `;
}


function syncDebtInputsToState() {
  ensureDebtState();

  const cap = state.debts.capitalOne;
  const mbn = state.debts.mbna;

  const capBalance = parseFloat(el("capBalance")?.value || "");
  const capApr = parseFloat(el("capApr")?.value || "");
  const capMinPct = parseFloat(el("capMinPct")?.value || "");

  const mbnaBalance = parseFloat(el("mbnaBalance")?.value || "");
  const mbnaApr = parseFloat(el("mbnaApr")?.value || "");
  const mbnaMin = parseFloat(el("mbnaMin")?.value || "");

  if (Number.isFinite(capBalance)) cap.balance = clampMoney(capBalance);
  if (Number.isFinite(capApr)) cap.apr = clampMoney(capApr);
  if (Number.isFinite(capMinPct)) { cap.minType = "percent"; cap.minValue = clampMoney(capMinPct); }

  if (Number.isFinite(mbnaBalance)) mbn.balance = clampMoney(mbnaBalance);
  if (Number.isFinite(mbnaApr)) mbn.apr = clampMoney(mbnaApr);
  if (Number.isFinite(mbnaMin)) { mbn.minType = "fixed"; mbn.minValue = clampMoney(mbnaMin); }

  saveState();
}

function syncDebtStateToInputs() {
  ensureDebtState();
  const cap = state.debts.capitalOne;
  const mbn = state.debts.mbna;

  if (el("capBalance")) el("capBalance").value = cap.balance ?? "";
  if (el("capApr")) el("capApr").value = cap.apr ?? "";
  if (el("capMinPct")) el("capMinPct").value = cap.minValue ?? "";

  if (el("mbnaBalance")) el("mbnaBalance").value = mbn.balance ?? "";
  if (el("mbnaApr")) el("mbnaApr").value = mbn.apr ?? "";
  if (el("mbnaMin")) el("mbnaMin").value = mbn.minValue ?? "";

  if (el("extraPayDate")) el("extraPayDate").value = todayIso();
}


/* ------------------ Events ------------------ */

el("btnShareWhatsApp")?.addEventListener("click", () => {
  const msg = buildWhatsAppMessage();
  window.open("https://wa.me/447544147085?text=" + encodeURIComponent(msg), "_blank");
});

el("btnManage")?.addEventListener("click", () => {
  const showing = !el("manageView")?.classList.contains("hidden");
  showManage(!showing);
});

el("btnNewGigTop")?.addEventListener("click", () => {
  showManage(true);
  resetForm();
  el("formCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

el("btnClearForm")?.addEventListener("click", resetForm);

el("btnSaveGig")?.addEventListener("click", saveGigFromForm);

el("search")?.addEventListener("input", renderGigList);
el("sort")?.addEventListener("change", renderGigList);

["feeType", "fee", "driver", "venueSelect", "useOverrideMiles", "oneWayMiles"].forEach(id => {
  el(id)?.addEventListener("input", updateCalcUI);
  el(id)?.addEventListener("change", updateCalcUI);
});

el("btnExport")?.addEventListener("click", exportJson);


el("btnSaveDebtSettings")?.addEventListener("click", () => {
  syncDebtInputsToState();
  renderDebtForecast();
});

el("btnRecalcDebt")?.addEventListener("click", () => {
  syncDebtInputsToState();
  renderDebtForecast();
});

el("btnAddExtraPayment")?.addEventListener("click", () => {
  const date = el("extraPayDate")?.value;
  const amount = parseFloat(el("extraPayAmount")?.value || "0");
  const target = el("extraPayTarget")?.value;
  const note = el("extraPayNote")?.value || "";

  addExtraPayment({ date, amount, target, note });

  if (el("extraPayAmount")) el("extraPayAmount").value = "";
  if (el("extraPayNote")) el("extraPayNote").value = "";

  renderDebtForecast();
});

el("btnImport")?.addEventListener("click", () => el("importFile")?.click());
el("importFile")?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (file) importJsonFile(file);
  e.target.value = "";
});

el("btnClearAll")?.addEventListener("click", () => {
  if (!confirm("Clear ALL saved data?")) return;
  state.gigs = [];
  state.venues = [];
  state.ui = {};
  saveState();
  populateVenues();
  renderUpcoming();
  renderGigList();
  renderDebtForecast();
  resetForm();
});

/* ------------------ Venue dialog ------------------ */

el("btnNewVenue")?.addEventListener("click", () => el("venueDialog")?.showModal());

el("btnCancelVenue")?.addEventListener("click", () => el("venueDialog")?.close());

el("venueDialog")?.addEventListener("close", () => {
  // no-op: form method=dialog handles ok/cancel
});

document.querySelector("#venueDialog form")?.addEventListener("submit", (e) => {
  // submit fires for "ok"
  const name = el("venueName")?.value?.trim();
  const milesVal = parseFloat(el("venueMiles")?.value || "");
  if (!name || !Number.isFinite(milesVal)) return;

  const venue = {
    id: uid(),
    name,
    miles: Math.max(0, Math.round(milesVal)),
    start: el("venueStart")?.value || "",
    end: el("venueEnd")?.value || "",
    notes: el("venueNotes")?.value || ""
  };

  state.venues.push(venue);
  saveState();
  populateVenues();
  if (el("venueSelect")) el("venueSelect").value = venue.id;
  updateCalcUI();
});

/* ------------------ Init ------------------ */

(function init() {
  // Home widgets
  renderUpcoming();

  // Manage
  populateVenues();
  renderGigList();
  renderDebtForecast();
  resetForm();

  // Debt
  syncDebtStateToInputs();
  renderDebtForecast();

  // Start on home
  showManage(false);
})();
