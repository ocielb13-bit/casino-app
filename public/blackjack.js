let blackjackState = {
  active: false
};

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

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    return;
  }

  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setButtons(active, canDouble = false) {
  const dealBtn = document.getElementById("dealBtn");
  const hitBtn = document.getElementById("hitBtn");
  const standBtn = document.getElementById("standBtn");
  const doubleBtn = document.getElementById("doubleBtn");

  if (dealBtn) dealBtn.disabled = false;
  if (hitBtn) hitBtn.disabled = !active;
  if (standBtn) standBtn.disabled = !active;
  if (doubleBtn) doubleBtn.disabled = !active || !canDouble;
}

function cardChip(label) {
  const div = document.createElement("div");
  div.className = "chip";
  div.textContent = label;
  return div;
}

function renderHand(containerId, cards = [], hiddenCount = 0) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  (cards || []).forEach((card) => {
    container.appendChild(cardChip(card.label));
  });

  for (let i = 0; i < hiddenCount; i += 1) {
    container.appendChild(cardChip("🂠"));
  }
}

function renderState(data) {
  blackjackState = {
    active: Boolean(data.active),
    finished: Boolean(data.finished),
    bet: Number(data.bet || 0),
    balance: Number(data.balance || 0),
    canDouble: Boolean(data.canDouble)
  };

  setText("saldo", data.balance || 0);
  setText("playerValue", data.playerValue || 0);
  setText("dealerValue", data.dealerValue || 0);
  setText("estado", data.message || (data.active ? "Tu turno" : "Listo para repartir"));
  setText("betDisplay", data.bet || Number(document.getElementById("bet").value || 100));

  renderHand("dealerHand", data.dealerHand || [], Number(data.dealerHiddenCount || 0));
  renderHand("playerHand", data.playerHand || [], 0);

  setButtons(Boolean(data.active), Boolean(data.canDouble));
}

async function loadMe() {
  const me = await api("/api/me");
  if (!me) return;

  setText("playerLine", me.username);
  setText("saldo", me.balance);
}

async function loadState() {
  const state = await api("/api/blackjack/state");
  if (!state) return;

  if (state.active) {
    renderState(state);
  } else {
    blackjackState.active = false;
    setText("estado", state.message || "Listo para repartir");
    setButtons(false, false);
    renderHand("dealerHand", [], 0);
    renderHand("playerHand", [], 0);
  }
}

async function dealHand() {
  if (blackjackState.active) return;

  try {
    const bet = Number(document.getElementById("bet").value || 100);

    if (!Number.isFinite(bet) || bet <= 0) {
      setText("estado", "Poné una apuesta válida");
      return;
    }

    const data = await api("/api/blackjack/deal", {
      method: "POST",
      body: JSON.stringify({ amount: bet })
    });

    renderState(data);
  } catch (err) {
    setText("estado", err.message || "Error");
  }
}

async function action(type) {
  if (!blackjackState.active) return;

  try {
    const data = await api("/api/blackjack/action", {
      method: "POST",
      body: JSON.stringify({ action: type })
    });

    renderState(data);
  } catch (err) {
    setText("estado", err.message || "Error");
  }
}

function hit() {
  action("hit");
}

function stand() {
  action("stand");
}

function doubleDown() {
  action("double");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadMe();
    await loadState();
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});

window.dealHand = dealHand;
window.hit = hit;
window.stand = stand;
window.doubleDown = doubleDown;