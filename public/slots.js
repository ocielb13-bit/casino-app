const symbols = [
  "https://i.imgur.com/1XqXK0K.png", // dragon
  "https://i.imgur.com/8Qf6X4F.png", // moneda
  "https://i.imgur.com/yXOvdOS.png", // farol
  "https://i.imgur.com/Jk7pK0B.png", // diamante
  "https://i.imgur.com/Z6X9Q0K.png"  // 7
];

function spin() {
  spinReel("r1", 20, 80);
  spinReel("r2", 30, 80);
  spinReel("r3", 40, 80);
}

function spinReel(id, spins, speed) {
  let reel = document.getElementById(id);
  let count = 0;

  let interval = setInterval(() => {
    reel.src = symbols[Math.floor(Math.random() * symbols.length)];
    count++;

    if (count >= spins) {
      clearInterval(interval);
      if (id === "r3") setTimeout(checkWin, 300);
    }
  }, speed);
}

function checkWin() {
  let r1 = document.getElementById("r1").src;
  let r2 = document.getElementById("r2").src;
  let r3 = document.getElementById("r3").src;

  if (r1 === r2 && r2 === r3) {
    document.getElementById("resultado").innerText = "🎉 JACKPOT!";
  } else {
    document.getElementById("resultado").innerText = "😢 Perdiste";
  }
}