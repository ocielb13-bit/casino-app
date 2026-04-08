<!-- public/ruleta.js -->
// =====================================================
// RULETA ENHANCED - Apuestas reales + animación canvas
// =====================================================

let selectedChip = 50;
let placedBets = {}; // { 'red': 100, '17': 50, 'dozen1': 75, ... }

const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const COLORS = { 0: '#0a0', 32:'#c00', 15:'#111', /* ... continúa con el orden clásico */ }; // puedes completar

let isSpinning = false;

const canvas = document.getElementById('rouletteCanvas');
const ctx = canvas.getContext('2d');

function drawWheel(rotation = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 220;

  for (let i = 0; i < 37; i++) {
    const angle = (i * (Math.PI * 2 / 37)) + rotation;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.fillStyle = WHEEL_NUMBERS[i] === 0 ? '#0a0' : (i % 2 === 0 ? '#c00' : '#111');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, 0, Math.PI * 2 / 37);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(WHEEL_NUMBERS[i].toString(), radius - 40, 8);
    ctx.restore();
  }
  // Bola
  const ballAngle = rotation + Math.PI * 1.7;
  const ballX = centerX + Math.cos(ballAngle) * (radius - 30);
  const ballY = centerY + Math.sin(ballAngle) * (radius - 30);
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
  ctx.fill();
}

// ====================== APUESTAS MEJORADAS ======================
function placeBet(type, amount) {
  if (!placedBets[type]) placedBets[type] = 0;
  placedBets[type] += amount;
  renderBetTable();
}

function renderBetTable() {
  // Actualiza visualmente las fichas colocadas (usa tu estilo existente)
  console.log('Apuestas actuales:', placedBets);
}

// ====================== SPIN REALISTA ======================
async function spinRoulette() {
  if (isSpinning) return;
  isSpinning = true;

  // === TU CÓDIGO EXISTENTE DE DEDUCCIÓN DE FICHAS ===
  // NO BORRAR

  const totalBet = Object.values(placedBets).reduce((a, b) => a + b, 0);

  let rotation = 0;
  const targetNumber = WHEEL_NUMBERS[Math.floor(Math.random() * 37)];
  const extraSpins = 8 + Math.random() * 6;
  const targetAngle = extraSpins * Math.PI * 2 + (targetNumber * (Math.PI * 2 / 37)) * -1;

  const startTime = Date.now();
  const duration = 7500; // 7.5 segundos de emoción

  while (Date.now() - startTime < duration) {
    const progress = (Date.now() - startTime) / duration;
    const eased = 1 - Math.pow(1 - progress, 4); // desaceleración realista
    rotation = targetAngle * eased;
    drawWheel(rotation);
    await new Promise(r => setTimeout(r, 16));
  }

  // Resultado final
  drawWheel(targetAngle);
  const winnings = calculateRoulettePayout(targetNumber, placedBets);

  // === TU CÓDIGO EXISTENTE DE ACTUALIZAR BALANCE EN SUPABASE ===
  if (winnings > 0) {
    // mostrar ganancia
  }

  placedBets = {}; // reset bets
  renderBetTable();
  isSpinning = false;
}

// ====================== CÁLCULO DE PAGOS (mantén tu lógica si ya existe) ======================
function calculateRoulettePayout(winningNumber, bets) {
  let payout = 0;
  // red / black / odd / even → 1:1
  // dozen / column → 2:1
  // single number → 35:1
  // ... (implementación completa según reglas estándar)
  return payout;
}

// ====================== INICIALIZACIÓN ======================
function initRoulette() {
  drawWheel();
  // Agrega listeners a los botones de fichas y mesa
  console.log('🎲 Ruleta enhanced cargada');
}

window.spinRoulette = spinRoulette;
window.placeBet = placeBet;
window.initRoulette = initRoulette;