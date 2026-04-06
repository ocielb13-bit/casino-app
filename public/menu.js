const user = localStorage.getItem("user");

if (!user) {
  window.location.href = "/";
}

async function cargarSaldo() {
  const res = await fetch("/get-balance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username: user })
  });

  const data = await res.json();

  document.getElementById("userText").innerText = "Usuario: " + user;
  document.getElementById("saldo").innerText = "💰 Saldo: " + data.balance;
}

function irSlots() {
  window.location.href = "/slots.html";
}

function irRuleta() {
  window.location.href = "/ruleta.html";
}

window.addEventListener("DOMContentLoaded", cargarSaldo);