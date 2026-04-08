const username = localStorage.getItem("username");

if (!username) {
  window.location.href = "/";
}

document.getElementById("welcome").innerText = "Bienvenido " + username;

// (Opcional después lo conectamos al saldo real)

function logout() {
  localStorage.clear();
  window.location.href = "/";
}