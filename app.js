//  Data 
let tenants = [
  {
    id: 1,
    name: "Amara Osei",
    unit: "A-101",
    property: "Sunset Apartments",
    rent: 45000,
    dueDay: 1,
    phone: "+254 712 000 101",
    email: "amara@email.com",
    leaseEnd: "2026-12-31",
    payments: [
      { id: "p1", date: "2026-05-01", amount: 45000, method: "Bank Transfer", status: "confirmed" },
      { id: "p2", date: "2026-04-01", amount: 45000, method: "Bank Transfer", status: "confirmed" },
      { id: "p3", date: "2026-03-01", amount: 22500, method: "Cash",          status: "confirmed" },
    ],
  },
  {
    id: 2,
    name: "Diego Reyes",
    unit: "B-204",
    property: "Sunset Apartments",
    rent: 38000,
    dueDay: 1,
    phone: "+254 722 000 202",
    email: "diego@email.com",
    leaseEnd: "2027-03-31",
    payments: [
      { id: "p4", date: "2026-04-01", amount: 38000, method: "Card", status: "confirmed" },
      { id: "p5", date: "2026-03-01", amount: 38000, method: "Card", status: "confirmed" },
    ],
  },
  {
    id: 3,
    name: "Fatima Al-Hassan",
    unit: "C-305",
    property: "Maple Grove",
    rent: 60000,
    dueDay: 1,
    phone: "+254 733 000 303",
    email: "fatima@email.com",
    leaseEnd: "2026-09-30",
    payments: [
      { id: "p6", date: "2026-05-01", amount: 60000, method: "Bank Transfer", status: "confirmed" },
      { id: "p7", date: "2026-04-01", amount: 60000, method: "Bank Transfer", status: "confirmed" },
      { id: "p8", date: "2026-03-01", amount: 60000, method: "Bank Transfer", status: "confirmed" },
    ],
  },
  {
    id: 4,
    name: "James Whitfield",
    unit: "A-102",
    property: "Sunset Apartments",
    rent: 42000,
    dueDay: 1,
    phone: "+254 700 000 404",
    email: "james@email.com",
    leaseEnd: "2026-07-31",
    payments: [
      { id: "p9", date: "2026-03-01", amount: 42000, method: "Cash", status: "confirmed" },
    ],
  },
];

//  State 
let currentRole       = "landlord"; // "landlord" | "tenant"
let currentView       = "dashboard";
let activeTenantId    = null;
let payTargetId       = null;       // which tenant the pay modal is for
let filterStatus      = "all";
let previousView      = "tenants";

const LOGGED_TENANT_ID = 1; // simulated logged-in tenant

//  Helpers 
function fmt(n) {
  return "KSh " + Number(n).toLocaleString("en-KE");
}

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function computeArrears(tenant) {
  const today = new Date("2026-05-27");
  const start = new Date("2026-01-01");
  let months = 0;
  const d = new Date(start);
  while (d <= today) {
    if (d.getDate() === 1) months++;
    d.setDate(d.getDate() + 1);
  }
  const totalDue  = months * tenant.rent;
  const totalPaid = tenant.payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, totalDue - totalPaid);
}

function getStatus(tenant) {
  const a = computeArrears(tenant);
  if (a === 0)             return "current";
  if (a <= tenant.rent)    return "late";
  return "delinquent";
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

//  Role switching 
function setRole(role) {
  currentRole = role;
  const app = document.getElementById("app");
  app.className = role + "-mode";
  if (role === "tenant") renderTenantView();
  else renderAll();
}

//  View switching (landlord) 
function switchView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + view)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });

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
  const totalRevenue    = tenants.reduce((s, t) => s + t.payments.reduce((x, p) => x + p.amount, 0), 0);
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
    <button class="btn-filter ${filterStatus === s ? "active" : ""}"
      onclick="setFilter('${s}','${containerId}')">${s}</button>
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
    <div class="tenant-card" onclick="openDetail(${t.id})">
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
  const totalPaid = t.payments.reduce((s, p) => s + p.amount, 0);

  // Header
  document.getElementById("detail-header").innerHTML = `
    <div class="avatar-lg">${initials(t.name)}</div>
    <div style="flex:1">
      <div class="detail-name">${t.name}</div>
      <div class="detail-sub">${t.property} · Unit ${t.unit}</div>
      <div class="detail-badges">
        <span class="${statusBadgeClass(status)}">${status}</span>
        <span class="badge badge-dark">Lease ends ${t.leaseEnd}</span>
      </div>
    </div>
    <button class="btn-add" onclick="openPayModal(${t.id})">+ Record Payment</button>
  `;

  // T-cards
  document.getElementById("detail-tcards").innerHTML = `
    <div class="t-card" style="border-top:3px solidrgb(241, 232, 99)">
      ${svgIcon("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z").replace('stroke="currentColor"','stroke="#6366f1"')}
      <div class="t-card-label">Monthly Rent</div>
      <div class="t-card-val">${fmt(t.rent)}</div>
    </div>
    <div class="t-card" style="border-top:3px solid ${arrears > 0 ? '#ef4444' : '#22c55e'}">
      ${svgIcon("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z").replace('stroke="currentColor"', `stroke="${arrears > 0 ? '#ef4444' : '#22c55e'}"` )}
      <div class="t-card-label">Arrears</div>
      <div class="t-card-val" style="color:${arrears > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(arrears)}</div>
    </div>
    <div class="t-card" style="border-top:3px solidrgb(59, 34, 197)">
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
          <td><span class="badge badge-confirmed">${p.status}</span></td>
        </tr>
      `).join("");
}

//  Tenant View 
function renderTenantView() {
  const t       = tenants.find(x => x.id === LOGGED_TENANT_ID);
  const arrears = computeArrears(t);
  const status  = getStatus(t);
  const totalPaid = t.payments.reduce((s, p) => s + p.amount, 0);

  document.getElementById("tv-name").textContent = t.name;

  const badge = document.getElementById("tv-status-badge");
  badge.textContent = status;
  badge.className = statusBadgeClass(status);

  document.getElementById("tv-tcards").innerHTML = `
    <div class="t-card" style="border-top:3px solidrgb(241, 99, 123)">
      ${svgIcon("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z").replace('stroke="currentColor"','stroke="#6366f1"')}
      <div class="t-card-label">Monthly Rent</div>
      <div class="t-card-val">${fmt(t.rent)}</div>
    </div>
    <div class="t-card" style="border-top:3px solid ${arrears > 0 ? '#ef4444' : '#22c55e'}">
      ${svgIcon("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z").replace('stroke="currentColor"', `stroke="${arrears > 0 ? '#ef4444' : '#22c55e'}"` )}
      <div class="t-card-label">Arrears</div>
      <div class="t-card-val" style="color:${arrears > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(arrears)}</div>
    </div>
    <div class="t-card" style="border-top:3px solidrgb(28, 211, 22)">
      ${svgIcon("M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6").replace('stroke="currentColor"','stroke="#f59e0b"')}
      <div class="t-card-label">Unit</div>
      <div class="t-card-val">${t.unit}</div>
    </div>
    <div class="t-card" style="border-top:3px solid #0ea5e9">
      ${svgIcon("M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z").replace('stroke="currentColor"','stroke="#0ea5e9"')}
      <div class="t-card-label">Lease Ends</div>
      <div class="t-card-val">${t.leaseEnd}</div>
    </div>
  `;

  document.getElementById("tv-arrears-banner").innerHTML = arrears > 0 ? `
    <div class="arrears-banner">
      <span>⚠ Outstanding balance: <strong>${fmt(arrears)}</strong></span>
      <button class="btn-pay-now" onclick="openPayModal(null)">Pay Now</button>
    </div>
  ` : "";

  document.getElementById("tv-payments").innerHTML = t.payments.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:24px">No payments yet</td></tr>`
    : t.payments.map(p => `
        <tr>
          <td>${p.date}</td>
          <td class="color-green fw700">${fmt(p.amount)}</td>
          <td>${p.method}</td>
          <td><span class="badge badge-confirmed">${p.status}</span></td>
        </tr>
      `).join("");
}

//  Pay Modal 
function openPayModal(tenantId) {
  payTargetId = tenantId; // null means use logged tenant in tenant view
  document.getElementById("pay-amount").value = "";
  document.getElementById("pay-note").value   = "";
  document.getElementById("pay-method").value = "Bank Transfer";
  document.getElementById("pay-modal").classList.remove("hidden");
}

function closePayModal() {
  document.getElementById("pay-modal").classList.add("hidden");
}

function submitPayment() {
  const amt = parseFloat(document.getElementById("pay-amount").value);
  if (!amt || amt <= 0) { showToast("Enter a valid amount", "error"); return; }

  const targetId = payTargetId !== null ? payTargetId : LOGGED_TENANT_ID;
  const method   = document.getElementById("pay-method").value;

  const payment = {
    id:     "p" + Date.now(),
    date:   new Date().toISOString().split("T")[0],
    amount: amt,
    method: method,
    status: "confirmed",
  };

  tenants = tenants.map(t =>
    t.id === targetId ? { ...t, payments: [payment, ...t.payments] } : t
  );

  closePayModal();
  showToast("Payment of " + fmt(amt) + " recorded successfully!");

  // Refresh current view
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
  document.getElementById("add-modal").classList.remove("hidden");
}

function closeAddModal() {
  document.getElementById("add-modal").classList.add("hidden");
}

function submitAddTenant() {
  const name  = document.getElementById("nt-name").value.trim();
  const unit  = document.getElementById("nt-unit").value.trim();
  const rent  = parseFloat(document.getElementById("nt-rent").value);

  if (!name || !unit || !rent) { showToast("Fill required fields (Name, Unit, Rent)", "error"); return; }

  tenants.push({
    id:       Date.now(),
    name,
    unit,
    property: document.getElementById("nt-property").value.trim() || "–",
    rent,
    dueDay:   1,
    phone:    document.getElementById("nt-phone").value.trim(),
    email:    document.getElementById("nt-email").value.trim(),
    leaseEnd: document.getElementById("nt-lease").value || "–",
    payments: [],
  });

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

// Close modals on overlay click
document.getElementById("pay-modal").addEventListener("click", function(e) {
  if (e.target === this) closePayModal();
});
document.getElementById("add-modal").addEventListener("click", function(e) {
  if (e.target === this) closeAddModal();
});

//  Init 
renderAll();
switchView("dashboard");
