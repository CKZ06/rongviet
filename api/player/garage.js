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
        slots: [
            {
                slot: 1,
                species: 'Carnotaurus',
                female: false,
                growth: 1.0,
                colors: {},
                skin: { variation: 0, pattern: 1, theme: 0 }
            }
        ]
    });
};
