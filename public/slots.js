<!-- public/slots.js -->
// =====================================================
// SLOTS ENHANCED - Classic + Asian Dragon
// Mantiene TODA la lógica original + nuevas features
// =====================================================

const SOUNDS = {
  spin: new Audio('/sounds/spin.mp3'),
  stop: new Audio('/sounds/reel_stop.mp3'),
  win: new Audio('/sounds/win.mp3'),
  jackpot: new Audio('/sounds/jackpot.mp3'),
  bonus: new Audio('/sounds/bonus_trigger.mp3'),
  freeSpin: new Audio('/sounds/free_spins_start.mp3')
};
SOUNDS.spin.loop = true;

// Configuración (usa settings del servidor)
let SETTINGS = {};
let freeSpinsLeft = 0;
let currentMultiplier = 1; // puede aumentar en bonus

// Símbolos (mantén tus rutas originales y agrega los nuevos)
const SYMBOLS = {
  classic: [
    { name: 'cherry', src: '/asset/symbol/classic/cherry.png' },
    { name: 'lemon', src: '/asset/symbol/classic/lemon.png' },
    { name: 'orange', src: '/asset/symbol/classic/orange.png' },
    { name: 'bell', src: '/asset/symbol/classic/bell.png' },
    { name: 'seven', src: '/asset/symbol/classic/seven.png' },
    { name: 'bar', src: '/asset/symbol/classic/bar.png' },
    { name: 'scatter', src: '/asset/symbol/classic/scatter.png' },   // ⭐ nuevo
    { name: 'bonus', src: '/asset/symbol/classic/bonus.png' }       // 💎 nuevo
  ],
  dragon: [
    { name: 'dragon', src: '/asset/symbol/asian/dragon.png' },
    { name: 'phoenix', src: '/asset/symbol/asian/phoenix.png' },
    { name: 'koi', src: '/asset/symbol/asian/koi.png' },
    { name: 'lantern', src: '/asset/symbol/asian/lantern.png' },
    { name: 'scatter', src: '/asset/symbol/asian/scatter.png' },
    { name: 'bonus', src: '/asset/symbol/asian/bonus.png' }
  ]
};

let currentStyle = 'classic'; // se cambia desde casino.html

// ====================== UTILIDADES ======================
function playSound(key) {
  try {
    const audio = SOUNDS[key];
    audio.currentTime = 0;
    audio.play();
  } catch(e) {}
}

function getRandomSymbol() {
  const list = SYMBOLS[currentStyle];
  return list[Math.floor(Math.random() * list.length)];
}

// ====================== ANIMATION MEJORADA ======================
async function spin() {
  // === TU CÓDIGO EXISTENTE (balance check, bet deduction, etc.) ===
  // NO BORRAR: aquí va tu lógica original de validación y descuento
  // Ejemplo: await updateBalance(-betAmount); // Supabase / API

  const betAmount = parseInt(document.getElementById('betAmount').value) || 10;

  playSound('spin');

  // Activar animación en los 3 reels
  document.querySelectorAll('.reel').forEach(r => r.classList.add('spinning'));

  // Generar resultado final (mantén tu función original si existe)
  const finalReels = [
    getRandomSymbol(), getRandomSymbol(), getRandomSymbol()
  ];

  // Parada escalonada + realista (reel 1 → 2 → 3)
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 700 + i * 650));
    document.querySelectorAll('.reel')[i].innerHTML = `
      <div class="reel-strip">
        <img src="${finalReels[i].src}" class="reel-symbol">
      </div>`;
    playSound('stop');
  }

  document.querySelectorAll('.reel').forEach(r => r.classList.remove('spinning'));
  SOUNDS.spin.pause();

  // === TU LÓGICA EXISTENTE DE WIN CALCULATION ===
  const winnings = calculateWin(finalReels); // ← mantén tu función original
  const totalWin = winnings * currentMultiplier;

  // Actualizar balance (TU CÓDIGO EXISTENTE CON SUPABASE)
  // Ejemplo: await api('/api/update-balance', { balance: newBalance });

  if (totalWin > 0) {
    playSound(totalWin >= betAmount * 15 ? 'jackpot' : 'win');
    showWinMessage(totalWin);
  }

  // ==================== NUEVAS FEATURES ====================
  const scatters = finalReels.filter(s => s.name === 'scatter').length;
  if (scatters >= 3) {
    freeSpinsLeft += 12;
    playSound('freeSpin');
    document.getElementById('freeSpinsCounter').textContent = freeSpinsLeft;
    triggerFreeSpinsMode();
  }

  const bonusSymbols = finalReels.filter(s => s.name === 'bonus').length;
  if (bonusSymbols >= 2) {
    playSound('bonus');
    await startBonusRound();
  }

  // Multiplicador global (usa el del servidor + posible bonus)
  if (SETTINGS.multiplier) currentMultiplier = SETTINGS.multiplier;
}

// ====================== FREE SPINS ======================
async function triggerFreeSpinsMode() {
  const overlay = createOverlay(`¡${freeSpinsLeft} FREE SPINS!`);
  while (freeSpinsLeft > 0) {
    freeSpinsLeft--;
    document.getElementById('freeSpinsCounter').textContent = freeSpinsLeft;
    await spin(); // spin sin costo
    await new Promise(r => setTimeout(r, 1200));
  }
  overlay.remove();
}

// ====================== BONUS ROUND ======================
async function startBonusRound() {
  const overlay = createOverlay('BONUS ROUND - Elige 3 cofres');
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '30px';

  for (let i = 0; i < 3; i++) {
    const chest = document.createElement('button');
    chest.textContent = '🪙';
    chest.style.fontSize = '80px';
    chest.onclick = () => {
      const prize = Math.random() > 0.5 ? 25 : 50; // o free spins
      chest.textContent = prize >= 40 ? '💎' : '🪙';
      currentMultiplier += prize / 10;
      setTimeout(() => chest.style.opacity = '0.3', 600);
    };
    container.appendChild(chest);
  }
  overlay.appendChild(container);
  // Auto close después de 12 segundos
  setTimeout(() => overlay.remove(), 12000);
}

// ====================== HELPERS ======================
function createOverlay(title) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `<h1 style="font-size:3rem">${title}</h1>`;
  document.body.appendChild(overlay);
  return overlay;
}

function showWinMessage(amount) {
  // puedes usar tu sistema de notificaciones existente
  console.log(`%c¡GANASTE ${amount} fichas!`, 'color:gold;font-size:2rem');
}

// ====================== INICIALIZACIÓN ======================
async function initSlots() {
  const data = await api('/api/game-info'); // TU ENDPOINT EXISTENTE
  SETTINGS = data;
  // cargar reels en HTML (mantén tu código de creación de reels)
  console.log('🎰 Slots enhanced cargados');
}

window.spin = spin; // para onclick
window.initSlots = initSlots;