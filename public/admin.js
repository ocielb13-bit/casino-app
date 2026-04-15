const token = localStorage.getItem("token");

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    ...options
  });

  return res.json();
}

/* SETTINGS */

async function loadSettings() {
  const s = await api("/api/admin/settings");

  Object.keys(s).forEach(k => {
    if (document.getElementById(k)) {
      document.getElementById(k).value = s[k];
    }
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
    slot_pay_5: Number(slot_pay_5.value)
  };

  await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  alert("Guardado");
}

/* USERS */

async function loadUsers() {
  const data = await api("/api/admin/users");

  const container = document.getElementById("users");
  container.innerHTML = "";

  data.users.forEach(u => {
    const div = document.createElement("div");

    div.innerHTML = `
      ${u.username} 💰 ${u.balance}
      <input type="number" id="b-${u.id}">
      <button onclick="setBalance(${u.id})">Set</button>
    `;

    container.appendChild(div);
  });
}

async function setBalance(id) {
  const val = document.getElementById("b-" + id).value;

  await api("/api/admin/user/" + id + "/balance", {
    method: "PUT",
    body: JSON.stringify({ amount: val })
  });

  loadUsers();
}

/* INIT */

loadSettings();
loadUsers();