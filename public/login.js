console.log("LOGIN JS CARGADO");

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorText = document.getElementById("error");

  errorText.innerText = "Cargando...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!data.success) {
      errorText.innerText = data.error || "Error";
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    localStorage.setItem("role", data.role);

    if (data.role === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/casino.html";
    }
  } catch {
    errorText.innerText = "Error de conexión con el servidor";
  }
}