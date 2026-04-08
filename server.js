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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const DEFAULT_SETTINGS = {
  slot_rtp: 96,
  jackpot_bank: 1000,
  default_balance: 1000,
  slot_pay_3: 2,
  slot_pay_4: 5,
  slot_pay_5: 10,
  roulette_payout: 35
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function getSetting(key, fallback) {
  const { data, error } = await supabase
    .from("casino_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return fallback;
  const n = Number(data.value);
  return Number.isFinite(n) ? n : fallback;
}

async function getAllSettings() {
  const entries = await Promise.all(
    Object.entries(DEFAULT_SETTINGS).map(async ([key, fallback]) => [
      key,
      await getSetting(key, fallback)
    ])
  );

  return Object.fromEntries(entries);
}

async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  if (rows.length > 0) {
    await supabase.from("casino_settings").upsert(rows, { onConflict: "key" });
  }
}

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, username, role, balance, free_spins, free_spin_bank")
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

function tierFor(amountWin, bet) {
  if (amountWin >= bet * 30) return "win-jackpot";
  if (amountWin >= bet * 12) return "win-high";
  if (amountWin >= bet * 5) return "win-mid";
  return "win-low";
}

async function passwordMatches(plain, stored) {
  if (typeof stored === "string" && stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

function buildPool(theme, rtp) {
  const themes = {
    asian: ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"],
    classic: ["cherry", "lemon", "plum", "bell", "bar", "wild", "scatter"],
    fruits: ["cherry", "lemon", "melon", "grape", "orange", "wild", "scatter"]
  };

  const base = themes[theme] || themes.asian;
  const factor = clamp(rtp / 96, 0.7, 1.3);
  const pool = [];

  for (const s of base) {
    let weight = 10;

    if (s === "dragon") weight = Math.max(4, Math.round(18 * factor));
    if (s === "goldpot") weight = Math.max(4, Math.round(14 * factor));
    if (s === "coin") weight = Math.max(4, Math.round(16 * factor));
    if (s === "jade") weight = Math.max(4, Math.round(16 * factor));
    if (s === "lantern") weight = Math.max(4, Math.round(14 * factor));
    if (s === "wild") weight = Math.max(1, Math.round(6 * factor));
    if (s === "scatter") weight = Math.max(1, Math.round(3 * factor));
    if (s === "plum" || s === "bell" || s === "bar") weight = Math.max(2, Math.round(10 * factor));
    if (s === "melon" || s === "grape" || s === "orange" || s === "cherry" || s === "lemon")
      weight = Math.max(2, Math.round(12 * factor));

    for (let i = 0; i < weight; i++) pool.push(s);
  }

  return pool;
}

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateBoard(theme, rtp) {
  const pool = buildPool(theme, rtp);
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 5 }, () => pick(pool))
  );
}

function countFromLeft(row) {
  let base = row.find((s) => s !== "wild" && s !== "scatter");
  if (!base) base = row[0];

  let count = 0;
  for (const s of row) {
    if (s === "scatter") break;
    if (s === "wild" || s === base) count++;
    else break;
  }

  return { base, count };
}

function payForCount(count, pay3, pay4, pay5) {
  if (count === 3) return pay3;
  if (count === 4) return pay4;
  if (count >= 5) return pay5;
  return 0;
}

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUser = String(username || "").trim();
    const cleanPass = String(password || "").trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const hashed = await bcrypt.hash(cleanPass, 10);
    const defaultBalance = await getSetting("default_balance", 1000);

    const { error } = await supabase.from("app_users").insert({
      username: cleanUser,
      password: hashed,
      role: "player",
      balance: defaultBalance,
      free_spins: 0,
      free_spin_bank: 0
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUser = String(username || "").trim();
    const cleanPass = String(password || "").trim();

    const { data: user, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", cleanUser)
      .maybeSingle();

    if (error || !user) {
      return res.status(400).json({ error: "Usuario no existe" });
    }

    const valid = await passwordMatches(cleanPass, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      username: user.username,
      role: user.role,
      balance: user.balance,
      free_spins: user.free_spins || 0,
      free_spin_bank: user.free_spin_bank || 0
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/logout", (req, res) => {
  res.json({ success: true });
});

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

app.get("/api/user", authRequired, (req, res) => {
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

app.get("/api/game-info", authRequired, async (req, res) => {
  const settings = await getAllSettings();
  res.json({
    success: true,
    slot_rtp: settings.slot_rtp,
    jackpot_bank: settings.jackpot_bank,
    slot_pay_3: settings.slot_pay_3,
    slot_pay_4: settings.slot_pay_4,
    slot_pay_5: settings.slot_pay_5,
    roulette_payout: settings.roulette_payout
  });
});

app.get("/api/admin/settings", authRequired, adminRequired, async (req, res) => {
  const settings = await getAllSettings();
  res.json({ success: true, ...settings });
});

app.put("/api/admin/settings", authRequired, adminRequired, async (req, res) => {
  const next = {};

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (req.body[key] !== undefined) {
      const raw = Number(req.body[key]);
      if (Number.isFinite(raw)) next[key] = raw;
    }
  }

  if (next.slot_rtp !== undefined) next.slot_rtp = clamp(next.slot_rtp, 70, 99.9);
  if (next.default_balance !== undefined) next.default_balance = Math.max(0, Math.floor(next.default_balance));
  if (next.jackpot_bank !== undefined) next.jackpot_bank = Math.max(1000, Math.floor(next.jackpot_bank));
  if (next.slot_pay_3 !== undefined) next.slot_pay_3 = Math.max(0, Math.floor(next.slot_pay_3));
  if (next.slot_pay_4 !== undefined) next.slot_pay_4 = Math.max(0, Math.floor(next.slot_pay_4));
  if (next.slot_pay_5 !== undefined) next.slot_pay_5 = Math.max(0, Math.floor(next.slot_pay_5));
  if (next.roulette_payout !== undefined) next.roulette_payout = Math.max(1, Math.floor(next.roulette_payout));

  await saveSettings(next);
  res.json({ success: true });
});

app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, free_spins, free_spin_bank, created_at")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, users: data || [] });
});

app.post("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  try {
    const cleanUser = String(req.body.username || "").trim();
    const cleanPass = String(req.body.password || "").trim();
    const role = req.body.role === "admin" ? "admin" : "player";

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ error: "Poné usuario y contraseña" });
    }

    const balanceInput = Number(req.body.balance);
    const defaultBalance = await getSetting("default_balance", 1000);
    const balance = Number.isFinite(balanceInput)
      ? Math.max(0, Math.floor(balanceInput))
      : defaultBalance;

    const hashed = await bcrypt.hash(cleanPass, 10);

    const { error } = await supabase.from("app_users").insert({
      username: cleanUser,
      password: hashed,
      role,
      balance,
      free_spins: 0,
      free_spin_bank: 0
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch("/api/admin/users/:id/balance", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const delta = Number(req.body.delta);

  if (!Number.isFinite(id) || !Number.isFinite(delta)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, balance")
    .eq("id", id)
    .maybeSingle();

  if (error || !user) return res.status(404).json({ error: "Usuario no encontrado" });

  const balance = Math.max(0, Math.floor(Number(user.balance) + delta));

  const { error: updateError } = await supabase
    .from("app_users")
    .update({ balance })
    .eq("id", id);

  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ success: true, balance });
});

app.put("/api/admin/users/:id/balance", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const balanceInput = Number(req.body.balance);

  if (!Number.isFinite(id) || !Number.isFinite(balanceInput)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const balance = Math.max(0, Math.floor(balanceInput));

  const { error } = await supabase
    .from("app_users")
    .update({ balance })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, balance });
});

app.patch("/api/admin/users/:id/role", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const role = req.body.role === "admin" ? "admin" : "player";

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Usuario inválido" });
  }

  if (id === req.user.id && role !== "admin") {
    return res.status(400).json({ error: "No podés quitarte admin a vos mismo" });
  }

  const { error } = await supabase
    .from("app_users")
    .update({ role })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, role });
});

app.delete("/api/admin/users/:id", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Usuario inválido" });
  }

  if (id === req.user.id) {
    return res.status(400).json({ error: "No podés borrarte a vos mismo" });
  }

  const { error } = await supabase.from("app_users").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const theme = ["asian", "classic", "fruits"].includes(req.body.theme)
      ? req.body.theme
      : "asian";

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    const settings = await getAllSettings();
    const rtp = clamp(Number(settings.slot_rtp), 70, 99.9);
    const pay3 = Number(settings.slot_pay_3);
    const pay4 = Number(settings.slot_pay_4);
    const pay5 = Number(settings.slot_pay_5);
    let jackpotBank = Number(settings.jackpot_bank);

    const { data: user, error: userError } = await supabase
      .from("app_users")
      .select("*")
      .eq("id", req.user.id)
      .maybeSingle();

    if (userError || !user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    let balance = Number(user.balance || 0);
    let freeSpins = Number(user.free_spins || 0);
    let freeSpinBank = Number(user.free_spin_bank || 0);

    const inFreeSpin = freeSpins > 0;

    if (!inFreeSpin) {
      if (balance < amount) return res.status(400).json({ error: "Sin saldo" });
      balance -= amount;
    } else {
      freeSpins -= 1;
    }

    const board = generateBoard(theme, rtp);
    const rowIds = [
      ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
      ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
      ["c3_0", "c3_1", "c3_2", "c3_3", "c3_4"]
    ];

    const paylines = [];
    let spinWinRaw = 0;
    let creditedNow = 0;
    let freeSpinsAwarded = 0;
    let freeSpinBankPaid = 0;
    let jackpotHit = false;

    for (let r = 0; r < 3; r++) {
      const row = board[r];

      if (r === 2 && row.every((s) => s === "dragon")) {
        jackpotHit = true;
        const jackpotWin = jackpotBank + Math.round(amount * 40);
        spinWinRaw += jackpotWin;
        paylines.push({
          label: "JACKPOT",
          ids: rowIds[r],
          amount: jackpotWin,
          tier: "win-jackpot"
        });
        jackpotBank = 1000;
        continue;
      }

      const { count } = countFromLeft(row);
      if (count >= 3) {
        const multiplier = payForCount(count, pay3, pay4, pay5);
        if (multiplier > 0) {
          const win = Math.round(amount * multiplier);
          spinWinRaw += win;
          paylines.push({
            label: `Fila ${r + 1} x${count}`,
            ids: rowIds[r].slice(0, count),
            amount: win,
            tier: tierFor(win, amount)
          });
        }
      }
    }

    const scatterCells = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (board[r][c] === "scatter") {
          scatterCells.push(rowIds[r][c]);
        }
      }
    }

    const scatterCount = scatterCells.length;
    if (scatterCount >= 3) {
      freeSpins += 5;
      freeSpinsAwarded = 5;
    }

    if (spinWinRaw > 0) {
      if (inFreeSpin) {
        freeSpinBank += spinWinRaw;
      } else {
        balance += spinWinRaw;
        creditedNow = spinWinRaw;
      }
    }

    if (freeSpins === 0 && freeSpinBank > 0) {
      balance += freeSpinBank;
      freeSpinBankPaid = freeSpinBank;
      creditedNow += freeSpinBank;
      freeSpinBank = 0;
    }

    if (!jackpotHit) {
      jackpotBank += Math.max(1, Math.round(amount * 0.1));
    }

    const { error: saveError } = await supabase
      .from("app_users")
      .update({
        balance,
        free_spins: freeSpins,
        free_spin_bank: freeSpinBank
      })
      .eq("id", user.id);

    if (saveError) {
      return res.status(500).json({ error: saveError.message });
    }

    await saveSettings({ jackpot_bank: jackpotBank });

    res.json({
      success: true,
      board,
      paylines,
      balance,
      win: spinWinRaw,
      creditedNow,
      freeSpins,
      freeSpinsAwarded,
      freeSpinBank,
      freeSpinBankPaid,
      scatterCount,
      scatterCells,
      jackpotBank,
      jackpotHit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/roulette/spin", authRequired, async (req, res) => {
  try {
    const number = Number(req.body.number);
    const amount = Number(req.body.amount);

    if (!Number.isInteger(number) || number < 0 || number > 36) {
      return res.status(400).json({ error: "Número inválido" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    const settings = await getAllSettings();
    const payout = Number(settings.roulette_payout);

    const { data: user, error: userError } = await supabase
      .from("app_users")
      .select("*")
      .eq("id", req.user.id)
      .maybeSingle();

    if (userError || !user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    let balance = Number(user.balance || 0);
    if (balance < amount) return res.status(400).json({ error: "Sin saldo" });

    balance -= amount;

    const result = Math.floor(Math.random() * 37);
    let win = 0;

    if (result === number) {
      win = amount * payout;
      balance += win;
    }

    const { error: saveError } = await supabase
      .from("app_users")
      .update({ balance })
      .eq("id", user.id);

    if (saveError) return res.status(500).json({ error: saveError.message });

    res.json({ success: true, result, win, balance });
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