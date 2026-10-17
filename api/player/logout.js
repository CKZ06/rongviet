module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Set-Cookie', 'dino4vn_steam_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure');
    return res.status(200).json({ ok: true });
};
