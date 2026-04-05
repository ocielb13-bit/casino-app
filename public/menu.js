function mostrarMenu(nombre) {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("menuBox").style.display = "block";
  document.getElementById("mensaje").innerText = "Bienvenido, " + nombre + " 🎰";
}

function crearUsuario() {
  const input = document.getElementById("name");
  const nombre = input.value.trim();

  if (!nombre) {
    alert("Poné un nombre");
    return;
  }

  localStorage.setItem("user", nombre);

  if (!localStorage.getItem("saldo")) {
    localStorage.setItem("saldo", "1000");
  }

  mostrarMenu(nombre);
}

window.addEventListener("DOMContentLoaded", () => {
  const userGuardado = localStorage.getItem("user");

  if (userGuardado) {
    const input = document.getElementById("name");
    if (input) input.value = userGuardado;
    mostrarMenu(userGuardado);
  }
});