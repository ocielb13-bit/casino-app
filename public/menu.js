function login() {
  const username = document.getElementById("name").value;
  const password = document.getElementById("pass").value;

  fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      localStorage.setItem("user", data.username);
      localStorage.setItem("saldo", data.balance);

      window.location.href = "/menu.html";
    } else {
      alert("Usuario o contraseña incorrectos");
    }
  });
}