/**
 * Web Server Dino4VN & Steam Login (Pure Node.js - Zero External Dependencies)
 * Chạy trực tiếp trên mọi phiên bản Node.js mà không cần cài đặt node_modules/express.
 */

const http = require('http');
const fs = require('fs');
<<<<<<< Updated upstream
const dotenv = require('dotenv');
=======
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const islepilot = require('./services/islepilot');
const skinStore = require('./services/skinStore');
const garageStore = require('./services/garageStore');
>>>>>>> Stashed changes

const PORT = parseInt(process.env.PORT || '3000', 10);
const webDir = path.join(__dirname, 'dino4vn.com');

// Simple Session Storage in memory
const sessions = new Map();

function parseCookies(req) {
    const list = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
        });
    }
    return list;
}

function getSession(req, res) {
    const cookies = parseCookies(req);
    let sid = cookies['connect.sid'];
    if (!sid || !sessions.has(sid)) {
        sid = crypto.randomBytes(16).toString('hex');
        sessions.set(sid, {});
    }
    res.setHeader('Set-Cookie', `connect.sid=${sid}; Path=/; HttpOnly; Max-Age=${30 * 24 * 3600}`);
    return sessions.get(sid);
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.mp3': 'audio/mpeg',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.webmanifest': 'application/manifest+json'
};

function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}

function sendFile(res, filePath) {
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('File Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
    });
    fs.createReadStream(filePath).pipe(res);
}

function getBaseUrl(req, port) {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${port}`;
    return `${proto}://${host}`;
}

async function handleRequest(req, res, currentPort) {
    const parsed = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsed.pathname || '/');
    const session = getSession(req, res);

    // Đọc body nếu là POST / PUT
    let bodyText = '';
    if (req.method === 'POST' || req.method === 'PUT') {
        bodyText = await new Promise(resolve => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => resolve(data));
        });
    }
    let bodyJson = {};
    try {
        if (bodyText) bodyJson = JSON.parse(bodyText);
    } catch (e) {}

    // ── 1. Đăng nhập Steam ───────────────────────────────────────────────────
    if (pathname === '/api/auth/steam' || pathname === '/dang-nhap') {
        const returnTo = parsed.query.return || parsed.query.ve || '/';
        session.returnTo = returnTo;
        const baseUrl = getBaseUrl(req, currentPort);
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
        res.writeHead(302, { 'Location': `https://steamcommunity.com/openid/login?${openidParams.toString()}` });
        return res.end();
    }

    // ── 2. Xử lý phản hồi từ Steam (Callback) ────────────────────────────────
    if (pathname === '/api/auth/steam/return') {
        try {
            const query = parsed.query;
            if (!query || !query['openid.mode']) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('Phản hồi không hợp lệ từ Steam.');
            }
            if (query['openid.mode'] === 'cancel') {
                const returnTo = session.returnTo || '/';
                delete session.returnTo;
                res.writeHead(302, { 'Location': returnTo });
                return res.end();
            }

            const claimedId = query['openid.claimed_id'] || query['openid.identity'] || '';
            const match = claimedId.match(/\/id\/(\d+)/);
            if (!match) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('Không tìm thấy SteamID hợp lệ.');
            }
            const steamId = match[1];

            let name = `Steam ...${steamId.slice(-4)}`;
            let avatar = '';
            let profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
            let country = '';

            try {
                const xmlRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                if (xmlRes.ok) {
                    const xmlText = await xmlRes.text();
                    const nameM = xmlText.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
                    const avM = xmlText.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
                    const locM = xmlText.match(/<location><!\[CDATA\[(.*?)\]\]><\/location>/);
                    if (nameM && nameM[1]) name = nameM[1];
                    if (avM && avM[1]) avatar = avM[1];
                    if (locM && locM[1]) country = locM[1];
                }
            } catch (err) {}

<<<<<<< Updated upstream
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
=======
            session.user = {
                logged_in: true,
                steamid: steamId,
                name: name,
                avatar: avatar,
                profileurl: profileUrl,
                country: country
>>>>>>> Stashed changes
            };

            const returnTo = session.returnTo || '/me.html';
            delete session.returnTo;
            res.writeHead(302, { 'Location': returnTo });
            return res.end();
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Lỗi xác thực Steam: ' + err.message);
        }
    }

    // ── 3. API Player Info ───────────────────────────────────────────────────
    if (pathname === '/api/player/me') {
        if (session && session.user && session.user.logged_in) {
            return sendJson(res, 200, session.user);
        }
        return sendJson(res, 200, { logged_in: false });
    }

    if (pathname === '/api/player/logout') {
        if (session) {
            session.user = null;
        }
        return sendJson(res, 200, { ok: true });
    }

    // ── 4. API Skin & Khủng long ─────────────────────────────────────────────
    if (pathname === '/api/player/skin') {
        const steamId = session?.user?.steamid || '76561199805093098'; // fallback steamid
        const live = await islepilot.getLivePlayer(steamId);
        const species = live?.song?.species || 'Spinosaurus';

        if (req.method === 'POST') {
            skinStore.saveSkin(steamId, bodyJson.species || species, {
                colors: bodyJson.colors || bodyJson,
                skin: bodyJson.skin || { variation: bodyJson.variation, pattern: bodyJson.pattern, theme: bodyJson.theme }
            });
            return sendJson(res, 200, { ok: true, message: 'Đã lưu màu skin thành công!' });
        }

        const savedSkin = skinStore.getSkin(steamId, species) || {};
        return sendJson(res, 200, {
            ok: true,
            species: species,
            female: live?.song?.gender === 'female',
            growth: live?.song?.growth || 1.0,
            colors: savedSkin.colors || {},
            skin: savedSkin.skin || { variation: 0, pattern: 1, theme: 0 }
        });
    }

    if (pathname === '/api/player/garage') {
        const steamId = session?.user?.steamid || '76561199805093098';
        const data = await islepilot.getPlayerGarage(steamId);
        return sendJson(res, 200, data);
    }

    const garaSlotMatch = pathname.match(/^\/api\/player\/garage\/(\d+)$/);
    if (garaSlotMatch) {
        const steamId = session?.user?.steamid || '76561199805093098';
        const targetSlot = parseInt(garaSlotMatch[1], 10);
        const data = await islepilot.getPlayerGarage(steamId);
        const dino = (data.slots || []).find(s => s.slot === targetSlot);
        if (dino) {
            return sendJson(res, 200, { ok: true, dino: dino });
        }
        return sendJson(res, 404, { ok: false, err: 'khong_tim_thay_o' });
    }

    if (pathname === '/api/player/garage/store') {
        const steamId = session?.user?.steamid || '76561199805093098';
        const targetSlot = bodyJson.slot || 1;
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
        return sendJson(res, 200, result);
    }

    if (pathname === '/api/player/garage/load') {
        const steamId = session?.user?.steamid || '76561199805093098';
        const targetSlot = bodyJson.slot || 1;
        const result = garageStore.loadDino(steamId, targetSlot);
        return sendJson(res, 200, result);
    }

    if (pathname === '/api/player/garage/delete') {
        const steamId = session?.user?.steamid || '76561199805093098';
        const targetSlot = bodyJson.slot || 1;
        const result = garageStore.deleteDino(steamId, targetSlot);
        return sendJson(res, 200, result);
    }

    if (pathname === '/api/player/kill') {
        return sendJson(res, 200, { ok: true, cho: 10, di_xa_m: 3 });
    }

    if (pathname === '/api/player/kill/huy') {
        return sendJson(res, 200, { ok: true, res: "Đã huỷ lệnh thành công." });
    }

    if (pathname === '/api/player/live') {
        const steamId = session?.user?.steamid || '76561199805093098';
        const data = await islepilot.getLivePlayer(steamId);
        return sendJson(res, 200, data);
    }

    if (pathname === '/api/player/map') {
        const steamId = session?.user?.steamid || '76561199805093098';
        const data = await islepilot.getPlayerMap(steamId);
        return sendJson(res, 200, data);
    }

    if (pathname === '/api/player/skin/quyen') {
        return sendJson(res, 200, { ok: true, mo: true, gioi_han_mau: false, tuap: true });
    }
    if (pathname === '/api/player/skin/bang-mau') return sendJson(res, 200, { ok: true, mau: [] });
    if (pathname === '/api/player/bo-mau') return sendJson(res, 200, { ok: true, bo: [] });
    if (pathname === '/api/player/skin/kho') return sendJson(res, 200, { ok: true, bo: [], ca_kho: false });
    if (pathname === '/api/player/skin/gradient') return sendJson(res, 200, { ok: true, bat: false, duoc: true, bo: [] });

    // ── 5. Status & Leaderboard ──────────────────────────────────────────────
    if (pathname === '/api/status' || pathname === '/api/status.json') {
        const data = await islepilot.getRealStatus();
        return sendJson(res, 200, data);
    }

    if (pathname === '/api/bxh' || pathname === '/api/bang-xep-hang.json') {
        const data = await islepilot.getRealLeaderboard();
        return sendJson(res, 200, data);
    }

    // ── 6. Phục vụ file tĩnh ─────────────────────────────────────────────────
    let filePath = path.join(webDir, pathname);

    // Nếu vào trang chủ /
    if (pathname === '/') {
        filePath = path.join(webDir, 'index.html');
    }

    // Nếu đường dẫn không có đuôi .html
    if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return sendFile(res, filePath);
    }

    // Proxy asset 3D nếu thiếu
    if (pathname.startsWith('/assets/vendor/three') || pathname.startsWith('/assets/dino/')) {
        try {
            const remoteUrl = `https://dino4vn.com${pathname}`;
            const remoteRes = await fetch(remoteUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (remoteRes.ok) {
                const buffer = Buffer.from(await remoteRes.arrayBuffer());
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, buffer);
                const ext = path.extname(filePath).toLowerCase();
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
                return res.end(buffer);
            }
        } catch (e) {}
    }

<<<<<<< Updated upstream
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
=======
    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
}

// Đồng bộ IslePilot định kỳ
async function syncIslePilotData() {
    try {
        const [status_payload, bxh_data] = await Promise.all([
            islepilot.getRealStatus(),
            islepilot.getRealLeaderboard()
        ]);
        const destApi = path.join(webDir, 'api');
        fs.mkdirSync(destApi, { recursive: true });
        fs.writeFileSync(path.join(destApi, 'status.json'), JSON.stringify(status_payload, null, 2));
        fs.writeFileSync(path.join(destApi, 'bang-xep-hang.json'), JSON.stringify(bxh_data, null, 2));
    } catch (err) {}
>>>>>>> Stashed changes
}
syncSequenceMods();
setInterval(syncSequenceMods, 30000);

function startServer(port) {
    const server = http.createServer((req, res) => handleRequest(req, res, port));

    server.on('error', err => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Cảnh báo] Cổng ${port} đang bận, tự động chuyển sang cổng ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('[Lỗi Server]:', err.message);
        }
    });

    server.listen(port, () => {
        console.log(`=======================================================`);
        console.log(` Web Server Dino4VN & Steam Login đang chạy tại:`);
        console.log(` http://localhost:${port}`);
        console.log(`=======================================================`);
    });
}

startServer(PORT);
