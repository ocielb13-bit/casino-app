// Configuración de símbolos con pesos (probabilidades)
const SYMBOLS = [
    { name: "dragon",   value: 50,  weight: 5 },  // Más raro
    { name: "goldpot",  value: 20,  weight: 10 },
    { name: "jade",     value: 10,  weight: 15 },
    { name: "lantern",  value: 5,   weight: 20 },
    { name: "coin",     value: 2,   weight: 30 },
    { name: "wild",     value: 0,   weight: 8 },  // Comodín
    { name: "scatter",  value: 0,   weight: 5 }   // Bonus
];

let isSpinning = false;

// 1. UTILIDAD: Obtener símbolo aleatorio basado en pesos
function getRandomSymbol() {
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const s of SYMBOLS) {
        if (random < s.weight) return s;
        random -= s.weight;
    }
    return SYMBOLS[0];
}

// 2. CREACIÓN DE CARRETES (Genera la tira visual)
function createReelStrip(reelElement, finalSymbol) {
    reelElement.innerHTML = ''; // Limpiar
    const strip = document.createElement('div');
    strip.className = 'reel-strip';
    
    // Añadimos 30 símbolos aleatorios para el efecto de giro
    for (let i = 0; i < 30; i++) {
        const symbol = i === 0 ? finalSymbol : getRandomSymbol();
        const img = document.createElement('img');
        img.src = `/assets/symbols/asian/${symbol.name}.png`;
        img.onerror = () => img.src = 'https://via.placeholder.com/80?text=S'; // Fallback
        strip.appendChild(img);
    }
    
    reelElement.appendChild(strip);
    return strip;
}

// 3. FUNCIÓN PRINCIPAL DE GIRO
async function spin() {
    if (isSpinning) return;
    
    // Obtener apuesta y validar balance (Integrar con tu API)
    const betInput = document.getElementById('apuesta');
    const amount = parseInt(betInput.value) || 200;
    
    // Aquí llamarías a tu servidor: const res = await api("/api/slots/spin", ...)
    // Por ahora simularemos la respuesta para el ejemplo visual:
    startSpinVisual(amount);
}

async function startSpinVisual(amount) {
    isSpinning = true;
    const reels = document.querySelectorAll('.reel'); // Selecciona los 5 reels del HTML
    const winMessage = document.getElementById('resultado');
    
    winMessage.innerText = "¡Mucha suerte!";
    
    // Generar resultados finales (Esto debería venir del servidor en el futuro)
    const results = Array.from({ length: 5 }, () => getRandomSymbol());

    // Iniciar animación de cada reel con un pequeño delay (efecto cascada)
    const animationPromises = Array.from(reels).map((reel, i) => {
        const strip = createReelStrip(reel, results[i]);
        
        return new Promise(resolve => {
            setTimeout(() => {
                reel.classList.add('spinning');
                // La magia está en el CSS (translateY)
                strip.style.transition = `transform ${2 + i * 0.5}s cubic-bezier(0.45, 0.05, 0.55, 0.95)`;
                strip.style.transform = `translateY(-${(30 - 3) * 100}px)`; 
                
                setTimeout(resolve, 2000 + i * 500);
            }, i * 100);
        });
    });

    await Promise.all(animationPromises);
    
    // Finalizar
    isSpinning = false;
    reels.forEach(r => r.classList.remove('spinning'));
    checkWin(results, amount);
}

function checkWin(results, bet) {
    // Lógica de premios mejorada (ejemplo de 3 iguales)
    const names = results.map(r => r.name);
    const unique = [...new Set(names.filter(n => n !== 'wild'))];
    
    if (unique.length === 1 || (unique.length === 2 && names.includes('wild'))) {
        const prize = bet * 10;
        document.getElementById('resultado').innerHTML = `<span class="win-anim">🔥 ¡GANASTE ${prize}! 🔥</span>`;
        // Actualizar balance en UI
    } else {
        document.getElementById('resultado').innerText = "Sigue intentando...";
    }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Llenar los carretes inicialmente
    document.querySelectorAll('.reel').forEach(reel => {
        createReelStrip(reel, getRandomSymbol());
    });
});