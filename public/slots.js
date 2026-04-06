const user = localStorage.getItem("user");

const simbolos = ["🍒","🍋","🍉","⭐","💎","7️⃣"];

async function cargarSaldo() {
  const res = await fetch("/get-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user })
  });

  const data = await res.json();
  document.getElementById("saldo").innerText = "💰 " + data.balance;
}

function girarVisual() {
  return simbolos[Math.floor(Math.random() * simbolos.length)];
}

async function jugar() {
  const apuesta = parseInt(document.getElementById("apuesta").value);
  if (!apuesta || apuesta <= 0) return;

  // RESTAR
  await fetch("/update-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user, amount: -apuesta })
  });

  // 🎰 GIRO VISUAL
  let r1 = girarVisual();
  let r2 = girarVisual();
  let r3 = girarVisual();

  document.getElementById("r1").innerText = r1;
  document.getElementById("r2").innerText = r2;
  document.getElementById("r3").innerText = r3;

  // 🧠 LÓGICA
  let ganancia = 0;

  if (r1 === r2 && r2 === r3) {
    ganancia = apuesta * 5;
  }

  if (ganancia > 0) {
    await fetch("/update-balance", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username: user, amount: ganancia })
    });
  }

  document.getElementById("resultado").innerText =
    ganancia ? "🎉 Ganaste " + ganancia : "😢 Perdiste";

  cargarSaldo();
}

function volver() {
  window.location.href = "/menu.html";
}

cargarSaldo();