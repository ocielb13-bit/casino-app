import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";

// ================= SUPABASE =================

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.error("❌ Faltan variables de entorno de Supabase");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// ================= STATIC =================

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ================= AUTH =================

app.post("/api/login", async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", req.body.username)
      .maybeSingle();

    if (!user) {
      return res.status(400).json({ error: "Usuario no existe" });
    }

    const valid =
      user.password === req.body.password ||
      (await bcrypt.compare(req.body.password, user.password));

    if (!valid) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      username: user.username,
      balance: user.balance,
      role: user.role
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= ADMIN MIDDLEWARE =================

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "No sos admin" });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ================= ADMIN =================

// crear usuario
app.post("/api/admin/create-user", verifyAdmin, async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("app_users").insert({
    username,
    password: hash,
    balance: 0,
    role: "user"
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

// borrar usuario
app.post("/api/admin/delete-user", verifyAdmin, async (req, res) => {
  const { username } = req.body;

  const { error } = await supabase
    .from("app_users")
    .delete()
    .eq("username", username);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

// modificar saldo
app.post("/api/admin/update-balance", verifyAdmin, async (req, res) => {
  const { username, amount } = req.body;

  const { data: user } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .single();

  if (!user) return res.status(400).json({ error: "Usuario no existe" });

  const newBalance = user.balance + amount;

  const { error } = await supabase
    .from("app_users")
    .update({ balance: newBalance })
    .eq("username", username);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true, balance: newBalance });
});

// ================= SETTINGS =================

// obtener config
app.get("/api/settings", async (req, res) => {
  const { data, error } = await supabase
    .from("game_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// actualizar config
app.post("/api/admin/update-settings", verifyAdmin, async (req, res) => {
  const { win_rate, multiplier } = req.body;

  const { error } = await supabase
    .from("game_settings")
    .update({ win_rate, multiplier })
    .eq("id", 1);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

// ================= TEST =================

app.get("/api/test", async (req, res) => {
  const { data, error } = await supabase.from("app_users").select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, users: data });
});

// ================= START =================

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});