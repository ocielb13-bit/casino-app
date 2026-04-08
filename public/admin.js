function token() {
  return localStorage.getItem("token") || "";
}

function headers() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token()
  };
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      ...headers(),
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

function goCasino() {
  window.location.href = "/casino.html";
}

function setMsg(text) {
  const el = document.getElementById("msg");
  if (el) el.textContent = text;
}

async function loadMe() {
  const me = await api("/api/me");
  if (me.role !== "admin") {
    window.location.href = "/casino.html";
    return;
  }
  document.getElementById("adminLine").textContent = `Admin: ${me.username}`;
}

async function loadSettings() {
  const s = await api("/api/admin/settings");

  document.getElementById("currentWinRate").textContent = s.win_rate;
  document.getElementById("currentMultiplier").textContent = s.multiplier;
  document.getElementById("currentJackpot").textContent = s.jackpot_bank;
  document.getElementById("currentDefaultBalance").textContent = s.default_balance;

  document.getElementById("win_rate").value = s.win_rate;
  document.getElementById("multiplier").value = s.multiplier;
  document.getElementById("jackpot_bank").value = s.jackpot_bank;
  document.getElementById("default_balance").value = s.default_balance;
  document.getElementById("slot_pay_3").value = s.slot_pay_3;
  document.getElementById("slot_pay_4").value = s.slot_pay_4;
  document.getElementById("slot_pay_5").value = s.slot_pay_5;
  document.getElementById("roulette_payout").value = s.roulette_payout;
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  const box = document.getElementById("usersList");
  box.innerHTML = "";

  data.users.forEach((u) => {
    const card = document.createElement("div");
    card.className = "user-card";

    card.innerHTML = `
      <div class="user-top">
        <div>
          <strong>${u.username}</strong>
          <div class="small">ID: ${u.id} · <span class="tag">${u.role}</span></div>
        </div>
        <div class="small">Saldo actual: <strong>${u.balance}</strong></div>
      </div>

      <div class="row">
        <input id="bal-${u.id}" type="number" value="${u.balance}">
        <button type="button" onclick="setBalance(${u.id})">Guardar saldo</button>
        <button type="button" onclick="addBalance(${u.id}, 100)">+100</button>
        <button type="button" onclick="addBalance(${u.id}, -100)">-100</button>
        <button type="button" onclick="toggleRole(${u.id}, '${u.role === 'admin' ? 'player' : 'admin'}')">
          ${u.role === "admin" ? "Quitar admin" : "Hacer admin"}
        </button>
        <button type="button" class="danger" onclick="deleteUser(${u.id}, '${u.username}')">Eliminar</button>
      </div>
    `;

    box.appendChild(card);
  });
}

async function saveSettings() {
  const payload = {
    win_rate: parseFloat(document.getElementById("win_rate").value),
    multiplier: parseFloat(document.getElementById("multiplier").value),
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

  setMsg("Ajustes guardados");
  await reloadAll();
}

async function createUser() {
  const username = document.getElementById("newUser").value.trim();
  const password = document.getElementById("newPass").value.trim();
  const balance = document.getElementById("newBalance").value;
  const role = document.getElementById("newRole").value;

  if (!username || !password) {
    setMsg("Poné usuario y contraseña");
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

  setMsg("Usuario creado");
  await reloadAll();
}

async function addBalance(id, delta) {
  await api(`/api/admin/users/${id}/balance`, {
    method: "PATCH",
    body: JSON.stringify({ delta })
  });

  await reloadAll();
}

async function setBalance(id) {
  const balance = parseInt(document.getElementById(`bal-${id}`).value, 10);

  await api(`/api/admin/users/${id}/balance`, {
    method: "PUT",
    body: JSON.stringify({ balance })
  });

  await reloadAll();
}

async function toggleRole(id, role) {
  await api(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });

  await reloadAll();
}

async function deleteUser(id, username) {
  if (!confirm(`¿Eliminar a ${username}?`)) return;

  await api(`/api/admin/users/${id}`, {
    method: "DELETE"
  });

  await reloadAll();
}

async function logout() {
  localStorage.clear();
  try {
    await api("/api/logout", { method: "POST" });
  } catch {}
  window.location.href = "/";
}

async function reloadAll() {
  await loadSettings();
  await loadUsers();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadMe();
    await reloadAll();
  } catch (err) {
    setMsg(err.message);
    localStorage.clear();
    window.location.href = "/";
  }
});