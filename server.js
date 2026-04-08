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

    // 🔥 FIX CLAVE
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
      balance: user.balance
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});