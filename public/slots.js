async function api(path, options = {}) {
    const token = localStorage.getItem("token");
    const res = await fetch(path, {
        method: options.method || 'GET',
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: options.body
    });
    return res.json();
}

async function jugar() {
    const betInput = document.getElementById("apuesta");
    const btn = document.getElementById("spinBtn");
    const resMsg = document.getElementById("resultado");
    const bet = betInput.value;

    if (!bet || bet <= 0) return alert("Apuesta válida requerida");

    try {
        btn.disabled = true;
        resMsg.textContent = "Girando...";

        const data = await api("/api/slots/spin", {
            method: "POST",
            body: JSON.stringify({ amount: bet })
        });

        if (data.error) throw new Error(data.error);

        // --- ANIMACIÓN ---
        // Aquí simulamos que giran cambiando imágenes aleatorias
        const reels = document.querySelectorAll(".reel img");
        let spins = 0;
        const interval = setInterval(() => {
            reels.forEach(img => {
                const randomSym = ["dragon", "coin", "jade", "lantern"][Math.floor(Math.random()*4)];
                img.src = `/assets/symbols/asian/${randomSym}.png`;
            });
            if (++spins > 10) {
                clearInterval(interval);
                renderFinalBoard(data.board);
                document.getElementById("saldo").textContent = data.balance;
                resMsg.textContent = data.win > 0 ? `¡GANASTE $${data.win}!` : "Sin premio";
                btn.disabled = false;
            }
        }, 100);

    } catch (err) {
        alert(err.message);
        btn.disabled = false;
    }
}

function renderFinalBoard(board) {
    board.forEach((row, rIdx) => {
        row.forEach((symbol, cIdx) => {
            const img = document.getElementById(`img-c${rIdx + 1}_${cIdx}`);
            if (img) img.src = `/assets/symbols/asian/${symbol}.png`;
        });
    });
}

// Cargar saldo al entrar
document.addEventListener("DOMContentLoaded", async () => {
    const me = await api("/api/me");
    if(me.balance !== undefined) document.getElementById("saldo").textContent = me.balance;
});