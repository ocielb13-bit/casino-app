<!-- public/slots.js -->
// =====================================================
// SLOTS ASIAN DRAGON - 5 reels × 3 filas
// RUTA CORRECTA FINAL (según tus capturas):
// /assets/symbols/asian/
// =====================================================

const SYMBOLS = [
  { name: "coin",     src: "/assets/symbols/asian/coin.png" },
  { name: "dragon",   src: "/assets/symbols/asian/dragon.png" },
  { name: "goldpot",  src: "/assets/symbols/asian/goldpot.png" },
  { name: "jade",     src: "/assets/symbols/asian/jade.png" },
  { name: "lantern",  src: "/assets/symbols/asian/lantern.png" },
  { name: "scatter",  src: "/assets/symbols/asian/scatter.png" },
  { name: "wild",     src: "/assets/symbols/asian/wild.png" }
];

let balance = 1229;
let currentBet = 200;

// Obtener símbolo aleatorio
function getRandomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// Actualizar los 15 casilleros
function createOrUpdateGrid(finalResult = null) {
  const grid = document.getElementById('slotGrid');
  if (!grid) return;
  
  const containers = grid.querySelectorAll('.reel-symbol-container');
  
  containers.forEach((container, index) => {
    const symbol = finalResult ? finalResult[index] : getRandomSymbol();
    
    container.innerHTML = `
      <img src="${symbol.src}" 
           onerror="this.style.display='none'; 
                    this.parentElement.innerHTML = '<span style=\"font-size:58px\">${symbol.name === 'wild' ? '🔥' : symbol.name === 'dragon' ? '🐉' : '🪙'}</span>'"
           style="width:88%; height:88%; object-fit:contain; filter: drop-shadow(0 0 15px #facc15);">
    `;
  });
}

// Función de giro
async function spin() {
  const betInput = document.getElementById('betAmount');
  currentBet = parseInt(betInput.value) || 200;

  if (balance < currentBet) {
    document.getElementById('winMessage').innerHTML = `<span style="color:#f87171">❌ Saldo insuficiente</span>`;
    return;
  }

  balance -= currentBet;
  document.getElementById('balance').textContent = balance;

  document.getElementById('winMessage').innerHTML = `<span style="color:#facc15">🎰 GIRANDO...</span>`;

  // Animación de giro
  const totalSpins = 25;
  for (let i = 0; i < totalSpins; i++) {
    createOrUpdateGrid();
    await new Promise(r => setTimeout(r, 55));
  }

  // Resultado final
  const finalResult = Array.from({length: 15}, () => getRandomSymbol());
  createOrUpdateGrid(finalResult);

  // Cálculo de ganancia simple
  let winnings = 0;
  const rows = [
    finalResult.slice(0, 5),
    finalResult.slice(5, 10),
    finalResult.slice(10, 15)
  ];

  rows.forEach(row => {
    const names = row.map(s => s.name);
    const unique = [...new Set(names)];
    if (unique.length === 1 || (unique.length === 2 && unique.includes('wild'))) {
      winnings += currentBet * 12;
    }
  });

  if (winnings > 0) {
    balance += winnings;
    document.getElementById('winMessage').innerHTML = 
      `🎉 ¡GANASTE <strong style="color:#facc15">${winnings}</strong> fichas!`;
    document.getElementById('balance').textContent = balance;
  } else {
    document.getElementById('winMessage').innerHTML = 
      `<span style="color:#f87171">¡Mejor suerte la próxima! 🔥</span>`;
  }
}

// Inicializar
function initSlots() {
  console.log('%c✅ Asian Dragon Slots cargados con ruta /assets/symbols/asian/', 'color:#facc15;font-size:16px');
  createOrUpdateGrid();
}

window.spin = spin;
window.initSlots = initSlots;