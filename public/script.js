let user = "";

function crearUsuario() {
  user = document.getElementById("name").value;

  fetch("http://localhost:3000/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: user })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById("saldo").innerText = "Saldo: " + data.balance;
  });
}

function jugar() {
  const numero = parseInt(document.getElementById("numero").value);
  const apuesta = parseInt(document.getElementById("apuesta").value);

  fetch("http://localhost:3000/roulette", {
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
    document.getElementById("resultado").innerText =
      "Salió: " + data.result + " | Ganaste: " + data.win;

    document.getElementById("saldo").innerText =
      "Saldo: " + data.balance;
  });
}