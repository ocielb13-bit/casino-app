async function login() {
  const username = document.getElementById("name").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  console.log(data);

  if (!data.success) {
    alert("Login incorrecto");
    return;
  }

  alert("Login correcto 🎉");
}