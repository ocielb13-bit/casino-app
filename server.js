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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// --- MIDDLEWARE DE AUTENTICACIÓN ---
async function authRequired(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const { data: user, error } = await supabase
            .from("app_users")
            .select("*")
            .eq("id", payload.id)
            .maybeSingle();
        if (error || !user) return res.status(401).json({ error: "Sesión inválida" });
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ error: "Token inválido" });
    }
}

// --- LÓGICA DE LA RULETA (SEGURA) ---
app.post("/api/roulette/spin", authRequired, async (req, res) => {
    const { number, amount } = req.body;
    const bet = Math.floor(Number(amount));
    const selectedNumber = parseInt(number);

    if (bet <= 0 || req.user.balance < bet) return res.status(400).json({ error: "Saldo insuficiente" });

    // El servidor genera el número aleatorio
    const winningNumber = Math.floor(Math.random() * 37);
    const won = selectedNumber === winningNumber;
    const prize = won ? bet * 36 : 0; // Pago estándar 36 a 1

    const newBalance = req.user.balance - bet + prize;

    // Actualizamos en Supabase
    const { error } = await supabase.from("app_users").update({ balance: newBalance }).eq("id", req.user.id);
    if (error) return res.status(500).json({ error: "Error de DB" });

    res.json({ success: true, result: winningNumber, win: prize, balance: newBalance });
});

// --- LÓGICA DE SLOTS (SEGURA) ---
app.post("/api/slots/spin", authRequired, async (req, res) => {
    const bet = Math.floor(Number(req.body.amount));
    if (bet <= 0 || req.user.balance < bet) return res.status(400).json({ error: "Saldo insuficiente" });

    const symbols = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];
    
    // Generar tablero 3x5
    let board = [];
    for(let i=0; i<3; i++) {
        board[i] = Array.from({length: 5}, () => symbols[Math.floor(Math.random() * symbols.length)]);
    }

    // Lógica simple: 3 iguales en la fila del medio
    let win = 0;
    const mid = board[1];
    if (mid[0] === mid[1] && mid[1] === mid[2]) win = bet * 5; 
    if (mid[0] === "wild") win = bet * 2; // Ejemplo de comodín

    const newBalance = req.user.balance - bet + win;
    await supabase.from("app_users").update({ balance: newBalance }).eq("id", req.user.id);

    res.json({ success: true, board, win, balance: newBalance });
});

// --- OTROS ENDPOINTS (LOGIN/ME/ADMIN) ---
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const { data: user } = await supabase.from("app_users").select("*").eq("username", username).maybeSingle();
    if (!user) return res.status(400).json({ error: "Usuario no existe" });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, username: user.username, balance: user.balance, role: user.role });
});

app.get("/api/me", authRequired, (req, res) => {
    res.json({ success: true, ...req.user });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => console.log("🚀 Casino listo en puerto " + PORT));