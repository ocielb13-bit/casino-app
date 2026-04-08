const token = localStorage.getItem("token");

if (!token) window.location.href = "/";

document.body.innerHTML = `
<h1>Casino 🎰</h1>
<p>Jugador: ${localStorage.getItem("username")}</p>
<button onclick="logout()">Salir</button>
`;

function logout() {
  localStorage.clear();
  window.location.href = "/";
}