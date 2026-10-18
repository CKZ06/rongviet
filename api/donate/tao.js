module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { so_tien, loi_nhan, an_danh, dong_y_dieu_khoan, cho_ky } = req.body || {};
    if (!dong_y_dieu_khoan) {
        return res.status(400).json({ ok: false, err: 'chua_dong_y_dieu_khoan' });
    }

    const donateBankInfo = {
        ten: 'Techcombank',
        bin: '970407',
        so: '1903 3228 2290 12',
        so_raw: '19033228229012',
        chu: 'DANG THI LAM'
    };

    const code = 'RV' + Math.floor(100000 + Math.random() * 900000);
    const amount = Number(so_tien) || 0;

    let qrUrl = `https://img.vietqr.io/image/${donateBankInfo.bin}-${donateBankInfo.so_raw}-compact2.png?addInfo=${encodeURIComponent(code)}&accountName=${encodeURIComponent(donateBankInfo.chu)}`;
    if (amount > 0) {
        qrUrl += `&amount=${amount}`;
    }

    res.json({
        ok: true,
        ma: code,
        soTien: amount > 0 ? amount : null,
        nganHang: {
            ten: donateBankInfo.ten,
            bin: donateBankInfo.bin,
            so: donateBankInfo.so,
            chu: donateBankInfo.chu
        },
        qr: qrUrl,
        qrGoc: '/assets/img/qr-techcombank.jpg'
    });
};
