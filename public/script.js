let user = localStorage.getItem("user") || "";
let saldo = parseInt(localStorage.getItem("saldo") || "1000", 10);

function actualizarSaldo() {
  const saldoEl = document.getElementById("saldo");
  if (saldoEl) {
    saldoEl.innerText = "Saldo: " + saldo;
  }
  localStorage.setItem("saldo", String(saldo));
}

window.addEventListener("DOMContentLoaded", () => {
  actualizarSaldo();

  const nameInput = document.getElementById("name");
  if (nameInput && user) {
    nameInput.value = user;
  }
});


    .then(res => res.json())
    .then(() => {
      actualizarSaldo();
    })
    .catch(err => {
      console.error(err);
      alert("No se pudo crear el usuario");
    });
}

function jugar() {
  const numeroEl = document.getElementById("numero");
  const apuestaEl = document.getElementById("apuesta");
  const resultadoEl = document.getElementById("resultado");

  const numero = parseInt(numeroEl ? numeroEl.value : "", 10);
  const apuesta = parseInt(apuestaEl ? apuestaEl.value : "", 10);

  if (!user) {
    alert("Primero poné tu nombre");
    return;
  }

  if (Number.isNaN(numero) || Number.isNaN(apuesta) || apuesta <= 0) {
    alert("Revisá el número y la apuesta");
    return;
  }

  if (apuesta > saldo) {
    alert("No tenés saldo suficiente");
    return;
  }

  fetch("/roulette", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: user,
      betNumber: numero,
      amount: apuesta
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }

      saldo = data.balance;
      actualizarSaldo();

      if (resultadoEl) {
        resultadoEl.innerText =
          "Salió: " + data.result + " | Ganaste: " + data.win;
      }
    })
    .catch(err => {
      console.error(err);
      alert("Error al jugar");
    });
}