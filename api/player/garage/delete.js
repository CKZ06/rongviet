const { verify, parseCookies } = require('../../_auth');
const garageStore = require('../../../services/garageStore');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const cookies = parseCookies(req);
    const user = verify(cookies['dino4vn_steam_session']);
    if (!user || !user.logged_in) {
        return res.status(401).json({ ok: false, err: 'chua_dang_nhap' });
    }

    const steamId = user.steamid;
    const targetSlot = req.body?.slot || 1;
    const result = garageStore.deleteDino(steamId, targetSlot);

    return res.status(200).json(result);
};

