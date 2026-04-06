const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 PEGÁ TUS DATOS DE SUPABASE
const supabase = createClient(
  "https://TU-PROYECTO.supabase.co",
  "TU-ANON-KEY"
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// LOGIN
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


// RULETA
app.post("/roulette", async (req, res) => {
  const { username, betNumber, amount } = req.body;

  const { data: user } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .single();

  if (!user) return res.json({ error: "Usuario no existe" });

  let balance = user.balance - amount;

  const result = Math.floor(Math.random() * 37);

  let win = 0;
  if (result === betNumber) {
    win = amount * 36;
    balance += win;
  }

  await supabase
    .from("app_users")
    .update({ balance })
    .eq("username", username);

  res.json({ result, win, balance });
});


// SLOTS
app.post("/slots", async (req, res) => {
  const { username, amount } = req.body;

  const { data: user } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .single();

  if (!user) return res.json({ error: "Usuario no existe" });

  let balance = user.balance - amount;

  const symbols = ["🍒", "🍋", "🍉", "⭐", "💎"];
  const r1 = symbols[Math.floor(Math.random() * symbols.length)];
  const r2 = symbols[Math.floor(Math.random() * symbols.length)];
  const r3 = symbols[Math.floor(Math.random() * symbols.length)];

  let win = 0;
  if (r1 === r2 && r2 === r3) {
    win = amount * 5;
    balance += win;
  }

  await supabase
    .from("app_users")
    .update({ balance })
    .eq("username", username);

  res.json({ r1, r2, r3, win, balance });
});


// SERVER
app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});