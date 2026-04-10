// 🔥 REEMPLAZÁ SOLO LA PARTE DE /api/slots/spin POR ESTA

app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const bet = Math.floor(Number(req.body.amount));
    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    const settings = await getAllSettings();
    const user = await getUserById(req.user.id);
    if (!user) return res.status(401).json({ error: "Sesión inválida" });

    const usingFreeSpin = user.free_spins > 0 || user.free_spin_bank > 0;

    if (!usingFreeSpin && user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const board = buildBoard();
    const outcome = calculateSlotOutcome(board, bet, settings);

    const spend = usingFreeSpin ? 0 : bet;
    const nextBalance = Math.max(0, user.balance - spend + outcome.win);

    // 🎰 CONSUMO DE FREESPINS
    let nextFreeSpins = Math.max(0, user.free_spins - (usingFreeSpin ? 1 : 0));
    let nextFreeBank = Math.max(0, user.free_spin_bank - (usingFreeSpin ? 1 : 0));

    // 🎯 TOTAL ACTUAL
    const totalFree = nextFreeSpins + nextFreeBank;

    // 🎁 BONUS CON PROBABILIDAD REAL
    let awarded = 0;

    if (outcome.scatterCount >= 3) {
      const chance = Math.random();

      if (chance < 0.25) { // 🔥 25% probabilidad real
        awarded = Math.min(Number(settings.free_spin_award || 5), 20);
      }
    }

    // 🚫 SOLO DAR SI NO TENÉS FREESPINS
    if (awarded > 0 && totalFree === 0) {
      nextFreeSpins = awarded;
      nextFreeBank = awarded;
    }

    await saveUserState(user.id, {
      balance: nextBalance,
      free_spins: nextFreeSpins,
      free_spin_bank: nextFreeBank
    });

    res.json({
      success: true,
      board,
      win: outcome.win,
      balance: nextBalance,
      freeSpins: nextFreeSpins,
      freeSpinBank: nextFreeBank,
      freeSpinsAwarded: awarded,
      scatterCount: outcome.scatterCount,
      scatterCells: outcome.scatterCells,
      paylines: outcome.paylines,
      jackpotBank: Number(settings.jackpot_bank || 1000)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});