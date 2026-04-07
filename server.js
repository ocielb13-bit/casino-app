// server.js - login, sesiones, admin, saldo, ruleta y slots PRO

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Base Supabase (puede quedar hardcodeada para no pelear con variables)
const supabase = createClient(
  "https://zggvrzgumtbilqvoggco.supabase.co",
  "sb_publishable_5Juv5ZwoL7tfkGLpOkKGaw_a9jMUDAC"
);

const JWT_SECRET = process.env.JWT_SECRET || "casino-demo-secret-2026";
const publicDir = path.join(__dirname, "public");

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

app.use(express.json());
app.use(cookieParser());

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function sendFile(name) {
  return (req, res) => res.sendFile(path.join(publicDir, name));
}

async function readSetting(key, fallback) {
  const { data, error } = await supabase
    .from("casino_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return fallback;
  const num = Number(data.value);
  return Number.isFinite(num) ? num : data.value;
}

async function writeSetting(key, value) {
  await supabase
    .from("casino_settings")
    .upsert([{ key, value: String(value) }], { onConflict: "key" });
}

function signToken(user) {
  return jwt.sign(
    {
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function loadPublicUser(username) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, free_spins, free_spin_bank, created_at")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function authRequired(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadPublicUser(payload.username);

    if (!user) {
      return res.status(401).json({ error: "Usuario no válido" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida" });
  }
}

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

// Páginas protegidas
app.get("/", sendFile("index.html"));
app.get("/menu.html", authRequired, sendFile("menu.html"));
app.get("/slots.html", authRequired, sendFile("slots.html"));
app.get("/ruleta.html", authRequired, sendFile("ruleta.html"));
app.get("/admin.html", authRequired, adminRequired, sendFile("admin.html"));

// Archivos estáticos
app.use(express.static(publicDir));

// LOGIN
app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Faltan datos" });
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, password, role, balance, free_spins, free_spin_bank")
    .eq("username", username)
    .maybeSingle();

  if (error || !data || data.password !== password) {
    return res.status(401).json({ success: false, error: "Datos incorrectos" });
  }

  const token = signToken(data);

  res.cookie("token", token, cookieOptions);
  res.json({
    success: true,
    username: data.username,
    role: data.role,
    balance: data.balance
  });
});

// LOGOUT
app.post("/api/logout", (req, res) => {
  res.clearCookie("token", { ...cookieOptions, maxAge: 0 });
  res.json({ success: true });
});

// QUIÉN SOY
app.get("/api/me", authRequired, (req, res) => {
  res.json({
    success: true,
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    balance: req.user.balance,
    free_spins: req.user.free_spins || 0,
    free_spin_bank: req.user.free_spin_bank || 0
  });
});

// ADMIN: LISTAR USUARIOS
app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, free_spins, free_spin_bank, created_at")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, users: data || [] });
});

// ADMIN: CREAR USUARIO
app.post("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Faltan datos" });
  }

  const existing = await supabase
    .from("app_users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing.data) {
    return res.status(409).json({ success: false, error: "Ese usuario ya existe" });
  }

  const defaultBalance = Number(await readSetting("default_balance", 1000));
  const balanceInput = Number(req.body.balance);
  const balance = Number.isFinite(balanceInput)
    ? Math.max(0, Math.floor(balanceInput))
    : defaultBalance;

  const { error } = await supabase.from("app_users").insert([
    {
      username,
      password,
      role: "user",
      balance,
      free_spins: 0,
      free_spin_bank: 0
    }
  ]);

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

// ADMIN: SUMAR / RESTAR SALDO
app.patch("/api/admin/users/:id/balance", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const delta = Number(req.body.delta);

  if (!Number.isFinite(id) || !Number.isFinite(delta)) {
    return res.status(400).json({ success: false, error: "Datos inválidos" });
  }

  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id, balance")
    .eq("id", id)
    .maybeSingle();

  if (userError || !user) {
    return res.status(404).json({ success: false, error: "Usuario no encontrado" });
  }

  const newBalance = Math.max(0, Math.floor(Number(user.balance) + delta));

  const { error } = await supabase
    .from("app_users")
    .update({ balance: newBalance })
    .eq("id", id);

  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true, balance: newBalance });
});

// ADMIN: SETEAR SALDO EXACTO
app.put("/api/admin/users/:id/balance", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const balance = Number(req.body.balance);

  if (!Number.isFinite(id) || !Number.isFinite(balance)) {
    return res.status(400).json({ success: false, error: "Datos inválidos" });
  }

  const newBalance = Math.max(0, Math.floor(balance));

  const { error } = await supabase
    .from("app_users")
    .update({ balance: newBalance })
    .eq("id", id);

  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true, balance: newBalance });
});

// ADMIN: BORRAR USUARIO
app.delete("/api/admin/users/:id", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);

  const { data: target, error } = await supabase
    .from("app_users")
    .select("id, username, role")
    .eq("id", id)
    .maybeSingle();

  if (error || !target) {
    return res.status(404).json({ success: false, error: "Usuario no encontrado" });
  }

  if (target.role === "admin") {
    return res.status(400).json({ success: false, error: "No podés borrar el admin" });
  }

  const { error: deleteError } = await supabase
    .from("app_users")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return res.status(500).json({ success: false, error: deleteError.message });
  }

  res.json({ success: true });
});

// ADMIN: SETTINGS (RTP, BALANCE INICIAL, JACKPOT)
app.get("/api/admin/settings", authRequired, adminRequired, async (req, res) => {
  const slot_rtp = Number(await readSetting("slot_rtp", 96));
  const default_balance = Number(await readSetting("default_balance", 1000));
  const jackpot_bank = Number(await readSetting("jackpot_bank", 1000));

  res.json({
    success: true,
    slot_rtp,
    default_balance,
    jackpot_bank
  });
});

app.put("/api/admin/settings", authRequired, adminRequired, async (req, res) => {
  const slot_rtp = Number(req.body.slot_rtp);
  const default_balance = Number(req.body.default_balance);
  const jackpot_bank = Number(req.body.jackpot_bank);

  if (Number.isFinite(slot_rtp)) await writeSetting("slot_rtp", clamp(slot_rtp, 70, 99.9));
  if (Number.isFinite(default_balance)) await writeSetting("default_balance", Math.max(0, Math.floor(default_balance)));
  if (Number.isFinite(jackpot_bank)) await writeSetting("jackpot_bank", Math.max(1000, Math.floor(jackpot_bank)));

  res.json({ success: true });
});

// RULETA
app.post("/api/roulette/spin", authRequired, async (req, res) => {
  const number = Number(req.body.number);
  const amount = Number(req.body.amount);

  if (!Number.isInteger(number) || number < 0 || number > 36) {
    return res.status(400).json({ success: false, error: "Número inválido" });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: "Apuesta inválida" });
  }

  let balance = Number(req.user.balance);
  if (balance < amount) {
    return res.status(400).json({ success: false, error: "Saldo insuficiente" });
  }

  balance -= amount;

  const result = Math.floor(Math.random() * 37);
  let win = 0;

  if (result === number) {
    win = amount * 36;
    balance += win;
  }

  const { error } = await supabase
    .from("app_users")
    .update({ balance })
    .eq("id", req.user.id);

  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({
    success: true,
    result,
    win,
    balance
  });
});

// THEMES DE SLOTS
const THEMES = {
  asian: [
    { id: "dragon", kind: "regular", weight: 18 },
    { id: "coin", kind: "regular", weight: 18 },
    { id: "jade", kind: "regular", weight: 16 },
    { id: "scroll", kind: "regular", weight: 14 },
    { id: "monk", kind: "regular", weight: 12 },
    { id: "wild", kind: "wild", weight: 6 },
    { id: "scatter", kind: "scatter", weight: 2 },
    { id: "seven", kind: "jackpot", weight: 4 }
  ],
  classic: [
    { id: "cherry", kind: "regular", weight: 20 },
    { id: "lemon", kind: "regular", weight: 20 },
    { id: "plum", kind: "regular", weight: 16 },
    { id: "bell", kind: "regular", weight: 14 },
    { id: "bar", kind: "regular", weight: 12 },
    { id: "wild", kind: "wild", weight: 6 },
    { id: "scatter", kind: "scatter", weight: 2 },
    { id: "seven", kind: "jackpot", weight: 4 }
  ],
  fruits: [
    { id: "cherry", kind: "regular", weight: 20 },
    { id: "lemon", kind: "regular", weight: 18 },
    { id: "melon", kind: "regular", weight: 16 },
    { id: "grape", kind: "regular", weight: 14 },
    { id: "orange", kind: "regular", weight: 14 },
    { id: "wild", kind: "wild", weight: 6 },
    { id: "scatter", kind: "scatter", weight: 2 },
    { id: "seven", kind: "jackpot", weight: 4 }
  ]
};

function getThemeDefs(themeName) {
  return THEMES[themeName] || THEMES.asian;
}

function getThemeMap(themeName) {
  const defs = getThemeDefs(themeName);
  return Object.fromEntries(defs.map((d) => [d.id, d]));
}

function weightFor(def, rtp) {
  const factor = clamp(rtp / 96, 0.7, 1.3);

  if (def.kind === "regular") {
    return Math.max(3, Math.round(def.weight * (1.18 - (factor - 1) * 0.6)));
  }

  if (def.kind === "wild") {
    return Math.max(1, Math.round(def.weight * (0.85 + (factor - 1) * 1.1)));
  }

  if (def.kind === "scatter") {
    return Math.max(1, Math.round(def.weight * (0.65 + (factor - 1) * 0.7)));
  }

  // jackpot / seven
  return Math.max(1, Math.round(def.weight * (0.75 + (factor - 1) * 0.5)));
}

function buildPool(themeName, rtp) {
  const defs = getThemeDefs(themeName);
  const pool = [];

  for (const def of defs) {
    const weight = weightFor(def, rtp);
    for (let i = 0; i < weight; i++) pool.push(def.id);
  }

  return pool;
}

function pickFromPool(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateBoard(themeName, rtp) {
  const pool = buildPool(themeName, rtp);

  const pick = () => pickFromPool(pool);

  return {
    top: [pick(), pick(), pick()],
    row1: [pick(), pick(), pick(), pick(), pick()],
    row2: [pick(), pick(), pick(), pick(), pick()],
    bottom: [pick(), pick(), pick()]
  };
}

function isWild(themeMap, id) {
  return themeMap[id]?.kind === "wild";
}

function isRegular(themeMap, id) {
  return themeMap[id]?.kind === "regular";
}

function sameLineMatch(lineIds, themeMap) {
  const nonWild = lineIds.filter((id) => !isWild(themeMap, id));
  if (nonWild.length === 0) return null;

  const ref = nonWild[0];
  if (!isRegular(themeMap, ref)) return null;

  const ok = lineIds.every((id) => isWild(themeMap, id) || id === ref);
  return ok ? ref : null;
}

function pairMatch(a, b, themeMap) {
  const kindA = themeMap[a]?.kind;
  const kindB = themeMap[b]?.kind;

  if (!kindA || !kindB) return false;
  if (kindA === "scatter" || kindB === "scatter") return false;
  if (kindA === "jackpot" || kindB === "jackpot") return false;

  if (a === b && isRegular(themeMap, a)) return true;
  if (isWild(themeMap, a) && isRegular(themeMap, b)) return true;
  if (isWild(themeMap, b) && isRegular(themeMap, a)) return true;
  if (isWild(themeMap, a) && isWild(themeMap, b)) return true;

  return false;
}

function payoutTier(amount, bet) {
  if (amount >= bet * 30) return "win-jackpot";
  if (amount >= bet * 12) return "win-high";
  if (amount >= bet * 5) return "win-mid";
  return "win-low";
}

// SLOTS: motor principal
app.post("/api/slots/spin", authRequired, async (req, res) => {
  const amount = Number(req.body.amount);
  const theme = ["asian", "classic", "fruits"].includes(req.body.theme)
    ? req.body.theme
    : "asian";

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: "Apuesta inválida" });
  }

  const rtp = clamp(Number(await readSetting("slot_rtp", 96)), 70, 99.9);
  let jackpotBank = Number(await readSetting("jackpot_bank", 1000));

  let balance = Number(req.user.balance);
  let freeSpins = Number(req.user.free_spins || 0);
  let freeSpinBank = Number(req.user.free_spin_bank || 0);

  const inFreeSpin = freeSpins > 0;

  if (!inFreeSpin) {
    if (balance < amount) {
      return res.status(400).json({ success: false, error: "Saldo insuficiente" });
    }
    balance -= amount;
  } else {
    freeSpins -= 1;
  }

  const board = generateBoard(theme, rtp);
  const themeMap = getThemeMap(theme);
  const paylines = [];
  const payoutScale = rtp / 96;

  // Línea superior
  const topMatch = sameLineMatch(board.top, themeMap);
  if (topMatch) {
    const win = Math.round(amount * 10 * payoutScale);
    paylines.push({
      label: "Fila superior",
      ids: ["tr1", "tr2", "tr3"],
      amount: win,
      tier: payoutTier(win, amount)
    });
  }

  // Fila central 1
  const row1Match = sameLineMatch(board.row1, themeMap);
  if (row1Match) {
    const win = Math.round(amount * 6 * payoutScale);
    paylines.push({
      label: "Fila central A",
      ids: ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
      amount: win,
      tier: payoutTier(win, amount)
    });
  }

  // Fila central 2
  const row2Match = sameLineMatch(board.row2, themeMap);
  if (row2Match) {
    const win = Math.round(amount * 6 * payoutScale);
    paylines.push({
      label: "Fila central B",
      ids: ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
      amount: win,
      tier: payoutTier(win, amount)
    });
  }

  // Parejas por posición entre filas centrales
  for (let i = 0; i < 5; i++) {
    if (pairMatch(board.row1[i], board.row2[i], themeMap)) {
      const win = Math.round(amount * 2 * payoutScale);
      paylines.push({
        label: `Par ${i + 1}`,
        ids: [`c1_${i}`, `c2_${i}`],
        amount: win,
        tier: payoutTier(win, amount)
      });
    }
  }

  // Jackpot: 3 siete abajo
  let jackpotHit = false;
  if (board.bottom.every((id) => id === "seven")) {
    jackpotHit = true;
    const win = jackpotBank + Math.round(amount * 40 * payoutScale);
    paylines.push({
      label: "JACKPOT",
      ids: ["br1", "br2", "br3"],
      amount: win,
      tier: "win-jackpot"
    });
    jackpotBank = 1000;
  } else {
    jackpotBank += Math.max(1, Math.round(amount * 0.1));
  }

  // Scatter / free spins
  const allCellIds = [
    "tr1", "tr2", "tr3",
    "c1_0", "c1_1", "c1_2", "c1_3", "c1_4",
    "c2_0", "c2_1", "c2_2", "c2_3", "c2_4",
    "br1", "br2", "br3"
  ];

  const allSymbols = [
    ...board.top, ...board.row1, ...board.row2, ...board.bottom
  ];

  const scatterCells = [];
  allSymbols.forEach((symbolId, index) => {
    if (themeMap[symbolId]?.kind === "scatter") {
      scatterCells.push(allCellIds[index]);
    }
  });

  const scatterCount = scatterCells.length;
  let freeSpinsAwarded = 0;

  if (scatterCount >= 3) {
    freeSpins += 5;
    freeSpinsAwarded = 5;
  }

  const spinWinRaw = paylines.reduce((sum, line) => sum + line.amount, 0);

  let creditedNow = 0;
  if (spinWinRaw > 0) {
    if (inFreeSpin) {
      freeSpinBank += spinWinRaw;
    } else {
      balance += spinWinRaw;
      creditedNow = spinWinRaw;
    }
  }

  let freeSpinBankPaid = 0;
  if (freeSpins === 0 && freeSpinBank > 0) {
    balance += freeSpinBank;
    freeSpinBankPaid = freeSpinBank;
    creditedNow += freeSpinBank;
    freeSpinBank = 0;
  }

  const { error: saveError } = await supabase
    .from("app_users")
    .update({
      balance,
      free_spins: freeSpins,
      free_spin_bank: freeSpinBank
    })
    .eq("id", req.user.id);

  if (saveError) {
    return res.status(500).json({ success: false, error: saveError.message });
  }

  await writeSetting("jackpot_bank", jackpotBank);

  res.json({
    success: true,
    theme,
    rtp,
    board,
    paylines,
    balance,
    spinWinRaw,
    creditedNow,
    freeSpinsRemaining: freeSpins,
    freeSpinsAwarded,
    freeSpinBank,
    freeSpinBankPaid,
    scatterCount,
    scatterCells,
    jackpotBank,
    jackpotHit
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});