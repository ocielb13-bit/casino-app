const symbols = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"];

function spin() {
  spinReel("r1", 20, 100);
  spinReel("r2", 30, 100);
  spinReel("r3", 40, 100);
}

function spinReel(id, spins, speed) {
  let reel = document.getElementById(id);

  let count = 0;

  let interval = setInterval(() => {
    reel.innerText = symbols[Math.floor(Math.random() * symbols.length)];
    count++;

    if (count >= spins) {
      clearInterval(interval);

      // cuando termina el último, verifica resultado
      if (id === "r3") {
        setTimeout(checkWin, 300);
      }
    }
  }, speed);
}

function checkWin() {
  let r1 = document.getElementById("r1").innerText;
  let r2 = document.getElementById("r2").innerText;
  let r3 = document.getElementById("r3").innerText;

  if (r1 === r2 && r2 === r3) {
    document.getElementById("resultado").innerText = "🎉 JACKPOT!";
  } else {
    document.getElementById("resultado").innerText = "😢 Perdiste";
  }
}