const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  "https://zggvrzgumtbilqvoggco.supabase.co",
  "TU-ANON-KEY"
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/login", async (req, res) => {
  const username = req.body.username.trim();
  const password = req.body.password.trim();

  console.log("LOGIN:", username, password);

  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username);

  console.log("DATA:", data, "ERROR:", error);

  if (!data || data.length === 0) {
    return res.json({ success: false });
  }

  const user = data[0];

  if (user.password !== password) {
    return res.json({ success: false });
  }

  res.json({
    success: true,
    username: user.username,
    balance: user.balance
  });
});

app.listen(PORT, () => {
  console.log("Servidor corriendo");
});