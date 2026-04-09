async function api(path, options = {}) {
    const token = localStorage.getItem("token");
    const res = await fetch(path, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
            ...(options.headers || {})
        },
        ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    return data;
}

async function jugar() {
    const num = document.getElementById("numero").value;
    const bet = document.getElementById("apuesta").value;
    const resMsg = document.getElementById("resultado");

    if (!num || !bet) return alert("Completa los campos");

    try {
        resMsg.textContent = "Girando...";
        const data = await api("/api/roulette/spin", {
            method: "POST",
            body: JSON.stringify({ number: num, amount: bet })
        });

        // Animación de la rueda (el número final ya lo sabemos por data.result)
        animateWheel(data.result);

        setTimeout(() => {
            document.getElementById("saldo").textContent = data.balance;
            if (data.win > 0) {
                resMsg.innerHTML = `<h2 style="color:var(--gold)">🎉 ¡Salió el ${data.result}! GANASTE $${data.win}</h2>`;
                if(window.confetti) confetti(); 
            } else {
                resMsg.innerHTML = `Salió el ${data.result}. Perdiste.`;
            }
        }, 1100);

    } catch (err) {
        resMsg.textContent = "❌ " + err.message;
    }
}

// Función de animación (reutiliza la que ya tenías o usa esta)
function animateWheel(final) {
    const wheel = document.getElementById("wheel");
    wheel.classList.add("spinning");
    let count = 0;
    const interval = setInterval(() => {
        wheel.textContent = Math.floor(Math.random() * 37);
        if (++count > 15) {
            clearInterval(interval);
            wheel.classList.remove("spinning");
            wheel.textContent = final;
        }
    }, 70);
}