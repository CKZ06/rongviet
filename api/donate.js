const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const donateBankInfo = {
        ten: 'Techcombank',
        bin: '970407',
        so: '1903 3228 2290 12',
        chu: 'DANG THI LAM'
    };

    try {
        const jsonPath = path.join(process.cwd(), 'dino4vn.com', 'api', 'donate.json');
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            data.nganHang = donateBankInfo;
            return res.json(data);
        }
    } catch (e) {}

    res.json({
        ok: true,
        nganHang: donateBankInfo,
        luat: {
            muc1_nguong: 150000,
            muc2_nguong: 300000,
            muc3_nguong: 450000,
            so_ngay_hieu_luc: 30
        }
    });
};
