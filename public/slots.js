// saldo inicial
let saldo = localStorage.getItem("saldo") || 1000;
saldo = parseInt(saldo);

actualizarSaldo();

function actualizarSaldo() {
  document.getElementById("saldo").innerText = "Saldo: " + saldo;
  localStorage.setItem("saldo", saldo);
}

const symbols = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"];

function spin() {
  let apuesta = parseInt(document.getElementById("apuesta").value);

  if (apuesta > saldo) {
    alert("No tenés saldo suficiente");
    return;
  }

  saldo -= apuesta;
  actualizarSaldo();

  spinReel("r1", 20, 80);
  spinReel("r2", 30, 80);
  spinReel("r3", 40, 80);

  setTimeout(() => checkWin(apuesta), 3500);
}

function spinReel(id, spins, speed) {
  let reel = document.getElementById(id);
  let count = 0;

  let interval = setInterval(() => {
    reel.innerText = symbols[Math.floor(Math.random() * symbols.length)];
    count++;

    if (count >= spins) {
      clearInterval(interval);
    }
  }, speed);
}

function checkWin(apuesta) {
  let r1 = document.getElementById("r1").innerText;
  let r2 = document.getElementById("r2").innerText;
  let r3 = document.getElementById("r3").innerText;

  if (r1 === r2 && r2 === r3) {
    let premio = apuesta * 5;
    saldo += premio;
    document.getElementById("resultado").innerText = "🎉 Ganaste " + premio;
  } else {
    document.getElementById("resultado").innerText = "😢 Perdiste";
  }

  actualizarSaldo();
}