const { verify, parseCookies } = require('../_auth');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const cookies = parseCookies(req);
    const user = verify(cookies['dino4vn_steam_session']);
    if (!user || !user.logged_in) {
        return res.status(401).json({ ok: false, err: 'chua_dang_nhap' });
    }

    res.json({
        ok: true,
        song: {
            in_game: true,
            species: 'Carnotaurus',
            gender: 'male',
            growth: 1.0,
            health: 1.0,
            stamina: 1.0,
            hunger: 0.95,
            thirst: 0.9,
            dot_bien: [],
            prime: 10,
            prime_dat: 5,
            prime_eligible: true
        },
        caps: {
            prime_conditions: true
        }
    });
};
