async function login() {
  const username = document.getElementById("name").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: username,
      password: password
    })
  });

  const data = await res.json();

  if (!data.success) {
    alert("Usuario o contraseña incorrectos");
    return;
  }

  // guardar sesión
  localStorage.setItem("user", JSON.stringify(data));

  // redirigir
  window.location.href = "/menu.html";
}