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

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !data) {
    return res.json({ success: false });
  }

  res.json({
    success: true,
    username: data.username,
    balance: data.balance,
    role: data.role
  });
});
// Obtener saldo
app.get("/balance/:name", (req, res) => {
  res.json(users[req.params.name] || {});
});


app.post("/update-balance", async (req, res) => {
  const { username, balance } = req.body;

  const { error } = await supabase
    .from("app_users")
    .update({ balance: balance })
    .eq("username", username);

  if (error) {
    return res.json({ success: false });
  }

  res.json({ success: true });
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