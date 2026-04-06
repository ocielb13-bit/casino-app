async function login() {
  console.log("CLICK");

  const username = document.getElementById("name").value;
  const password = document.getElementById("pass").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.success) {
    localStorage.setItem("user", username);

    if (data.role === "admin") {
      window.location.href = "/admin.html";
    } else {
      alert("Login OK (usuario normal)");
    }

  } else {
    document.getElementById("msg").innerText = "❌ Datos incorrectos";
  }
}