const { verify, parseCookies } = require('../../_auth');
const islepilot = require('../../../services/islepilot');
const skinStore = require('../../../services/skinStore');
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
    const live = await islepilot.getLivePlayer(steamId);
    const species = live?.song?.species || 'Spinosaurus';
    const savedSkin = skinStore.getSkin(steamId, species) || {};

    const result = garageStore.storeDino(steamId, targetSlot, {
        species: species,
        female: live?.song?.gender === 'female',
        growth: live?.song?.growth || 1.0,
        colors: savedSkin.colors || {},
        skin: savedSkin.skin || { variation: 0, pattern: 1, theme: 0 }
    });

    return res.status(200).json(result);
};

