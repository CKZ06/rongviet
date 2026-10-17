const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'dino4vn_steam_auth_secret_key_2026';

function sign(payload) {
    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function verify(token) {
    if (!token || typeof token !== 'string') return null;
    const idx = token.lastIndexOf('.');
    if (idx === -1) return null;
    const data = token.substring(0, idx);
    const sig = token.substring(idx + 1);
    const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
        return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

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

function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000';
    return `${proto}://${host}`;
}

module.exports = {
    sign,
    verify,
    parseCookies,
    getBaseUrl
};
