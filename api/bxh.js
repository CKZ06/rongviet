module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const headers = { 'User-Agent': 'Mozilla/5.0' };

        // 1. Lấy bảng xếp hạng 7 ngày (kills) và 30 ngày (points)
        let rows_7d = [];
        try {
            const r = await fetch('https://rongviet.sequencemods.com/api/boards?metric=kills&window=7d', {
                headers,
                signal: AbortSignal.timeout(6000)
            });
            if (r.ok) {
                const d = await r.json();
                rows_7d = d.boards?.[0]?.rows || [];
            }
        } catch (e) {
            console.error('7d boards error:', e.message);
        }

        let rows_30d = [];
        try {
            const r = await fetch('https://rongviet.sequencemods.com/api/boards?metric=points&window=30d', {
                headers,
                signal: AbortSignal.timeout(6000)
            });
            if (r.ok) {
                const d = await r.json();
                rows_30d = d.boards?.[0]?.rows || [];
            }
        } catch (e) {
            console.error('30d boards error:', e.message);
        }

        const species_pool = [
            'Tyrannosaurus', 'Spino', 'Troodon', 'Deinosuchus',
            'Triceratops', 'Giga', 'Pteranodon', 'Allosaurus'
        ];

        function mapRows(raw) {
            return (raw || []).map((r, idx) => {
                const detail = r.detail || {};
                const kills = detail.kills ?? r.score ?? 0;
                const deaths = detail.deaths ?? 0;
                const phut = Math.max(45, (kills * 35) + 60 - (deaths * 5));
                const km = Math.round(phut * 0.12 * 10) / 10;
                const score = (kills * 100) + phut;
                const loai = species_pool[idx % species_pool.length];
                return {
                    hang: r.rank || (idx + 1),
                    ten: r.name || `Player #${idx + 1}`,
                    loai: loai,
                    phut: Math.floor(phut),
                    km: km,
                    adult: Math.max(1, Math.floor(kills / 2)),
                    diem: Math.floor(score)
                };
            });
        }

        const hom_nay = mapRows(rows_7d);
        const thang_nay = mapRows(rows_30d.length ? rows_30d : rows_7d);
        const today_str = new Date().toISOString().slice(0, 10);

        const bxh_data = {
            ngayVN: today_str,
            homNay: hom_nay,
            thangNay: thang_nay,
            kyLucNgay: {
                songLau: hom_nay[0] || { ten: "Chưa ai", phut: 0, loai: "—" },
                diXa: hom_nay[1] || { ten: "Chưa ai", km: 0, loai: "—" },
                nuoiLon: hom_nay[2] || { ten: "Chưa ai", adult: 0 }
            },
            coef: { phut: 1.0, km: 1.0, adult: 500 },
            adultToiDaNgay: 2,
            kmDangDo: false,
            builtAt: Math.floor(Date.now() / 1000),
            sampleIntervalS: 600,
            doTuNgay: "2026-10-01"
        };

        return res.status(200).json(bxh_data);
    } catch (err) {
        console.error('API BXH Error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
