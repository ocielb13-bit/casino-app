// admin.js - panel para crear, borrar y modificar usuarios + RTP

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || "Error");
  }

  return data;
}

function goMenu() {
  window.location.href = "/menu.html";
}

async function loadMe() {
  try {
    const me = await api("/api/me");
    if (me.role !== "admin") {
      window.location.href = "/menu.html";
      return;
    }
    document.getElementById("adminLine").textContent = `Admin: ${me.username}`;
  } catch {
    window.location.href = "/";
  }
}

async function loadSettings() {
  const settings = await api("/api/admin/settings");

  document.getElementById("currentRtp").textContent = settings.slot_rtp;
  document.getElementById("currentDefaultBalance").textContent = settings.default_balance;
  document.getElementById("currentJackpot").textContent = settings.jackpot_bank;

  document.getElementById("rtpInput").value = settings.slot_rtp;
  document.getElementById("defaultBalanceInput").value = settings.default_balance;
  document.getElementById("jackpotInput").value = settings.jackpot_bank;
}

async function saveSettings() {
  const slot_rtp = parseFloat(document.getElementById("rtpInput").value);
  const default_balance = parseInt(document.getElementById("defaultBalanceInput").value, 10);
  const jackpot_bank = parseInt(document.getElementById("jackpotInput").value, 10);

  await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ slot_rtp, default_balance, jackpot_bank })
  });

  await loadSettings();
  await loadUsers();
}

async function createUser() {
  const username = document.getElementById("newUser").value.trim();
  const password = document.getElementById("newPass").value.trim();
  const balance = parseInt(document.getElementById("newBalance").value, 10);

  if (!username || !password) {
    alert("Poné usuario y contraseña");
    return;
  }

  await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, password, balance })
  });

  document.getElementById("newUser").value = "";
  document.getElementById("newPass").value = "";
  document.getElementById("newBalance").value = "";

  await loadUsers();
}

async function addBalance(id, delta) {
  await api(`/api/admin/users/${id}/balance`, {
    method: "PATCH",
    body: JSON.stringify({ delta })
  });

  await loadUsers();
}

async function setBalance(id, inputId) {
  const value = parseInt(document.getElementById(inputId).value, 10);
  if (!Number.isFinite(value)) {
    alert("Saldo inválido");
    return;
  }

  await api(`/api/admin/users/${id}/balance`, {
    method: "PUT",
    body: JSON.stringify({ balance: value })
  });

  await loadUsers();
}

async function deleteUser(id, username) {
  if (!confirm(`¿Borrar a ${username}?`)) return;

  await api(`/api/admin/users/${id}`, {
    method: "DELETE"
  });

  await loadUsers();
}

function renderUsers(users) {
  const box = document.getElementById("usersList");
  box.innerHTML = "";

  users.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-card";

    row.innerHTML = `
      <strong>${u.username}</strong>
      <small class="muted">Rol: ${u.role}</small>

      <div class="user-meta">
        <div>Saldo: <strong>${u.balance}</strong></div>
        <div>Free spins: <strong>${u.free_spins || 0}</strong></div>
        <div>Banco free: <strong>${u.free_spin_bank || 0}</strong></div>
      </div>

      <div class="actions">
        <input id="balance-${u.id}" type="number" value="${u.balance}">
        <button type="button" onclick="setBalance(${u.id}, 'balance-${u.id}')">Guardar saldo</button>
        <button type="button" onclick="addBalance(${u.id}, 100)">+100</button>
        <button type="button" onclick="addBalance(${u.id}, -100)">-100</button>
        <button type="button" class="danger" onclick="deleteUser(${u.id}, '${u.username}')">Eliminar</button>
      </div>
    `;

    if (u.role === "admin") {
      row.querySelector(".danger").disabled = true;
      row.querySelector(".danger").textContent = "Admin";
    }

    box.appendChild(row);
  });
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  renderUsers(data.users || []);
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadMe();
  await loadSettings();
  await loadUsers();
});