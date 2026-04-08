async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("error").innerText = data.error;
      return;
    }

    // 🔥 guardamos token
    localStorage.setItem("token", data.token);

    // 👉 redirige al menú
    window.location.href = "/menu.html";

  } catch (err) {
    document.getElementById("error").innerText = "Error de conexión";
  }
}