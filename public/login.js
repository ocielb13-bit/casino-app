console.log("LOGIN JS CARGADO");

let loggingIn = false;

async function login() {
  if (loggingIn) return;

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorText = document.getElementById("error");

  if (!username || !password) {
    errorText.textContent = "Poné usuario y contraseña";
    return;
  }

  errorText.textContent = "Cargando...";
  loggingIn = true;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      errorText.textContent = data.error || "Error";
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    localStorage.setItem("role", data.role);

    if (data.role === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/menu.html";
    }
  } catch {
    errorText.textContent = "Error de conexión con el servidor";
  } finally {
    loggingIn = false;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});