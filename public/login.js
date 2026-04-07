// login.js - valida sesión, hace login y redirige

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || "Error");
  }

  return data;
}

async function checkSession() {
  try {
    const me = await api("/api/me");
    window.location.href = me.role === "admin" ? "/admin.html" : "/menu.html";
  } catch {
    // no hay sesión, se queda en login
  }
}

async function login() {
  const username = document.getElementById("name").value.trim();
  const password = document.getElementById("pass").value.trim();
  const msg = document.getElementById("msg");

  if (!username || !password) {
    msg.textContent = "Poné usuario y contraseña.";
    return;
  }

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    window.location.href = data.role === "admin" ? "/admin.html" : "/menu.html";
  } catch (err) {
    msg.textContent = "❌ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", checkSession);