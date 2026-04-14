console.log("LOGIN JS CARGADO");

let loggingIn = false;

function setLoginError(message) {
  const errorText = document.getElementById("error");
  if (errorText) errorText.textContent = message;
}

async function login() {
  if (loggingIn) return;

  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  const errorText = document.getElementById("error");

  const username = usernameEl ? usernameEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value.trim() : "";

  if (!username || !password) {
    setLoginError("Poné usuario y contraseña");
    return;
  }

  if (errorText) errorText.textContent = "Cargando...";
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
      setLoginError(data.error || "Error");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username || "");
    localStorage.setItem("role", data.role || "");

    if (data.role === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/menu.html";
    }
  } catch {
    setLoginError("Error de conexión con el servidor");
  } finally {
    loggingIn = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const passwordEl = document.getElementById("password");

  passwordEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement?.id !== "password") {
      login();
    }
  });
});