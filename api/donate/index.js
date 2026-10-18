module.exports = async function handler(req, res) {
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

    const defaultLuat = {
        o_mac_dinh: 3,
        o_toi_da: 98,
        muc1_nguong: 150000,
        muc1_them_o: 7,
        muc2_nguong: 300000,
        muc3_nguong: 450000,
        buoc_o: 10000,
        nhan_toi_thieu: 20000,
        keo_toi_da: 5000000,
        keo_giua: 500000,
        keo_buoc_xa: 100000,
        nhap_toi_da: 100000000,
        loa_giay: 30,
        uu_tien_muc: 2,
        bao_hiem_muc: 2,
        chon_loai_muc: 3,
        so_ngay_hieu_luc: 30,
        gia_han_ngay: 5,
        bh_luot_chu_ky: 3,
        skin_nguong: 50000,
        skin_bo_0: 9999,
        skin_bo_1: 9999,
        skin_bo_2: 9999,
        skin_bo_3: 9999,
        skin_tudo_bac: 0,
        skin_tuap_bac: 0,
        gradient_bac: 3,
        nguong_chat: false,
        ten_muc: { "1": "Góp gạo", "2": "Góp thịt", "3": "Góp PC" }
    };

    const defaultBangMuc = [
        { muc: 1, ten: "Góp gạo", nguong: 150000, o_gara: 10, uu_tien: false, bao_hiem: false, chon_loai: false, quyen: ["10 ô gara"] },
        { muc: 2, ten: "Góp thịt", nguong: 300000, o_gara: 10, uu_tien: true, bao_hiem: true, chon_loai: false, quyen: ["10 ô gara, góp thêm mỗi 10.000 ₫ được thêm 1 ô (tối đa 98 ô)", "Ưu tiên xếp hàng khi server đầy", "Bảo hiểm khủng long: 3 lượt mỗi 30 ngày"] },
        { muc: 3, ten: "Góp PC", nguong: 450000, o_gara: 25, uu_tien: true, bao_hiem: true, chon_loai: true, quyen: ["25 ô gara, góp thêm mỗi 10.000 ₫ được thêm 1 ô (tối đa 98 ô)", "Ưu tiên xếp hàng khi server đầy", "Bảo hiểm khủng long: 3 lượt mỗi 30 ngày", "Chọn loài dù loài đó đã đủ trần"] }
    ];

    try {
        const fetchRes = await fetch('https://rongviet.sequencemods.com/api/donate.json', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
        if (fetchRes.ok) {
            const data = await fetchRes.json();
            data.nganHang = donateBankInfo;
            return res.status(200).json(data);
        }
    } catch (e) {}

    res.status(200).json({
        ok: true,
        schema: 1,
        builtAt: Math.floor(Date.now() / 1000),
        nganHang: donateBankInfo,
        luat: defaultLuat,
        bangMuc: defaultBangMuc,
        topNgay: [],
        topThang: [],
        chayChu: []
    });
};
