const token = localStorage.getItem("token");

// =========================
// 🌐 API PRO (CON ERRORES)
// =========================
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      ...options
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("❌ API ERROR:", data);
      alert(data.error || "Error en el servidor");
      throw new Error(data.error || "Error");
    }

    return data;

  } catch (err) {
    console.error("🔥 FETCH ERROR:", err);
    alert("Error de conexión con el servidor");
    throw err;
  }
}

// =========================
// ⚙️ SETTINGS
// =========================
async function loadSettings() {
  const s = await api("/api/admin/settings");

  Object.keys(s).forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = s[k];
  });
}

async function saveSettings() {
  const payload = {
    win_rate: Number(win_rate.value),
    rtp: Number(rtp.value),
    roulette_winrate: Number(roulette_winrate.value),
    roulette_payout: Number(roulette_payout.value),
    slot_pay_3: Number(slot_pay_3.value),
    slot_pay_4: Number(slot_pay_4.value),
    slot_pay_5: Number(slot_pay_5.value),

    // 🔥 NUEVOS CAMPOS (IMPORTANTES)
    free_spin_award: Number(free_spin_award.value),
    default_balance: Number(default_balance.value),
    volatility: volatility.value
  };

  await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  alert("✅ Configuración guardada");
}

// =========================
// 👤 USERS
// =========================
async function loadUsers() {
  const data = await api("/api/admin/users");

  const container = document.getElementById("users");
  container.innerHTML = "";

  data.users.forEach(u => {
    const div = document.createElement("div");

    div.innerHTML = `
      <b>${u.username}</b> 💰 ${u.balance}
      <input type="number" id="b-${u.id}" placeholder="Nuevo saldo">
      <button onclick="setBalance(${u.id})">Set</button>
    `;

    container.appendChild(div);
  });
}

async function setBalance(id) {
  const val = Number(document.getElementById("b-" + id).value);

  if (isNaN(val)) {
    alert("Ingresá un número válido");
    return;
  }

  await api("/api/admin/user/" + id + "/balance", {
    method: "PUT",
    body: JSON.stringify({ amount: val })
  });

  loadUsers();
}

// =========================
// ➕ CREAR USUARIO (CORREGIDO)
// =========================
async function createUser() {
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value.trim();
  const role = document.getElementById("newRole").value;
  const balance = Number(document.getElementById("newBalance").value) || 0;

  if (!username || !password) {
    alert("Faltan datos");
    return;
  }

  await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      role,
      balance
    })
  });

  alert("✅ Usuario creado");

  // limpiar inputs
  document.getElementById("newUsername").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("newBalance").value = "0";

  loadUsers();
}

// =========================
// 🚀 INIT
// =========================
loadSettings();
loadUsers();