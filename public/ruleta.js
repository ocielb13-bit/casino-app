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

async function loadMe() {
  try {
    const me = await api("/api/me");
    if (me.role === "admin") {
      window.location.href = "/admin.html";
      return;
    }

    document.getElementById("playerLine").textContent = `Usuario: ${me.username}`;
    document.getElementById("saldo").textContent = me.balance;
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
}

function animateWheel(finalNumber) {
  const wheel = document.getElementById("wheel");
  wheel.classList.add("spinning");

  let count = 0;
  const timer = setInterval(() => {
    wheel.textContent = Math.floor(Math.random() * 37);
    count += 1;

    if (count >= 14) {
      clearInterval(timer);
      wheel.classList.remove("spinning");
      wheel.textContent = finalNumber;
    }
  }, 70);
}

async function jugar() {
  try {
    const numero = parseInt(document.getElementById("numero").value, 10);
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);

    if (!Number.isInteger(numero) || numero < 0 || numero > 36) {
      document.getElementById("resultado").textContent = "Elegí un número entre 0 y 36.";
      return;
    }

    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      document.getElementById("resultado").textContent = "Poné una apuesta válida.";
      return;
    }

    document.getElementById("resultado").textContent = "Girando...";

    const res = await api("/api/roulette/spin", {
      method: "POST",
      body: JSON.stringify({ number: numero, amount: apuesta })
    });

    animateWheel(res.result);

    setTimeout(() => {
      document.getElementById("saldo").textContent = res.balance;
      document.getElementById("resultado").textContent =
        res.win > 0
          ? `🎉 Salió ${res.result}. Ganaste ${res.win}.`
          : `😢 Salió ${res.result}. Perdiste.`;
    }, 1100);
  } catch (err) {
    document.getElementById("resultado").textContent = "❌ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", loadMe);