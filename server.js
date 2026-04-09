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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Middleware de seguridad
async function authRequired(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No hay token" });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const { data: user } = await supabase.from("app_users").select("*").eq("id", payload.id).maybeSingle();
        if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
        req.user = user;
        next();
    } catch (e) { return res.status(401).json({ error: "Sesión expirada" }); }
}

// --- JUGAR RULETA ---
app.post("/api/roulette/spin", authRequired, async (req, res) => {
    const { number, amount } = req.body;
    const bet = Math.floor(Number(amount));
    const pick = parseInt(number);

    if (bet <= 0 || req.user.balance < bet) return res.status(400).json({ error: "Saldo insuficiente o apuesta inválida" });

    const result = Math.floor(Math.random() * 37);
    const win = (pick === result) ? bet * 36 : 0;
    const newBalance = req.user.balance - bet + win;

    await supabase.from("app_users").update({ balance: newBalance }).eq("id", req.user.id);
    res.json({ success: true, result, win, balance: newBalance });
});

// --- JUGAR SLOTS ---
app.post("/api/slots/spin", authRequired, async (req, res) => {
    const bet = Math.floor(Number(req.body.amount));
    if (bet <= 0 || req.user.balance < bet) return res.status(400).json({ error: "Saldo insuficiente" });

    const symbols = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];
    let board = [];
    for(let i=0; i<3; i++) {
        board[i] = Array.from({length: 5}, () => symbols[Math.floor(Math.random() * symbols.length)]);
    }

    // Lógica de premio: 3 iguales en fila central (simplificado)
    let win = 0;
    const mid = board[1];
    if (mid[0] === mid[1] && mid[1] === mid[2]) win = bet * 5;
    
    const newBalance = req.user.balance - bet + win;
    await supabase.from("app_users").update({ balance: newBalance }).eq("id", req.user.id);

    res.json({ success: true, board, win, balance: newBalance });
});

// Endpoints básicos
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const { data: user } = await supabase.from("app_users").select("*").eq("username", username.trim()).maybeSingle();
    if (!user) return res.status(400).json({ error: "Usuario no existe" });
    const valid = await bcrypt.compare(password.trim(), user.password);
    if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ success: true, token, username: user.username, balance: user.balance, role: user.role });
});

app.get("/api/me", authRequired, (req, res) => res.json({ success: true, ...req.user }));

app.get("*", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.listen(PORT, () => console.log("🔥 Servidor en puerto " + PORT));