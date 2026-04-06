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
  const numero = parseInt(document.getElementById("numero").value);
  const apuesta = parseInt(document.getElementById("apuesta").value);

  if (numero < 0 || numero > 36) return;
  if (!apuesta || apuesta <= 0) return;

  // restar apuesta
  await fetch("/update-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user, amount: -apuesta })
  });

  const resultado = Math.floor(Math.random() * 37);

  let ganancia = 0;

  if (resultado === numero) {
    ganancia = apuesta * 36;
  }

  if (ganancia > 0) {
    await fetch("/update-balance", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username: user, amount: ganancia })
    });
  }

  document.getElementById("resultado").innerText =
    "Salió: " + resultado +
    (ganancia ? " 🎉 Ganaste " + ganancia : " 😢 Perdiste");

  cargarSaldo();
}

function volver() {
  window.location.href = "/menu.html";
}

cargarSaldo();