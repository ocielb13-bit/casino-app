function crearUsuario() {
  const input = document.getElementById("name");
  const nombre = input.value.trim();

  if (!nombre) {
    alert("Poné un nombre");
    return;
  }

  localStorage.setItem("user", nombre);

  // SOLO crea saldo si no existe
  if (!localStorage.getItem("saldo")) {
    localStorage.setItem("saldo", "1000");
  }

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("menuBox").style.display = "block";

  document.getElementById("mensaje").innerText =
    "Bienvenido " + nombre + " 🎰";
}