console.log("ADMIN JS OK");

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/";
}

/* ================= API ================= */

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
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/";
      }
      throw new Error(data.error || "Error API");
    }

    return data;
  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  await loadAdminInfo();
  await loadSettings();
  await loadUsers();
}

/* ================= ADMIN INFO ================= */

async function loadAdminInfo() {
  try {
    const me = await api("/api/me");
    document.getElementById("adminLine").textContent =
      "Logueado como: " + me.username;
  } catch (e) {
    console.error(e);
  }
}

/* ================= SETTINGS ================= */

async function loadSettings() {
  try {
    const s = await api("/api/admin/settings");

    // inputs
    document.getElementById("win_rate").value = s.win_rate;
    document.getElementById("multiplier").value = s.multiplier;
    document.getElementById("jackpot_bank").value = s.jackpot_bank;
    document.getElementById("default_balance").value = s.default_balance;
    document.getElementById("slot_pay_3").value = s.slot_pay_3;
    document.getElementById("slot_pay_4").value = s.slot_pay_4;
    document.getElementById("slot_pay_5").value = s.slot_pay_5;
    document.getElementById("roulette_payout").value = s.roulette_payout;
    document.getElementById("free_spin_award").value = s.free_spin_award;

    // KPI arriba
    document.getElementById("currentWinRate").textContent = s.win_rate;
    document.getElementById("currentMultiplier").textContent = s.multiplier;
    document.getElementById("currentJackpot").textContent = s.jackpot_bank;
    document.getElementById("currentDefaultBalance").textContent = s.default_balance;
    document.getElementById("currentFreeAward").textContent = s.free_spin_award;

  } catch (e) {
    console.error("ERROR SETTINGS", e);
  }
}

async function saveSettings() {
  try {
    const payload = {
      win_rate: Number(win_rate.value),
      multiplier: Number(multiplier.value),
      jackpot_bank: Number(jackpot_bank.value),
      default_balance: Number(default_balance.value),
      slot_pay_3: Number(slot_pay_3.value),
      slot_pay_4: Number(slot_pay_4.value),
      slot_pay_5: Number(slot_pay_5.value),
      roulette_payout: Number(roulette_payout.value),
      free_spin_award: Number(free_spin_award.value)
    };

    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    alert("✅ Guardado");
    loadSettings();

  } catch (e) {
    alert("❌ Error guardando");
  }
}

/* ================= USERS ================= */

async function loadUsers() {
  try {
    const data = await api("/api/admin/users");

    const container = document.getElementById("usersList");
    container.innerHTML = "";

    data.users.forEach(u => {
      const div = document.createElement("div");
      div.className = "user";

      div.innerHTML = `
        <b>${u.username}</b> (${u.role})  
        💰 ${u.balance}
      `;

      container.appendChild(div);
    });

  } catch (e) {
    console.error("ERROR USERS", e);
  }
}

async function createUser() {
  try {
    const payload = {
      username: newUser.value,
      password: newPass.value,
      balance: Number(newBalance.value || 0),
      role: newRole.value
    };

    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    alert("✅ Usuario creado");

    newUser.value = "";
    newPass.value = "";
    newBalance.value = "";

    loadUsers();

  } catch (e) {
    alert("❌ Error creando usuario");
  }
}

/* ================= NAV ================= */

function logout() {
  localStorage.clear();
  window.location.href = "/";
}

function goCasino() {
  window.location.href = "/menu.html";
}

function reloadAll() {
  init();
}