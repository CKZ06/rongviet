const islepilot = require('../services/islepilot');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const bxhData = await islepilot.getRealLeaderboard();
        return res.status(200).json(bxhData);
    } catch (err) {
        console.error('API BXH Error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
