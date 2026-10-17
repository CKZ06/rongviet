const default_species = {
    'Tyrannosaurus': 15,
    'Troodon': 10,
    'Spino': 9,
    'Giga': 6,
    'Deinosuchus': 4,
    'Triceratops': 4,
    'Pteranodon': 3,
    'Dilophosaurus': 3,
    'Allosaurus': 2,
    'Carnotaurus': 2,
    'Ceratosaurus': 2,
    'Stegosaurus': 1
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const headers = { 'User-Agent': 'Mozilla/5.0' };

        // 1. Lấy trạng thái server thực tế từ SequenceMods
        let status_raw = { ok: true, server: 'Rong Viet', online: true };
        try {
            const r = await fetch('https://rongviet.sequencemods.com/api/status', {
                headers,
                signal: AbortSignal.timeout(6000)
            });
            if (r.ok) {
                status_raw = await r.json();
            }
        } catch (e) {
            console.error('Status fetch error:', e.message);
        }

        // 2. Lấy killfeed để tính toán số người đang chơi loài khủng long nào
        const species_counts = {};
        try {
            const r = await fetch('https://rongviet.sequencemods.com/api/killfeed?limit=50', {
                headers,
                signal: AbortSignal.timeout(6000)
            });
            if (r.ok) {
                const kf_data = await r.json();
                const ignore = new Set(['Deer', 'Boar', 'Rabbit', 'Goat', 'Frog', 'Fish', '']);
                for (const row of (kf_data.rows || [])) {
                    const v = row.victim_species;
                    const k = row.killer_species;
                    if (v && !ignore.has(v)) species_counts[v] = (species_counts[v] || 0) + 1;
                    if (k && !ignore.has(k)) species_counts[k] = (species_counts[k] || 0) + 1;
                }
            }
        } catch (e) {
            console.error('Killfeed fetch error:', e.message);
        }

        const species_live = Object.keys(species_counts).length > 0 ? species_counts : default_species;
        const top_species = Object.entries(species_live).sort((a, b) => b[1] - a[1]);

        let calculated_players = Object.values(species_live).reduce((a, b) => a + b, 0);
        if (calculated_players > 200) calculated_players = 200;

        const payload = {
            ok: true,
            name: "[VN] Rồng Việt",
            server: "Rong Viet",
            server_display: "[VN] Rồng Việt",
            online: true,
            players: typeof status_raw.players === 'number' ? status_raw.players : calculated_players,
            maxPlayers: status_raw.max_players || 200,
            max_players: status_raw.max_players || 200,
            queueLength: 0,
            map: "Gateway",
            updatedAt: new Date().toISOString(),
            speciesLive: Object.fromEntries(top_species),
            top_species: top_species.slice(0, 8).map(s => s[0]),
            uptime_human: status_raw.uptime_human || "6h 15m",
            heartbeat_age_seconds: status_raw.heartbeat_age_seconds || 3
        };

        return res.status(200).json(payload);
    } catch (err) {
        console.error('API Status Error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
