/* vaytrum.js — bảng tin trực tiếp sự kiện Vây Trùm (/event; URL cũ /vay-trum) từ /api/vay-trum.json
 *
 * Hình dạng JSON + luật công khai: `ops/daisan/bang_tin.py` (docstring). Tóm tắt:
 *   { schema, ts, dang: {…} | null, gan_nhat: {…} | null, truoc: [...], luat: {thuong_trum, thuong_taysai},
 *     sap: null | {mo_luc_ms, ten_vung} }   ← `sap` do đạo diễn ghi lúc đếm ngược báo trước (2026-09-27)
 * "Đang báo trước" dùng CÙNG luật với khối sự kiện trang chủ (`sk-luat.js`, nạp trước file này) — trang
 * chủ nói "bắt đầu sau 06:40" thì trang này không được nói "không có đợt nào".
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 BỐN ĐIỀU KHÔNG ĐƯỢC PHÁ
 * ════════════════════════════════════════════════════════════════════════
 * 1. `textContent`, KHÔNG BAO GIỜ `innerHTML`. Tên người chơi do người lạ đặt; câu "Diễn biến" ghép tên đó.
 * 2. `null` KHÁC `0`: máu trùm / số tay sai / số người trong vùng không đọc được thì hiện "—", không 0.
 * 3. Không đụng `.style` (CSP `style-src 'self'`): thanh máu là thuộc tính `width` của <rect>.
 * 4. Số cũ thì nói là cũ, đừng giả vờ đang sống. `ts` là giờ MÁY CHỦ ghi file; giờ "bây giờ" lấy theo header
 *    `Date` của chính lần tải (máy người xem có thể lệch vài phút). Đợt đang chạy mà file đứng im quá
 *    `BO_DANG` thì coi như đợt đã dừng — người dẫn chết giữa chừng để lại một `dang` mồ côi.
 *
 * Nhịp: đợt đang chạy hoặc đang báo trước 5 s (máy chủ ghi 3–15 s một lần), không có đợt 60 s (để thấy đợt
 * mới mở). Tab ẩn thì thôi hỏi.
 */
(() => {
  'use strict';

  const API = '/api/vay-trum.json';
  const NHIP_SONG = 5000;
  const NHIP_RANH = 60000;
  const CU = 45000;          // đợt đang chạy: quá ngần này không có bản mới ⇒ nói là số đã cũ
  const BO_DANG = 600000;    // quá ngần này ⇒ coi đợt đã dừng (không còn ai ghi)
  const CHO = 8000;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const $ = (id) => document.getElementById(id);
  const tt = $('vt-tt');
  if (!tt) return;

  let lech = 0;              // giờ máy chủ − giờ máy người xem (ms), đo bằng header Date
  let dulieu = null;
  let lanTai = 0;
  let hen = null;

  const bayGio = () => Date.now() + lech;
  /* `sap` còn hiệu lực theo luật chung (sk-luat.js). File đó không nạp được ⇒ coi như không báo trước. */
  const L = window.dino4vnSK;
  const dangBao = (d) => !!(L && d && !d.khongCo && L.trangThai(null, d, bayGio()) === 'bao');

  let hhmm, hhmmss, ngay;
  try {
    const tz = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
    const f1 = new Intl.DateTimeFormat('vi-VN', { ...tz, hour: '2-digit', minute: '2-digit' });
    const f2 = new Intl.DateTimeFormat('vi-VN', { ...tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const f3 = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'numeric' });
    hhmm = (t) => f1.format(new Date(t));
    hhmmss = (t) => f2.format(new Date(t));
    ngay = (t) => f3.format(new Date(t));
  } catch {
    hhmm = (t) => new Date(t).toISOString().slice(11, 16);
    hhmmss = (t) => new Date(t).toISOString().slice(11, 19);
    ngay = (t) => new Date(t).toISOString().slice(5, 10);
  }

  const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
  const so = (n, le = 0) => Number(n).toLocaleString('vi-VN', {
    minimumFractionDigits: le, maximumFractionDigits: le,
  });
  const soHoac = (v) => (laSo(v) ? so(v) : '—');

  const tao = (tag, cls, chu) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  };
  const dat = (el, chu) => { if (el) el.textContent = chu; };

  function thoiLuong(ms) {
    const phut = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(phut / 60), m = phut % 60;
    return h ? `${h} giờ ${m} phút` : `${m} phút`;
  }

  function demNguoc(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), g = s % 60;
    const hai = (x) => String(x).padStart(2, '0');
    return h ? `${h}:${hai(m)}:${hai(g)}` : `${hai(m)}:${hai(g)}`;
  }

  /* ── tải ─────────────────────────────────────────────────────────────── */
  async function tai() {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), CHO);
    try {
      const r = await fetch(API, { signal: bo.signal, cache: 'no-cache', credentials: 'same-origin' });
      const d = Date.parse(r.headers.get('Date') || '');
      if (Number.isFinite(d) && Math.abs(d - Date.now()) < 86400000) lech = d - Date.now();
      if (r.status === 404) return { khongCo: true };
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!j || j.schema !== 1) throw new Error('schema');
      return j;
    } finally { clearTimeout(h); }
  }

  /* ── đầu trang ───────────────────────────────────────────────────────── */
  function veDau(d, dang, tuoi) {
    const song = $('vt-tong-song'), khac = $('vt-tong-khac');
    if (dang) {
      dat(tt, dang.dong_ms
        ? 'Đợt vừa đóng, đang chốt kết quả.'
        : `Đang diễn ra${dang.vung ? ` ở ${dang.vung}` : ''}.`);
      song.hidden = false; khac.hidden = true;
      dat($('vt-tg'), soHoac(dang.nguoi && dang.nguoi.tham_gia));
      dat($('vt-tv'), soHoac(dang.nguoi && dang.nguoi.trong_vung));
      veDongHo();
    } else if (dangBao(d)) {
      dat(tt, `Đợt mới mở lúc ${hhmm(d.sap.mo_luc_ms)}${d.sap.ten_vung ? ` ở ${d.sap.ten_vung}` : ''}.`);
      song.hidden = true; khac.hidden = false;
      dat(khac, 'Server đang báo trước trong game. Khi đợt mở, gõ !event trong chat game để vào.');
    } else {
      dat(tt, 'Không có đợt nào đang diễn ra.');
      song.hidden = true; khac.hidden = false;
      const g = d && d.gan_nhat;
      dat(khac, g && laSo(g.mo_ms) ? `Đợt gần nhất mở lúc ${hhmm(g.mo_ms)} ngày ${ngay(g.mo_ms)}.` : '');
    }
    /* Đang báo trước: `ts` là nhịp tim của NGƯỜI DẪN (đạo diễn ghi `sap` mà không đụng `ts` — HOP-DONG §7a), nên
       "Cập nhật lúc 13:34:11" có thể là lần ghi của hôm qua, in ngay dưới "Đợt mới mở lúc 16:40" — trông như trang
       đứng im 3 tiếng. Không in giờ nào không phản ánh `sap`; dòng vẫn có chữ (không co lại, không nhảy). */
    if (!dang && dangBao(d)) { dat($('vt-tuoi'), 'Trang tự làm mới vài giây một lần.'); return; }
    const tu = d && laSo(d.ts) ? d.ts : null;
    if (tu === null) { dat($('vt-tuoi'), ''); return; }
    if (dang && tuoi > CU) {
      dat($('vt-tuoi'), `Số liệu chưa về thêm từ ${hhmmss(tu)}, trang vẫn đang thử lại.`);
    } else {
      dat($('vt-tuoi'), dang
        ? `Cập nhật lúc ${hhmmss(tu)}, trang tự làm mới vài giây một lần.`
        : `Cập nhật lúc ${hhmmss(tu)} giờ Việt Nam.`);
    }
  }

  function veDongHo() {
    const dang = dulieu && dulieu.dangHieuLuc;
    const el = $('vt-con');
    if (!dang || !el) return;
    if (!laSo(dang.het_ms)) { dat(el, '—'); return; }
    const con = dang.het_ms - bayGio();
    dat(el, dang.dong_ms ? '00:00' : demNguoc(con));
  }

  /* ── đợt đang chạy ───────────────────────────────────────────────────── */
  function thanhMau(pct) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'vt-thanh');
    svg.setAttribute('viewBox', '0 0 100 6');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const nen = document.createElementNS(SVG_NS, 'rect');
    nen.setAttribute('class', 'vt-thanh__nen');
    nen.setAttribute('width', '100'); nen.setAttribute('height', '6');
    const day = document.createElementNS(SVG_NS, 'rect');
    day.setAttribute('class', 'vt-thanh__dat');
    day.setAttribute('width', String(Math.max(0, Math.min(100, pct || 0))));
    day.setAttribute('height', '6');
    svg.append(nen, day);
    return svg;
  }

  function veTrum(dang) {
    const ds = $('vt-trum-ds');
    const trum = Array.isArray(dang.trum) ? dang.trum : [];
    const dong = [];
    if (!trum.length) {
      dong.push(tao('p', 'vt-trum__so dim', dang.trum_guc ? 'Trùm đã gục.' : 'Trùm chưa xuất hiện.'));
    }
    trum.forEach((t, i) => {
      const k = tao('div', 'vt-trum__dong');
      const p = tao('p', 'vt-trum__so');
      if (trum.length > 1) p.append(tao('span', 'vt-trum__nhan', `Trùm ${i + 1}`));
      if (t.song === false) {
        p.append(tao('span', 'vt-trum__pct', 'Đã gục'));
        k.append(p, thanhMau(0));
      } else if (laSo(t.mau_pct)) {
        p.append(tao('span', 'vt-trum__pct', `${so(t.mau_pct, 1)}%`), document.createTextNode(' máu còn lại'));
        k.append(p, thanhMau(t.mau_pct));
        k.setAttribute('aria-label', `Trùm còn ${so(t.mau_pct, 1)} phần trăm máu`);
      } else {
        p.append(tao('span', 'vt-trum__pct', '—'), document.createTextNode(' chưa đọc được máu'));
        k.append(p);
      }
      dong.push(k);
    });
    ds.replaceChildren(...dong);

    const ts = dang.tay_sai || {};
    let phu = '';
    if (laSo(ts.song) && laSo(ts.da_xuat_hien)) {
      const ha = Math.max(0, ts.da_xuat_hien - ts.song);
      phu = `Tay sai: ${so(ts.song)} còn sống, ${so(ha)} đã bị hạ.`;
    } else if (laSo(ts.song)) {
      phu = `Tay sai: ${so(ts.song)} còn sống.`;
    } else {
      phu = 'Chưa đọc được số tay sai.';
    }
    dat($('vt-trum-phu'), phu);
  }

  function hangBang(than, ds, cot, trong) {
    if (!ds.length) {
      const tr = tao('tr');
      const td = tao('td', 'dim', trong);
      td.colSpan = cot.length;
      tr.append(td);
      than.replaceChildren(tr);
      return;
    }
    than.replaceChildren(...ds.map((r) => {
      const tr = tao('tr');
      cot.forEach(([nhan, cls, lay]) => {
        const td = tao('td', cls, lay(r));
        td.setAttribute('data-nhan', nhan);
        tr.append(td);
      });
      return tr;
    }));
  }

  function veTop(dang) {
    hangBang($('vt-top'), Array.isArray(dang.top) ? dang.top : [], [
      ['Hạng', 'bxh__hang', (r) => `#${r.hang}`],
      ['Người chơi', 'bxh__ten', (r) => r.ten || 'Một chiến binh'],
      ['Khủng long', '', (r) => r.loai || '—'],
      ['Sát thương', 'bxh__diem so', (r) => soHoac(r.sat_thuong)],
      ['Cú đánh', 'so', (r) => soHoac(r.cu)],
    ], 'Chưa ai gây sát thương.');
  }

  function veTin(dang) {
    const ol = $('vt-tin');
    const tin = Array.isArray(dang.tin) ? dang.tin : [];
    if (!tin.length) {
      ol.replaceChildren(tao('li', 'dim', 'Chưa có thông báo nào trong đợt này.'));
      return;
    }
    ol.replaceChildren(...tin.map((x) => {
      const li = tao('li');
      li.append(tao('span', 'vt-tin__gio', laSo(x.t) ? hhmm(x.t) : ''), tao('span', '', x.cau || ''));
      return li;
    }));
  }

  /* ── kết quả ─────────────────────────────────────────────────────────── */
  function veKet(g) {
    dat($('vt-ket-td'), laSo(g.mo_ms)
      ? `Kết quả đợt lúc ${hhmm(g.mo_ms)} ngày ${ngay(g.mo_ms)}` : 'Kết quả đợt gần nhất');
    const dai = laSo(g.mo_ms) && laSo(g.dong_ms) && g.dong_ms > g.mo_ms ? thoiLuong(g.dong_ms - g.mo_ms) : null;
    const dau = g.ket === 'guc'
      ? `Trùm T-Rex đã gục${dai ? ` sau ${dai}` : ''}${g.vung ? ` ở ${g.vung}` : ''}.`
      /* `rut_lui` gồm cả hết giờ LẪN đợt dừng sớm (người dẫn không phân biệt được) ⇒ không nói "hết giờ". */
      : `Trùm T-Rex đã rút lui${dai ? ` sau ${dai}` : ''}${g.vung ? ` khỏi ${g.vung}` : ''}.`;
    const them = [];
    if (laSo(g.so_nguoi)) them.push(`${so(g.so_nguoi)} người tham gia`);
    if (laSo(g.tay_sai_ha)) them.push(`${so(g.tay_sai_ha)} tay sai bị hạ`);
    dat($('vt-ket-tom'), them.length ? `${dau} ${them.join(', ')}.` : dau);

    const kl = g.ket_lieu;
    dat($('vt-g-kl'), kl && kl.ten
      ? `${kl.ten}${kl.loai ? ` (${kl.loai})` : ''}`
      : (g.ket === 'guc' ? 'Không xác định được' : 'Không ai, trùm đã rút lui'));
    const dn = g.dame_nhat;
    dat($('vt-g-dn'), dn && dn.ten
      ? `${dn.ten}${laSo(dn.sat_thuong) ? `, ${so(dn.sat_thuong)} máu` : ''}` : 'Chưa ai gây sát thương');
    const mm = g.may_man;
    dat($('vt-g-mm'), mm && mm.ten ? mm.ten : 'Không có ai đủ điều kiện');

    hangBang($('vt-bang'), Array.isArray(g.bang) ? g.bang : [], [
      ['Hạng', 'bxh__hang', (r) => `#${r.hang}`],
      ['Người chơi', 'bxh__ten', (r) => r.ten || 'Một chiến binh'],
      ['Khủng long', '', (r) => r.loai || '—'],
      ['Sát thương', 'so', (r) => soHoac(r.sat_thuong)],
      ['Điểm', 'bxh__diem so', (r) => soHoac(r.diem)],
    ], 'Không ai ghi điểm trong đợt này.');
  }

  function tomTat(g) {
    const b = Array.isArray(g.bang) && g.bang[0];
    return {
      mo_ms: g.mo_ms, ket: g.ket,
      ket_lieu: g.ket_lieu && g.ket_lieu.ten, dau_bang: b && b.ten, so_nguoi: g.so_nguoi,
    };
  }

  function veTruoc(d, dang) {
    const ds = [];
    if (dang && d.gan_nhat) ds.push(tomTat(d.gan_nhat));
    (Array.isArray(d.truoc) ? d.truoc : []).forEach((x) => { if (x) ds.push(x); });
    $('vt-truoc-khoi').hidden = !ds.length;
    hangBang($('vt-truoc'), ds, [
      ['Lúc mở', 'so', (r) => (laSo(r.mo_ms) ? `${hhmm(r.mo_ms)} ngày ${ngay(r.mo_ms)}` : '—')],
      ['Kết quả', '', (r) => (r.ket === 'guc' ? 'Trùm gục' : 'Trùm rút lui')],
      ['Hạ đòn cuối', 'bxh__ten', (r) => r.ket_lieu || '—'],
      ['Dẫn đầu bảng điểm', '', (r) => r.dau_bang || '—'],
      ['Người tham gia', 'so', (r) => soHoac(r.so_nguoi)],
    ], '');
  }

  /* ── ghép ────────────────────────────────────────────────────────────── */
  function ve(d) {
    const tuoi = d && laSo(d.ts) ? bayGio() - d.ts : Infinity;
    const dang = d && d.dang && tuoi <= BO_DANG ? d.dang : null;
    dulieu = { goc: d, dangHieuLuc: dang };
    veDau(d, dang, tuoi);

    $('vt-song').hidden = !dang;
    $('vt-ket').hidden = !!dang || !(d && d.gan_nhat);
    $('vt-chua').hidden = !!dang || !!(d && d.gan_nhat);
    if (dang) { veTrum(dang); veTop(dang); veTin(dang); }
    if (!dang && d && d.gan_nhat) veKet(d.gan_nhat);
    if (d) veTruoc(d, dang); else $('vt-truoc-khoi').hidden = true;

    const l = d && d.luat;
    if (l && laSo(l.thuong_trum)) dat($('vt-l-trum'), so(l.thuong_trum));
    if (l && laSo(l.thuong_taysai)) dat($('vt-l-ts'), so(l.thuong_taysai));
  }

  async function vong() {
    clearTimeout(hen);
    let dang = false;
    try {
      const d = await tai();
      lanTai = Date.now();
      if (d.khongCo) {
        ve(null);
      } else {
        ve(d);
        dang = !!(dulieu && dulieu.dangHieuLuc) || dangBao(d);
      }
    } catch {
      /* Mất mạng / máy chủ chưa trả lời: GIỮ bản đang hiện, chỉ nói là chưa tải được. */
      if (dulieu && dulieu.goc) {
        dang = !!dulieu.dangHieuLuc;
        dat($('vt-tuoi'), 'Chưa tải được số liệu mới, đang thử lại.');
      } else {
        dat(tt, 'Chưa tải được số liệu, đang thử lại.');
        dat($('vt-tuoi'), '');
      }
    }
    hen = setTimeout(() => { if (!document.hidden) vong(); }, dang ? NHIP_SONG : NHIP_RANH);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const nhip = dulieu && (dulieu.dangHieuLuc || dangBao(dulieu.goc)) ? NHIP_SONG : NHIP_RANH;
    if (Date.now() - lanTai >= nhip) vong();
    else { clearTimeout(hen); hen = setTimeout(vong, nhip - (Date.now() - lanTai)); }
  });
  /* Đồng hồ đếm ngược đổi mỗi giây — đó là dữ liệu đổi, không phải hiệu ứng. */
  setInterval(() => { if (!document.hidden) veDongHo(); }, 1000);
  vong();
})();
