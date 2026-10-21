const islepilot = require('../services/islepilot');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const payload = await islepilot.getRealStatus();
        return res.status(200).json(payload);
    } catch (err) {
        console.error('API Status Error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
