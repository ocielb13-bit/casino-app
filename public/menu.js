function crearUsuario() {
  let nombre = document.getElementById("name").value;

  if (!nombre) {
    alert("Poné un nombre");
    return;
  }

  localStorage.setItem("user", nombre);
  localStorage.setItem("saldo", 1000);

  document.getElementById("login").style.display = "none";
  document.getElementById("juegos").style.display = "block";
}

  // guardar usuario
  localStorage.setItem("user", nombre);

  // si no hay saldo, crear uno
  if (!localStorage.getItem("saldo")) {
    localStorage.setItem("saldo", 1000);
  }

  document.getElementById("mensaje").innerText =
    "Bienvenido " + nombre + " 🎰";

  // redirigir automáticamente (opcional)
  setTimeout(() => {
    window.location.href = "/index.html";
  }, 1000);
}