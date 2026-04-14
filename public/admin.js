console.log("ADMIN PANEL CARGADO");

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/";
}

/* ================= API HELPER ================= */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    throw new Error(data.error || "Error");
  }

  return data;
}

/* ================= CARGAR SETTINGS ================= */

async function loadSettings() {
  try {
    const data = await api("/api/admin/settings");

    document.getElementById("win_rate").value = data.win_rate;
    document.getElementById("multiplier").value = data.multiplier;
    document.getElementById("jackpot_bank").value = data.jackpot_bank;

  } catch (err) {
    console.error(err);
  }
}

/* ================= GUARDAR SETTINGS ================= */

async function saveSettings() {
  try {
    const payload = {
      win_rate: Number(document.getElementById("win_rate").value),
      multiplier: Number(document.getElementById("multiplier").value),
      jackpot_bank: Number(document.getElementById("jackpot_bank").value)
    };

    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    alert("✅ Config guardada");

  } catch (err) {
    alert("❌ Error guardando");
    console.error(err);
  }
}

/* ================= USUARIOS ================= */

async function loadUsers() {
  try {
    const data = await api("/api/admin/users");

    const list = document.getElementById("userList");
    list.innerHTML = "";

    data.users.forEach(u => {
      const div = document.createElement("div");
      div.className = "user";

      div.innerHTML = `
        <span>${u.username} (${u.role}) - 💰 ${u.balance}</span>
      `;

      list.appendChild(div);
    });

  } catch (err) {
    console.error(err);
  }
}

/* ================= CREAR USUARIO ================= */

async function createUser() {
  const username = document.getElementById("newUser").value;
  const password = document.getElementById("newPass").value;

  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    alert("✅ Usuario creado");
    loadUsers();

  } catch (err) {
    alert("❌ Error creando usuario");
  }
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  loadUsers();
});