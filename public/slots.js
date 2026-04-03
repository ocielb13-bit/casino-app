const symbols = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"];

function spin() {

  let r1 = document.getElementById("r1");
  let r2 = document.getElementById("r2");
  let r3 = document.getElementById("r3");

  let spins = 20;

  let interval = setInterval(() => {
    r1.innerText = symbols[Math.floor(Math.random() * symbols.length)];
    r2.innerText = symbols[Math.floor(Math.random() * symbols.length)];
    r3.innerText = symbols[Math.floor(Math.random() * symbols.length)];

    spins--;

    if (spins <= 0) {
      clearInterval(interval);
      checkWin();
    }
  }, 100);
}

function checkWin() {
  let r1 = document.getElementById("r1").innerText;
  let r2 = document.getElementById("r2").innerText;
  let r3 = document.getElementById("r3").innerText;

  if (r1 === r2 && r2 === r3) {
    document.getElementById("resultado").innerText = "🎉 GANASTE!";
  } else {
    document.getElementById("resultado").innerText = "😢 Perdiste";
  }
}