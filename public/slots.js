<!-- public/slots.js -->
// =====================================================
// SLOTS ASIAN DRAGON - 5 reels × 3 filas (exacto como querés)
// Funciona con tu casino.html actual
// =====================================================

const SYMBOLS = [
  { name: "coin",     emoji: "🪙", src: "/asset/symbol/asian/coin.png" },
  { name: "dragon",   emoji: "🐉", src: "/asset/symbol/asian/dragon.png" },
  { name: "lantern",  emoji: "🏮", src: "/asset/symbol/asian/lantern.png" },
  { name: "treasure", emoji: "💰", src: "/asset/symbol/asian/treasure.png" },
  { name: "wild",     emoji: "🔥", src: "/asset/symbol/asian/wild.png" },
  { name: "star",     emoji: "⭐", src: "/asset/symbol/asian/star.png" },
  { name: "phoenix",  emoji: "🦅", src: "/asset/symbol/asian/phoenix.png" },
  { name: "koi",      emoji: "🐟", src: "/asset/symbol/asian/koi.png" }
];

// Variables globales
let balance = 1229; // se actualizará desde Supabase
let currentBet = 200;

function getRandomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// Crear o actualizar los 15 casilleros con animación
function createOrUpdateGrid(finalResult = null) {
  const grid = document.getElementById('slotGrid');
  const containers = grid.querySelectorAll('.reel-symbol-container');

  containers.forEach((container, index) => {
    const symbol = finalResult ? finalResult[index] : getRandomSymbol();
    
    // Intenta cargar imagen real, si falla usa emoji (para que siempre funcione)
    container.innerHTML = `
      <img src="${symbol.src}" 
           onerror="this.style.display='none'; this.parentElement.innerHTML = '<span style=\"font-size:52px\">${symbol.emoji}</span>'"
           style="width:85%; max-height:100%; object-fit:contain; filter:drop-shadow(0 0 12px gold);">
    `;
  });
}

// Animación de giro (rápida y realista)
async function spin() {
  const betInput = document.getElementById('betAmount');
  currentBet = parseInt(betInput.value) || 200;

  // Validación simple de saldo
  if (balance < currentBet) {
    document.getElementById('winMessage').innerHTML = `<span style="color:#f87171">❌ Saldo insuficiente</span>`;
    return;
  }

  // Descontar apuesta
  balance -= currentBet;
  document.getElementById('balance').textContent = balance;

  document.getElementById('winMessage').textContent = '🎰 GIRANDO...';

  // 1. Animación de giro (cambia símbolos muy rápido)
  const totalSpins = 25; // cuántas veces cambia cada símbolo
  for (let i = 0; i < totalSpins; i++) {
    createOrUpdateGrid(); // cambia todos los símbolos
    await new Promise(r => setTimeout(r, 60)); // velocidad del giro
  }

  // 2. Resultado final
  const finalResult = [];
  for (let i = 0; i < 15; i++) {
    finalResult.push(getRandomSymbol());
  }
  createOrUpdateGrid(finalResult);

  // 3. Calcular ganancia simple (puedes expandir después)
  let winnings = 0;
  // Ejemplo básico: 3 símbolos iguales en cualquier fila
  const rows = [
    finalResult.slice(0, 5),   // fila 1
    finalResult.slice(5, 10),  // fila 2
    finalResult.slice(10, 15)  // fila 3
  ];

  rows.forEach(row => {
    const first = row[0].name;
    if (row.every(s => s.name === first || s.name === 'wild')) {
      winnings += currentBet * 8; // ganancia x8
    }
  });

  if (winnings > 0) {
    balance += winnings;
    document.getElementById('winMessage').innerHTML = 
      `🎉 ¡GANASTE <strong>${winnings}</strong>!`;
    document.getElementById('balance').textContent = balance;
  } else {
    document.getElementById('winMessage').innerHTML = 
      `<span style="color:#f87171">Mejor suerte la próxima 🔥</span>`;
  }

  // Actualizar saldo en Supabase (usa tu endpoint existente)
  // fetch('/api/update-balance', { method: 'POST', ... }) → aquí iría tu lógica real
}

// Inicialización
function initSlots() {
  console.log('%c🎰 Asian Dragon Slots cargados correctamente', 'color:#facc15; font-size:18px');
  createOrUpdateGrid(); // muestra símbolos al cargar
}

// Exponer funciones al HTML
window.spin = spin;
window.initSlots = initSlots;