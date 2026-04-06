const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://TU_URL.supabase.co",
  "TU_ANON_KEY"
);
npm install @supabase/supabase-js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let users = {};

// Crear usuario
app.post("/user", (req, res) => {
  const { name } = req.body;
  users[name] = { balance: 1000 };
  res.json(users[name]);
});

// Obtener saldo
app.get("/balance/:name", (req, res) => {
  res.json(users[req.params.name] || {});
});

// Jugar ruleta
app.post("/roulette", (req, res) => {
  const { name, betNumber, amount } = req.body;

  if (!users[name] || users[name].balance < amount) {
    return res.status(400).json({ error: "Fondos insuficientes" });
  }

  const result = Math.floor(Math.random() * 37); // 0-36
  let win = 0;

  if (result === betNumber) {
    win = amount * 35;
  }

  users[name].balance += win - amount;

  res.json({
    result,
    win,
    balance: users[name].balance
  });
});

app.listen(3000, () => console.log("Servidor en http://localhost:3000"));