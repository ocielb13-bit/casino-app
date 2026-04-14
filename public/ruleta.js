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

  if (!res.ok) {
    if (res.status === 401) {
      console.warn("Token inválido");
      localStorage.removeItem("token");
      window.location.href = "/";
      return;
    }
    throw new Error(data.error || "Error");
  }

  return data;
}

async function loadMe() {
  try {
    const me = await api("/api/me");
    if (!me) return;

    document.getElementById("playerLine").textContent = me.username;
    document.getElementById("saldo").textContent = me.balance;

    const info = await api("/api/game-info");
    if (!info) return;

    document.getElementById("payoutLine").textContent =
      (info.roulette_payout || 35) + ":1";

  } catch (err) {
    console.error(err);
  }
}

async function jugar() {
  try {
    const numero = Number(document.getElementById("numero").value);
    const apuesta = Number(document.getElementById("apuesta").value);

    const res = await api("/api/roulette/spin", {
      method: "POST",
      body: JSON.stringify({
        number: numero,
        amount: apuesta
      })
    });

    if (!res) return;

    document.getElementById("saldo").textContent = res.balance;

    document.getElementById("resultado").textContent =
      res.win > 0
        ? `Ganaste ${res.win}`
        : `Salió ${res.result}`;

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadMe);