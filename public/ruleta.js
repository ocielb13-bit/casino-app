async function api(path, options = {}) {
    const token = localStorage.getItem("token");
    const res = await fetch(path, {
        method: options.method || 'GET',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: options.body
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    return data;
}

async function loadMe() {
    try {
        const me = await api("/api/me");
        document.getElementById("saldo").textContent = me.balance;
        document.getElementById("playerLine").textContent = `Usuario: ${me.username}`;
    } catch { window.location.href = "/"; }
}

async function jugar() {
    const num = document.getElementById("numero").value;
    const bet = document.getElementById("apuesta").value;
    const resMsg = document.getElementById("resultado");
    const wheel = document.getElementById("wheel");

    if (!num || !bet) return alert("Ingresa número y apuesta");

    try {
        resMsg.textContent = "Girando...";
        wheel.classList.add("spinning"); // Activa la animación CSS

        const data = await api("/api/roulette/spin", {
            method: "POST",
            body: JSON.stringify({ number: num, amount: bet })
        });

        // Animación visual de números aleatorios antes del final
        let i = 0;
        const timer = setInterval(() => {
            wheel.textContent = Math.floor(Math.random() * 37);
            if (++i > 15) {
                clearInterval(timer);
                wheel.classList.remove("spinning");
                wheel.textContent = data.result; // Número real del servidor
                document.getElementById("saldo").textContent = data.balance;
                
                if (data.win > 0) {
                    resMsg.innerHTML = `<b style="color:gold">🎉 ¡GANASTE $${data.win}!</b>`;
                } else {
                    resMsg.textContent = "Salió el " + data.result + ". Suerte la próxima.";
                }
            }
        }, 70);

    } catch (err) {
        alert(err.message);
        wheel.classList.remove("spinning");
    }
}

document.addEventListener("DOMContentLoaded", loadMe);