
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

function isoToDDMMYYYY(iso) {
  if (!iso || typeof iso !== "string" || iso.length < 10) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function money(n) { if (Number.isNaN(n) || n === null || n === undefined) return "—"; return `£${Math.round(n)}`; }
function roundToNearest10(n) { return Math.round(n / 10) * 10; }
function getBand(oneWayMiles) {
  const m = Math.max(0, Math.round(oneWayMiles || 0));
  for (const b of SETTINGS.bands) if (m >= b.min && m <= b.max) return b;
  return SETTINGS.bands[SETTINGS.bands.length - 1];
}
function calcGig({ fee, oneWayMiles, driver }) {
  const feeInt = Math.max(0, Math.round(fee || 0));
  const ow = Math.max(0, Math.round(oneWayMiles || 0));
  const rt = ow * 2;

  const mileagePayout = Math.round(rt * SETTINGS.mileageRate);
  const remaining = feeInt - mileagePayout;
  const baseSplit = remaining / 2;

  const driverKey = driver === "B" ? "B" : "A";
  const otherKey = driverKey === "A" ? "B" : "A";

  const driverTotalRaw = mileagePayout + baseSplit;
  const driverTotalRounded = roundToNearest10(driverTotalRaw);
  const otherTotal = feeInt - driverTotalRounded;

  return { fee: feeInt, oneWayMiles: ow, roundTripMiles: rt, mileagePayout, remainingAfterMileage: remaining, baseSplitRaw: baseSplit, driverKey, otherKey, driverTotalRounded, otherTotal };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { venues: [], gigs: [], ui: { bannerDismissed: false } };
    const parsed = JSON.parse(raw);
    parsed.venues ||= [];
    parsed.gigs ||= [];
    parsed.ui ||= { bannerDismissed: false };
    return parsed;
  } catch {
    return { venues: [], gigs: [], ui: { bannerDismissed: false } };
  }
}
const state = loadState();
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const el = (id) => document.getElementById(id);

const todayLabel = el("todayLabel");
const upcomingList = el("upcomingList");
const btnNewGigTop = el("btnNewGigTop");
const btnShareWhatsApp = el("btnShareWhatsApp");
const allGigsCard = el("allGigsCard");
const search = el("search");
const sort = el("sort");
const gigList = el("gigList");
const btnClearAll = el("btnClearAll");

const formCard = el("formCard");
const formTitle = el("formTitle");
const gigDate = el("gigDate");
const venueSelect = el("venueSelect");
const lockVenueDefaults = el("lockVenueDefaults");
const btnNewVenue = el("btnNewVenue");
const startTime = el("startTime");
const endTime = el("endTime");
const fee = el("fee");
const feeType = el("feeType");
const feeWarn = el("feeWarn");
const clashWarn = el("clashWarn");
const paymentMethod = el("paymentMethod");
const cancelled = el("cancelled");
const driver = el("driver");
const notes = el("notes");

const useOverrideMiles = el("useOverrideMiles");
const oneWayMiles = el("oneWayMiles");
const distanceBandPill = el("distanceBandPill");
const minFeeWarn = el("minFeeWarn");

const roundTripMiles = el("roundTripMiles");
const mileagePayout = el("mileagePayout");
const remainingAfterMileage = el("remainingAfterMileage");
const baseSplitRaw = el("baseSplitRaw");
const personALabel = el("personALabel");
const personBLabel = el("personBLabel");
const personAAmount = el("personAAmount");
const personBAmount = el("personBAmount");

const btnSaveGig = el("btnSaveGig");
const btnClearForm = el("btnClearForm");
const saveMsg = el("saveMsg");
const postSaveBar = el("postSaveBar");
const btnSendToSteve = el("btnSendToSteve");

const venueDialog = el("venueDialog");
const venueName = el("venueName");
const venueMiles = el("venueMiles");
const venueStart = el("venueStart");
const venueEnd = el("venueEnd");
const venueNotes = el("venueNotes");
const btnCancelVenue = el("btnCancelVenue");

const btnExport = el("btnExport");
const btnImport = el("btnImport");
const btnManage = el("btnManage");
const manageView = el("manageView");
const importFile = el("importFile");

const installBanner = el("installBanner");
const btnDismissBanner = el("btnDismissBanner");
const btnInstall = el("btnInstall");

let editingGigId = null;
let deferredPrompt = null;

function venueNameById(id) { return state.venues.find(v => v.id === id)?.name || "(unknown venue)"; }
function formatTimeRange(s,e){ if(!s && !e) return ""; if(s && e) return `${s}–${e}`; return s || e; }
function monthKey(iso){ const [y,m]=(iso||"").split("-"); if(!y||!m) return ""; return `${y}-${m}`; }
function monthLabelFromKey(key){
  const [y,m]=key.split("-");
  const names=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx=Math.max(0,Math.min(11,parseInt(m,10)-1));
  return `${names[idx]} ${y}`;
}
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }


function icsEscape(str){
  return String(str||"")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}
function isoToICSDate(iso){
  const [y,m,d]=(iso||"").split("-");
  if(!y||!m||!d) return "";
  return `${y}${m}${d}`;
}
function timeToICS(t){
  // "HH:MM" -> "HHMM00"
  if(!t) return "";
  const parts = String(t).split(":");
  if(parts.length<2) return "";
  const hh = parts[0].padStart(2,"0");
  const mm = parts[1].padStart(2,"0");
  return `${hh}${mm}00`;
}
function downloadTextFile(filename, text, mime){
  const blob = new Blob([text], {type: mime || "text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}
function buildICSForGig(g){
  const vName = venueNameById(g.venueId);
  const summary = `Two Sick Steves – ${vName}`;
  const dt = isoToICSDate(g.date);
  const uid = `${g.id}@two-sick-steves`;
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,"0")}${String(now.getUTCDate()).padStart(2,"0")}T${String(now.getUTCHours()).padStart(2,"0")}${String(now.getUTCMinutes()).padStart(2,"0")}${String(now.getUTCSeconds()).padStart(2,"0")}Z`;

  const hasTime = !!(g.startTime || g.endTime);
  let lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Two Sick Steves//Gig Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${icsEscape(uid)}`);
  lines.push(`DTSTAMP:${stamp}`);
  lines.push(`SUMMARY:${icsEscape(summary)}`);
  lines.push(`LOCATION:${icsEscape(vName)}`);

  let desc = [];
  if(g.isFree) desc.push("Free gig");
  else desc.push(`Fee: £${g.fee} (${g.paymentMethod||"Cash"})`);
  if(!g.isFree) desc.push(`Your share: £${g.payoutB}`);
  if(g.notes) desc.push(`Notes: ${g.notes}`);
  lines.push(`DESCRIPTION:${icsEscape(desc.join("\n"))}`);

  if(!hasTime){
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    const d = new Date(`${g.date}T00:00:00`);
    d.setDate(d.getDate()+1);
    const dtEnd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
  } else {
    const st = timeToICS(g.startTime) || "000000";
    let et = timeToICS(g.endTime);
    if(!et){
      const d = new Date(`${g.date}T${g.startTime||"00:00"}:00`);
      d.setHours(d.getHours()+2);
      et = `${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}00`;
    }
    lines.push(`DTSTART:${dt}T${st}`);
    lines.push(`DTEND:${dt}T${et}`);
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function addGigToCalendar(gigId){
  const g = state.gigs.find(x=>x.id===gigId);
  if(!g) return;
  const vName = venueNameById(g.venueId);
  const safeVenue = (vName||"venue").replace(/[^a-z0-9]+/gi,"-").replace(/(^-|-$)/g,"").toLowerCase();
  const filename = `tss-gig-${g.date}-${safeVenue}.ics`;
  const ics = buildICSForGig(g);
  downloadTextFile(filename, ics, "text/calendar;charset=utf-8");
}

function renderVenueSelect(){
  const venues = state.venues.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  venueSelect.innerHTML="";
  if(!venues.length){
    const opt=document.createElement("option"); opt.value=""; opt.textContent="Add a venue first";
    venueSelect.appendChild(opt);
    return;
  }
  for(const v of venues){
    const opt=document.createElement("option"); opt.value=v.id; opt.textContent=v.name;
    venueSelect.appendChild(opt);
  }
}
function getSelectedVenue(){ return state.venues.find(v=>v.id===venueSelect.value)||null; }

function applyVenueDefaults(){
  const v=getSelectedVenue(); if(!v) return;
  if(!useOverrideMiles.checked){ oneWayMiles.value=String(Math.round(v.oneWayMiles||0)); oneWayMiles.disabled=true; }
  else { oneWayMiles.disabled=false; }
  if(!(lockVenueDefaults && lockVenueDefaults.checked)){
    if(v.usualStart) startTime.value=v.usualStart;
    if(v.usualEnd) endTime.value=v.usualEnd;
    // Suggested fee: last paid fee at this venue
    if(feeType && feeType.value==="paid" && v.lastFee && Number(v.lastFee)>0){
      fee.value = String(Math.round(Number(v.lastFee)));
    }
  }
}

function renderBandAndWarnings(){
  const ow=Math.max(0,Math.round(Number(oneWayMiles.value||0)));
  const band=getBand(ow);
  distanceBandPill.textContent=`${band.name} • min £${band.minimumFee}`;
  const feeVal=Math.max(0,Math.round(Number(fee.value||0)));

  if(feeVal>0 && feeVal<band.minimumFee){
    minFeeWarn.classList.remove("hidden");
    const src=useOverrideMiles.checked?"manual":"venue";
    minFeeWarn.textContent=`Warning: Fee is below minimum for ${band.name} (${band.min}–${band.max===Infinity?"∞":band.max} miles one-way). Minimum is £${band.minimumFee}. Based on ${ow} miles one-way (${src}).`;
  } else { minFeeWarn.classList.add("hidden"); minFeeWarn.textContent=""; }

  if(feeVal>0 && feeVal%10!==0){
    feeWarn.classList.remove("hidden");
    feeWarn.textContent="Warning: Fee isn’t a multiple of £10. Your ‘no coins’ rule may be broken unless the venue pays in £10s.";
  } else { feeWarn.classList.add("hidden"); feeWarn.textContent=""; }

  const dateVal=gigDate.value;
  if(dateVal){
    const clash=state.gigs.some(g=>g.id!==editingGigId && g.date===dateVal && g.cancelled!==true);
    if(clash){ clashWarn.classList.remove("hidden"); clashWarn.textContent="Warning: You already have a non-cancelled gig on this date."; }
    else { clashWarn.classList.add("hidden"); clashWarn.textContent=""; }
  }
}

function renderCalc(){
  personALabel.textContent=PEOPLE.A;
  personBLabel.textContent=PEOPLE.B;

  let feeVal=Math.round(Number(fee.value||0));
  const isFree = (feeType && feeType.value==="free");
  if(isFree){ feeVal = 0; }
  const ow=Math.round(Number(oneWayMiles.value||0));
  const drv=driver.value||"A";

  if(isFree){
    roundTripMiles.textContent="—"; mileagePayout.textContent="—"; remainingAfterMileage.textContent="—"; baseSplitRaw.textContent="—";
    personAAmount.textContent="£0"; personBAmount.textContent="£0";
    distanceBandPill.textContent="Free gig";
    minFeeWarn.classList.add("hidden"); feeWarn.classList.add("hidden"); clashWarn.classList.add("hidden");
    return;
  }
  if(!feeVal || feeVal<=0){
    roundTripMiles.textContent="—"; mileagePayout.textContent="—"; remainingAfterMileage.textContent="—"; baseSplitRaw.textContent="—";
    personAAmount.textContent="—"; personBAmount.textContent="—";
    renderBandAndWarnings();
    return;
  }

  const res=calcGig({fee:feeVal, oneWayMiles:ow, driver:drv});
  roundTripMiles.textContent=String(res.roundTripMiles);
  mileagePayout.textContent=money(res.mileagePayout);
  remainingAfterMileage.textContent=money(res.remainingAfterMileage);
  baseSplitRaw.textContent=`£${Math.round(res.baseSplitRaw)} / £${Math.round(res.baseSplitRaw)}`;

  const payoutA = res.driverKey==="A" ? res.driverTotalRounded : res.otherTotal;
  const payoutB = res.driverKey==="B" ? res.driverTotalRounded : res.otherTotal;
  personAAmount.textContent=money(payoutA);
  personBAmount.textContent=money(payoutB);

  renderBandAndWarnings();
}

function setDefaultForm(){
  if(lockVenueDefaults) lockVenueDefaults.checked=false;
  editingGigId=null;
  formTitle.textContent="New gig";
  gigDate.value=todayIso();
  startTime.value=""; endTime.value="";
  feeType.value="paid"; fee.disabled=false;
  fee.value=""; paymentMethod.value="Cash"; cancelled.value="no"; driver.value="A"; notes.value="";
  useOverrideMiles.checked=false;
  if(state.venues.length) venueSelect.value=state.venues[0].id;
  applyVenueDefaults();
  saveMsg.classList.add("hidden"); saveMsg.textContent="";
  renderCalc();
}

function scrollToForm(){ formCard.scrollIntoView(true); }

function loadGigIntoForm(id){
  const g=state.gigs.find(x=>x.id===id); if(!g) return;
  editingGigId=id;
  formTitle.textContent="Edit gig";
  gigDate.value=g.date;
  venueSelect.value=g.venueId;
  startTime.value=g.startTime||"";
  endTime.value=g.endTime||"";
  fee.value=g.fee;
  feeType.value = (g.isFree ? "free" : "paid");
  fee.disabled = (feeType.value==="free");
  paymentMethod.value=g.paymentMethod||"Cash";
  cancelled.value=g.cancelled?"yes":"no";
  driver.value=g.driverKey||"A";
  notes.value=g.notes||"";
  useOverrideMiles.checked=!!g.overrideMiles;
  oneWayMiles.value=String(g.oneWayMiles||0);
  oneWayMiles.disabled=!useOverrideMiles.checked;
  saveMsg.classList.remove("hidden"); saveMsg.textContent="Editing. Save to update.";
  renderCalc(); scrollToForm();
}

function saveGig(){
  const v=getSelectedVenue();
  if(!v){ saveMsg.classList.remove("hidden"); saveMsg.textContent="Add/select a venue first."; return; }
  const date=gigDate.value;
  let feeVal=Math.round(Number(fee.value||0));
  const isFree = (feeType && feeType.value==="free");
  if(isFree){ feeVal = 0; }
  if(!date || !feeVal || feeVal<=0){ saveMsg.classList.remove("hidden"); saveMsg.textContent="Enter at least a date and a fee."; return; }

  const ow=Math.max(0,Math.round(Number(oneWayMiles.value||0)));
  const drv=driver.value||"A";
  let res=null;
  let payoutA=0, payoutB=0;
  let roundTrip=0, mileagePay=0;
  let driverKey=drv;
  if(!isFree){
    res=calcGig({fee:feeVal, oneWayMiles:ow, driver:drv});
    roundTrip=res.roundTripMiles;
    mileagePay=res.mileagePayout;
    driverKey=res.driverKey;
    payoutA = res.driverKey==="A" ? res.driverTotalRounded : res.otherTotal;
    payoutB = res.driverKey==="B" ? res.driverTotalRounded : res.otherTotal;
  }

  const gig={
    isFree: isFree,
    id: editingGigId || uid(),
    date,
    venueId: v.id,
    startTime: startTime.value || "",
    endTime: endTime.value || "",
    fee: feeVal,
    paymentMethod: paymentMethod.value || "Cash",
    cancelled: cancelled.value==="yes",
    notes: (notes.value||"").trim(),
    overrideMiles: useOverrideMiles.checked,
    oneWayMiles: ow,
    roundTripMiles: roundTrip,
    mileageRate: SETTINGS.mileageRate,
    mileagePayout: mileagePay,
    driverKey: driverKey,
    payoutA, payoutB,
    updatedAt: Date.now(),
    createdAt: editingGigId ? (state.gigs.find(g=>g.id===editingGigId)?.createdAt || Date.now()) : Date.now(),
  };

  if(editingGigId){
    const idx=state.gigs.findIndex(g=>g.id===editingGigId);
    if(idx>=0) state.gigs[idx]=gig;
  } else {
    state.gigs.push(gig);
  }

  // store venue usual times
  v.usualStart = startTime.value || v.usualStart || "";
  v.usualEnd = endTime.value || v.usualEnd || "";
  if(!isFree && feeVal>0){ v.lastFee = feeVal; }
  const vIdx = state.venues.findIndex(x=>x.id===v.id);
  if(vIdx>=0) state.venues[vIdx]=v;

  saveState();
  renderUpcoming();
  renderGigList();

  saveMsg.classList.remove("hidden");
  saveMsg.textContent = editingGigId ? "Gig updated." : "Gig saved.";
  editingGigId=null;
  if(gig.date >= todayIso()) showPostSaveBar();

  document.querySelector(".container")?.scrollIntoView(true);
}

function deleteGig(id){
  state.gigs = state.gigs.filter(g=>g.id!==id);
  saveState();
  renderUpcoming();
  renderGigList();
  if(editingGigId===id) setDefaultForm();
}

function renderUpcoming(){
  const t=todayIso();
  todayLabel.textContent = isoToDDMMYYYY(t);

  const gigs = state.gigs
    .filter(g => (g.date||"") >= t)
    .filter(g => g.cancelled !== true)
    .slice()
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.startTime||"").localeCompare(b.startTime||""));

  const next = gigs.slice(0, SETTINGS.upcomingCount);

  upcomingList.innerHTML="";
  if(!next.length){
    const empty=document.createElement("div");
    empty.className="muted tiny";
    empty.textContent="No upcoming gigs saved.";
    upcomingList.appendChild(empty);
    return;
  }

  let currentMonth="";
  for(const g of next){
    const mk = monthKey(g.date);
    if(mk !== currentMonth){
      currentMonth = mk;
      const header=document.createElement("div");
      header.className="pill";
      header.textContent=monthLabelFromKey(mk);
      upcomingList.appendChild(header);
    }

    const item=document.createElement("div");
    item.className="item";
    const vName=venueNameById(g.venueId);
    const timeRange=formatTimeRange(g.startTime,g.endTime);
    item.innerHTML=`
      <div class="top">
        <div>
          <div class="title">${isoToDDMMYYYY(g.date)}${timeRange ? " • " + timeRange : ""}</div>
          <div class="meta">${vName}</div>
        </div>
        ${g.isFree ? `<div class="tag-free">FREE</div>` : `<div class="pill">£${g.fee}</div>`}
      </div>
      <div class="nums">
        <div>${g.isFree ? "<strong>Free gig</strong>" : `${PEOPLE.A}: <strong>£${g.payoutA}</strong> • ${PEOPLE.B}: <strong>£${g.payoutB}</strong>`}</div>
      </div>
      <div class="buttons">
        <button class="btn btn-secondary" type="button" data-ics="${g.id}">Add to calendar</button>
      </div>
      `;
    upcomingList.appendChild(item);
  }
}

function renderGigList(){
  const q=(search.value||"").trim().toLowerCase();
  const mode=sort.value;

  let gigs = state.gigs.slice().map(g=>({ ...g, venueName: venueNameById(g.venueId) }));

  if(q){
    gigs = gigs.filter(g => (g.venueName||"").toLowerCase().includes(q) || (g.notes||"").toLowerCase().includes(q));
  }

  if(mode==="dateDesc") gigs.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(mode==="dateAsc") gigs.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(mode==="venueAsc") gigs.sort((a,b)=>(a.venueName||"").localeCompare(b.venueName||""));

  gigList.innerHTML="";
  if(!gigs.length){
    const empty=document.createElement("div");
    empty.className="muted tiny";
    empty.textContent="No gigs saved yet.";
    gigList.appendChild(empty);
    return;
  }

  for(const g of gigs){
    const item=document.createElement("div");
    item.className="item";
    const timeRange=formatTimeRange(g.startTime,g.endTime);
    item.innerHTML=`
      <div class="top">
        <div>
          <div class="title">${escapeHtml(g.venueName)}${g.cancelled ? " (Cancelled)" : ""}${g.isFree ? " (FREE)" : ""}</div>
          <div class="meta">${isoToDDMMYYYY(g.date)}${timeRange ? " • " + timeRange : ""} • Fee £${g.fee} • ${g.paymentMethod} • One-way ${g.oneWayMiles}mi${g.overrideMiles ? " (manual)" : ""}</div>
        </div>
        <div class="pill">Driver: ${g.driverKey==="A"?PEOPLE.A:PEOPLE.B}</div>
      </div>
      <div class="nums">
        <div>Round trip: <strong>${g.roundTripMiles}</strong> mi • Mileage: <strong>£${g.mileagePayout}</strong></div>
        <div>${g.isFree ? "<strong>Free gig</strong>" : `${PEOPLE.A}: <strong>£${g.payoutA}</strong> • ${PEOPLE.B}: <strong>£${g.payoutB}</strong>`}</div>
      </div>
      ${g.notes ? `<div class="meta">Notes: ${escapeHtml(g.notes)}</div>` : ""}
            <div class="buttons">
        <button class="btn btn-secondary" type="button" data-edit="${g.id}">Edit</button>
        <button class="btn btn-secondary" type="button" data-dup="${g.id}">Duplicate</button>
        <button class="btn btn-danger" type="button" data-del="${g.id}">Delete</button>
      </div>
      `;
    gigList.appendChild(item);
  }

  gigList.querySelectorAll("[data-edit]").forEach(btn=>btn.addEventListener("click", ()=>loadGigIntoForm(btn.getAttribute("data-edit"))));
  gigList.querySelectorAll("[data-del]").forEach(btn=>btn.addEventListener("click", ()=>deleteGig(btn.getAttribute("data-del"))));
  gigList.querySelectorAll("[data-dup]").forEach(btn=>btn.addEventListener("click", ()=>duplicateGig(btn.getAttribute("data-dup"))));
  gigList.querySelectorAll("[data-ics]").forEach(btn=>btn.addEventListener("click", ()=>addGigToCalendar(btn.getAttribute("data-ics"))));
}

function openVenueDialog(){
  venueName.value=""; venueMiles.value=""; venueStart.value=""; venueEnd.value=""; venueNotes.value="";
  venueDialog.showModal();
}
function saveVenueFromDialog(){
  const name=(venueName.value||"").trim();
  const miles=Math.max(0,Math.round(Number(venueMiles.value||0)));
  if(!name) return;

  const exists=state.venues.some(v=>(v.name||"").toLowerCase()===name.toLowerCase());
  if(exists){ alert("That venue already exists."); return; }

  const v={ id: uid(), name, oneWayMiles: miles, usualStart: venueStart.value||"", usualEnd: venueEnd.value||"", notes:(venueNotes.value||"").trim() };
  state.venues.push(v);
  saveState();
  renderVenueSelect();
  venueSelect.value=v.id;
  useOverrideMiles.checked=false;
  applyVenueDefaults();
  renderCalc();
}

function exportJSON(){
  const data = { exportedAt: new Date().toISOString(), settings: SETTINGS, people: PEOPLE, venues: state.venues, gigs: state.gigs };
  const fileName = `two-sick-steves-gig-calendar-${todayIso()}.json`;
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function importJSON(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(String(reader.result||"{}"));
      if(!data || !Array.isArray(data.gigs) || !Array.isArray(data.venues)){ alert("Import file doesn’t look valid."); return; }
      state.venues=data.venues;
      state.gigs=data.gigs;
      state.ui ||= { bannerDismissed: false };
      saveState();
      renderVenueSelect();
      if(state.venues.length) venueSelect.value=state.venues[0].id;
      setDefaultForm();
      renderUpcoming();
      renderGigList();
      alert("Import complete.");
    }catch{ alert("Could not import that file."); }
  };
  reader.readAsText(file);
}


function clearAllData(){
  if(!confirm("Clear ALL gigs and venues from this phone?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function maybeShowBanner(){
  if(state.ui?.bannerDismissed) return;
  installBanner.classList.remove("hidden");
}
function dismissBanner(){
  installBanner.classList.add("hidden");
  state.ui.bannerDismissed=true;
  saveState();
}

// PWA install prompt
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt=e;
  btnInstall.classList.remove("hidden");
});
btnInstall.addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  btnInstall.classList.add("hidden");
});

// Events
upcomingList?.addEventListener("click", (e)=>{
  const btn = e.target?.closest?.("[data-ics]");
  if(!btn) return;
  addGigToCalendar(btn.getAttribute("data-ics"));
});

if(btnNewGigTop) btnNewGigTop.addEventListener("click", ()=>{
  setManageMode(true);
  setTimeout(()=>{
    const fc = document.getElementById("formCard");
    if(fc && fc.scrollIntoView) fc.scrollIntoView(true);
  }, 50);
});
btnNewVenue.addEventListener("click", openVenueDialog);
venueDialog.addEventListener("close", ()=>{ if(venueDialog.returnValue==="ok") saveVenueFromDialog(); });
venueDialog.addEventListener("cancel", (e)=>{ e.preventDefault(); venueDialog.close("cancel"); });
btnCancelVenue.addEventListener("click", ()=>{ venueDialog.close("cancel"); });

venueSelect.addEventListener("change", ()=>{ applyVenueDefaults(); renderCalc(); });
useOverrideMiles.addEventListener("change", ()=>{ applyVenueDefaults(); renderCalc(); });

[gigDate,startTime,endTime,fee,paymentMethod,cancelled,driver,notes,oneWayMiles].forEach(node=>node.addEventListener("input", renderCalc));

btnSaveGig.addEventListener("click", saveGig);
btnClearForm.addEventListener("click", setDefaultForm);

search.addEventListener("input", renderGigList);
sort.addEventListener("change", renderGigList);

btnClearAll.addEventListener("click", clearAllData);

btnExport.addEventListener("click", exportJSON);
btnImport.addEventListener("click", ()=>importFile.click());
importFile.addEventListener("change", ()=>{
  const f=importFile.files?.[0];
  if(f) importJSON(f);
  importFile.value="";
});

btnDismissBanner.addEventListener("click", dismissBanner);

// Init
todayLabel.textContent = isoToDDMMYYYY(todayIso());


renderVenueSelect();
if(state.venues.length){ venueSelect.value = state.venues[0].id; }

setDefaultForm();
renderUpcoming();
renderGigList();
setManageMode(false);
maybeShowBanner();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}


function buildWhatsAppMessage(){
  const t = todayIso();
  const gigs = state.gigs
    .filter(g => (g.date||"") >= t)
    .filter(g => g.cancelled !== true)
    .slice()
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.startTime||"").localeCompare(b.startTime||""))
    .slice(0, SETTINGS.upcomingCount);

  if(!gigs.length){
    return "Two Sick Steves – Upcoming gigs\n\n(No upcoming gigs saved)";
  }

  let lines = [];
  lines.push("Two Sick Steves – Upcoming gigs\n");

  for(const g of gigs){
    const vName = venueNameById(g.venueId);    // Determine Steve Watson-Jones share (Person B)
    const yourShare = g.payoutB;

    lines.push(`${isoToDDMMYYYY(g.date)}`);
    lines.push(`${vName}`);
        if(g.isFree){
      lines.push("Free gig");
    } else {
      lines.push(`Your share: £${yourShare}`);
    }
    lines.push(""); // blank line between gigs
  }

  return lines.join("\n").trim();
}


if(btnShareWhatsApp) btnShareWhatsApp.addEventListener("click", ()=>{
  const msg = buildWhatsAppMessage();
  const url = "https://wa.me/447544147085?text=" + encodeURIComponent(msg);
  window.open(url, "_blank");
});


function showPostSaveBar(){
  if(!postSaveBar) return;
  postSaveBar.classList.remove("hidden");
  // auto-hide after ~5 seconds
  setTimeout(()=>{ postSaveBar.classList.add("hidden"); }, 5000);
}


if (btnSendToSteve){
  btnSendToSteve.addEventListener("click", ()=>{
    const msg = buildWhatsAppMessage();
    const url = "https://wa.me/447544147085?text=" + encodeURIComponent(msg);
    window.open(url, "_blank");
    postSaveBar.classList.add("hidden");
  });
}

feeType.addEventListener("change", ()=>{
  if(feeType.value==="free"){
    fee.value="0";
    fee.disabled=true;
  } else {
    fee.disabled=false;
  }
  renderCalc();
});

// Suggested fee: last paid fee when switching to paid
if (feeType){
  feeType.addEventListener("change", ()=>{
    const v = getSelectedVenue();
    if(feeType.value==="paid"){
      if(v && v.lastFee && Number(v.lastFee)>0 && (!fee.value || Number(fee.value)<=0)){
        fee.value = String(Math.round(Number(v.lastFee)));
      }
    }
  });
}

var manageMode = false;
function setManageMode(on){
  manageMode = !!on;
  if(manageView){
    if(manageMode) manageView.classList.remove("hidden");
    else manageView.classList.add("hidden");
  }
  if(btnManage){
    btnManage.textContent = manageMode ? "Home" : "Edit";
    btnManage.className = manageMode ? "btn btn-secondary" : "btn btn-primary";
  }
  // Keep it compatible: no scroll options object
  try{
    if(manageMode && manageView && manageView.scrollIntoView){
      manageView.scrollIntoView(true);
    } else if(!manageMode){
      const c = document.querySelector(".container");
      if(c && c.scrollIntoView) c.scrollIntoView(true);
    }
  }catch(e){}
}

if(btnManage){
  btnManage.addEventListener("click", ()=> setManageMode(!manageMode));
}

function duplicateGig(id){
  const g = state.gigs.find(x=>x.id===id);
  if(!g) return;
  const copy = { ...g };
  copy.id = uid();
  copy.date = todayIso(); // user can change
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  // Keep last payouts etc as-is; saveGig recalculates when edited; but we keep for quick view.
  state.gigs.push(copy);
  saveState();
  renderUpcoming();
  renderGigList();
  loadGigIntoForm(copy.id);
}