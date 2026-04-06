async function login() {
  const username = document.getElementById("name").value;
  const password = document.getElementById("pass").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.success) {
    localStorage.setItem("user", username);

    if (data.role === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/menu.html";
    }
  } else {
    document.getElementById("msg").innerText = "❌ Datos incorrectos";
  }
}