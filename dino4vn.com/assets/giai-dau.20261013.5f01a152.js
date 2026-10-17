/* giai-dau.js — trang /giai-dau (giải 5-5: Dilophosaurus 2026-10-03 · T-Rex 2026-10-04), đọc MỘT tệp /api/giai-dau.json.
 *
 * Tệp do panel ghi (tab "Giải đấu" → /var/lib/dino4vn-pub/giai-dau.json), Caddy phục vụ thẳng. Hình dạng —
 * đổi tên trường là hỏng IM LẶNG, panel và trang phải đổi cùng lúc:
 *   { v: 1, ts: <ms lần ghi cuối>,
 *     giai: { ten, trang_thai: "dang_ky" | "da_boc" | "dang_dau" | "xong",
 *             mo_luc, dong_dang_ky,                      // ISO có +07:00, hoặc null
 *             luat,                                      // chữ thường, có xuống dòng
 *             thong_so: { loai, growth (0..1), prime, dot_bien: [tên], co_doi, tran_phut, toi_da },
 *             server: { ten, huong_dan } },
 *     doi: [ { id, ten, mau, ten_mau, thanh_vien: [tên], bi_loai, ly_do_loai } ],   // [] cho tới lúc công bố bốc thăm
 *     so_do: { vong: [ { ten, tran: [ { id, a, b, thang, trang_thai: "cho" | "dang" | "xong", ghi_chu } ] } ] },
 *     tran_dang: null | { id, con_lai_s, song: { <id đội>: n }, mau_pct: { <id đội>: 0..100 }, tru_mau } }
 * Bản mẫu để xem thử: `web/mau/giai-dau.mau.json` (chép vào `web/dist/api/giai-dau.json`, xem web/README.md).
 *
 * Luật đọc (panel xác nhận 2026-10-03):
 *   - Panel dựng sẵn MỌI ô sơ đồ lúc bốc thăm (tk1..tk4, bk1..bk2, ck1). bk1 = thắng tk1 gặp thắng tk2,
 *     bk2 = tk3/tk4, ck1 = bk1/bk2, theo thứ tự mảng. Ô vòng sau chưa rõ đội: a/b null + "cho".
 *   - Miễn đấu: b null + "xong" + thang = a (ghi_chu "Miễn đấu"). Ô a, b đều null + "xong" = không có trận.
 *   - `mau_pct` = máu trung bình của người CÒN SỐNG, có thể vắng. `con_lai_s` ≥ 0; 0 = hết giờ, chờ xác nhận.
 *   - Tệp được ghi lại khi nội dung đổi, và ~5 s/lần trong lúc có trận ⇒ `ts` là lúc tính `con_lai_s`.
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 BỐN ĐIỀU KHÔNG ĐƯỢC PHÁ
 * ════════════════════════════════════════════════════════════════════════
 * 1. `textContent`, KHÔNG BAO GIỜ `innerHTML`: tên đội, tên người chơi, luật đều do người gõ. Liên kết trong
 *    luật dựng bằng `createElement('a')` và chỉ nhận http/https.
 * 2. `null` KHÁC `0`: số người sống / máu không đọc được thì nói ra, không vẽ thanh 0%.
 * 3. Không đụng `.style` (CSP `style-src 'self'`): thanh máu là thuộc tính `x`/`width` của <rect>.
 * 4. 404 (chưa công bố) KHÔNG phải lỗi: trang nói một câu bình thản, không cảnh báo đỏ.
 *
 * Nhịp: 5 s khi đang đấu, 10 s lúc khác (30 s cho tới 2026-10-04: giữa hai trận kết quả trận vừa xong hiện chậm
 * tới nửa phút). Tab ẩn thì thôi hỏi, hiện lại thì hỏi ngay nếu đã quá nhịp.
 */
(() => {
  'use strict';

  const API = '/api/giai-dau.json';
  const NHIP_DAU = 5000;
  const NHIP_RANH = 10000;
  const CHO = 8000;          // quá ngần này không trả lời ⇒ bỏ lượt tải
  const CU = 30000;          // đang có trận mà tệp đứng im quá ngần này ⇒ nói là số đã cũ
  const TRE_TOI_DA = 15000;  // độ trễ tối đa tin được giữa lúc panel tính `con_lai_s` và lúc trang nhận
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const $ = (id) => document.getElementById(id);
  const tt = $('gd-tt');
  if (!tt) return;
  const TEN_GOC = $('gd-ten').textContent;
  const DAN_GOC = $('gd-dan').textContent;

  let lech = 0;          // giờ máy chủ − giờ máy người xem (ms), đo bằng header Date
  let duLieu = null;     // bản JSON đang hiện
  let khoaVe = '';       // giai + doi + so_do đã vẽ — giống nhau thì khỏi dựng lại sơ đồ, danh sách đội, luật
  let hdDaVe = null;     // hướng dẫn vào server đã vẽ
  let lanTai = 0;
  let dangTai = false;
  let hen = null;
  let neo = null;        // { khoa, id, het }: `het` = mốc (đồng hồ máy người xem) trận về 00:00
  let truMau = false;   // hết giờ và đang trừ máu (panel tính, `tran_dang.tru_mau`)
  let doiTheoId = new Map();
  let tranTheoId = new Map();

  const bayGio = () => Date.now() + lech;

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
    /* Trình duyệt không có dữ liệu múi giờ: tự cộng 7 giờ (Việt Nam không đổi giờ theo mùa). */
    const vn = (t) => new Date(t + 7 * 3600000).toISOString();
    hhmm = (t) => vn(t).slice(11, 16);
    hhmmss = (t) => vn(t).slice(11, 19);
    ngay = (t) => { const s = vn(t); return `${Number(s.slice(8, 10))}/${Number(s.slice(5, 7))}`; };
  }
  const luc = (t) => `${hhmm(t)} ngày ${ngay(t)}`;

  const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
  const laChu = (v) => typeof v === 'string' && v.trim() !== '';
  const chu = (v) => (typeof v === 'string' ? v.trim() : (laSo(v) ? String(v) : ''));
  const vat = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
  const mang = (v) => (Array.isArray(v) ? v : []);
  const so = (n) => Math.round(n).toLocaleString('vi-VN');
  const idCua = (v) => (v === null || v === undefined || v === '' ? null : String(v));
  const moc = (v) => {
    if (laSo(v)) return v;
    if (!laChu(v)) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  };
  /* growth là 0..1; lỡ panel gửi phần trăm (80) thì vẫn đọc đúng. */
  const phanTram = (g) => (laSo(g) && g > 0 ? Math.round(g <= 1 ? g * 100 : g) : null);

  const tao = (tag, cls, noiDung) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (noiDung !== undefined && noiDung !== null) e.textContent = String(noiDung);
    return e;
  };
  /* Chỉ ghi khi chữ đổi: ghi lại cùng một chữ vẫn thay nút chữ, làm mất vùng người xem đang bôi đen. */
  const dat = (el, noiDung) => { if (el && el.textContent !== noiDung) el.textContent = noiDung; };

  /* Tên giải hay có "5-5": giữ cụm có gạch nối giữa hai chữ số trên một dòng (màn 360 px từng ngắt thành
     "Giải đấu 5-" / "5 Dilophosaurus"). */
  function datTen(el, s) {
    if (el.textContent === s) return;
    const phan = [];
    let i = 0;
    for (const m of s.matchAll(/\S*\d-\d\S*/g)) {
      if (m.index > i) phan.push(s.slice(i, m.index));
      phan.push(tao('span', 'gd-lien', m[0]));
      i = m.index + m[0].length;
    }
    if (i < s.length) phan.push(s.slice(i));
    el.replaceChildren(...phan);
  }

  /* ── chữ do ban tổ chức gõ: đoạn, danh sách, liên kết ─────────────────── */
  const RE_LINK = /\bhttps?:\/\/[^\s<>"']+/gi;

  function themChu(el, s) {
    let i = 0;
    for (const m of s.matchAll(RE_LINK)) {
      let url = m[0];
      const du = url.match(/[.,;:!?)\]}»”’]+$/);     // dấu câu cuối câu không thuộc đường dẫn
      if (du) url = url.slice(0, -du[0].length);
      if (m.index > i) el.append(s.slice(i, m.index));
      let hopLe = false;
      try {
        const u = new URL(url);
        hopLe = u.protocol === 'https:' || u.protocol === 'http:';
      } catch { hopLe = false; }
      if (hopLe) {
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener nofollow';
        a.textContent = url;
        el.append(a);
      } else {
        el.append(url);
      }
      i = m.index + url.length;
    }
    if (i < s.length) el.append(s.slice(i));
  }

  /* Mỗi dòng một đoạn; dòng mở đầu bằng "-", "•", "*" hoặc "1." gom thành danh sách. */
  function doanVan(s) {
    const ra = [];
    let ds = null;
    for (const tho of String(s).split(/\r?\n/)) {
      const dong = tho.trim();
      if (!dong) { ds = null; continue; }
      const m = dong.match(/^(?:([-•*+–])|(\d{1,2})[.)])\s+(.+)$/);
      if (m) {
        const the = m[2] ? 'OL' : 'UL';
        if (!ds || ds.tagName !== the) {
          ds = tao(the.toLowerCase(), 'gd-ds');
          if (m[2] && Number(m[2]) > 1) ds.start = Number(m[2]);
          ra.push(ds);
        }
        const li = tao('li');
        themChu(li, m[3]);
        ds.append(li);
      } else {
        ds = null;
        const p = tao('p');
        themChu(p, dong);
        ra.push(p);
      }
    }
    return ra;
  }

  /* ── tải ─────────────────────────────────────────────────────────────── */
  /* Trả JSON, hoặc `null` khi ban tổ chức chưa công bố (404, hoặc tệp chưa có `giai`). Lỗi khác thì ném. */
  async function tai() {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), CHO);
    try {
      const r = await fetch(API, { signal: bo.signal, cache: 'no-store', credentials: 'same-origin' });
      const d = Date.parse(r.headers.get('Date') || '');
      if (Number.isFinite(d) && Math.abs(d - Date.now()) < 86400000) lech = d - Date.now();
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!vat(j) || j.v !== 1) throw new Error('v');
      return vat(j.giai) ? j : null;
    } finally {
      clearTimeout(h);
    }
  }

  /* ── chỉ mục ─────────────────────────────────────────────────────────── */
  function cacVong(d) {
    const sd = vat(d.so_do);
    return mang(sd && sd.vong).filter(vat).map((v, r) => ({
      ten: chu(v.ten) || `Vòng ${r + 1}`,
      tran: mang(v.tran).filter(vat),
    }));
  }
  const nhanTran = (v, j) => (v.tran.length > 1 ? `${v.ten} ${j + 1}` : v.ten);

  function chiMuc(d) {
    doiTheoId = new Map();
    for (const x of mang(d.doi)) {
      if (vat(x) && idCua(x.id) !== null) doiTheoId.set(idCua(x.id), x);
    }
    tranTheoId = new Map();
    cacVong(d).forEach((v) => v.tran.forEach((t, j) => {
      if (idCua(t.id) !== null) tranTheoId.set(idCua(t.id), { t, nhan: nhanTran(v, j) });
    }));
  }

  const tenDoi = (id) => {
    const x = doiTheoId.get(id);
    return (x && chu(x.ten)) || id;
  };
  const biLoai = (id) => { const x = doiTheoId.get(id); return !!(x && x.bi_loai === true); };
  const lyDoLoai = (id) => {
    const x = doiTheoId.get(id);
    const ly = x ? chu(x.ly_do_loai) : '';
    return ly ? `Bị loại: ${ly}` : 'Bị loại';
  };
  const tenCap = (t) => {
    const a = idCua(t.a), b = idCua(t.b);
    return `${a !== null ? tenDoi(a) : 'chưa rõ đội'} gặp ${b !== null ? tenDoi(b) : 'chưa rõ đội'}`;
  };

  function voDich(vong) {
    const cuoi = vong.length ? vong[vong.length - 1] : null;
    if (!cuoi || cuoi.tran.length !== 1) return null;
    const t = cuoi.tran[0];
    return t.trang_thai === 'xong' ? idCua(t.thang) : null;
  }

  function tranKe(vong) {
    for (const v of vong) {
      for (let j = 0; j < v.tran.length; j++) {
        const t = v.tran[j];
        if (t.trang_thai === 'cho' && idCua(t.a) !== null && idCua(t.b) !== null) return { t, nhan: nhanTran(v, j) };
      }
    }
    return null;
  }

  /* ── đầu trang ───────────────────────────────────────────────────────── */
  function cauDan(ts) {
    const coDoi = ts && laSo(ts.co_doi) && ts.co_doi > 0 ? `${so(ts.co_doi)} người` : 'năm người';
    const phut = ts && laSo(ts.tran_phut) && ts.tran_phut > 0 ? ` ${so(ts.tran_phut)} phút` : '';
    let cau = `Các đội ${coDoi} đấu loại trực tiếp, mỗi trận một ván${phut}.`;
    const loai = ts ? chu(ts.loai) : '';
    if (loai) {
      const pct = phanTram(ts.growth);
      cau += ` Ai cũng cưỡi ${loai}${pct !== null ? ` ${pct}%` : ''}${ts.prime === true ? ' đã Prime' : ''} do server cấp`;
      cau += ', cùng một bộ đột biến do ban tổ chức chọn.';
    } else {
      cau += ' Ai cũng cưỡi cùng một loại khủng long, cùng độ trưởng thành và bộ đột biến, do server cấp.';
    }
    return cau;
  }

  function cauTrangThai(d, vong) {
    const td = vat(d.tran_dang);
    if (td) {
      const x = tranTheoId.get(idCua(td.id));
      return x ? `Đang đấu ${x.nhan}: ${tenCap(x.t)}.` : 'Đang có trận đấu.';
    }
    switch (d.giai.trang_thai) {
      case 'dang_ky': return 'Đang nhận đăng ký.';
      case 'da_boc': return 'Đã bốc thăm, chờ trận đầu tiên.';
      case 'dang_dau': {
        const ke = tranKe(vong);
        return ke ? `Trận kế tiếp: ${ke.nhan}, ${tenCap(ke.t)}.` : 'Giải đang diễn ra.';
      }
      case 'xong': {
        const vd = voDich(vong);
        return vd !== null ? `Giải đã kết thúc. Vô địch: ${tenDoi(vd)}.` : 'Giải đã kết thúc.';
      }
      default: return 'Thông tin giải đang được cập nhật.';
    }
  }

  function cauGio(g) {
    const mo = moc(g.mo_luc);
    const dong = moc(g.dong_dang_ky);
    if (g.trang_thai === 'dang_ky') {
      const phan = [];
      const cungNgay = mo !== null && dong !== null && ngay(mo) === ngay(dong);
      if (dong !== null) phan.push(`Đóng đăng ký lúc ${cungNgay ? hhmm(dong) : luc(dong)}`);
      if (mo !== null) phan.push(`${phan.length ? 'trận đầu' : 'Trận đầu'} bắt đầu lúc ${luc(mo)}`);
      return phan.length ? `${phan.join(', ')} (giờ Việt Nam).` : '';
    }
    if (mo === null) return '';
    if (g.trang_thai === 'da_boc') return `Trận đầu bắt đầu lúc ${luc(mo)} (giờ Việt Nam).`;
    if (g.trang_thai === 'dang_dau') return `Giải bắt đầu lúc ${luc(mo)} (giờ Việt Nam).`;
    return '';
  }

  function veDau(d, vong) {
    const g = d.giai;
    datTen($('gd-ten'), chu(g.ten) || TEN_GOC);
    dat($('gd-dan'), cauDan(vat(g.thong_so)));
    dat(tt, cauTrangThai(d, vong));

    const gio = cauGio(g);
    $('gd-gio').hidden = !gio;
    dat($('gd-gio'), gio);

    const sv = vat(g.server);
    const tenSv = sv ? chu(sv.ten) : '';
    const hd = sv ? chu(sv.huong_dan) : '';
    $('gd-vao').hidden = !(tenSv || hd) || g.trang_thai === 'xong';
    $('gd-sv').parentElement.hidden = !tenSv;
    dat($('gd-sv'), tenSv);
    if (hd !== hdDaVe) {
      $('gd-hd').replaceChildren(...doanVan(hd));
      hdDaVe = hd;
    }
  }

  function veTuoi(d) {
    const el = $('gd-tuoi');
    if (!laSo(d.ts)) { dat(el, ''); return; }
    const khiNao = ngay(d.ts) === ngay(bayGio()) ? hhmmss(d.ts) : `${hhmmss(d.ts)} ngày ${ngay(d.ts)}`;
    if (vat(d.tran_dang) && bayGio() - d.ts > CU) {
      dat(el, `Số liệu trận chưa về thêm từ ${khiNao}, trang vẫn đang thử lại.`);
    } else {
      dat(el, `Cập nhật lúc ${khiNao}.`);
    }
  }

  /* ── trận đang đấu ───────────────────────────────────────────────────── */
  function thanhMau(pct, phai) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'gd-thanh');
    svg.setAttribute('viewBox', '0 0 100 8');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const nen = document.createElementNS(SVG_NS, 'rect');
    nen.setAttribute('class', 'gd-thanh__nen');
    nen.setAttribute('width', '100');
    nen.setAttribute('height', '8');
    const day = document.createElementNS(SVG_NS, 'rect');
    day.setAttribute('class', 'gd-thanh__dat');
    /* Đội bên phải đầy từ mép phải, như bảng tỉ số hai bên đối xứng. */
    day.setAttribute('x', String(phai ? 100 - pct : 0));
    day.setAttribute('width', String(pct));
    day.setAttribute('height', '8');
    svg.append(nen, day);
    return svg;
  }

  function veDoiSong(el, id, song, mau, phai) {
    if (id === null) {
      el.replaceChildren(tao('h3', 'gd-ts__ten dim', 'Chưa rõ đội'));
      return;
    }
    const phan = [tao('h3', 'gd-ts__ten', tenDoi(id))];
    if (biLoai(id)) phan.push(tao('p', 'gd-ts__loai', lyDoLoai(id)));
    const n = song[id];
    const dongSo = tao('p', 'gd-ts__so');
    dongSo.append(tao('span', 'gd-ts__n', laSo(n) ? so(n) : '—'),
      tao('span', 'gd-ts__nhan', laSo(n) ? 'người còn sống' : 'chưa đọc được số người sống'));
    phan.push(dongSo);
    const pct = mau[id];
    if (laSo(pct)) {
      const p = Math.max(0, Math.min(100, pct));
      phan.push(thanhMau(p, phai));
      const m = tao('p', 'gd-ts__mau');
      m.append('Máu ', tao('b', 'so', `${so(p)}%`));
      phan.push(m);
    } else {
      phan.push(tao('p', 'gd-ts__mau', 'Chưa đọc được máu'));
    }
    el.replaceChildren(...phan);
  }

  function demNguoc(ms) {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), g = s % 60;
    const hai = (x) => String(x).padStart(2, '0');
    return h ? `${h}:${hai(m)}:${hai(g)}` : `${hai(m)}:${hai(g)}`;
  }

  function veDem() {
    const el = $('gd-dem'), ghi = $('gd-dem-chu');
    if (!neo) { dat(el, '—'); dat(ghi, 'còn lại'); return; }
    const con = neo.het - Date.now();
    if (con <= 0) {
      dat(el, '00:00');
      /* Luật 2026-10-03: hết giờ mà hai đội còn người thì trừ 2% máu mỗi giây tới khi một đội chết hết. */
      dat(ghi, truMau ? 'hết giờ: mỗi giây trừ 2% máu tới khi một đội chết hết' : 'hết giờ, chờ ban tổ chức chốt kết quả');
      return;
    }
    dat(el, demNguoc(con));
    dat(ghi, 'còn lại');
  }

  function veSong(d) {
    const khoi = $('gd-song');
    const td = vat(d.tran_dang);
    if (!td) { khoi.hidden = true; neo = null; truMau = false; return; }
    truMau = td.tru_mau === true;
    khoi.hidden = false;
    const x = tranTheoId.get(idCua(td.id));
    dat($('gd-song-td'), x ? `${x.nhan} đang đấu` : 'Trận đang đấu');
    const song = vat(td.song) || {};
    const mau = vat(td.mau_pct) || {};
    const ids = x ? [idCua(x.t.a), idCua(x.t.b)] : Object.keys(song).slice(0, 2);
    veDoiSong($('gd-ts-a'), ids[0] !== undefined ? ids[0] : null, song, mau, false);
    veDoiSong($('gd-ts-b'), ids[1] !== undefined ? ids[1] : null, song, mau, true);

    /* Đồng hồ: `con_lai_s` đúng ở lúc `ts`. Chỉ đặt lại mốc khi panel gửi số MỚI — tệp đứng im (panel dừng ghi)
       thì đồng hồ vẫn chạy tiếp về 00:00 thay vì nhảy ngược lên mỗi lần tải. */
    if (laSo(td.con_lai_s)) {
      const id = idCua(td.id);
      const khoa = `${id}|${td.con_lai_s}|${d.ts}`;
      if (!neo || neo.khoa !== khoa) {
        const tre = laSo(d.ts) ? Math.min(Math.max(bayGio() - d.ts, 0), TRE_TOI_DA) : 0;
        const het = Date.now() - tre + Math.max(0, td.con_lai_s) * 1000;
        /* Header Date chỉ đúng tới giây: mốc mới lệch mốc cũ dưới 1,5 s là nhiễu đo, giữ mốc cũ để đồng hồ
           không giật một giây mỗi lần tải. Lệch hơn (tạm dừng, chỉnh giờ trận) thì theo số mới. */
        const giu = neo && neo.id === id && Math.abs(het - neo.het) < 1500;
        neo = { khoa, id, het: giu ? neo.het : het };
      }
    } else {
      neo = null;
    }
    veDem();
  }

  /* ── sơ đồ ───────────────────────────────────────────────────────────── */
  function dongDoi(id, thang) {
    const dong = tao('div', 'gd-dong');
    const ten = tao('span', 'gd-dong__ten');
    /* Trên desktop tên một dòng + dấu ba chấm (ô cao đều nhau thì đường nối mới thẳng): đủ tên trong `title`
       và ở khối "Các đội" bên dưới. */
    const chuTen = tao('span', 'gd-dong__chu', tenDoi(id));
    chuTen.title = tenDoi(id);
    ten.append(chuTen);
    if (biLoai(id)) {
      dong.classList.add('gd-dong--loai');
      ten.append(tao('span', 'gd-dong__loai', lyDoLoai(id)));
    }
    dong.append(ten);
    if (thang !== null) {
      if (thang === id) {
        dong.classList.add('gd-dong--thang');
        dong.append(tao('span', 'gd-dong__nhan', 'Thắng'));
      } else {
        dong.classList.add('gd-dong--thua');
      }
    }
    return dong;
  }

  const dongCho = (noiDung) => {
    const dong = tao('div', 'gd-dong gd-dong--cho');
    const ten = tao('span', 'gd-dong__ten');
    ten.append(tao('span', 'gd-dong__chu', noiDung));
    dong.append(ten);
    return dong;
  };

  function oTran(t, nhan, truoc, j) {
    const hop = tao('div', 'gd-tran');
    const dau = tao('p', 'gd-tran__dau');
    dau.append(tao('span', '', nhan));
    if (t.trang_thai === 'dang') {
      hop.dataset.tt = 'dang';
      dau.append(tao('span', 'gd-tran__tt', 'Đang đấu'));
    }
    hop.append(dau);

    const a = idCua(t.a), b = idCua(t.b), thang = idCua(t.thang);
    const ghi = chu(t.ghi_chu);
    if (a === null && b === null && t.trang_thai === 'xong') {
      hop.classList.add('gd-tran--rong');
      hop.append(tao('p', 'gd-tran__ghi', ghi || 'Không có trận này.'));
      return hop;
    }
    /* Miễn đấu chỉ khi trận ĐÃ xong và có đội thắng. Ô vòng sau chưa rõ đội cũng có a/b null nhưng đang "cho". */
    const mien = t.trang_thai === 'xong' && thang !== null && (a === null || b === null);
    [[a, 2 * j], [b, 2 * j + 1]].forEach(([id, k]) => {
      if (id !== null) { hop.append(dongDoi(id, thang)); return; }
      if (mien) { hop.append(dongCho(ghi || 'Miễn đấu')); return; }
      const nguon = truoc && truoc.tran[k] ? `Đội thắng ${nhanTran(truoc, k)}` : 'Chưa rõ đội';
      hop.append(dongCho(nguon));
    });
    if (ghi && !mien) hop.append(tao('p', 'gd-tran__ghi', ghi));
    return hop;
  }

  function cotVong(v, r, vong, soTran) {
    const cot = tao('div', 'gd-vong');
    if (r + 1 < soTran.length) cot.dataset.noi = soTran[r] === 2 * soTran[r + 1] ? 'cap' : 'thang';
    cot.append(tao('h3', 'gd-vong__ten', v.ten));
    const ds = tao('ol', 'gd-vong__ds');
    v.tran.forEach((t, j) => {
      const li = tao('li', 'gd-o');
      li.append(oTran(t, nhanTran(v, j), r > 0 ? vong[r - 1] : null, j));
      ds.append(li);
    });
    cot.append(ds);
    return cot;
  }

  function cotVoDich(ck) {
    const cot = tao('div', 'gd-vong');
    cot.append(tao('h3', 'gd-vong__ten', 'Vô địch'));
    const ds = tao('div', 'gd-vong__ds');
    const o = tao('div', 'gd-o');
    const hop = tao('div', 'gd-tran gd-tran--vd');
    const id = ck.trang_thai === 'xong' ? idCua(ck.thang) : null;
    if (id !== null) {
      hop.classList.add('gd-tran--vo-dich');
      hop.append(tao('p', 'gd-vd__ten', tenDoi(id)));
      const x = doiTheoId.get(id);
      const tv = mang(x && x.thanh_vien).filter(laChu).map((s) => s.trim());
      if (tv.length) hop.append(tao('p', 'gd-vd__tv', tv.join(', ')));
    } else {
      hop.append(tao('p', 'gd-vd__cho', 'Đội thắng chung kết'));
    }
    o.append(hop);
    ds.append(o);
    cot.append(ds);
    return cot;
  }

  function veSoDo(d) {
    const vong = cacVong(d).filter((v) => v.tran.length);
    const cay = $('gd-cay');
    if (!vong.length) {
      $('gd-sodo').hidden = true;
      cay.replaceChildren();
      return false;
    }
    $('gd-sodo').hidden = false;
    const cuoi = vong[vong.length - 1];
    const coVoDich = cuoi.tran.length === 1;
    const soTran = vong.map((v) => v.tran.length).concat(coVoDich ? [1] : []);
    /* Đường nối chỉ đúng khi mỗi vòng có đúng một nửa số trận của vòng trước (vòng cuối → ô vô địch: 1 → 1). */
    let chuan = true;
    for (let r = 0; r + 1 < soTran.length; r++) {
      if (!(soTran[r] === 2 * soTran[r + 1] || (soTran[r] === 1 && soTran[r + 1] === 1))) chuan = false;
    }
    cay.className = chuan ? 'gd-cay gd-cay--chuan' : 'gd-cay';
    const cot = vong.map((v, r) => cotVong(v, r, vong, soTran));
    if (coVoDich) cot.push(cotVoDich(cuoi.tran[0]));
    cay.replaceChildren(...cot);
    return true;
  }

  /* ── các đội ─────────────────────────────────────────────────────────── */
  function veDoi(d) {
    const ds = mang(d.doi).filter((x) => vat(x) && idCua(x.id) !== null);
    if (!ds.length) {
      $('gd-doi-khoi').hidden = true;
      return false;
    }
    $('gd-doi-khoi').hidden = false;
    const tongNguoi = ds.reduce((s, x) => s + mang(x.thanh_vien).filter(laChu).length, 0);
    $('gd-doi-tong').replaceChildren(tao('span', 'so', so(ds.length)), ' đội, ',
      tao('span', 'so', so(tongNguoi)), ' người chơi.');
    $('gd-doi').replaceChildren(...ds.map((x) => {
      const id = idCua(x.id);
      const loai = x.bi_loai === true;
      const li = tao('li', loai ? 'gd-doi__muc gd-doi__muc--loai' : 'gd-doi__muc');
      li.append(tao('h3', 'gd-doi__ten', tenDoi(id)));
      if (loai) li.append(tao('p', 'gd-doi__loai', lyDoLoai(id)));
      // Màu đội = màu server sơn lên khủng long của cả đội khi vào sân. Chỉ nhận #rrggbb; ô màu vẽ bằng
      // CSSOM (el.style) — CSP chặn style viết thẳng trong HTML chứ không chặn CSSOM.
      const mauHex = typeof x.mau === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.mau) ? x.mau : null;
      if (mauHex) {
        const cham = tao('span', 'gd-doi__cham');
        cham.style.background = mauHex;
        const dong = tao('p', 'gd-doi__mau');
        dong.append(cham, 'Màu đội: ' + (chu(x.ten_mau) || mauHex));
        li.append(dong);
      }
      const tv = mang(x.thanh_vien).filter(laChu);
      if (tv.length) {
        const ul = tao('ul', 'gd-doi__tv');
        tv.forEach((n) => ul.append(tao('li', '', n.trim())));
        li.append(ul);
      } else {
        li.append(tao('p', 'dim nho', 'Chưa có tên người chơi.'));
      }
      return li;
    }));
    return true;
  }

  /* ── luật ────────────────────────────────────────────────────────────── */
  function hangThongSo(ts) {
    if (!ts) return [];
    const hang = [];
    const them = (nhan, giaTri) => {
      const tr = tao('tr');
      const th = tao('th', '', nhan);
      th.scope = 'row';
      tr.append(th, tao('td', '', giaTri));
      hang.push(tr);
    };
    const loai = chu(ts.loai);
    if (loai) {
      const phan = [loai];
      const pct = phanTram(ts.growth);
      if (pct !== null) phan.push(`${pct}% trưởng thành`);
      if (ts.prime === true) phan.push('đã Prime');
      them('Khủng long', phan.join(', '));
    }
    if (Array.isArray(ts.dot_bien)) {
      // Danh sách rỗng = ban tổ chức CHƯA nhập, không phải "không có đột biến" (người dùng chốt 2026-10-03:
      // admin chọn một bộ chung cho cả giải).
      const db = ts.dot_bien.filter(laChu).map((s) => s.trim());
      them('Đột biến', db.length ? db.join(', ') : 'Ban tổ chức chọn sẵn, giống nhau cho mọi người');
    }
    if (laSo(ts.co_doi) && ts.co_doi > 0) them('Mỗi đội', `${so(ts.co_doi)} người`);
    if (laSo(ts.tran_phut) && ts.tran_phut > 0) them('Mỗi trận', `Một ván, tối đa ${so(ts.tran_phut)} phút`);
    if (laSo(ts.toi_da) && ts.toi_da > 0) them('Tối đa', `${so(ts.toi_da)} người chơi`);
    return hang;
  }

  function veLuat(d) {
    const luat = chu(d.giai.luat);
    $('gd-luat').replaceChildren(...(luat
      ? doanVan(luat)
      : [tao('p', 'muted', 'Ban tổ chức chưa đăng luật chi tiết.')]));
    const hang = hangThongSo(vat(d.giai.thong_so));
    $('gd-thongso').replaceChildren(...hang);
    $('gd-thongso-khoi').hidden = !hang.length;
    $('gd-luat-khoi').hidden = !luat && !hang.length;
  }

  /* ── ghép ────────────────────────────────────────────────────────────── */
  const KHOI = ['gd-trong', 'gd-cho', 'gd-song', 'gd-sodo', 'gd-doi-khoi', 'gd-luat-khoi'];

  function veChuaCo(loiMang) {
    duLieu = null;
    khoaVe = '';
    hdDaVe = null;
    neo = null;
    datTen($('gd-ten'), TEN_GOC);
    dat($('gd-dan'), DAN_GOC);
    dat(tt, 'Thông tin giải sẽ hiện ở đây khi ban tổ chức công bố.');
    $('gd-gio').hidden = true;
    $('gd-vao').hidden = true;
    dat($('gd-tuoi'), loiMang
      ? 'Chưa tải được thông tin giải, trang đang thử lại.'
      : 'Trang tự kiểm tra lại nửa phút một lần.');
    KHOI.forEach((id) => { $(id).hidden = id !== 'gd-trong'; });
  }

  function ve(d) {
    const vong = cacVong(d);
    const khoa = JSON.stringify([d.giai, d.doi, d.so_do]);
    duLieu = d;
    $('gd-trong').hidden = true;
    if (khoa !== khoaVe) {
      khoaVe = khoa;
      chiMuc(d);
      const coSoDo = veSoDo(d);
      const coDoi = veDoi(d);
      veLuat(d);
      $('gd-cho').hidden = coSoDo || coDoi;
    }
    veDau(d, vong);
    veSong(d);
    veTuoi(d);
  }

  const dangDau = () => !!(duLieu && (duLieu.giai.trang_thai === 'dang_dau' || vat(duLieu.tran_dang)));
  const nhip = () => (dangDau() ? NHIP_DAU : NHIP_RANH);

  function henLuot(sau) {
    clearTimeout(hen);
    hen = setTimeout(() => { if (!document.hidden) luot(); }, sau);
  }

  async function luot() {
    if (dangTai) return;
    dangTai = true;
    clearTimeout(hen);
    try {
      const d = await tai();
      if (d) ve(d); else veChuaCo(false);
    } catch {
      /* Mất mạng, máy chủ lỗi, JSON hỏng: GIỮ bản đang hiện, chỉ nói là chưa tải được. */
      if (duLieu) dat($('gd-tuoi'), 'Chưa tải được số liệu mới, trang đang thử lại.');
      else veChuaCo(true);
    } finally {
      lanTai = Date.now();
      dangTai = false;
    }
    henLuot(nhip());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const da = Date.now() - lanTai;
    if (da >= nhip()) luot();
    else henLuot(nhip() - da);
  });
  /* Đồng hồ đếm lùi đổi mỗi giây: đó là dữ liệu đổi, không phải hiệu ứng. */
  setInterval(() => { if (!document.hidden && neo) veDem(); }, 1000);
  luot();
})();
