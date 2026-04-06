async function crearUsuario() {
  const username = document.getElementById("newUser").value;
  const password = document.getElementById("newPass").value;
  const balance = parseInt(document.getElementById("newSaldo").value);

  await fetch("/admin/create-user", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password, balance })
  });

  alert("Usuario creado");
}

async function cargarUsuarios() {
  const res = await fetch("/admin/users");
  const data = await res.json();

  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  data.forEach(u => {
    const li = document.createElement("li");
    li.innerText = `${u.username} - 💰 ${u.balance}`;
    lista.appendChild(li);
  });
}