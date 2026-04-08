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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

async function checkSession() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const me = await api("/api/me");
    window.location.href = me.role === "admin" ? "/admin.html" : "/menu.html";
  } catch {
    localStorage.removeItem("token");
  }
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  if (!username || !password) {
    error.textContent = "Poné usuario y contraseña.";
    return;
  }

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    localStorage.setItem("token", data.token);
    window.location.href = data.role === "admin" ? "/admin.html" : "/menu.html";
  } catch (err) {
    error.textContent = "❌ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", checkSession);