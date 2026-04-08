async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
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
    localStorage.removeItem("token");
    window.location.href = "/";
  }
}

async function loadSettings() {
  const settings = await api("/api/admin/settings");

  document.getElementById("currentRtp").textContent = settings.slot_rtp;
  document.getElementById("currentJackpot").textContent = settings.jackpot_bank;
  document.getElementById("currentDefaultBalance").textContent = settings.default_balance;

  document.getElementById("slot_rtp").value = settings.slot_rtp;
  document.getElementById("jackpot_bank").value = settings.jackpot_bank;
  document.getElementById("default_balance").value = settings.default_balance;
  document.getElementById("slot_pay_3").value = settings.slot_pay_3;
  document.getElementById("slot_pay_4").value = settings.slot_pay_4;
  document.getElementById("slot_pay_5").value = settings.slot_pay_5;
  document.getElementById("roulette_payout").value = settings.roulette_payout;
}

async function saveSettings() {
  const payload = {
    slot_rtp: parseFloat(document.getElementById("slot_rtp").value),
    jackpot_bank: parseInt(document.getElementById("jackpot_bank").value, 10),
    default_balance: parseInt(document.getElementById("default_balance").value, 10),
    slot_pay_3: parseInt(document.getElementById("slot_pay_3").value, 10),
    slot_pay_4: parseInt(document.getElementById("slot_pay_4").value, 10),
    slot_pay_5: parseInt(document.getElementById("slot_pay_5").value, 10),
    roulette_payout: parseInt(document.getElementById("roulette_payout").value, 10)
  };

  await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  await loadSettings();
}

async function createUser() {
  const username = document.getElementById("newUser").value.trim();
  const password = document.getElementById("newPass").value.trim();
  const balance = parseInt(document.getElementById("newBalance").value, 10);
  const role = document.getElementById("newRole").value;

  if (!username || !password) {
    alert("Poné usuario y contraseña");
    return;
  }

  await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, password, balance, role })
  });

  document.getElementById("newUser").value = "";
  document.getElementById("newPass").value = "";
  document.getElementById("newBalance").value = "";
  document.getElementById("newRole").value = "player";

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

async function setRole(id, role) {
  await api(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
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
        <button type="button" onclick="setRole(${u.id}, '${u.role === 'admin' ? 'player' : 'admin'}')">
          ${u.role === "admin" ? "Quitar admin" : "Hacer admin"}
        </button>
        <button type="button" class="danger" onclick="deleteUser(${u.id}, '${u.username}')">Eliminar</button>
      </div>
    `;

    if (u.username === "admin" && u.role === "admin") {
      row.querySelector(".danger").disabled = true;
      row.querySelector(".danger").textContent = "Admin principal";
    }

    box.appendChild(row);
  });
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  renderUsers(data.users || []);
}

async function logout() {
  localStorage.removeItem("token");
  try { await api("/api/logout", { method: "POST" }); } catch {}
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadMe();
  await loadSettings();
  await loadUsers();
});