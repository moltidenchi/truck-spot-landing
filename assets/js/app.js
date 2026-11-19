// Truck Spot landing page behaviour: map, truck tickets, filters, location and the demo opt-in.
// Vanilla ES module; Leaflet (vendored, pinned 1.9.4) is loaded as a classic deferred script before this runs.
import { DEFAULT_CENTER, TRUCKS } from "./trucks.js";
import { statusAt, describeStatus, weekRows } from "./hours.js";
import { distanceMeters, offsetLatLng, formatDistance, unitsForLocale } from "./geo.js";
import { validateEmail } from "./email.js";

const $ = (sel, root = document) => root.querySelector(sel);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const units = unitsForLocale(navigator.language);
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const fmtMinutes = (m) => timeFormat.format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60));

const state = {
  center: { ...DEFAULT_CENTER },
  centerLabel: DEFAULT_CENTER.label,
  cuisine: "All",
  openOnly: false,
  activeId: null,
  trucks: [],
};

/** Small DOM builder: el("p", { class: "x" }, "text", child). Text is always set as text, never HTML. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) node.append(child);
  return node;
}

function statusClass(status) {
  if (!status.open) return "status--closed";
  return status.closesInMinutes <= 30 ? "status--soon" : "status--open";
}

/** Place the demo trucks around the current centre and compute live status + distance. */
function computeTrucks(now = new Date()) {
  state.trucks = TRUCKS.map((t) => {
    const pos = offsetLatLng(state.center, t.offset[0], t.offset[1]);
    const status = statusAt(t.hours, now);
    return { ...t, pos, status, label: describeStatus(status, fmtMinutes), distance: distanceMeters(state.center, pos) };
  }).sort((a, b) => a.distance - b.distance);
}

function visibleTrucks() {
  return state.trucks.filter(
    (t) => (state.cuisine === "All" || t.cuisine === state.cuisine) && (!state.openOnly || t.status.open),
  );
}

// ---------------------------------------------------------------- Map
let map = null;
let youMarker = null;
const markers = new Map();

const PIN_SVG =
  '<svg viewBox="0 0 34 44" aria-hidden="true" focusable="false">' +
  '<path class="pin-body" d="M17 42.5 4.6 24.6A15 15 0 1 1 29.4 24.6Z"/>' +
  '<circle cx="17" cy="15" r="5.5" fill="#FFFFFF"/></svg>';

function initMap() {
  const box = $("#truck-map");
  if (!window.L || !box) {
    if (box) box.append(el("p", { class: "noscript", text: "The map could not load. The truck list still works." }));
    return;
  }
  map = window.L.map(box, { scrollWheelZoom: false, zoomControl: true, fadeAnimation: false }).setView(state.center, 14);
  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  // Wheel zoom only after the visitor has engaged with the map, so page scrolling never gets trapped.
  map.on("focus click", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());
}

function popupContent(truck) {
  const button = el("button", { type: "button", class: "popup-link", text: "See Menu & Hours" });
  button.addEventListener("click", () => {
    const card = document.getElementById(`truck-${truck.id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
    card.querySelector(".ticket-locate")?.focus({ preventScroll: true });
  });
  return el(
    "div",
    { class: "popup" },
    el("p", { class: "popup-name", text: truck.name }),
    el("p", { class: "popup-meta", text: `${truck.cuisine}, ${formatDistance(truck.distance, units)} away` }),
    el("p", { class: `status ${statusClass(truck.status)}`, text: truck.label }),
    button,
  );
}

function renderMarkers() {
  if (!map) return;
  const visible = new Set(visibleTrucks().map((t) => t.id));
  for (const truck of state.trucks) {
    let marker = markers.get(truck.id);
    const icon = window.L.divIcon({
      className: `truck-marker${truck.status.open ? "" : " is-closed"}${truck.id === state.activeId ? " is-active" : ""}`,
      html: PIN_SVG,
      iconSize: [34, 44],
      iconAnchor: [17, 43],
      popupAnchor: [0, -40],
    });
    if (!marker) {
      marker = window.L.marker(truck.pos, { icon, title: truck.name, riseOnHover: true, keyboard: true });
      marker.on("click", () => setActive(truck.id, { fromMap: true }));
      markers.set(truck.id, marker);
    } else {
      marker.setLatLng(truck.pos).setIcon(icon);
    }
    marker.bindPopup(() => popupContent(state.trucks.find((t) => t.id === truck.id)), { minWidth: 220, maxWidth: 280 });
    if (visible.has(truck.id)) marker.addTo(map);
    else marker.remove();
    const node = marker.getElement();
    if (node) {
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", `${truck.name}, ${truck.label}`);
    }
  }
}

function focusTruck(truck, { animate = true } = {}) {
  const marker = markers.get(truck.id);
  if (!map || !marker) return;
  if (!map.hasLayer(marker)) marker.addTo(map);
  const zoom = Math.max(map.getZoom(), 15);
  if (!animate || reduceMotion.matches) map.setView(truck.pos, zoom, { animate: false });
  else map.flyTo(truck.pos, zoom, { duration: 0.6 });
  marker.openPopup();
}

function setActive(id, { fromMap = false } = {}) {
  state.activeId = id;
  document.querySelectorAll(".ticket.is-active").forEach((n) => n.classList.remove("is-active"));
  const card = document.getElementById(`truck-${id}`);
  card?.classList.add("is-active");
  markers.forEach((m, mid) => m.getElement()?.classList.toggle("is-active", mid === id));
  const truck = state.trucks.find((t) => t.id === id);
  if (!truck) return;
  if (fromMap) {
    // Bring the ticket into view inside the list without moving keyboard focus.
    if (card && window.matchMedia("(min-width: 961px)").matches) {
      card.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "nearest" });
    }
  } else {
    // Shareable link to this truck (index.html#truck-<id>); replaceState keeps the back button clean.
    history.replaceState(null, "", `#truck-${id}`);
    if (window.matchMedia("(max-width: 960px)").matches) {
      $("#truck-map").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
    }
    focusTruck(truck);
  }
}

// ---------------------------------------------------------------- Tickets
function ticket(truck) {
  const today = new Date().getDay();
  const table = el("table", {}, el("caption", { class: "sr-only", text: `${truck.name} opening hours` }));
  const tbody = el("tbody");
  for (const row of weekRows(truck.hours, fmtMinutes)) {
    tbody.append(
      el(
        "tr",
        { class: row.index === today ? "is-today" : null },
        el("th", { scope: "row" }, row.label, row.index === today ? el("span", { class: "sr-only", text: " (today)" }) : ""),
        el("td", { text: row.text }),
      ),
    );
  }
  table.append(tbody);

  const locate = el("button", {
    type: "button",
    class: "ticket-locate",
    "aria-label": `Show ${truck.name} on the map`,
    text: "Show on Map",
  });
  locate.addEventListener("click", () => setActive(truck.id));

  const menu = el("ul", { class: "menu", "aria-label": `${truck.name} sample menu` });
  for (const [item, price] of truck.menu) menu.append(el("li", {}, el("span", { text: item }), el("span", { class: "price", text: price })));

  return el(
    "li",
    {},
    el(
      "article",
      { class: `ticket${truck.id === state.activeId ? " is-active" : ""}`, id: `truck-${truck.id}`, "aria-labelledby": `name-${truck.id}` },
      el(
        "div",
        { class: "ticket-top" },
        el("h4", { class: "ticket-name", id: `name-${truck.id}`, text: truck.name }),
        el("span", { class: "ticket-distance", text: formatDistance(truck.distance, units) }),
      ),
      el("p", { class: "ticket-cuisine" }, el("span", { text: truck.cuisine }), el("span", { class: "demo-badge", text: "Demo truck" })),
      el("p", { class: `status ${statusClass(truck.status)}`, text: truck.label }),
      el("p", { class: "ticket-blurb", text: truck.blurb }),
      menu,
      el("div", { class: "ticket-actions" }, el("details", { class: "hours" }, el("summary", { text: "Weekly Hours" }), table), locate),
    ),
  );
}

function renderList() {
  const list = $("#truck-list");
  const open = new Set([...list.querySelectorAll("details[open]")].map((d) => d.closest(".ticket").id));
  // Re-rendering replaces the nodes, so remember which control had keyboard focus and restore it.
  const focused = list.contains(document.activeElement) ? document.activeElement : null;
  const focusTicket = focused?.closest(".ticket")?.id;
  const focusSel = focused?.matches("summary") ? "summary" : ".ticket-locate";
  const items = visibleTrucks();
  list.replaceChildren(...items.map(ticket));
  open.forEach((id) => document.getElementById(id)?.querySelector("details")?.setAttribute("open", ""));
  if (focusTicket) document.getElementById(focusTicket)?.querySelector(focusSel)?.focus({ preventScroll: true });
  $("#empty-state").hidden = items.length > 0;
  const openCount = items.filter((t) => t.status.open).length;
  $("#result-count").textContent = `${items.length} of ${state.trucks.length} trucks, ${openCount} open now`;
}

function renderFilters() {
  const cuisines = ["All", ...new Set(TRUCKS.map((t) => t.cuisine).sort())];
  const group = $("#cuisine-filters");
  group.replaceChildren(
    ...cuisines.map((c) => {
      const chip = el("button", { type: "button", class: "chip", "aria-pressed": String(c === state.cuisine), text: c });
      chip.addEventListener("click", () => {
        state.cuisine = c;
        group.querySelectorAll(".chip").forEach((n) => n.setAttribute("aria-pressed", String(n === chip)));
        refresh();
      });
      return chip;
    }),
  );
}

function renderHeroLive() {
  const open = state.trucks.filter((t) => t.status.open).length;
  const link = $("#hero-live a");
  if (link) link.textContent = `Right now ${open} of ${state.trucks.length} demo trucks are open near ${state.centerLabel}. See them on the map.`;
}

function refresh() {
  computeTrucks();
  renderList();
  renderMarkers();
  renderHeroLive();
}

// ---------------------------------------------------------------- Location
function fitToTrucks(animate = true) {
  if (!map) return;
  const bounds = window.L.latLngBounds(state.trucks.map((t) => t.pos)).extend(state.center);
  map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16, animate: animate && !reduceMotion.matches });
}

function showYou() {
  if (!map) return;
  const icon = window.L.divIcon({ className: "you-marker", html: "<span></span>", iconSize: [18, 18] });
  if (youMarker) youMarker.setLatLng(state.center);
  else youMarker = window.L.marker(state.center, { icon, keyboard: false, interactive: false, title: "You are here" }).addTo(map);
}

function initLocate() {
  const btn = $("#locate-btn");
  const label = btn.querySelector(".btn-label");
  const status = $("#locate-status");
  const fallback = (reason) => {
    status.textContent = `${reason} Showing demo trucks around ${DEFAULT_CENTER.label} instead.`;
  };
  btn.addEventListener("click", () => {
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      fallback("This browser can’t share its location here.");
      return;
    }
    btn.setAttribute("aria-busy", "true");
    label.textContent = "Locating…";
    // If the permission prompt is ignored, neither callback fires; don't leave the button spinning.
    const waiting = setTimeout(() => {
      btn.removeAttribute("aria-busy");
      label.textContent = "Use My Location";
      fallback("No location yet. If your browser is asking, allow location access.");
    }, 15000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(waiting);
        btn.removeAttribute("aria-busy");
        label.textContent = "Update My Location";
        state.center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.centerLabel = "you";
        status.textContent = "Showing trucks around your location. In this demo the fictional trucks are placed near you.";
        refresh();
        showYou();
        fitToTrucks();
      },
      (err) => {
        clearTimeout(waiting);
        btn.removeAttribute("aria-busy");
        label.textContent = "Use My Location";
        fallback(err.code === 1 ? "Location access was declined." : "Your location isn’t available right now.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

// ---------------------------------------------------------------- Opt-in (demo only)
function maskEmail(value) {
  const [local, domain] = value.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(local.length - 1, 6)))}@${domain}`;
}

function initOptIn() {
  const form = $("#optin");
  const input = $("#optin-email");
  const error = $("#optin-error");
  const success = $("#optin-success");
  const showError = (message) => {
    error.textContent = message;
    input.setAttribute("aria-invalid", "true");
  };
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true" && validateEmail(input.value).ok) {
      input.removeAttribute("aria-invalid");
      error.textContent = "";
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = validateEmail(input.value);
    if (!result.ok) {
      showError(result.error);
      input.focus();
      return;
    }
    // DEMO: nothing leaves the browser. See README "Wire up the email opt-in" for Mailchimp/Formspree.
    $("#optin-success-text").textContent =
      `In the live app we’d send a confirmation to ${maskEmail(result.value)}. This demo sent nothing and stored nothing.`;
    form.hidden = true;
    success.hidden = false;
    success.focus();
    form.reset();
    input.removeAttribute("aria-invalid");
    error.textContent = "";
  });
  $("#optin-reset").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    input.focus();
  });
}

// ---------------------------------------------------------------- Store placeholders
function initStoreButtons() {
  const status = $("#store-status");
  document.querySelectorAll("a[data-store]").forEach((a) => {
    a.addEventListener("click", (event) => {
      event.preventDefault();
      status.textContent = `${a.dataset.store} link is a placeholder until the app is published.`;
    });
  });
}

// ---------------------------------------------------------------- Boot
function boot() {
  computeTrucks();
  initMap();
  renderFilters();
  renderList();
  renderMarkers();
  fitToTrucks(false);
  renderHeroLive();
  initLocate();
  initOptIn();
  initStoreButtons();
  $("#open-only").addEventListener("change", (e) => {
    state.openOnly = e.target.checked;
    refresh();
  });
  $("#clear-filters").addEventListener("click", () => {
    state.cuisine = "All";
    state.openOnly = false;
    $("#open-only").checked = false;
    renderFilters();
    refresh();
    $("#cuisine-filters .chip")?.focus(); // the Clear button is hidden now; keep focus in the filters
  });
  // Deep link: index.html#truck-<id> highlights that truck and opens its pin.
  const linked = /^#truck-([a-z0-9-]+)$/.exec(location.hash);
  if (linked && state.trucks.some((t) => t.id === linked[1])) {
    const truck = state.trucks.find((t) => t.id === linked[1]);
    state.activeId = truck.id;
    document.getElementById(`truck-${truck.id}`)?.classList.add("is-active");
    markers.get(truck.id)?.getElement()?.classList.add("is-active");
    focusTruck(truck, { animate: false });
  }
  // "Open now" changes with the clock: re-evaluate every minute.
  setInterval(refresh, 60 * 1000);
}

boot();
