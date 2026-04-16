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
  process.env.SUPABASE_SERVICE_ROLE
);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ================= SETTINGS ================= */

const DEFAULT_SETTINGS = {
  win_rate: 30,
  rtp: 90,
  slot_pay_3: 2,
  slot_pay_4: 5,
  slot_pay_5: 10,
  roulette_winrate: 48,
  roulette_payout: 35,
  free_spin_award: 5,
  default_balance: 1000,
  volatility: "medium"
};

async function getSettings() {
  const { data } = await supabase.from("game_settings").select("*");
  const s = { ...DEFAULT_SETTINGS };

  (data || []).forEach((row) => {
    if (row.key === "volatility") {
      s[row.key] = String(row.value || "medium");
    } else {
      const n = Number(row.value);
      s[row.key] = Number.isFinite(n) ? n : s[row.key];
    }
  });

  return s;
}

async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  if (rows.length > 0) {
    await supabase.from("game_settings").upsert(rows, { onConflict: "key" });
  }
}

/* ================= USERS ================= */

async function getUserById(id) {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data || null;
}

async function getUserByUsername(username) {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  return data || null;
}

async function saveUser(id, data) {
  await supabase.from("app_users").update(data).eq("id", id);
}

/* ================= AUTH ================= */

function issueToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.id);

    if (!user) return res.status(401).json({ error: "Sesión inválida" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

async function passwordMatches(plain, stored) {
  if (!stored) return false;

  if (String(stored).startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }

  return plain === stored;
}

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({ error: "Poné usuario y contraseña" });
  }

  const user = await getUserByUsername(username);
  if (!user) return res.status(400).json({ error: "Usuario no existe" });

  const ok = await passwordMatches(password, user.password);
  if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

  res.json({
    success: true,
    token: issueToken(user),
    username: user.username,
    role: user.role,
    balance: Number(user.balance || 0)
  });
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
    balance: Number(req.user.balance || 0),
    freeSpins: Number(req.user.freeSpins || 0)
  });
});

/* ================= ADMIN ================= */

app.get("/api/game-info", authRequired, async (req, res) => {
  const settings = await getSettings();
  res.json({ success: true, ...settings });
});

app.get("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  res.json(await getSettings());
});

app.put("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  try {
    const next = {};

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (req.body[key] !== undefined) {
        if (key === "volatility") {
          const v = String(req.body[key]).toLowerCase();
          next[key] = ["low", "medium", "high"].includes(v) ? v : "medium";
        } else {
          const raw = Number(req.body[key]);
          if (Number.isFinite(raw)) next[key] = raw;
        }
      }
    }

    if (next.win_rate !== undefined) next.win_rate = Math.max(1, Math.min(99.9, next.win_rate));
    if (next.rtp !== undefined) next.rtp = Math.max(1, Math.min(99.9, next.rtp));
    if (next.default_balance !== undefined) next.default_balance = Math.max(0, Math.floor(next.default_balance));
    if (next.slot_pay_3 !== undefined) next.slot_pay_3 = Math.max(0, Math.floor(next.slot_pay_3));
    if (next.slot_pay_4 !== undefined) next.slot_pay_4 = Math.max(0, Math.floor(next.slot_pay_4));
    if (next.slot_pay_5 !== undefined) next.slot_pay_5 = Math.max(0, Math.floor(next.slot_pay_5));
    if (next.roulette_winrate !== undefined) next.roulette_winrate = Math.max(1, Math.min(99.9, next.roulette_winrate));
    if (next.roulette_payout !== undefined) next.roulette_payout = Math.max(1, Math.floor(next.roulette_payout));
    if (next.free_spin_award !== undefined) next.free_spin_award = Math.max(0, Math.floor(next.free_spin_award));

    await saveSettings(next);
    res.json({ success: true, ...(await getSettings()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, freeSpins")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    success: true,
    users: (data || []).map((u) => ({
      ...u,
      balance: Number(u.balance || 0),
      freeSpins: Number(u.freeSpins || 0)
    }))
  });
});

app.post("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = req.body.role === "admin" ? "admin" : "player";
    const balance = Number(req.body.balance || 0);

    if (!username || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: "Usuario ya existe" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("app_users").insert({
      username,
      password: hashed,
      role,
      balance: Math.max(0, Math.floor(balance)),
      freeSpins: 0
    });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/user/:id/balance", authRequired, adminOnly, async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const newBalance = Number(req.body.amount);
  if (!Number.isFinite(newBalance)) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  await saveUser(user.id, { balance: Math.max(0, Math.floor(newBalance)) });
  res.json({ success: true });
});

/* ================= SLOTS ================= */

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.symbol;
  }

  return items[items.length - 1].symbol;
}

function buildBoard() {
  const weighted = [
    { symbol: "coin.png", weight: 24 },
    { symbol: "jade.png", weight: 20 },
    { symbol: "lantern.png", weight: 18 },
    { symbol: "goldpot.png", weight: 12 },
    { symbol: "dragon.png", weight: 8 },
    { symbol: "wild.png", weight: 5 },
    { symbol: "scatter.png", weight: 3 }
  ];

  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => weightedPick(weighted))
  );
}

function calcSlotWin(board, bet, settings) {
  let win = 0;
  let paylines = [];

  for (let row = 0; row < 3; row++) {
    let first = board[0][row];
    if (first === "scatter.png") continue;

    let count = 1;
    for (let col = 1; col < 5; col++) {
      if (board[col][row] === first || board[col][row] === "wild.png") count++;
      else break;
    }

    if (count >= 3) {
      let amount = 0;
      if (count === 3) amount = bet * settings.slot_pay_3;
      if (count === 4) amount = bet * settings.slot_pay_4;
      if (count >= 5) amount = bet * settings.slot_pay_5;

      win += amount;
      paylines.push({
        row,
        count,
        amount,
        symbol: first
      });
    }
  }

  const scatterCount = board.flat().filter((s) => s === "scatter.png").length;
  const freeSpinsAwarded = scatterCount >= 3 ? Number(settings.free_spin_award || 5) : 0;

  return {
    win,
    paylines,
    scatterCount,
    freeSpinsAwarded
  };
}

app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const bet = Number(req.body.amount);
    const user = await getUserById(req.user.id);
    const settings = await getSettings();

    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    let freeSpins = Number(user.freeSpins || 0);
    const isFreeSpin = freeSpins > 0;

    if (!isFreeSpin && user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const board = buildBoard();
    const outcome = calcSlotWin(board, bet, settings);

    if (outcome.freeSpinsAwarded > 0) {
      freeSpins += outcome.freeSpinsAwarded;
    }

    if (isFreeSpin) {
      freeSpins = Math.max(0, freeSpins - 1);
    }

    const newBalance = isFreeSpin
      ? Number(user.balance || 0) + outcome.win
      : Number(user.balance || 0) - bet + outcome.win;

    await saveUser(user.id, {
      balance: Math.max(0, Math.floor(newBalance)),
      freeSpins
    });

    res.json({
      success: true,
      board,
      win: outcome.win,
      balance: Math.max(0, Math.floor(newBalance)),
      freeSpins,
      isFreeSpin,
      paylines: outcome.paylines,
      scatterCount: outcome.scatterCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= RULETTE ================= */

app.post("/api/roulette/spin", authRequired, async (req, res) => {
  try {
    const number = Math.floor(Number(req.body.number));
    const amount = Math.floor(Number(req.body.amount));
    const settings = await getSettings();
    const user = await getUserById(req.user.id);

    if (!Number.isFinite(number) || number < 0 || number > 36) {
      return res.status(400).json({ error: "Número inválido" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const result = Math.floor(Math.random() * 37);
    const win = result === number ? amount * Number(settings.roulette_payout || 35) : 0;
    const balance = Math.max(0, Number(user.balance || 0) - amount + win);

    await saveUser(user.id, { balance });

    res.json({
      success: true,
      result,
      win,
      balance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CRASH GAME ================= */

const crashRounds = new Map();

function getCrashRound(userId) {
  return crashRounds.get(userId) || null;
}

// 🎯 iniciar crash
app.post("/api/crash/start", authRequired, async (req, res) => {
  const user = await getUserById(req.user.id);
  const bet = Number(req.body.amount);

  if (!bet || bet <= 0) {
    return res.status(400).json({ error: "Apuesta inválida" });
  }

  if (user.balance < bet) {
    return res.status(400).json({ error: "Saldo insuficiente" });
  }

  // evitar doble partida
  if (getCrashRound(user.id)) {
    return res.status(400).json({ error: "Ya tenés una partida activa" });
  }

  // generar crash point (entre 1.2x y 5x aprox)
  const crashPoint = Number((1.2 + Math.random() * 3.8).toFixed(2));

  // descontar saldo
  const newBalance = user.balance - bet;
  await saveUser(user.id, { balance: newBalance });

  crashRounds.set(user.id, {
    bet,
    crashPoint,
    startedAt: Date.now()
  });

  res.json({
    success: true,
    crashPoint // 👈 el frontend lo usa
  });
});

// 💰 retirar
app.post("/api/crash/cashout", authRequired, async (req, res) => {
  const user = await getUserById(req.user.id);
  const round = getCrashRound(user.id);

  if (!round) {
    return res.status(400).json({ error: "No hay partida activa" });
  }

  const currentMultiplier = Number(req.body.multiplier);

  // perdió
  if (currentMultiplier >= round.crashPoint) {
    crashRounds.delete(user.id);

    return res.json({
      success: false,
      crashed: true,
      crashPoint: round.crashPoint
    });
  }

  // ganó
  const win = Math.floor(round.bet * currentMultiplier);
  const newBalance = user.balance + win;

  await saveUser(user.id, { balance: newBalance });

  crashRounds.delete(user.id);

  res.json({
    success: true,
    win,
    balance: newBalance
  });
});

/* ================= BLACKJACK ================= */

const blackjackGames = new Map();

const BLACKJACK_SUITS = ["♠", "♥", "♦", "♣"];
const BLACKJACK_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck() {
  const deck = [];

  for (const suit of BLACKJACK_SUITS) {
    for (const rank of BLACKJACK_RANKS) {
      deck.push({ rank, suit });
    }
  }

  return shuffle(deck);
}

function drawCard(deck) {
  const card = deck.pop();
  if (!card) throw new Error("Mazo agotado");
  return card;
}

function cardLabel(card) {
  return `${card.rank}${card.suit}`;
}

function serializeCard(card) {
  return {
    rank: card.rank,
    suit: card.suit,
    label: cardLabel(card)
  };
}

function serializeHand(hand) {
  return hand.map(serializeCard);
}

function blackjackHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["J", "Q", "K"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && blackjackHandValue(hand) === 21;
}

function getBlackjackGame(userId) {
  return blackjackGames.get(Number(userId)) || null;
}

function buildBlackjackState(user, game, options = {}) {
  const revealDealer = Boolean(options.revealDealer);
  const finished = Boolean(options.finished);
  const playerValue = blackjackHandValue(game.playerHand);
  const dealerValue = blackjackHandValue(game.dealerHand);

  return {
    success: true,
    active: !finished,
    finished,
    bet: game.bet,
    balance: Number(user.balance || 0),
    playerHand: serializeHand(game.playerHand),
    dealerHand: revealDealer ? serializeHand(game.dealerHand) : [serializeCard(game.dealerHand[0])],
    dealerHiddenCount: revealDealer ? 0 : Math.max(0, game.dealerHand.length - 1),
    playerValue,
    dealerValue: revealDealer ? dealerValue : blackjackHandValue([game.dealerHand[0]]),
    canHit: !finished,
    canStand: !finished,
    canDouble: !finished && game.playerHand.length === 2 && Number(user.balance || 0) >= game.bet,
    result: options.result || "",
    message: options.message || ""
  };
}

async function settleBlackjackGame(userId, game, outcome) {
  const user = await getUserById(userId);

  let payout = 0;
  if (outcome === "player_blackjack") {
    payout = Math.floor(game.bet * 2.5);
  } else if (outcome === "player_win") {
    payout = game.bet * 2;
  } else if (outcome === "push") {
    payout = game.bet;
  }

  const newBalance = Math.max(0, Number(user.balance || 0) + payout);

  blackjackGames.delete(Number(userId));
  await saveUser(userId, { balance: newBalance });

  return newBalance;
}

function dealerPlay(game) {
  while (blackjackHandValue(game.dealerHand) < 17) {
    game.dealerHand.push(drawCard(game.deck));
  }
}

function compareBlackjackHands(game) {
  const playerValue = blackjackHandValue(game.playerHand);
  const dealerValue = blackjackHandValue(game.dealerHand);

  if (playerValue > 21) return "lose";
  if (dealerValue > 21) return "player_win";
  if (playerValue > dealerValue) return "player_win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}

app.get("/api/blackjack/state", authRequired, (req, res) => {
  const user = req.user;
  const game = getBlackjackGame(user.id);

  if (!game) {
    return res.json({
      success: true,
      active: false,
      balance: Number(user.balance || 0),
      message: "Listo para repartir"
    });
  }

  res.json(buildBlackjackState(user, game, {
    finished: false,
    revealDealer: false,
    message: "Tu turno"
  }));
});

app.post("/api/blackjack/deal", authRequired, async (req, res) => {
  try {
    const bet = Math.floor(Number(req.body.amount));
    const user = await getUserById(req.user.id);

    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    if (getBlackjackGame(user.id)) {
      return res.status(400).json({ error: "Ya tenés una mano activa" });
    }

    if (user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const deck = createDeck();
    const playerHand = [drawCard(deck), drawCard(deck)];
    const dealerHand = [drawCard(deck), drawCard(deck)];

    const newBalance = Math.max(0, Number(user.balance || 0) - bet);

    const game = {
      bet,
      deck,
      playerHand,
      dealerHand
    };

    blackjackGames.set(user.id, game);
    await saveUser(user.id, { balance: newBalance });

    const playerBJ = isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);

    if (playerBJ || dealerBJ) {
      let outcome = "lose";
      let message = "Perdiste";
      let result = "lose";

      if (playerBJ && dealerBJ) {
        outcome = "push";
        message = "Push: ambos blackjack";
        result = "push";
      } else if (playerBJ) {
        outcome = "player_blackjack";
        message = "Blackjack!";
        result = "blackjack";
      } else {
        outcome = "lose";
        message = "Dealer blackjack";
        result = "dealer_blackjack";
      }

      const balance = await settleBlackjackGame(user.id, game, outcome);

      return res.json({
        success: true,
        active: false,
        finished: true,
        bet,
        balance,
        playerHand: serializeHand(playerHand),
        dealerHand: serializeHand(dealerHand),
        dealerHiddenCount: 0,
        playerValue: blackjackHandValue(playerHand),
        dealerValue: blackjackHandValue(dealerHand),
        canHit: false,
        canStand: false,
        canDouble: false,
        result,
        message
      });
    }

    return res.json(buildBlackjackState(
      { ...user, balance: newBalance },
      game,
      { finished: false, revealDealer: false, message: "Tu turno" }
    ));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/blackjack/action", authRequired, async (req, res) => {
  try {
    const action = String(req.body.action || "").toLowerCase();
    const user = await getUserById(req.user.id);
    const game = getBlackjackGame(user.id);

    if (!game) {
      return res.status(400).json({ error: "No hay mano activa" });
    }

    if (action === "hit") {
      game.playerHand.push(drawCard(game.deck));

      const playerValue = blackjackHandValue(game.playerHand);

      if (playerValue > 21) {
        blackjackGames.delete(user.id);
        return res.json({
          success: true,
          active: false,
          finished: true,
          result: "lose",
          message: "Te pasaste",
          bet: game.bet,
          balance: Number(user.balance || 0),
          playerHand: serializeHand(game.playerHand),
          dealerHand: serializeHand(game.dealerHand),
          dealerHiddenCount: 0,
          playerValue,
          dealerValue: blackjackHandValue(game.dealerHand),
          canHit: false,
          canStand: false,
          canDouble: false
        });
      }

      await saveUser(user.id, { balance: Number(user.balance || 0) });

      return res.json(buildBlackjackState(user, game, {
        finished: false,
        revealDealer: false,
        message: "Tu turno"
      }));
    }

    if (action === "double") {
      if (game.playerHand.length !== 2) {
        return res.status(400).json({ error: "Solo podés doblar con 2 cartas" });
      }

      if (user.balance < game.bet) {
        return res.status(400).json({ error: "Saldo insuficiente para doblar" });
      }

      const balanceAfterDouble = Math.max(0, Number(user.balance || 0) - game.bet);
      await saveUser(user.id, { balance: balanceAfterDouble });
      game.bet *= 2;

      game.playerHand.push(drawCard(game.deck));
      const playerValue = blackjackHandValue(game.playerHand);

      if (playerValue > 21) {
        blackjackGames.delete(user.id);
        return res.json({
          success: true,
          active: false,
          finished: true,
          result: "lose",
          message: "Te pasaste",
          bet: game.bet,
          balance: balanceAfterDouble,
          playerHand: serializeHand(game.playerHand),
          dealerHand: serializeHand(game.dealerHand),
          dealerHiddenCount: 0,
          playerValue,
          dealerValue: blackjackHandValue(game.dealerHand),
          canHit: false,
          canStand: false,
          canDouble: false
        });
      }

      dealerPlay(game);

      const outcome = compareBlackjackHands(game);
      const balance = await settleBlackjackGame(user.id, game, outcome);

      return res.json({
        success: true,
        active: false,
        finished: true,
        result: outcome,
        message: outcome === "player_win" ? "Ganaste" : outcome === "push" ? "Push" : "Perdiste",
        bet: game.bet,
        balance,
        playerHand: serializeHand(game.playerHand),
        dealerHand: serializeHand(game.dealerHand),
        dealerHiddenCount: 0,
        playerValue: blackjackHandValue(game.playerHand),
        dealerValue: blackjackHandValue(game.dealerHand),
        canHit: false,
        canStand: false,
        canDouble: false
      });
    }

    if (action === "stand") {
      dealerPlay(game);

      const outcome = compareBlackjackHands(game);
      const balance = await settleBlackjackGame(user.id, game, outcome);

      return res.json({
        success: true,
        active: false,
        finished: true,
        result: outcome,
        message: outcome === "player_win" ? "Ganaste" : outcome === "push" ? "Push" : "Perdiste",
        bet: game.bet,
        balance,
        playerHand: serializeHand(game.playerHand),
        dealerHand: serializeHand(game.dealerHand),
        dealerHiddenCount: 0,
        playerValue: blackjackHandValue(game.playerHand),
        dealerValue: blackjackHandValue(game.dealerHand),
        canHit: false,
        canStand: false,
        canDouble: false
      });
    }

    return res.status(400).json({ error: "Acción inválida" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= START ================= */

app.listen(PORT, () => {
  console.log("🔥 Casino PRO corriendo");
});