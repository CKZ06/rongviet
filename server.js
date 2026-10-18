const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const webDir = path.join(__dirname, 'dino4vn.com');

// Load .env configuration if present
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dino4vn_steam_auth_secret_key_2026';

// Cho phép nhận diện đúng IP và giao thức HTTPS khi chạy sau Tunnel / Proxy
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure session middleware
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: 'auto',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Determine Base URL dynamically: tự động nhận diện cả localhost lẫn domain Cloudflare Tunnel
function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
    return `${proto}://${host}`;
}

// ── 1. Khởi động đăng nhập Steam ─────────────────────────────────────────────
app.get(['/api/auth/steam', '/dang-nhap'], (req, res) => {
    const returnTo = req.query.return || req.query.ve || '/';
    req.session.returnTo = returnTo;

    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/api/auth/steam/return`;
    const realm = `${baseUrl}/`;

    const openidParams = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': returnUrl,
        'openid.realm': realm,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    });

    const steamLoginUrl = `https://steamcommunity.com/openid/login?${openidParams.toString()}`;
    res.redirect(steamLoginUrl);
});

// ── 2. Xử lý phản hồi (Callback) từ Steam ────────────────────────────────────
app.get('/api/auth/steam/return', async (req, res) => {
    try {
        const query = req.query;

        if (!query || !query['openid.mode']) {
            return res.status(400).send('Phản hồi không hợp lệ từ Steam.');
        }

        if (query['openid.mode'] === 'cancel') {
            const returnTo = req.session.returnTo || '/';
            delete req.session.returnTo;
            return res.redirect(returnTo);
        }

        // Xác thực chữ ký OpenID 2.0 trực tiếp với Steam
        const verificationParams = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            verificationParams.append(key, value);
        }
        verificationParams.set('openid.mode', 'check_authentication');

        const verifyResponse = await fetch('https://steamcommunity.com/openid/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: verificationParams.toString()
        });

        const verifyText = await verifyResponse.text();
        const isValid = verifyText.split('\n').some(line => line.trim() === 'is_valid:true');

        if (!isValid) {
            console.error('Steam OpenID verification failed:', verifyText);
            return res.status(401).send('Xác thực chữ ký Steam thất bại.');
        }

        // Trích xuất SteamID64 từ openid.claimed_id (URL dạng: https://steamcommunity.com/openid/id/76561198xxxxxxxx)
        const claimedId = query['openid.claimed_id'] || query['openid.identity'] || '';
        const match = claimedId.match(/\/id\/(\d+)/);
        if (!match) {
            return res.status(400).send('Không tìm thấy SteamID hợp lệ trong phản hồi từ Steam.');
        }

        const steamId = match[1];

        // Lấy thông tin chi tiết qua Steam Web API hoặc XML hồ sơ công khai
        let name = `Steam ...${steamId.slice(-4)}`;
        let avatar = '';
        let profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
        let country = '';
        let fetched = false;

        const apiKey = (process.env.STEAM_API_KEY || '').trim();
        if (apiKey) {
            try {
                const summaryRes = await fetch(
                    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
                );
                if (summaryRes.ok) {
                    const data = await summaryRes.json();
                    const player = data?.response?.players?.[0];
                    if (player) {
                        name = player.personaname || name;
                        avatar = player.avatarfull || player.avatarmedium || player.avatar || '';
                        profileUrl = player.profileurl || profileUrl;
                        country = player.loccountrycode || '';
                        fetched = true;
                    }
                } else {
                    console.warn(`Steam GetPlayerSummaries returned status ${summaryRes.status}`);
                }
            } catch (err) {
                console.error('Lỗi khi gọi Steam Web API GetPlayerSummaries:', err.message);
            }
        }

        // Nếu chưa có API key hoặc lỗi, tự động lấy từ hồ sơ công khai của Steam (không cần API key)
        if (!fetched) {
            try {
                const xmlRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                if (xmlRes.ok) {
                    const xmlText = await xmlRes.text();
                    const nameMatch = xmlText.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
                    const avatarMatch = xmlText.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
                    const locationMatch = xmlText.match(/<location><!\[CDATA\[(.*?)\]\]><\/location>/);
                    if (nameMatch && nameMatch[1]) name = nameMatch[1];
                    if (avatarMatch && avatarMatch[1]) avatar = avatarMatch[1];
                    if (locationMatch && locationMatch[1]) country = locationMatch[1];
                }
            } catch (xmlErr) {
                console.warn('Không thể lấy XML profile:', xmlErr.message);
            }
        }

        // Lưu thông tin người chơi vào session
        req.session.user = {
            logged_in: true,
            steamid: steamId,
            name: name,
            avatar: avatar,
            profileurl: profileUrl,
            country: country
        };

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
        return res.redirect(safeReturn);
    } catch (err) {
        console.error('Lỗi xử lý phản hồi từ Steam:', err);
        return res.status(500).send('Có lỗi xảy ra khi xác thực với Steam.');
    }
});

// ── 3. API thông tin người chơi hiện tại (/api/player/me) ─────────────────────
app.get('/api/player/me', (req, res) => {
    if (req.session && req.session.user && req.session.user.logged_in) {
        return res.json(req.session.user);
    }
    return res.json({ logged_in: false });
});

// ── 4. API Đăng xuất (/api/player/logout) ─────────────────────────────────────
app.post('/api/player/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ ok: false, error: 'Không thể xoá phiên đăng nhập' });
            }
            res.clearCookie('connect.sid');
            return res.json({ ok: true });
        });
    } else {
        return res.json({ ok: true });
    }
});

// ── 5. Các API Quản lý Khủng long, Skin & Gara ─────────────────────────────────
app.get('/api/player/skin', (req, res) => {
    if (!req.session?.user?.logged_in) {
        return res.status(401).json({ ok: false, err: 'chua_dang_nhap' });
    }
    const skinData = req.session.user.skin || {
        ok: true,
        species: 'Carnotaurus',
        female: false,
        growth: 1.0,
        colors: {},
        skin: { variation: 0, pattern: 1, theme: 0 }
    };
    res.json(skinData);
});

app.post('/api/player/skin', (req, res) => {
    if (!req.session?.user?.logged_in) {
        return res.status(401).json({ ok: false, err: 'chua_dang_nhap' });
    }
    if (!req.session.user.skin) {
        req.session.user.skin = {
            ok: true,
            species: req.body.species || 'Carnotaurus',
            female: false,
            growth: 1.0,
            colors: {},
            skin: { variation: 0, pattern: 1, theme: 0 }
        };
    }
    Object.assign(req.session.user.skin.colors, req.body.colors || req.body);
    res.json({ ok: true, message: 'Đã lưu màu skin thành công!' });
});

app.get('/api/player/garage', (req, res) => {
    if (!req.session?.user?.logged_in) {
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
});

app.get('/api/player/skin/quyen', (req, res) => {
    res.json({
        ok: true,
        mo: true,
        gioi_han_mau: false,
        tuap: true
    });
});

app.get('/api/player/skin/bang-mau', (req, res) => {
    res.json({ ok: true, mau: [] });
});

app.get('/api/player/bo-mau', (req, res) => {
    res.json({ ok: true, bo: [] });
});

app.get('/api/player/skin/kho', (req, res) => {
    res.json({ ok: true, bo: [], ca_kho: false });
});

app.get('/api/player/skin/gradient', (req, res) => {
    res.json({ ok: true, bat: false, duoc: true, bo: [] });
});

app.get('/api/player/live', (req, res) => {
    if (!req.session?.user?.logged_in) {
        return res.status(401).json({ ok: false, err: 'chua_dang_nhap' });
    }
    res.json({
        ok: true,
        song: {
            in_game: true,
            species: 'Carnotaurus',
            gender: 'male',
            growth: 1.0,
            health: 1.0,
            stamina: 1.0,
            hunger: 0.95,
            thirst: 0.9,
            dot_bien: [],
            prime: 10,
            prime_dat: 5,
            prime_eligible: true
        },
        caps: {
            prime_conditions: true
        }
    });
});

app.get('/api/player/map', (req, res) => {
    if (!req.session?.user?.logged_in) {
        return res.status(401).json({ ok: false, err: 'chua_dang_nhap' });
    }
    res.json({
        ok: true,
        in_game: true,
        lat: -100,
        lng: 150,
        age_s: 10,
        stale: false,
        tick_s: 15
    });
});

// ── 5.1 Các API Ủng hộ / Donate (Techcombank - DANG THI LAM) ──────────────────
const donateBankInfo = {
    ten: 'Techcombank',
    bin: '970407',
    so: '1903 3228 2290 12',
    so_raw: '19033228229012',
    chu: 'DANG THI LAM'
};

const activeDonations = new Map();

app.get('/api/donate.json', (req, res) => {
    const jsonPath = path.join(webDir, 'api', 'donate.json');
    if (fs.existsSync(jsonPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            data.nganHang = {
                ten: donateBankInfo.ten,
                bin: donateBankInfo.bin,
                so: donateBankInfo.so,
                chu: donateBankInfo.chu
            };
            return res.json(data);
        } catch (e) {
            console.error('Lỗi đọc donate.json:', e);
        }
    }
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
});

app.post('/api/donate/tao', (req, res) => {
    const { so_tien, loi_nhan, an_danh, dong_y_dieu_khoan, cho_ky } = req.body || {};
    if (!dong_y_dieu_khoan) {
        return res.status(400).json({ ok: false, err: 'chua_dong_y_dieu_khoan' });
    }

    const code = 'RV' + Math.floor(100000 + Math.random() * 900000);
    const amount = Number(so_tien) || 0;

    let qrUrl = `https://img.vietqr.io/image/${donateBankInfo.bin}-${donateBankInfo.so_raw}-compact2.png?addInfo=${encodeURIComponent(code)}&accountName=${encodeURIComponent(donateBankInfo.chu)}`;
    if (amount > 0) {
        qrUrl += `&amount=${amount}`;
    }

    const donationRecord = {
        ma: code,
        soTien: amount,
        loiNhan: loi_nhan || '',
        anDanh: !!an_danh,
        choKy: cho_ky || 'sau',
        taoLuc: Date.now(),
        daNhan: false
    };
    activeDonations.set(code, donationRecord);

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
});

app.get('/api/donate/trang-thai/:ma', (req, res) => {
    const ma = req.params.ma;
    const item = activeDonations.get(ma);
    if (item && item.daNhan) {
        return res.json({
            ok: true,
            daNhan: true,
            ma: item.ma,
            soTien: item.soTien
        });
    }
    res.json({
        ok: true,
        daNhan: false,
        ma: ma
    });
});

app.get('/api/donate/cua-toi', (req, res) => {
    res.json({
        ok: true,
        co: false
    });
});

// ── 6. Tự động tải & cache các file 3D Model và Thư viện Three.js ─────────────
app.use(async (req, res, next) => {
    if (req.path.startsWith('/assets/vendor/three') || req.path.startsWith('/assets/dino/')) {
        const localPath = path.join(webDir, req.path);
        if (fs.existsSync(localPath)) {
            return next();
        }
        try {
            const remoteUrl = `https://dino4vn.com${req.path}`;
            const remoteRes = await fetch(remoteUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (remoteRes.ok) {
                const buffer = Buffer.from(await remoteRes.arrayBuffer());
                fs.mkdirSync(path.dirname(localPath), { recursive: true });
                fs.writeFileSync(localPath, buffer);
                const contentType = remoteRes.headers.get('content-type');
                if (contentType) res.setHeader('Content-Type', contentType);
                return res.send(buffer);
            }
        } catch (e) {
            console.warn('Proxy asset error:', e.message);
        }
    }
    next();
});

// ── 7. Phục vụ các file tĩnh trong dino4vn.com ───────────────────────────────
app.use(express.static(webDir, { extensions: ['html', 'htm'] }));

// Fallback: Nếu truy cập thư mục gốc không có file, gửi index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(webDir, 'index.html'));
});

// ── 8. Tự động đồng bộ số liệu người chơi & BXH từ SequenceMods ────────────────
async function syncSequenceMods() {
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        let status_raw = { ok: true, server: 'Rong Viet', online: true };
        try {
            const r = await fetch('https://rongviet.sequencemods.com/api/status', { headers, signal: AbortSignal.timeout(6000) });
            if (r.ok) status_raw = await r.json();
        } catch (e) {}

        const species_counts = {};
        try {
            const r = await fetch('https://rongviet.sequencemods.com/api/killfeed?limit=50', { headers, signal: AbortSignal.timeout(6000) });
            if (r.ok) {
                const kf = await r.json();
                const ignore = new Set(['Deer', 'Boar', 'Rabbit', 'Goat', 'Frog', 'Fish', '']);
                for (const row of (kf.rows || [])) {
                    if (row.victim_species && !ignore.has(row.victim_species)) species_counts[row.victim_species] = (species_counts[row.victim_species] || 0) + 1;
                    if (row.killer_species && !ignore.has(row.killer_species)) species_counts[row.killer_species] = (species_counts[row.killer_species] || 0) + 1;
                }
            }
        } catch (e) {}

        const default_species = { 'Tyrannosaurus': 15, 'Troodon': 10, 'Spino': 9, 'Giga': 6, 'Deinosuchus': 4, 'Triceratops': 4, 'Pteranodon': 3, 'Dilophosaurus': 3, 'Allosaurus': 2, 'Carnotaurus': 2, 'Ceratosaurus': 2, 'Stegosaurus': 1 };
        const species_live = Object.keys(species_counts).length > 0 ? species_counts : default_species;
        const top_species = Object.entries(species_live).sort((a, b) => b[1] - a[1]);
        let calculated_players = Object.values(species_live).reduce((a, b) => a + b, 0);
        if (calculated_players > 200) calculated_players = 200;

        const status_payload = {
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

        const destApi = path.join(webDir, 'api');
        fs.mkdirSync(destApi, { recursive: true });
        fs.writeFileSync(path.join(destApi, 'status.json'), JSON.stringify(status_payload, null, 2));
    } catch (err) {
        // silent
    }
}
syncSequenceMods();
setInterval(syncSequenceMods, 30000);

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Web Server Dino4VN & Steam Login đang chạy tại:`);
    console.log(` http://localhost:${PORT}`);
    console.log(`=======================================================`);
});


