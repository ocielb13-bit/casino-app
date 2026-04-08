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

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.error("❌ Faltan variables de entorno de Supabase");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ================= AUTH =================

// 🔐 Middleware
function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

// 🔑 LOGIN
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

    // 🔥 MIXTO (temporal)
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
      role: user.role // 🔥 CLAVE
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 👤 CREAR USUARIO (ADMIN)
app.post("/api/register", authRequired, adminOnly, async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("app_users").insert({
      username,
      password: hashed,
      role: "player",
      balance: 1000
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🧪 TEST
app.get("/api/test", async (req, res) => {
  const { data, error } = await supabase.from("app_users").select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, users: data });
});

// ================= START =================

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});