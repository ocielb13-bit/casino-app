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

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;
}

function setMsg(text, type = "") {
  const el = document.getElementById("msg");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.type = type;
}

function goCasino() {
  window.location.href = "/menu.html";
}

function logout() {
  localStorage.clear();
  window.location.href = "/";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function clampInt(value, min, max) {
  const n = Math.floor(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

async function loadMe() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/";
    return false;
  }

  try {
    const me = await api("/api/me");

    if (me.role !== "admin") {
      window.location.href = "/menu.html";
      return false;
    }

    setText("adminLine", `Admin: ${me.username}`);
    return true;
  } catch (err) {
    setMsg(`Sesión inválida: ${err.message}`, "error");
    localStorage.removeItem("token");
    window.location.href = "/";
    return false;
  }
}

async function loadSettings() {
  const s = await api("/api/admin/settings");

  setText("currentWinRate", s.win_rate);
  setText("currentMultiplier", s.multiplier);
  setText("currentJackpot", s.jackpot_bank);
  setText("currentDefaultBalance", s.default_balance);
  setText("currentFreeAward", s.free_spin_award);

  const ids = [
    "win_rate",
    "multiplier",
    "jackpot_bank",
    "default_balance",
    "slot_pay_3",
    "slot_pay_4",
    "slot_pay_5",
    "roulette_payout",
    "free_spin_award"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el && s[id] !== undefined) el.value = s[id];
  });
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  const box = document.getElementById("usersList");
  if (!box) return;

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
        <div class="small">
          Saldo: <strong>${u.balance}</strong> · FS: <strong>${u.free_spins || 0}</strong> · Banco: <strong>${u.free_spin_bank || 0}</strong>
        </div>
      </div>

      <div class="form-grid">
        <input id="bal-${u.id}" type="number" value="${u.balance}">
        <button type="button" onclick="setBalance(${u.id})">Guardar saldo</button>
        <button type="button" onclick="addBalance(${u.id}, 100)">+100</button>
        <button type="button" onclick="addBalance(${u.id}, -100)">-100</button>
        <button type="button" onclick="toggleRole(${u.id}, '${u.role === "admin" ? "player" : "admin"}')">
          ${u.role === "admin" ? "Quitar admin" : "Hacer admin"}
        </button>
        <button type="button" class="danger" onclick="deleteUser(${u.id}, '${u.username}')">Eliminar</button>
      </div>
    `;

    box.appendChild(card);
  });
}

async function saveSettings() {
  try {
    const payload = {
      win_rate: parseFloat(document.getElementById("win_rate").value),
      multiplier: parseFloat(document.getElementById("multiplier").value),
      jackpot_bank: parseInt(document.getElementById("jackpot_bank").value, 10),
      default_balance: parseInt(document.getElementById("default_balance").value, 10),
      slot_pay_3: parseInt(document.getElementById("slot_pay_3").value, 10),
      slot_pay_4: parseInt(document.getElementById("slot_pay_4").value, 10),
      slot_pay_5: parseInt(document.getElementById("slot_pay_5").value, 10),
      roulette_payout: parseInt(document.getElementById("roulette_payout").value, 10),
      free_spin_award: parseInt(document.getElementById("free_spin_award").value, 10)
    };

    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    setMsg("Ajustes guardados");
    await reloadAll();
  } catch (err) {
    setMsg(err.message, "error");
  }
}

async function createUser() {
  try {
    const username = document.getElementById("newUser").value.trim();
    const password = document.getElementById("newPass").value.trim();
    const balance = document.getElementById("newBalance").value;
    const role = document.getElementById("newRole").value;

    if (!username || !password) {
      setMsg("Poné usuario y contraseña", "error");
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
  } catch (err) {
    setMsg(err.message, "error");
  }
}

async function addBalance(id, delta) {
  try {
    await api(`/api/admin/users/${id}/balance`, {
      method: "PATCH",
      body: JSON.stringify({ delta })
    });

    await reloadAll();
  } catch (err) {
    setMsg(err.message, "error");
  }
}

async function setBalance(id) {
  try {
    const balance = parseInt(document.getElementById(`bal-${id}`).value, 10);

    await api(`/api/admin/users/${id}/balance`,