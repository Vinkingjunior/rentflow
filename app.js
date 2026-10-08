//  Data (loaded from the API after login)
let tenants = [];

//  State 
let currentRole       = "landlord"; // "landlord" | "tenant"
let currentView       = "dashboard";
let activeTenantId    = null;
let payTargetId       = null;       // which tenant the pay modal is for
let filterStatus      = "all";
let previousView      = "tenants";

let LOGGED_TENANT_ID = 1; // set from the login response when the backend provides a tenant_id

//  Auth 
const API = "http://localhost:8000"; // your FastAPI base URL
let authRole = null;                 // role of the signed-in user: "landlord" | "tenant"

//  API 
async function api(path, options = {}) {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {            // token missing/expired: back to the login screen
    sessionStorage.clear();
    location.reload();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) msg = body.detail[0].msg;
    } catch (_) { /* non-JSON error body */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

async function loadData() {
  if (authRole === "tenant") tenants = [await api("/tenants/me")];
  else tenants = await api("/tenants");
}

//  Helpers 
function fmt(n) {
  return "KSh " + Number(n).toLocaleString("en-KE");
}

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// Arrears and status are calculated by the backend
function computeArrears(tenant) {
  return tenant.arrears;
}

function getStatus(tenant) {
  return tenant.status;
}

function paymentBadgeClass(payment) {
  return payment.status === "confirmed" ? "badge badge-confirmed" : "badge badge-late"; // pending shows amber
}

function statusBadgeClass(status) {
  return "badge badge-" + status;
}

function svgIcon(path) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

//  Toast 
let toastTimer;
function showToast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = (type === "error" ? "⚠ " : "✓ ") + msg;
  el.className = type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "hidden"; }, 3000);
}

//  Login / session 
async function startSession(role, tenantId) {
  authRole = role;
  if (tenantId != null && tenantId !== "") LOGGED_TENANT_ID = Number(tenantId);
  await loadData();
  document.body.classList.add("authed");
  document.getElementById("login-screen").hidden = true;
  setRole(role);
  if (role === "landlord") switchView("dashboard");
}

async function submitLogin() {
  const errEl = document.getElementById("login-error");
  errEl.hidden = true;

  try {
    const res = await fetch(`${API}/auth/login`, {     // adjust to your login route
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, // FastAPI OAuth2PasswordRequestForm
      body: new URLSearchParams({
        username: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value,
      }),
    });
    if (!res.ok) throw new Error("Invalid email or password");

    const data = await res.json();                     // expects { access_token, role, tenant_id? }
    if (data.role !== "landlord" && data.role !== "tenant") {
      throw new Error("Your account has no valid role");
    }

    sessionStorage.setItem("token", data.access_token);
    sessionStorage.setItem("role", data.role);
    if (data.tenant_id != null) sessionStorage.setItem("tenantId", data.tenant_id);

    document.getElementById("login-password").value = "";
    await startSession(data.role, data.tenant_id);
  } catch (ex) {
    errEl.textContent = ex instanceof TypeError ? "Could not reach the server" : ex.message;
    errEl.hidden = false;
  }
}

async function restoreSession() {
  const token = sessionStorage.getItem("token");
  const role  = sessionStorage.getItem("role");
  if (token && (role === "landlord" || role === "tenant")) {
    try {
      await startSession(role, sessionStorage.getItem("tenantId"));
    } catch (_) {
      sessionStorage.clear();                          // stale or unreachable: show the login screen
    }
  }
}

//  Role switching 
function setRole(role) {
  currentRole = role;
  const app = document.getElementById("app");
  app.className = role + "-mode";
  closeMobileMenu();
  if (role === "tenant") renderTenantView();
  else renderAll();
}

//  View switching (landlord) 
function switchView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + view)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });

  closeMobileMenu();

  if (view === "dashboard") renderDashboard();
  if (view === "tenants")   renderTenants();
  if (view === "arrears")   renderArrears();
}

function goBack() {
  switchView(previousView);
  activeTenantId = null;
}

//  Render: Dashboard 
function renderDashboard() {
  const totalRevenue    = tenants.reduce((s, t) => s + t.totalPaid, 0);
  const totalArrears    = tenants.reduce((s, t) => s + computeArrears(t), 0);
  const currentCount    = tenants.filter(t => getStatus(t) === "current").length;
  const delinquentCount = tenants.filter(t => getStatus(t) === "delinquent").length;

  const statsData = [
    { label: "Total Tenants",    value: tenants.length,       col: "#6366f1", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "Revenue Collected", value: fmt(totalRevenue),   col: "#22c55e", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "Total Arrears",    value: fmt(totalArrears),    col: "#ef4444", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    { label: "Current",          value: currentCount,         col: "#22c55e", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "Delinquent",       value: delinquentCount,      col: "#ef4444", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  document.getElementById("dash-stats").innerHTML = statsData.map(s => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${s.col}22;color:${s.col}">
        ${svgIcon(s.icon).replace('stroke="currentColor"', `stroke="${s.col}"`)}
      </div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-val" style="color:${s.col}">${s.value}</div>
    </div>
  `).join("");

  const recent = tenants
    .flatMap(t => t.payments.slice(0, 2).map(p => ({ ...p, tname: t.name, unit: t.unit })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  document.getElementById("dash-payments").innerHTML = recent.map(p => `
    <tr>
      <td>${p.tname}</td>
      <td><span class="unit-pill">${p.unit}</span></td>
      <td>${p.date}</td>
      <td class="color-green fw700">${fmt(p.amount)}</td>
      <td>${p.method}</td>
    </tr>
  `).join("");
}

//  Render: Tenants 
function renderTenants() {
  renderFilterBar("filter-bar-tenants");
  const list = filterStatus === "all" ? tenants : tenants.filter(t => getStatus(t) === filterStatus);
  document.getElementById("tenants-grid").innerHTML = list.map(tenantCard).join("");
}

function renderArrears() {
  renderFilterBar("filter-bar-arrears");
  const list = tenants.filter(t => computeArrears(t) > 0)
    .filter(t => filterStatus === "all" || getStatus(t) === filterStatus);
  const el = document.getElementById("arrears-grid");
  el.innerHTML = list.length ? list.map(tenantCard).join("") :
    `<p style="color:var(--dim);padding:20px">No arrears found 🎉</p>`;
}

function renderFilterBar(containerId) {
  const statuses = ["all", "current", "late", "delinquent"];
  document.getElementById(containerId).innerHTML = statuses.map(s => `
    <button type="button" class="btn-filter ${filterStatus === s ? "active" : ""}"
      data-action="set-filter" data-filter="${s}" data-bar="${containerId}">${s}</button>
  `).join("");
}

function setFilter(status, barId) {
  filterStatus = status;
  if (barId === "filter-bar-tenants") renderTenants();
  else renderArrears();
}

function tenantCard(t) {
  const arrears = computeArrears(t);
  const status  = getStatus(t);
  const arrCol  = arrears > 0 ? "var(--red)" : "var(--green)";
  return `
    <div class="tenant-card" role="button" tabindex="0" data-action="open-detail" data-tenant-id="${t.id}">
      <div class="tenant-card-header">
        <div class="avatar">${initials(t.name)}</div>
        <div>
          <div class="tenant-card-name">${t.name}</div>
          <div class="tenant-card-sub">${t.property} · ${t.unit}</div>
        </div>
        <span class="${statusBadgeClass(status)}" style="margin-left:auto">${status}</span>
      </div>
      <div class="tenant-card-stats">
        <div><div class="ts-label">Monthly Rent</div><div class="ts-val">${fmt(t.rent)}</div></div>
        <div><div class="ts-label">Arrears</div><div class="ts-val" style="color:${arrCol}">${fmt(arrears)}</div></div>
        <div><div class="ts-label">Payments</div><div class="ts-val">${t.payments.length}</div></div>
      </div>
    </div>
  `;
}

//  Tenant Detail 
function openDetail(id) {
  previousView   = currentView;
  activeTenantId = id;
  switchView("detail");
  renderDetail();
}

function renderDetail() {
  const t       = tenants.find(x => x.id === activeTenantId);
  const arrears = computeArrears(t);
  const status  = getStatus(t);
  const totalPaid = t.totalPaid;

  // Header
  document.getElementById("detail-header").innerHTML = `
    <div class="avatar-lg">${initials(t.name)}</div>
    <div style="flex:1">
      <div class="detail-name">${t.name}</div>
      <div class="detail-sub">${t.property} · Unit ${t.unit}</div>
      <div class="detail-badges">
        <span class="${statusBadgeClass(status)}">${status}</span>
        <span class="badge badge-dark">Lease ends ${t.leaseEnd || "–"}</span>
      </div>
    </div>
    <button type="button" class="btn-add" data-action="open-pay" data-tenant-id="${t.id}">+ Record Payment</button>
  `;

  // T-cards
  document.getElementById("detail-tcards").innerHTML = `
    <div class="t-card" style="border-top:3px solid #6366f1">
      ${svgIcon("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z").replace('stroke="currentColor"','stroke="#6366f1"')}
      <div class="t-card-label">Monthly Rent</div>
      <div class="t-card-val">${fmt(t.rent)}</div>
    </div>
    <div class="t-card" style="border-top:3px solid ${arrears > 0 ? '#ef4444' : '#22c55e'}">
      ${svgIcon("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z").replace('stroke="currentColor"', `stroke="${arrears > 0 ? '#ef4444' : '#22c55e'}"` )}
      <div class="t-card-label">Arrears</div>
      <div class="t-card-val" style="color:${arrears > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(arrears)}</div>
    </div>
    <div class="t-card" style="border-top:3px solid #22c55e">
      ${svgIcon("M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z").replace('stroke="currentColor"','stroke="#22c55e"')}
      <div class="t-card-label">Total Paid</div>
      <div class="t-card-val">${fmt(totalPaid)}</div>
    </div>
  `;

  // Arrears banner
  document.getElementById("detail-arrears-banner").innerHTML = arrears > 0 ? `
    <div class="arrears-banner">
      ⚠ ${t.name} has an outstanding balance of <strong>${fmt(arrears)}</strong>
    </div>
  ` : "";

  // Payments table
  document.getElementById("detail-payments").innerHTML = t.payments.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:24px">No payments recorded</td></tr>`
    : t.payments.map(p => `
        <tr>
          <td>${p.date}</td>
          <td class="color-green fw700">${fmt(p.amount)}</td>
          <td>${p.method}</td>
          <td><span class="${paymentBadgeClass(p)}">${p.status}</span></td>
        </tr>
      `).join("");
}

//  Tenant View 
function renderTenantView() {
  const t       = tenants.find(x => x.id === LOGGED_TENANT_ID);
  const arrears = computeArrears(t);
  const status  = getStatus(t);
  const totalPaid = t.totalPaid;

  document.getElementById("tv-name").textContent = t.name;

  const badge = document.getElementById("tv-status-badge");
  badge.textContent = status;
  badge.className = statusBadgeClass(status);

  document.getElementById("tv-tcards").innerHTML = `
    <div class="t-card" style="border-top:3px solid #6366f1">
      ${svgIcon("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z").replace('stroke="currentColor"','stroke="#6366f1"')}
      <div class="t-card-label">Monthly Rent</div>
      <div class="t-card-val">${fmt(t.rent)}</div>
    </div>
    <div class="t-card" style="border-top:3px solid ${arrears > 0 ? '#ef4444' : '#22c55e'}">
      ${svgIcon("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z").replace('stroke="currentColor"', `stroke="${arrears > 0 ? '#ef4444' : '#22c55e'}"` )}
      <div class="t-card-label">Arrears</div>
      <div class="t-card-val" style="color:${arrears > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(arrears)}</div>
    </div>
    <div class="t-card" style="border-top:3px solid #f59e0b">
      ${svgIcon("M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6").replace('stroke="currentColor"','stroke="#f59e0b"')}
      <div class="t-card-label">Unit</div>
      <div class="t-card-val">${t.unit}</div>
    </div>
    <div class="t-card" style="border-top:3px solid #0ea5e9">
      ${svgIcon("M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z").replace('stroke="currentColor"','stroke="#0ea5e9"')}
      <div class="t-card-label">Lease Ends</div>
      <div class="t-card-val">${t.leaseEnd || "–"}</div>
    </div>
  `;

  document.getElementById("tv-arrears-banner").innerHTML = arrears > 0 ? `
    <div class="arrears-banner">
      <span>⚠ Outstanding balance: <strong>${fmt(arrears)}</strong></span>
      <button type="button" class="btn-pay-now" data-action="open-pay" data-tenant-id="">Pay Now</button>
    </div>
  ` : "";

  document.getElementById("tv-payments").innerHTML = t.payments.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:24px">No payments yet</td></tr>`
    : t.payments.map(p => `
        <tr>
          <td>${p.date}</td>
          <td class="color-green fw700">${fmt(p.amount)}</td>
          <td>${p.method}</td>
          <td><span class="${paymentBadgeClass(p)}">${p.status}</span></td>
        </tr>
      `).join("");
}

//  Dialogs 
let lastFocus = null;

function focusableIn(container) {
  return [...container.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
    .filter(el => !el.disabled && el.getAttribute("aria-hidden") !== "true");
}

function openDialog(overlayId, focusId) {
  lastFocus = document.activeElement;
  const overlay = document.getElementById(overlayId);
  overlay.classList.remove("hidden");
  const focusEl = document.getElementById(focusId) || focusableIn(overlay)[0];
  focusEl?.focus();
}

function closeDialog(overlayId) {
  document.getElementById(overlayId).classList.add("hidden");
  lastFocus?.focus();
  lastFocus = null;
}

function trapFocus(e, overlay) {
  if (e.key !== "Tab" || overlay.classList.contains("hidden")) return;
  const nodes = focusableIn(overlay.querySelector(".modal") || overlay);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

//  Pay Modal 
function openPayModal(tenantId) {
  payTargetId = tenantId == null || tenantId === "" ? null : Number(tenantId);
  document.getElementById("pay-amount").value = "";
  document.getElementById("pay-note").value   = "";
  document.getElementById("pay-method").value = "Bank Transfer";
  document.getElementById("pay-modal-title").textContent =
    currentRole === "tenant" ? "Make Payment" : "Record Payment";
  openDialog("pay-modal", "pay-amount");
}

function closePayModal() {
  closeDialog("pay-modal");
}

async function submitPayment() {
  const amt = parseFloat(document.getElementById("pay-amount").value);
  if (!amt || amt <= 0) { showToast("Enter a valid amount", "error"); return; }

  const targetId = payTargetId !== null ? payTargetId : LOGGED_TENANT_ID;
  const method   = document.getElementById("pay-method").value;
  const note     = document.getElementById("pay-note").value.trim();

  try {
    await api(`/tenants/${targetId}/payments`, {
      method: "POST",
      body: JSON.stringify({ amount: amt, method, note }),
    });
    await loadData();
  } catch (ex) {
    showToast(ex.message, "error");
    return;
  }

  closePayModal();
  showToast(currentRole === "tenant"
    ? "Payment of " + fmt(amt) + " submitted - awaiting landlord confirmation"
    : "Payment of " + fmt(amt) + " recorded successfully!");

  if (currentRole === "tenant") renderTenantView();
  else if (currentView === "dashboard") renderDashboard();
  else if (currentView === "detail")    renderDetail();
  else if (currentView === "tenants")   renderTenants();
  else if (currentView === "arrears")   renderArrears();
}

//  Add Tenant Modal 
function openAddModal() {
  ["nt-name","nt-unit","nt-property","nt-rent","nt-phone","nt-email","nt-lease"]
    .forEach(id => { document.getElementById(id).value = ""; });
  openDialog("add-modal", "nt-name");
}

function closeAddModal() {
  closeDialog("add-modal");
}

async function submitAddTenant() {
  const name  = document.getElementById("nt-name").value.trim();
  const unit  = document.getElementById("nt-unit").value.trim();
  const rent  = parseFloat(document.getElementById("nt-rent").value);

  if (!name || !unit || !rent) { showToast("Fill required fields (Name, Unit, Rent)", "error"); return; }

  try {
    await api("/tenants", {
      method: "POST",
      body: JSON.stringify({
        name,
        unit,
        property: document.getElementById("nt-property").value.trim() || "–",
        rent,
        phone:    document.getElementById("nt-phone").value.trim(),
        email:    document.getElementById("nt-email").value.trim(),
        leaseEnd: document.getElementById("nt-lease").value || null,
      }),
    });
    await loadData();
  } catch (ex) {
    showToast(ex.message, "error");
    return;
  }

  closeAddModal();
  showToast("Tenant added successfully!");
  renderTenants();
}

//  Render All 
function renderAll() {
  renderDashboard();
  renderTenants();
  renderArrears();
}

//  Mobile menu 
function isMobileNav() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function openMobileMenu() {
  document.getElementById("sidebar").classList.add("open");
  const backdrop = document.getElementById("sidebar-backdrop");
  backdrop.classList.add("open");
  backdrop.hidden = false;
  const btn = document.getElementById("btn-menu");
  btn.setAttribute("aria-expanded", "true");
  btn.setAttribute("aria-label", "Close menu");
}

function closeMobileMenu() {
  document.getElementById("sidebar").classList.remove("open");
  const backdrop = document.getElementById("sidebar-backdrop");
  backdrop.classList.remove("open");
  backdrop.hidden = true;
  const btn = document.getElementById("btn-menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "Open menu");
}

function toggleMobileMenu() {
  if (document.getElementById("sidebar").classList.contains("open")) closeMobileMenu();
  else openMobileMenu();
}

function parseTenantId(value) {
  return value === "" || value == null ? null : Number(value);
}

function bindEvents() {
  document.getElementById("btn-menu").addEventListener("click", toggleMobileMenu);
  document.getElementById("sidebar-backdrop").addEventListener("click", closeMobileMenu);

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.querySelectorAll("[data-role]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.role === authRole) setRole(btn.dataset.role); // users can only enter their own role
    });
  });

  document.getElementById("login-form").addEventListener("submit", e => {
    e.preventDefault();
    submitLogin();
  });

  document.getElementById("pay-form").addEventListener("submit", e => {
    e.preventDefault();
    submitPayment();
  });
  document.getElementById("add-form").addEventListener("submit", e => {
    e.preventDefault();
    submitAddTenant();
  });

  document.getElementById("pay-modal").addEventListener("click", function(e) {
    if (e.target === this) closePayModal();
  });
  document.getElementById("add-modal").addEventListener("click", function(e) {
    if (e.target === this) closeAddModal();
  });

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (action === "open-add") openAddModal();
    if (action === "close-add") closeAddModal();
    if (action === "close-pay") closePayModal();
    if (action === "go-back") goBack();
    if (action === "open-pay") openPayModal(parseTenantId(el.dataset.tenantId));
    if (action === "open-detail") openDetail(Number(el.dataset.tenantId));
    if (action === "set-filter") setFilter(el.dataset.filter, el.dataset.bar);
  });

  document.addEventListener("keydown", e => {
    const pay = document.getElementById("pay-modal");
    const add = document.getElementById("add-modal");
    if (e.key === "Escape") {
      if (!pay.classList.contains("hidden")) { closePayModal(); return; }
      if (!add.classList.contains("hidden")) { closeAddModal(); return; }
      if (isMobileNav() && document.getElementById("sidebar").classList.contains("open")) {
        closeMobileMenu();
      }
      return;
    }
    trapFocus(e, pay);
    trapFocus(e, add);

    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-action='open-detail']")) {
      e.preventDefault();
      openDetail(Number(e.target.dataset.tenantId));
    }
  });
}

//  Init 
bindEvents();
renderAll();
switchView("dashboard");
restoreSession();