async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

let spinning = false;

async function spin() {
  if (spinning) return;
  spinning = true;

  const bet = Number(document.getElementById("bet").value || 10);
  const spinBtn = document.getElementById("spinBtn");

  spinBtn.disabled = true;
  spinBtn.textContent = "Girando...";

  // 🎰 animación fake
  let fakeInterval = setInterval(() => {
    document.getElementById("result").textContent =
      "🎰 " + Math.floor(Math.random() * 9999);
  }, 100);

  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: bet })
    });

    setTimeout(() => {
      clearInterval(fakeInterval);

      document.getElementById("balance").textContent = res.balance;

      if (res.win > 0) {
        document.getElementById("result").textContent =
          "🔥 GANASTE " + res.win;
      } else {
        document.getElementById("result").textContent =
          "❌ PERDISTE";
      }

      spinning = false;
      spinBtn.disabled = false;
      spinBtn.textContent = "GIRAR";

    }, 1200); // delay tipo slot real

  } catch (e) {
    clearInterval(fakeInterval);
    alert("Error");
    spinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = "GIRAR";
  }
}

async function loadCasino() {
  const me = await api("/api/me");

  document.getElementById("balance").textContent = me.balance;
  document.getElementById("welcome").textContent =
    "Bienvenido " + me.username;
}

document.addEventListener("DOMContentLoaded", loadCasino);