<!-- public/slots.js -->
// =====================================================
// SLOTS ASIAN DRAGON - 5 reels × 3 filas
// Rutas corregidas con tus archivos reales (assets/)
// =====================================================

const SYMBOLS = [
  { name: "coin",     src: "/assets/coin.png" },
  { name: "dragon",   src: "/assets/dragon.png" },
  { name: "goldpot",  src: "/assets/goldpot.png" },
  { name: "jade",     src: "/assets/jade.png" },
  { name: "lantern",  src: "/assets/lantern.png" },
  { name: "scatter",  src: "/assets/scatter.png" },
  { name: "wild",     src: "/assets/wild.png" }
];

let balance = 1229;   // se actualizará desde Supabase
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
           onerror="this.style.display='none'; this.parentElement.innerHTML = '<span style=\"font-size:58px\">${symbol.name === 'wild' ? '🔥' : symbol.name === 'dragon' ? '🐉' : '🪙'}</span>'"
           style="width:88%; height:88%; object-fit:contain; filter: drop-shadow(0 0 12px #facc15);">
    `;
  });
}

// Función principal de giro
async function spin() {
  const betInput = document.getElementById('betAmount');
  currentBet = parseInt(betInput.value) || 200;

  if (balance < currentBet) {
    document.getElementById('winMessage').innerHTML = `<span style="color:#f87171">❌ Saldo insuficiente</span>`;
    return;
  }

  // Descontar apuesta
  balance -= currentBet;
  document.getElementById('balance').textContent = balance;

  document.getElementById('winMessage').innerHTML = `<span style="color:#facc15">🎰 GIRANDO...</span>`;

  // Animación de giro rápido (25 cambios)
  const totalSpins = 25;
  for (let i = 0; i < totalSpins; i++) {
    createOrUpdateGrid();
    await new Promise(r => setTimeout(r, 55));
  }

  // Resultado final
  const finalResult = Array.from({length: 15}, () => getRandomSymbol());
  createOrUpdateGrid(finalResult);

  // Cálculo simple de ganancia (puedes mejorarlo después)
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
      winnings += currentBet * 12;   // x12 por línea
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
  console.log('%c✅ Asian Dragon Slots cargados con imágenes reales', 'color:#facc15;font-size:16px');
  createOrUpdateGrid();   // muestra los símbolos al cargar
}

// Exponer funciones
window.spin = spin;
window.initSlots = initSlots;