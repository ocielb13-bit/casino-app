const user = localStorage.getItem("user");

async function cargarSaldo() {
  const res = await fetch("/get-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user })
  });

  const data = await res.json();
  document.getElementById("saldo").innerText = "💰 " + data.balance;
}

async function jugar() {
  const apuesta = parseInt(document.getElementById("apuesta").value);

  if (!apuesta || apuesta <= 0) return;

  // perder apuesta primero
  await fetch("/update-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user, amount: -apuesta })
  });

  // lógica simple slot
  const win = Math.random() < 0.3;
  let ganancia = 0;

  if (win) {
    ganancia = apuesta * 2;
  }

  // sumar ganancia
  if (ganancia > 0) {
    await fetch("/update-balance", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username: user, amount: ganancia })
    });
  }

  document.getElementById("resultado").innerText =
    win ? "🎉 Ganaste " + ganancia : "😢 Perdiste";

  cargarSaldo();
}

function volver() {
  window.location.href = "/menu.html";
}

cargarSaldo();