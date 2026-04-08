const token = localStorage.getItem("token");

if (!token) window.location.href = "/";

document.getElementById("user").innerText =
  localStorage.getItem("username");

function logout() {
  localStorage.clear();
  window.location.href = "/";
}

async function crearUsuario() {
  const username = newUser.value;
  const password = newPass.value;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.success) alert("Usuario creado");
  else alert(data.error);
}