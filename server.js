import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const supabase = createClient(
  "https://zggvrzgumtbilqvoggco.supabase.co",
  "sb_publishable_5Juv5ZwoL7tfkGLpOkKGaw_a9jMUDAC"
);

// 🔐 LOGIN
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
    role: data.role,
    balance: data.balance
  });
});

// 👑 CREAR USUARIO
app.post("/admin/create-user", async (req, res) => {
  const { username, password, balance } = req.body;

  const { error } = await supabase.from("app_users").insert([
    {
      username,
      password,
      balance,
      role: "user"
    }
  ]);

  if (error) return res.json({ success: false });

  res.json({ success: true });
});

// 📋 LISTAR USUARIOS
app.get("/admin/users", async (req, res) => {
  const { data } = await supabase.from("app_users").select("*");
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo"));