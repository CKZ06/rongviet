/**
 * Garage Persistence Store
 * Quản lý lưu trữ và nạp/rút khủng long trong gara của người chơi theo SteamID
 */

const fs = require('fs');
const path = require('path');
const skinStore = require('./skinStore');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GARAGE_FILE = path.join(DATA_DIR, 'player_garage.json');

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAllGarage() {
    try {
        if (fs.existsSync(GARAGE_FILE)) {
            return JSON.parse(fs.readFileSync(GARAGE_FILE, 'utf8'));
        }
    } catch (e) {
        console.warn('Lỗi đọc player_garage.json:', e.message);
    }
    return {};
}

function writeAllGarage(data) {
    try {
        fs.writeFileSync(GARAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Lỗi ghi player_garage.json:', e.message);
    }
}

/**
 * Lấy danh sách ô gara của một người chơi
 */
function getGarage(steamId) {
    if (!steamId) return { ok: false, quota: 3, slots: [] };
    const all = readAllGarage();
    const userGarage = all[steamId] || { quota: 3, slots: [] };
    const quota = typeof userGarage.quota === 'number' ? userGarage.quota : 3;
    const rawSlots = Array.isArray(userGarage.slots) ? userGarage.slots : [];

    const slots = rawSlots.map((s, idx) => {
        const species = skinStore.normalizeSpecies(s.species || 'Spinosaurus');
        const savedSkin = skinStore.getSkin(steamId, species) || {};
        const colors = (s.colors && Object.keys(s.colors).length) ? { ...s.colors } : { ...(savedSkin.colors || {}) };
        if (colors.markings && !colors.pattern) colors.pattern = colors.markings;
        if (colors.pattern && !colors.markings) colors.markings = colors.pattern;

        return {
            ok: true,
            slot: s.slot || (idx + 1),
            species: species,
            female: !!s.female,
            growth: typeof s.growth === 'number' ? s.growth : 1.0,
            colors: colors,
            skin: s.skin || savedSkin.skin || { variation: 0, pattern: 1, theme: 0 },
            vitals: s.vitals || { health: 100, stamina: 100, hunger: 100, thirst: 100 },
            vitals_max: s.vitals_max || { health: 100, stamina: 100, hunger: 100, thirst: 100 },
            dot_bien: s.dot_bien || [],
            elder_stacks: s.elder_stacks || 0,
            stored_at: s.stored_at || Math.floor(Date.now() / 1000),
            cho_cat: s.cho_cat || { ten: "Rừng mưa nhiệt đới", km: 0 }
        };
    });

    slots.sort((a, b) => a.slot - b.slot);

    return {
        ok: true,
        quota: quota,
        slots: slots
    };
}

/**
 * Cất một con khủng long vào ô gara
 */
function storeDino(steamId, slotNumber, dinoData) {
    if (!steamId) return { ok: false, res: 'chua_dang_nhap' };
    const all = readAllGarage();
    if (!all[steamId]) {
        all[steamId] = { quota: 3, slots: [] };
    }

    const quota = typeof all[steamId].quota === 'number' ? all[steamId].quota : 3;
    const targetSlot = parseInt(slotNumber, 10) || 1;

    if (targetSlot > quota) {
        return { ok: false, res: `Ô ${targetSlot} vượt quá hạn mức ${quota} ô của bạn.` };
    }

    const species = skinStore.normalizeSpecies(dinoData.species || 'Spinosaurus');
    const savedSkin = skinStore.getSkin(steamId, species) || {};
    const colors = (dinoData.colors && Object.keys(dinoData.colors).length) ? { ...dinoData.colors } : { ...(savedSkin.colors || {}) };
    if (colors.markings && !colors.pattern) colors.pattern = colors.markings;
    if (colors.pattern && !colors.markings) colors.markings = colors.pattern;

    const newDino = {
        slot: targetSlot,
        species: species,
        female: !!dinoData.female,
        growth: typeof dinoData.growth === 'number' ? dinoData.growth : 1.0,
        colors: colors,
        skin: dinoData.skin || savedSkin.skin || { variation: 0, pattern: 1, theme: 0 },
        vitals: dinoData.vitals || { health: 100, stamina: 100, hunger: 100, thirst: 100 },
        vitals_max: dinoData.vitals_max || { health: 100, stamina: 100, hunger: 100, thirst: 100 },
        dot_bien: dinoData.dot_bien || [],
        elder_stacks: dinoData.elder_stacks || 0,
        stored_at: Math.floor(Date.now() / 1000),
        cho_cat: { ten: "Khu bảo tồn Gateway", km: 0 }
    };

    // Thay thế ô cũ nếu đã có hoặc thêm mới
    const slots = all[steamId].slots || [];
    const existingIndex = slots.findIndex(s => s.slot === targetSlot);
    if (existingIndex >= 0) {
        slots[existingIndex] = newDino;
    } else {
        slots.push(newDino);
    }

    all[steamId].slots = slots;
    writeAllGarage(all);

    return {
        ok: true,
        slot: targetSlot,
        cho: 10,
        di_xa_m: 3
    };
}

/**
 * Lấy ra một con khủng long từ gara
 */
function loadDino(steamId, slotNumber) {
    if (!steamId) return { ok: false, res: 'chua_dang_nhap' };
    const all = readAllGarage();
    const userGarage = all[steamId] || { quota: 3, slots: [] };
    const targetSlot = parseInt(slotNumber, 10);
    const slots = userGarage.slots || [];
    const dino = slots.find(s => s.slot === targetSlot);

    if (!dino) {
        return { ok: false, res: `Ô ${targetSlot} hiện không có khủng long nào.` };
    }

    return {
        ok: true,
        slot: targetSlot,
        cho_lay_s: 15,
        di_xa_m: 3,
        noi_hien: "cho_cat"
    };
}

/**
 * Xóa một ô khủng long khỏi gara
 */
function deleteDino(steamId, slotNumber) {
    if (!steamId) return { ok: false, da_xoa: false, cau: 'Chưa đăng nhập.' };
    const all = readAllGarage();
    if (!all[steamId] || !Array.isArray(all[steamId].slots)) {
        return { ok: true, da_xoa: true, cau: `Đã xoá ô ${slotNumber}.` };
    }

    const targetSlot = parseInt(slotNumber, 10);
    all[steamId].slots = all[steamId].slots.filter(s => s.slot !== targetSlot);
    writeAllGarage(all);

    return {
        ok: true,
        da_xoa: true,
        cau: `Đã xoá ô ${targetSlot}.`
    };
}

module.exports = {
    getGarage,
    storeDino,
    loadDino,
    deleteDino
};

