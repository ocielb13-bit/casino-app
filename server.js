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

const DEFAULT_SETTINGS = {
  slot_pay_3: 2,
  slot_pay_4: 5,
  slot_pay_5: 10,
  roulette_payout: 35,
  free_spin_award: 5
};

const SYMBOLS = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];

async function getAllSettings() {
  return DEFAULT_SETTINGS;
}

async function getUserById(id) {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    balance: Number(data.balance || 0),
    free_spins: Number(data.free_spins || 0),
    free_spin_bank: Number(data.free_spin_bank || 0)
  };
}

async function saveUserState(id, next) {
  await supabase.from("app_users").update(next).eq("id", id);
}

function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function buildBoard() {
  return Array.from({ length: 3 }, () =>
    Array.from(
      { length: 5 },
      () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    )
  );
}

function calculateSlotOutcome(board, bet, settings) {
  let win = 0;

  board.forEach(row => {
    let count = 1;
    for (let i = 1; i < row.length; i++) {
      if (row[i] !== row[0]) break;
      count++;
    }

    if (count >= 3) {
      if (count === 3) win += bet * settings.slot_pay_3;
      if (count === 4) win += bet * settings.slot_pay_4;
      if (count === 5) win += bet * settings.slot_pay_5;
    }
  });

  const scatterCount = board.flat().filter(s => s === "scatter").length;

  return { win, scatterCount };
}

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const { data: user } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (!user) return res.status(400).json({ error: "No existe" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Wrong pass" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET);

  res.json({
    token,
    balance: user.balance,
    free_spins: user.free_spins,
    free_spin_bank: user.free_spin_bank
  });
});

app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const bet = Math.floor(Number(req.body.amount));
    const settings = await getAllSettings();
    const user = await getUserById(req.user.id);

    if (!user) return res.status(401).json({ error: "No user" });

    const usingFree = user.free_spins > 0;

    if (!usingFree && user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const board = buildBoard();
    const outcome = calculateSlotOutcome(board, bet, settings);

    const spend = usingFree ? 0 : bet;
    const balance = Math.max(0, user.balance - spend + outcome.win);

    // 🎰 CONSUMO
    let free_spins = Math.max(0, user.free_spins - (usingFree ? 1 : 0));

    // 🎯 TOTAL
    let totalFree = free_spins;

    // 🎁 PROBABILIDAD REAL + LIMITE
    let awarded = 0;

    if (outcome.scatterCount >= 3 && totalFree === 0) {
      if (Math.random() < 0.20) {
        awarded = Math.min(settings.free_spin_award, 20);
        free_spins = awarded;
      }
    }

    await saveUserState(user.id, {
      balance,
      free_spins,
      free_spin_bank: free_spins
    });

    res.json({
      success: true,
      board,
      win: outcome.win,
      balance,
      freeSpins: free_spins,
      freeSpinsAwarded: awarded,
      scatterCount: outcome.scatterCount
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});