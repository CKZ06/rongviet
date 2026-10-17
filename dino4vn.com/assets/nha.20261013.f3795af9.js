/* nha.js — các khối động riêng của TRANG CHỦ:
 *   1. Khối sự kiện "Vây Trùm" `#sk` đầu trang (+ "Vây Trùm đợt trước" trong khối vinh danh) — IIFE thứ nhất.
 *   2. Khối "Cảm ơn người góp server" `#vd-gop` — IIFE thứ hai.
 *   3. Khối "Kết quả sự kiện gần nhất" `#skgn` (giải đấu / Vây Trùm, 2026-10-05) — IIFE thứ ba, cuối file.
 *   (Khối "Ai dẫn đầu" `#vd-bxh` do `bxh.js` vẽ — dùng chung bục 3D với /bang-xep-hang.)
 *
 * 2026-10-02 (chủ server chốt): BỎ dải cá nhân `#cua-toi` ("Chào bạn… đang gửi N ô… hai nút") —
 * thanh app đã có đủ "Trang của tôi", "Gara", "Xếp hạng", và khối vinh danh có link bảng xếp hạng.
 * Kéo theo: trang chủ không gọi `/api/player/garage` nữa.
 */

/* Khối sự kiện "Vây Trùm" ở đầu trang chủ (2026-09-27, phương án A chủ server chốt).
 *
 * Hợp đồng dữ liệu (`ops/daisan/HOP-DONG.md`):
 *   /api/su-kien.json   { schema, ts, lich: null | { mo_luc_ms, ghi_chu } }   lịch admin đặt trên panel
 *   /api/vay-trum.json  { schema, ts, dang, gan_nhat, truoc, luat, sap }      bảng tin + `sap` của đạo diễn
 *   /api/su-kien.js     đặt `data-sk` lên <html> TRƯỚC lần vẽ đầu (nạp chặn trong <head>)
 * Trạng thái do `window.dino4vnSK.trangThai` (`sk-luat.js`) quyết — CÙNG luật với máy chủ.
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 BỐN ĐIỀU KHÔNG ĐƯỢC PHÁ
 * ════════════════════════════════════════════════════════════════════════
 * 1. Chỉ ĐIỀN SỐ vào khung có sẵn. Phần nào hiện ở trạng thái nào là việc của CSS (`data-o`); file
 *    này chỉ đổi `data-sk` khi JSON nói khác bản `.js` (tệp đó trễ tối đa ~60 s) — mỗi lần đổi là
 *    một lần nhảy layout, nên KHÔNG đổi khi mới tải được một trong hai tệp.
 * 2. `textContent`, KHÔNG BAO GIỜ `innerHTML`: tên người chơi, câu diễn biến, ghi chú admin đều là
 *    chữ người khác đặt.
 * 3. `null` KHÁC `0`: không đọc được thì "—", không 0. Máu trùm CHỈ có phần trăm.
 * 4. "Bây giờ" = giờ MÁY CHỦ theo header `Date` (máy người xem có thể lệch vài phút) — đồng hồ đếm
 *    ngược và luật trạng thái đều dựa vào nó.
 *
 * Nhịp tải: đang diễn ra 5 s, có khối 30 s (báo trước / lịch hẹn sát giờ mở: 5 s), không có khối 60 s (để
 * thấy lịch hay báo trước mới). Tab ẩn thì thôi hỏi. Đồng hồ + luật trạng thái chạy lại mỗi giây trên
 * bản đã tải — qua giờ mở, trùm gục… là đổi trạng thái mà không cần chờ lượt tải.
 *
 * 🔴 KHÔNG SẬP KHỐI DƯỚI MẮT NGƯỜI ĐANG XEM (chot-A ghep2 (1)). Luật ra `null` giữa phiên chỉ vì ĐỒNG HỒ —
 *    hết 90 phút giữ kết quả, tới giờ hẹn mà đạo diễn chưa ghi `sap`, quá ân hạn báo trước — thì GIỮ trạng
 *    thái đang hiện và chỉ đổi chữ ("đang chờ server mở đợt"); khối cao ~310px mà biến mất là cả hero nhảy
 *    lên (đo 0,24 CLS). Khối chỉ ẩn ở lần tải trang sau (lúc đó `/api/su-kien.js` đã không đặt `data-sk`),
 *    hoặc khi tab ẩn rồi hiện lại (người xem không nhìn). Luật giữ là hàm thuần `L.giuKhung` (sk-luat.js, có
 *    bộ ca riêng trong test_web_sukien.py). Ba giới hạn của việc giữ:
 *      · chỉ giữ trạng thái JSON ĐÃ XÁC NHẬN trong phiên này — `data-sk` của tệp .js có thể cũ (panel chết
 *        hàng giờ), nên lượt tải JSON đầu tiên luôn được quyền sửa nó, kể cả thành "không có";
 *      · dữ liệu của trạng thái đó còn trong JSON (`L.coDuLieu`) — admin xoá lịch, đạo diễn huỷ báo trước là dữ
 *        liệu biến mất THẬT, khối ẩn ngay;
 *      · trạng thái mới khác `null` luôn thắng (lịch → báo trước → đang diễn ra → vừa xong đổi tại chỗ, cùng
 *        `min-height`).
 */
(() => {
  'use strict';

  const hop = document.getElementById('sk');
  const L = window.dino4vnSK;
  if (!hop || !L) return;
  const T = window.D4V_T;
  const EN = document.documentElement.lang === 'en';
  const LOC = EN ? 'en-US' : 'vi-VN';
  const LOC_GIO = EN ? 'en-GB' : 'vi-VN';
  const THANG_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Ngày/tháng: "12/10" trên trang Việt, "Oct 12" trên trang Anh (d/m dễ đọc nhầm thành m/d). */
  const dm = (d, m) => (EN ? `${THANG_EN[m - 1]} ${d}` : `${d}/${m}`);
  const goc = document.documentElement;
  const $ = (id) => document.getElementById(id);

  const API_VT = '/api/vay-trum.json';
  const API_SK = '/api/su-kien.json';
  const NHIP_DANG = 5000;
  const NHIP_CO = 30000;
  const NHIP_RANH = 60000;
  const SAT_GIO_MS = 30000;      // lịch / báo trước: từ 30 s trước giờ mở thì hỏi 5 s/lần để thấy đợt mở ngay
  const CU_MS = 45000;           // đợt đang chạy mà bản ghi không về thêm ngần này ⇒ số xám lại
  const CHO = 8000;
  const TRANG_THAI = ['lich', 'bao', 'dang', 'xong'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const GIO_VN = 7 * 3600000;    // Việt Nam UTC+7 quanh năm, không đổi giờ mùa hè

  /* Bộ màu trùm mặc trong game — CHÉP từ `ops/daisan/daisan-ctl::MAU_DO_HEX` (chủ server chốt
     2026-09-25, cùng bảng với AI ZONE). `panel/tests/test_web_sukien.py` so từng mã với nguồn đó:
     đổi màu trùm mà quên chỗ này là test đỏ, không phải một con trùm khác màu trên web. */
  const MAU_TRUM = {
    maleDisplay: '#B01414', markings: '#7A0C0C', body: '#C21A1A', flank: '#A81616',
    underbelly: '#8E1212', mouth: '#6E0E0E', detail1: '#D42020',
  };
  const LOAI_TRUM = 'Tyrannosaurus';
  const CAU_LICH = T('Server báo trước trong game kèm tên vùng săn.');   // = chữ tĩnh của #sk-ghichu
  const DUONG_3D = '/assets/dino3d.20261012.abc66f91.js';

  let hhmm, hhmmss;
  try {
    const tz = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
    const f1 = new Intl.DateTimeFormat(LOC_GIO, { ...tz, hour: '2-digit', minute: '2-digit' });
    const f2 = new Intl.DateTimeFormat(LOC_GIO, { ...tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    hhmm = (t) => f1.format(new Date(t));
    hhmmss = (t) => f2.format(new Date(t));
  } catch {
    hhmm = (t) => new Date(t + GIO_VN).toISOString().slice(11, 16);
    hhmmss = (t) => new Date(t + GIO_VN).toISOString().slice(11, 19);
  }

  const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
  const laObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hopLe = (d) => (laObj(d) && d.schema === 1 ? d : null);
  const chu = (v) => (typeof v === 'string' ? v.trim() : '');
  const so = (n, le = 0) => Number(n).toLocaleString(LOC, {
    minimumFractionDigits: le, maximumFractionDigits: le,
  });
  const soHoac = (v) => (laSo(v) ? so(v) : '—');
  const dat = (el, c) => { if (el && el.textContent !== c) el.textContent = c; };
  const tao = (tag, cls, c) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (c !== undefined && c !== null) e.textContent = String(c);
    return e;
  };

  /* Dựng lại một phần tử CHỈ khi nội dung đổi — đồng hồ gọi mỗi giây, bản tải về mỗi 5 s. */
  const daVe = new WeakMap();
  function lap(el, khoa, dung) {
    if (!el || daVe.get(el) === khoa) return;
    daVe.set(el, khoa);
    dung(el);
  }
  /* Câu có chữ đậm: `ghep(el, ['còn ', ['b', '3 giờ']])` — mỗi mảnh là textContent, không HTML. */
  function ghep(el, phan) {
    lap(el, JSON.stringify(phan), (e) => e.replaceChildren(...phan.map((x) => (
      Array.isArray(x) ? tao(x[0], x[2] || '', x[1]) : document.createTextNode(x)))));
  }
  /* Tên người chơi: một dòng, cắt dấu ba chấm bằng CSS, tên đủ ở `title`. */
  function datTen(el, ten, day) {
    if (!el) return;
    dat(el, ten);
    el.title = day === undefined ? ten : day;
  }

  const ngayVN = (t) => Math.floor((t + GIO_VN) / 86400000);
  const gioVN = (t) => new Date(t + GIO_VN).getUTCHours();
  function ngayThang(t) {
    const d = new Date(t + GIO_VN);
    return dm(d.getUTCDate(), d.getUTCMonth() + 1);
  }
  /* 0h–4h là "đêm", không phải "sáng": "Vây Trùm sáng mai" đứng cạnh số lớn 00:30 thì người đọc lướt hiểu là
     8–9 giờ sáng. Và 0h–4h của NGÀY MAI là "đêm nay" (đêm của hôm nay kéo qua 0 giờ). */
  const buoiIdx = (h) => (h < 5 ? 0 : h < 11 ? 1 : h < 13 ? 2 : h < 18 ? 3 : 4);
  function nhanNgay(t, now) {
    const lech = ngayVN(t) - ngayVN(now);
    const h = gioVN(t);
    const i = buoiIdx(h);
    if (lech === 0) {
      return i === 0 ? T('đêm nay') : i === 1 ? T('sáng nay') : i === 2 ? T('trưa nay') : i === 3 ? T('chiều nay') : T('tối nay');
    }
    if (lech === 1) {
      return i === 0 ? T('đêm nay') : i === 1 ? T('sáng mai') : i === 2 ? T('trưa mai') : i === 3 ? T('chiều mai') : T('tối mai');
    }
    return T('ngày {d}', { d: ngayThang(t) });
  }
  /* "3 giờ 12 phút" — không giây: lịch hẹn còn hàng giờ, đếm từng giây chỉ làm rối mắt. */
  function conLai(ms) {
    const phut = Math.max(1, Math.ceil(ms / 60000));
    const ngay = Math.floor(phut / 1440), gio = Math.floor((phut % 1440) / 60), p = phut % 60;
    if (ngay) return gio ? T('{ngay} ngày {gio} giờ', { ngay, gio }) : T('{ngay} ngày', { ngay });
    if (gio) return p ? T('{gio} giờ {p} phút', { gio, p }) : T('{gio} giờ', { gio });
    return T('{p} phút', { p });
  }
  function demNguoc(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), g = s % 60;
    const hai = (x) => String(x).padStart(2, '0');
    return h ? `${h}:${hai(m)}:${hai(g)}` : `${hai(m)}:${hai(g)}`;
  }
  function thoiLuong(ms) {
    const phut = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(phut / 60), m = phut % 60;
    return h ? T('{h} giờ {m} phút', { h, m }) : T('{m} phút', { m });
  }
  /* Máu trùm: dưới 10% giữ một chữ số lẻ — "0%" khi con trùm còn sống là một câu sai. */
  const phanTram = (p) => `${so(p, p >= 10 ? 0 : 1)}%`;

  function thanhMau(pct) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'vt-thanh sk__thanh');
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

  /* ── trạng thái trên <html> ──────────────────────────────────────────── */
  const docTT = () => (TRANG_THAI.includes(goc.dataset.sk) ? goc.dataset.sk : null);
  function datTT(s) {
    if (s) goc.dataset.sk = s;
    else delete goc.dataset.sk;
  }

  /* ── đợt trước (thẻ trùm, lịch hẹn + báo trước) ──────────────────────── */
  function veTruoc(vt) {
    const el = $('sk-truoc');
    const g = vt && laObj(vt.gan_nhat) && laSo(vt.gan_nhat.mo_ms) ? vt.gan_nhat : null;
    if (!g) { ghep(el, [T('Chưa có đợt nào trước đây.')]); return; }
    const dai = laSo(g.dong_ms) && g.dong_ms > g.mo_ms ? T(' sau {t}', { t: thoiLuong(g.dong_ms - g.mo_ms) }) : '';
    const nguoi = laSo(g.so_nguoi) ? T(', {n} người tham gia', { n: so(g.so_nguoi) }) : '';
    const dn = laObj(g.dame_nhat) && chu(g.dame_nhat.ten) ? chu(g.dame_nhat.ten) : '';
    ghep(el, [T('Đợt {ngay}: {kq}{dai}{nguoi}', { ngay: ngayThang(g.mo_ms), kq: g.ket === 'guc' ? T('trùm gục') : T('trùm rút lui'), dai, nguoi }),
      ...(dn ? [', ', ['b', dn], T(' gây nhiều sát thương nhất')] : []), '.']);
  }

  /* ── lịch hẹn ────────────────────────────────────────────────────────── */
  function veLich(sk, vt, now) {
    const l = sk.lich;
    dat($('sk-td-lich'), T('Vây Trùm {khi}', { khi: nhanNgay(l.mo_luc_ms, now) }));
    dat($('sk-so'), hhmm(l.mo_luc_ms));
    /* Ghi chú THAY câu mặc định trên cùng dòng (không ẩn/hiện dòng — mỗi lần là một cú nhảy layout). */
    const ghi = chu(l.ghi_chu);
    datTen($('sk-ghichu'), ghi || CAU_LICH, ghi);
    veTruoc(vt);
  }
  function gioLich(sk, now) {
    const mo = sk.lich.mo_luc_ms;
    dat($('sk-td-lich'), T('Vây Trùm {khi}', { khi: nhanNgay(mo, now) }));
    /* Qua giờ hẹn mà đạo diễn chưa bắt đầu báo trước: khối được GIỮ (khối chú thích đầu IIFE) — nói đúng sự thật
       thay vì "còn 1 phút" mãi. Lịch không tự mở đợt; server mở thì trạng thái tự sang "báo trước". */
    ghep($('sk-so-nhan'), mo > now ? [T('còn '), ['b', conLai(mo - now), 'so']] : [T('tới giờ, đang chờ server mở đợt')]);
  }

  /* ── báo trước ───────────────────────────────────────────────────────── */
  function veVung(ten) {
    datTen($('sk-vung-ten'), ten || '—', ten || '');
  }
  function veBao(vt) {
    veVung(chu(vt.sap.ten_vung));
    veTruoc(vt);
  }
  function gioBao(vt, now) {
    const mo = vt.sap.mo_luc_ms;
    dat($('sk-so'), demNguoc(mo - now));
    /* Qua giờ mở: trong ân hạn `BAO_QUA_MS` server đang mở đợt; quá ân hạn thì khối chỉ còn vì được GIỮ. */
    ghep($('sk-so-nhan'), mo > now ? [T('mở lúc '), ['b', hhmm(mo), 'so']]
      : (now - mo <= L.BAO_QUA_MS ? [T('đang mở đợt')] : [T('đang chờ server mở đợt')]));
  }

  /* ── đang diễn ra ────────────────────────────────────────────────────── */
  function veTrum(d) {
    const ds = $('sk-trum-ds');
    const trum = Array.isArray(d.trum) ? d.trum.filter(laObj) : [];
    lap(ds, JSON.stringify([trum, !!d.trum_guc]), (e) => {
      e.removeAttribute('aria-label');
      if (trum.length <= 1) {
        const t = trum[0];
        const p = tao('p', 'sk__mau');
        const pct = tao('span', 'sk__mau-pct so');
        let nhan = '', w = 0;
        if (!t) {
          pct.textContent = '—';
          nhan = d.trum_guc ? T('trùm đã gục') : T('trùm chưa xuất hiện');
        } else if (t.song === false) {
          pct.textContent = T('Đã gục');
          pct.classList.add('sk__mau-pct--guc');
        } else if (laSo(t.mau_pct)) {
          w = Math.max(0, Math.min(100, t.mau_pct));
          pct.textContent = phanTram(w);
          nhan = T('máu còn lại');
          e.setAttribute('aria-label', T('Trùm còn {p} phần trăm máu', { p: so(w, 1) }));
        } else {
          pct.textContent = '—';
          nhan = T('chưa đọc được máu');
        }
        p.append(pct);
        if (nhan) p.append(tao('span', 'sk__mau-nhan', nhan));
        e.replaceChildren(p, thanhMau(w));
        return;
      }
      /* Hai trùm trở lên (seed `so_trum` 1–5): mỗi con một dòng, không còn số lớn. */
      e.replaceChildren(...trum.map((t, i) => {
        const dong = tao('p', 'sk__mau-dong');
        let w = 0, c = '—';
        if (t.song === false) c = T('gục');
        else if (laSo(t.mau_pct)) { w = Math.max(0, Math.min(100, t.mau_pct)); c = phanTram(w); }
        dong.append(tao('span', '', T('Trùm {i}', { i: i + 1 })), thanhMau(w), tao('span', 'sk__mau-so so', c));
        return dong;
      }));
    });
  }

  function veTop(d) {
    const top = Array.isArray(d.top) ? d.top.filter(laObj).slice(0, 3) : [];
    lap($('sk-top'), JSON.stringify(top), (ol) => ol.replaceChildren(...[0, 1, 2].map((i) => {
      const r = top[i];
      const ten = tao('span', 'sk__top-ten');
      const soEl = tao('span', 'sk__top-so so');
      if (r) {
        const t = chu(r.ten) || T('Một chiến binh');
        const loai = chu(r.loai);
        ten.append(tao('b', '', t));
        if (loai) ten.append(' ', tao('span', 'sk__top-loai', loai));
        ten.title = loai ? `${t}, ${loai}` : t;
        soEl.textContent = soHoac(r.sat_thuong);
      } else {
        ten.textContent = i === 0 ? T('Chưa ai gây sát thương.') : ' ';
      }
      const li = tao('li');
      li.append(ten, soEl);
      return li;
    })));
  }

  function veDang(vt) {
    const d = vt.dang;
    veVung(chu(d.vung));
    const ng = laObj(d.nguoi) ? d.nguoi : {};
    dat($('sk-tg'), soHoac(ng.tham_gia));
    dat($('sk-tv'), soHoac(ng.trong_vung));
    const tin = Array.isArray(d.tin) ? d.tin.find((x) => laObj(x) && chu(x.cau)) : null;
    dat($('sk-tin-gio'), tin && laSo(tin.t) ? hhmm(tin.t) : '');
    datTen($('sk-tin-cau'), tin ? chu(tin.cau) : T('Chưa có thông báo nào trong đợt này.'), tin ? chu(tin.cau) : '');
    veTrum(d);
    const ts = laObj(d.tay_sai) ? d.tay_sai : {};
    if (laSo(ts.song) && laSo(ts.da_xuat_hien)) {
      ghep($('sk-taysai'), [T('Tay sai: '), ['b', so(ts.song), 'so'], T(' còn sống, '),
        ['b', so(Math.max(0, ts.da_xuat_hien - ts.song)), 'so'], T(' đã bị hạ.')]);
    } else if (laSo(ts.song)) {
      ghep($('sk-taysai'), [T('Tay sai: '), ['b', so(ts.song), 'so'], T(' còn sống.')]);
    } else {
      ghep($('sk-taysai'), [T('Chưa đọc được số tay sai.')]);
    }
    veTop(d);
  }
  function gioDang(vt, now) {
    const d = vt.dang;
    const el = $('sk-con');
    if (d.trum_guc) ghep(el, [T('Trùm đã gục, đang chốt kết quả.')]);
    else if (d.dong_ms) ghep(el, [T('Đợt vừa đóng, đang chốt kết quả.')]);
    else if (laSo(d.het_ms) && d.het_ms > now) {
      ghep(el, [T('Còn '), ['b', demNguoc(d.het_ms - now), 'so'], T(' trước khi trùm rút lui.')]);
    } else if (laSo(d.het_ms)) ghep(el, [T('Hết giờ, trùm đang rút lui.')]);
    else ghep(el, [T('Đợt đang chạy, chưa rõ giờ kết thúc.')]);
    /* Số cũ thì nói là cũ: xám lại, kèm giờ bản ghi cuối trong `title` của khối. */
    if (laSo(vt.ts) && now - vt.ts > CU_MS) {
      hop.dataset.cu = '1';
      hop.title = T('Số liệu chưa về thêm từ {t}, trang vẫn đang thử lại.', { t: hhmmss(vt.ts) });
    } else {
      boCu();
    }
  }
  /* "Số cũ" chỉ có nghĩa lúc đang diễn ra — sang trạng thái khác phải gỡ, không thì kết quả đợt xám oan. */
  function boCu() {
    if (!hop.dataset.cu) return;
    delete hop.dataset.cu;
    hop.removeAttribute('title');
  }

  /* ── ba giải của một đợt: DÙNG CHUNG cho "vừa kết thúc" (#sk) và "Vây Trùm đợt trước" (#vd-trum) ──
     Mỗi giải là [tên, phần phụ]. Một chỗ quyết câu chữ — hai khối không thể nói khác nhau về cùng một đợt. */
  function baGiai(g) {
    const guc = g.ket === 'guc';
    const kl = laObj(g.ket_lieu) && chu(g.ket_lieu.ten) ? g.ket_lieu : null;
    const dn = laObj(g.dame_nhat) && chu(g.dame_nhat.ten) ? g.dame_nhat : null;
    const mm = laObj(g.may_man) && chu(g.may_man.ten) ? g.may_man : null;
    return {
      /* Trùm rút lui: "Không ai" ở dòng tên, lý do ở dòng phụ — cả câu ở dòng tên thì cột hẹp chỉ còn "Không ai, trùm đ…". */
      kl: [kl ? chu(kl.ten) : (guc ? T('Không xác định được') : T('Không ai')),
        kl ? chu(kl.loai) : (guc ? '' : T('trùm đã rút lui'))],
      dn: [dn ? chu(dn.ten) : T('Chưa ai gây sát thương'),
        dn && laSo(dn.sat_thuong) ? T('{n} máu lên trùm và tay sai', { n: so(dn.sat_thuong) }) : ''],
      mm: [mm ? chu(mm.ten) : T('Không có ai đủ điều kiện'), mm ? T('bốc thăm trong những ai đã đánh') : ''],
    };
  }
  function datGiai(giai) {
    giai.forEach(([id, ten, phu]) => {
      const el = $(id);
      dat(el, ten);
      dat($(`${id}-phu`), phu || ' ');     // không bao giờ rỗng — xem ghi chú bảng giải ở index.njk
      /* Ô cắt dấu ba chấm cả hàng ⇒ `title` đặt trên ô, đủ cả tên lẫn phần phụ. */
      if (el && el.parentElement) el.parentElement.title = phu ? `${ten}, ${phu}` : ten;
    });
  }

  /* ── "Vây Trùm đợt trước" trong khối vinh danh (2026-10-02) ──────────────
     Chỉ hiện khi có `gan_nhat`. Khi khối `#sk` đầu trang đang mở (bất kỳ trạng thái nào) CSS ẩn phần này —
     đợt đó đã ở trên đầu trang rồi; JS không lật hiển thị theo `data-sk` (luật 1 ở đầu IIFE). */
  function veVdTrum(vt) {
    const hopVd = $('vd-trum');
    if (!hopVd) return;
    const g = vt && laObj(vt.gan_nhat) && laSo(vt.gan_nhat.mo_ms) ? vt.gan_nhat : null;
    if (!g) { hopVd.hidden = true; return; }
    dat($('vd-trum-td'), T('Vây Trùm đợt {ngay}', { ngay: ngayThang(g.mo_ms) }));
    const g3 = baGiai(g);
    datGiai([['vd-g-kl', ...g3.kl], ['vd-g-dn', ...g3.dn], ['vd-g-mm', ...g3.mm]]);
    hopVd.hidden = false;
  }

  /* ── vừa kết thúc ────────────────────────────────────────────────────── */
  function veXong(vt) {
    const g = vt.gan_nhat;
    const guc = g.ket === 'guc';
    const dai = laSo(g.mo_ms) && g.dong_ms > g.mo_ms ? thoiLuong(g.dong_ms - g.mo_ms) : '';
    ghep($('sk-ket-tom'), [guc ? T('Trùm gục lúc ') : T('Trùm rút lui lúc '), ['span', hhmm(g.dong_ms)],
      ...(dai ? [T(', sau '), ['span', dai]] : []),
      ...(laSo(g.so_nguoi) ? [', ', ['span', so(g.so_nguoi)], T(' người tham gia')] : []), '.']);

    const g3 = baGiai(g);
    datGiai([['sk-g-kl', ...g3.kl], ['sk-g-dn', ...g3.dn], ['sk-g-mm', ...g3.mm]]);

    const vung = chu(g.vung);
    ghep($('sk-ket-vung'), laSo(g.mo_ms)
      ? [T('Mở lúc '), ['b', hhmm(g.mo_ms), 'so'], ...(vung ? [T(' ở '), ['b', vung]] : []), '.']
      : (vung ? [T('Vùng săn: '), ['b', vung], '.'] : [' ']));
    ghep($('sk-ket-ts'), laSo(g.tay_sai_ha)
      ? [['b', so(g.tay_sai_ha), 'so'], T(' tay sai bị hạ.')] : [T('Chưa đếm được số tay sai bị hạ.')]);
  }

  /* ── con trùm 3D ─────────────────────────────────────────────────────────
     Tải bộ xem + .glb (~0,7 MB) SAU sự kiện `load` và lúc máy rảnh — màn đầu của trang chủ không đợi
     nó; huy hiệu tên loài nằm sẵn trong khung tới khi mô hình vẽ xong. Màn ≤ 719px: không tải gì
     (CSS cũng ẩn khung). Không vẽ được ⇒ huy hiệu, và trả WebGL context. */
  const khung = $('sk-3d');
  let taiTrang = document.readyState === 'complete';
  let da3D = false;
  function thayHuyHieu(bx) {
    try { if (bx) bx.huy(); } catch { /* bộ xem đã chết sẵn */ }
    if (!khung || !khung.isConnected) return;
    const d = tao('p', 'sk__huy sk__huy--rieng', LOAI_TRUM);
    d.setAttribute('aria-hidden', 'true');
    khung.replaceWith(d);
  }
  function mo3D() {
    let bx = null;
    new Promise((xong, hong) => {
      if (window.dino4vn3D) { xong(window.dino4vn3D); return; }
      document.addEventListener('dino4vn:3d-san-sang', () => xong(window.dino4vn3D), { once: true });
      const s = document.createElement('script');
      s.type = 'module';
      s.src = DUONG_3D;
      s.onerror = () => hong(new Error('khong tai duoc bo xem 3D'));
      document.head.appendChild(s);
    }).then((api) => {
      if (!api || !khung.isConnected) return null;
      bx = api.tao(khung);
      return bx.ve({ species: LOAI_TRUM, colors: MAU_TRUM });
    }).then(() => {
      const s = khung.getAttribute('data-state');
      if (s === 'nogl' || s === 'error') thayHuyHieu(bx);
    }).catch(() => thayHuyHieu(bx));
  }
  function hen3D() {
    if (da3D || !taiTrang || !khung || !docTT()) return;
    if (!window.matchMedia || window.matchMedia('(max-width: 719px)').matches) return;
    da3D = true;
    if ('requestIdleCallback' in window) window.requestIdleCallback(mo3D, { timeout: 2000 });
    else setTimeout(mo3D, 200);
  }
  if (!taiTrang) window.addEventListener('load', () => { taiTrang = true; hen3D(); }, { once: true });

  /* ── tải + ghép ──────────────────────────────────────────────────────── */
  let lech = 0;                  // giờ máy chủ − giờ máy người xem (ms), đo bằng header Date
  let docVT;                     // undefined = chưa tải được lần nào; null = 404 (không có tệp)
  let docSK;
  let tt = docTT();
  let hen = null;
  let lanTai = 0;

  async function tai(duong) {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), CHO);
    try {
      const r = await fetch(duong, { signal: bo.signal, cache: 'no-cache', credentials: 'same-origin' });
      const d = Date.parse(r.headers.get('Date') || '');
      if (Number.isFinite(d) && Math.abs(d - Date.now()) < 86400000) lech = d - Date.now();
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(h); }
  }

  /* `L.coDuLieu` (sk-luat.js): dữ liệu để vẽ trạng thái CÒN trong bản đã tải hay không. Mỗi nhánh tự kiểm — lúc
     chưa tải đủ hai tệp, trạng thái còn là của `/api/su-kien.js` và có thể chưa có gì để điền; khi đó để nguyên
     chỗ giữ "—". Cùng hàm đó quyết việc GIỮ khung (`L.giuKhung`). */
  function veDu(now) {
    const vt = hopLe(docVT), sk = hopLe(docSK);
    if (!L.coDuLieu(tt, sk, vt)) return;
    if (tt === 'lich') veLich(sk, vt, now);
    else if (tt === 'bao') veBao(vt);
    else if (tt === 'dang') veDang(vt);
    else if (tt === 'xong') veXong(vt);
  }
  function veGio(now) {
    const vt = hopLe(docVT), sk = hopLe(docSK);
    if (L.coDuLieu(tt, sk, vt)) {
      if (tt === 'lich') gioLich(sk, now);
      else if (tt === 'bao') gioBao(vt, now);
      else if (tt === 'dang') gioDang(vt, now);
    }
    if (tt !== 'dang') boCu();
  }

  let daXacNhan = false;         // `tt` đã được JSON xác nhận trong phiên này (khối chú thích đầu IIFE)

  function capNhat(moiTai) {
    const now = Date.now() + lech;
    /* Chỉ tự quyết trạng thái khi đã có CẢ HAI tệp (404 cũng là "có": biết chắc là không có).
       Một tệp hỏng mạng mà quyết theo tệp kia là sập khối đúng lúc đang có đợt. */
    const du = docVT !== undefined && docSK !== undefined;
    let moi = du ? L.trangThai(docSK, docVT, now) : docTT();
    if (du) {
      moi = L.giuKhung(tt, daXacNhan, moi, docSK, docVT);      // GIỮ khung — khối chú thích đầu IIFE
      daXacNhan = moi !== null;
    }
    if (moi !== docTT()) datTT(moi);
    if (moi !== tt || moiTai) { tt = moi; veDu(now); }
    if (moiTai) veVdTrum(hopLe(docVT));     // khối vinh danh — không phụ thuộc trạng thái `#sk`
    veGio(now);
    if (tt) hen3D();
  }

  function nhip() {
    if (tt === 'dang') return NHIP_DANG;
    const vt = hopLe(docVT), sk = hopLe(docSK);
    const mo = tt === 'bao' && L.coDuLieu('bao', sk, vt) ? vt.sap.mo_luc_ms
      : tt === 'lich' && L.coDuLieu('lich', sk, vt) ? sk.lich.mo_luc_ms : null;
    /* Sát giờ mở (hoặc đã qua mà còn chờ): hỏi 5 s/lần để thấy báo trước / đợt mở ngay. */
    if (mo !== null && mo - (Date.now() + lech) <= SAT_GIO_MS) return NHIP_DANG;
    return tt ? NHIP_CO : NHIP_RANH;
  }

  async function vong() {
    clearTimeout(hen);
    const [a, b] = await Promise.allSettled([tai(API_VT), tai(API_SK)]);
    /* Hỏng mạng / máy chủ chưa trả lời: GIỮ bản đang có, lần sau thử lại. */
    if (a.status === 'fulfilled') docVT = a.value;
    if (b.status === 'fulfilled') docSK = b.value;
    lanTai = Date.now();
    capNhat(true);
    hen = setTimeout(() => { if (!document.hidden) vong(); }, nhip());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    /* Người xem vừa quay lại tab: lúc vắng họ không nhìn khối, nên thôi GIỮ (một kết quả "vừa kết thúc" để tab mở
       qua đêm không được đứng đó tới sáng) — và tính lại NGAY, trong chính sự kiện này, để khối nếu phải ẩn thì ẩn
       trước khung hình đầu tiên họ thấy, không phải một giây sau khi họ đã bắt đầu đọc. */
    daXacNhan = false;
    if (lanTai) capNhat(false);
    const n = nhip();
    if (Date.now() - lanTai >= n) vong();
    else { clearTimeout(hen); hen = setTimeout(vong, n - (Date.now() - lanTai)); }
  });
  /* Đồng hồ đếm ngược đổi mỗi giây — đó là dữ liệu đổi, không phải hiệu ứng. */
  setInterval(() => { if (!document.hidden && lanTai) capNhat(false); }, 1000);
  /* `hen3D()` chạy lần đầu từ `capNhat` SAU lượt tải đầu, không phải ở đây: khung 3D đo cỡ lúc tạo bộ
     xem, và lúc JSON chưa về thì chữ trong khối còn đang là chỗ giữ — đo lúc đó từng cho góc máy hụt. */
  vong();
})();


/* Khối "Cảm ơn người góp server" `#vd-gop` (2026-10-02, chủ server chốt từ mockup).
 *
 * 🔴 KHÔNG BAO GIỜ hiện tổng tiền (ngày, tháng, cộng dồn) hay câu về chi phí, hạ tầng — chủ server chốt
 *    2026-10-02. `donate.json` cũng không còn hai khoá tổng (`ops/donate/xuatban.py`). Chỉ TỪNG người.
 * Dữ liệu: bản `donate.json` mà `chay.js` (dải cảm ơn, mọi trang) đã tải — sự kiện `dino4vn:donate`, bản cuối ở
 *   `window.__dino4vnDonate`. Không tự tải thêm: `chay.js` đã làm mới mỗi 60 s.
 * Ba kỷ luật như `chay.js`:
 *   · `textContent`, KHÔNG BAO GIỜ `innerHTML` — tên và lời nhắn do người lạ nhập;
 *   · dữ liệu cũ hơn 30 phút thì thôi hiện;
 *   · `topNgay` phải là của HÔM NAY (`d.ngay`): `donate.json` chỉ dựng lại khi có thay đổi, nên qua nửa đêm mà
 *     chưa ai góp thì nó vẫn là danh sách hôm qua (cùng lý do khoá `ngay` ở `donate.js::xetQua`).
 * Khối nằm dưới màn đầu (bắt đầu ~1.380 px ở 1440×900), nên dựng danh sách bằng JS không đẩy gì người đang xem.
 */
(() => {
  'use strict';

  const hop = document.getElementById('vd-gop');
  if (!hop) return;
  const T = window.D4V_T;
  const EN = document.documentElement.lang === 'en';
  const LOC = EN ? 'en-US' : 'vi-VN';
  const LOC_GIO = EN ? 'en-GB' : 'vi-VN';
  const THANG_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Ngày/tháng: "12/10" trên trang Việt, "Oct 12" trên trang Anh (d/m dễ đọc nhầm thành m/d). */
  const dm = (d, m) => (EN ? `${THANG_EN[m - 1]} ${d}` : `${d}/${m}`);
  const $ = (id) => document.getElementById(id);
  const QUA_CU = 30 * 60 * 1000;   // khớp `chay.js`
  const LECH = 2 * 60 * 1000;
  const TOI_DA = 15;               // = `TOP_N` của `ops/donate/xuatban.py` (chủ server chốt 2026-10-02)
  const NHAN_TOI_DA = 8;
  const GIO_VN = 7 * 3600000;

  const ngayVN = (ms) => new Date(ms + GIO_VN).toISOString().slice(0, 10);   // "YYYY-MM-DD", cùng dạng `d.ngay`
  const tien = (n) => (Number(n) || 0).toLocaleString(LOC) + ' ₫';
  const tao = (tag, cls, c) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (c !== undefined && c !== null) e.textContent = String(c);
    return e;
  };
  let hhmm;
  try {
    const f = new Intl.DateTimeFormat(LOC_GIO, {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
    });
    hhmm = (ms) => f.format(new Date(ms));
  } catch { hhmm = (ms) => new Date(ms + GIO_VN).toISOString().slice(11, 16); }
  /* Lời nhắn hôm nay: "19:23". Ngày khác: "1/10" — "19:23" trơn của hôm qua đọc thành hôm nay. */
  function khiChu(ms, now) {
    if (ngayVN(ms) === ngayVN(now)) return hhmm(ms);
    const d = new Date(ms + GIO_VN);
    return dm(d.getUTCDate(), d.getUTCMonth() + 1);
  }

  let daCo = false;

  function ve(d) {
    if (!d || typeof d !== 'object') return;
    daCo = true;
    const now = Date.now();
    const ds = $('vd-gop-ds'), dan = $('vd-gop-dan'), nhan = $('vd-nhan'), nhanTrong = $('vd-nhan-trong');
    const builtAt = (Number(d.builtAt) || 0) * 1000;
    if (!builtAt || now - builtAt > QUA_CU + LECH || builtAt - now > LECH) {
      if (dan) dan.textContent = T('Danh sách người góp chưa được cập nhật. Xem lại sau ít phút.');
      if (ds) ds.hidden = true;
      if (nhan) nhan.hidden = true;
      if (nhanTrong) nhanTrong.hidden = true;
      return;
    }

    const homNay = typeof d.ngay === 'string' && d.ngay === ngayVN(now);
    const top = homNay && Array.isArray(d.topNgay) ? d.topNgay.slice(0, TOI_DA) : [];
    if (dan) {
      const [, th, ng] = ngayVN(now).split('-').map(Number);
      dan.textContent = top.length
        ? T('Người góp nhiều nhất hôm nay ({ngay}).', { ngay: dm(ng, th) })
        : T('Hôm nay chưa có ai góp. Người góp đầu tiên sẽ đứng đầu danh sách này.');
    }
    if (ds) {
      ds.replaceChildren(...top.map((h) => {
        const li = tao('li');
        const ten = tao('span', 'vd__ten');
        ten.append(tao('b', null, h.ten || T('Ẩn danh')));
        ten.title = h.ten || T('Ẩn danh');
        li.append(ten, tao('span', 'vd__so so', tien(h.soTien)));
        return li;
      }));
      ds.hidden = !top.length;
    }

    if (nhan) {
      const ln = (Array.isArray(d.chayChu) ? d.chayChu : [])
        .filter((h) => h && typeof h.loiNhan === 'string' && h.loiNhan.trim())
        .slice(0, NHAN_TOI_DA);
      nhan.replaceChildren(...ln.map((h) => {
        const li = tao('li');
        const ten = h.ten || T('Ẩn danh');
        const dau = tao('div', 'vd__nhan-dau');
        dau.append(tao('b', null, ten), tao('span', 'so', tien(h.soTien)));
        if (Number(h.khi)) dau.append(tao('span', 'dim so', khiChu(Number(h.khi) * 1000, now)));
        /* Lời nhắn dài cắt một dòng bằng CSS; `title` giữ bản đầy đủ — cùng cách dải cảm ơn làm. */
        li.title = `${ten} ${tien(h.soTien)} “${h.loiNhan}”`;
        li.append(dau, tao('p', 'vd__nhan-loi', h.loiNhan));
        return li;
      }));
      nhan.hidden = !ln.length;
      if (nhanTrong) nhanTrong.hidden = ln.length > 0;
    }
  }

  document.addEventListener('dino4vn:donate', (e) => ve(e.detail));
  if (window.__dino4vnDonate) ve(window.__dino4vnDonate);
  /* `chay.js` không tải được (mạng hỏng, file bị chặn): sau 12 s nói thật thay vì đứng "Đang tải…" mãi. */
  setTimeout(() => {
    if (daCo) return;
    const dan = $('vd-gop-dan');
    if (dan) dan.textContent = T('Chưa lấy được danh sách người góp. Thử tải lại trang.');
  }, 12000);
})();


/* Khối "Kết quả sự kiện gần nhất" `#skgn` (2026-10-05, chủ server chốt).
 *
 * Nguồn `/api/su-kien-gan-day.json` (`panel/app/su_kien_luu.py::json_cong_khai`): `{ v: 1, ts, su_kien: null | {…} }`,
 *   CHỈ TÊN, không SteamID. Panel chọn sự kiện: mục admin ghim, không có thì sự kiện chốt xong mới nhất; GIỮ tới khi
 *   có sự kiện mới. `su_kien: null` hoặc 404 ⇒ khối ẩn. Hỏng mạng ⇒ giữ bản đang hiện, lần sau thử lại.
 * Bản mẫu xem thử: `web/mau/su-kien-gan-day.mau.json` (chép vào `web/dist/api/su-kien-gan-day.json`, web/README.md).
 * Kỷ luật như hai khối trên: `textContent`, KHÔNG BAO GIỜ `innerHTML` (tên đội, tên người chơi, ghi chú admin);
 *   `null` khác `0`; chỉ điền chữ vào ba hàng có sẵn trong HTML. Màu đội chỉ nhận `#rrggbb`, tô bằng thuộc tính
 *   `fill` của chấm SVG.
 * Nhịp: 60 s, tab ẩn thì thôi hỏi (sự kiện chỉ đổi khi một giải / đợt Vây Trùm kết thúc).
 */
(() => {
  'use strict';

  const hop = document.getElementById('skgn');
  if (!hop) return;
  const T = window.D4V_T;
  const EN = document.documentElement.lang === 'en';
  const LOC = EN ? 'en-US' : 'vi-VN';
  const LOC_GIO = EN ? 'en-GB' : 'vi-VN';
  const THANG_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Ngày/tháng: "12/10" trên trang Việt, "Oct 12" trên trang Anh (d/m dễ đọc nhầm thành m/d). */
  const dm = (d, m) => (EN ? `${THANG_EN[m - 1]} ${d}` : `${d}/${m}`);
  const $ = (id) => document.getElementById(id);
  const API = '/api/su-kien-gan-day.json';
  const NHIP = 60000;
  const CHO = 8000;
  const GIO_VN = 7 * 3600000;

  const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
  const laObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const chu = (v) => (typeof v === 'string' ? v.trim() : '');
  const so = (n) => Number(n).toLocaleString(LOC, { maximumFractionDigits: 0 });
  const dat = (el, c) => { if (el && el.textContent !== c) el.textContent = c; };
  const buoi = (h) => (h < 5 ? T('Đêm') : h < 11 ? T('Sáng') : h < 13 ? T('Trưa') : h < 18 ? T('Chiều') : T('Tối'));
  /* "Tối 4/10" — giờ Việt Nam, không phụ thuộc múi giờ máy người xem. */
  function ngay(t) {
    const d = new Date(t + GIO_VN);
    return `${buoi(d.getUTCHours())} ${dm(d.getUTCDate(), d.getUTCMonth() + 1)}`;
  }

  /* Một hàng bảng: nhãn, tên (cắt dấu ba chấm, đủ ở `title`), phần phụ. Không có người ⇒ "Chưa có". */
  function hang(i, nhan, ten, phu) {
    dat($(`skgn-n${i}`), nhan);
    const el = $(`skgn-g${i}`);
    dat(el, ten || T('Chưa có'));
    dat($(`skgn-g${i}-phu`), phu || ' ');
    if (el && el.parentElement) el.parentElement.title = ten ? (phu ? `${ten}, ${phu}` : ten) : '';
  }
  const tenNguoi = (p) => (laObj(p) ? chu(p.ten) : '');
  function phuNguoi(p, phan) {
    if (!laObj(p)) return '';
    const doi = chu(p.doi);
    return [doi, ...phan].filter(Boolean).join(', ');
  }
  const kill = (p) => (laObj(p) && laSo(p.kill) ? T('{n} kill', { n: so(p.kill) }) : '');
  const dmg = (p) => (laObj(p) && laSo(p.dmg) ? T('{n} sát thương', { n: so(p.dmg) }) : '');

  function chamMau(mau) {
    const cham = $('skgn-cham'), tron = $('skgn-cham-tron');
    const hex = typeof mau === 'string' && /^#[0-9a-fA-F]{6}$/.test(mau) ? mau : null;
    if (tron && hex) tron.setAttribute('fill', hex);
    /* SVG KHÔNG có thuộc tính DOM `.hidden` (chỉ HTMLElement có) — gán `cham.hidden = false` chỉ tạo một thuộc tính JS,
       thuộc tính HTML `hidden` ở lại và chấm không bao giờ hiện. Phải bật/tắt chính thuộc tính đó. */
    if (cham) cham.toggleAttribute('hidden', !hex);
  }

  function veGiai(s) {
    const vd = laObj(s.vo_dich) ? s.vo_dich : null;
    const phan = [];
    if (laSo(s.so_nguoi)) phan.push(T('{n} người thi đấu', { n: so(s.so_nguoi) }));
    if (laSo(s.so_tran)) phan.push(T('{n} trận', { n: so(s.so_tran) }));
    if (laSo(s.tong_kill)) phan.push(T('{n} kill', { n: so(s.tong_kill) }));
    dat($('skgn-dan'), [laSo(s.bat_dau_ms) ? ngay(s.bat_dau_ms) : '', ...phan].filter(Boolean).join(', ') + '.');
    chamMau(vd && vd.mau);
    dat($('skgn-kq'), vd && chu(vd.ten) ? chu(vd.ten) : T('Chưa có đội vô địch'));
    const tv = vd && Array.isArray(vd.thanh_vien) ? vd.thanh_vien.map(chu).filter(Boolean) : [];
    dat($('skgn-kq-phu'), vd ? (tv.length ? T('Vô địch, gồm {ds}.', { ds: tv.join(', ') }) : T('Vô địch.')) : ' ');
    hang(1, T('MVP'), tenNguoi(s.mvp), phuNguoi(s.mvp, [kill(s.mvp), dmg(s.mvp)]));
    hang(2, T('Sát thương nhiều nhất'), tenNguoi(s.dmg_nhat), phuNguoi(s.dmg_nhat, [dmg(s.dmg_nhat)]));
    hang(3, T('Giết nhiều nhất'), tenNguoi(s.kill_nhat), phuNguoi(s.kill_nhat, [kill(s.kill_nhat)]));
  }

  function veTrum(s) {
    const phan = [];
    if (laSo(s.so_nguoi)) phan.push(T('{n} người tham gia', { n: so(s.so_nguoi) }));
    dat($('skgn-dan'), [laSo(s.bat_dau_ms) ? ngay(s.bat_dau_ms) : '', ...phan].filter(Boolean).join(', ') + '.');
    chamMau(null);
    dat($('skgn-kq'), chu(s.ket_chu) || T('Đợt đã kết thúc'));
    const vung = chu(s.vung);
    const ts = laSo(s.tay_sai_ha) ? T('{n} tay sai bị hạ', { n: so(s.tay_sai_ha) }) : '';
    const kl = laObj(s.ket_lieu_trum) ? chu(s.ket_lieu_trum.ten) : '';
    const phu = [vung ? T('Ở {vung}', { vung }) : '', ts, kl ? T('{ten} hạ đòn cuối trùm', { ten: kl }) : ''].filter(Boolean);
    dat($('skgn-kq-phu'), phu.length ? phu.join(', ') + '.' : ' ');
    /* MVP: hạng 1 bảng điểm của đợt, hoặc người admin chọn ở panel (cùng hàng với giải đấu). */
    hang(1, T('MVP'), tenNguoi(s.mvp), phuNguoi(s.mvp, [dmg(s.mvp)]));
    hang(2, T('Sát thương nhiều nhất'), tenNguoi(s.dmg_nhat), phuNguoi(s.dmg_nhat, [dmg(s.dmg_nhat)]));
    const k = laObj(s.kill_nhat) && laSo(s.kill_nhat.kill) ? T('{n} lần kết liễu', { n: so(s.kill_nhat.kill) }) : '';
    hang(3, T('Kết liễu nhiều nhất'), tenNguoi(s.kill_nhat), k);
  }

  function ve(d) {
    const s = laObj(d) && d.v === 1 && laObj(d.su_kien) ? d.su_kien : null;
    if (!s || (s.loai !== 'giai_dau' && s.loai !== 'vay_trum')) { hop.hidden = true; return; }
    /* Tiêu đề "Kết quả <tên>": tên tự động của Vây Trùm có dạng "Vây Trùm — <vùng>" — vùng đã ở dòng dưới, và tiêu
       đề không mang gạch dài (checklist #3). */
    const ten = chu(s.ten).split(' — ')[0] || (s.loai === 'giai_dau' ? T('giải đấu') : T('Vây Trùm'));
    dat($('skgn-td'), T('Kết quả {ten}', { ten }));
    if (s.loai === 'giai_dau') veGiai(s); else veTrum(s);
    const ghi = $('skgn-ghi'), gc = chu(s.ghi_chu);
    if (ghi) { dat(ghi, gc); ghi.hidden = !gc; }
    const them = $('skgn-them'), lk = $('skgn-lk');
    const duong = s.lien_ket === '/giai-dau' || s.lien_ket === '/event' ? s.lien_ket : null;
    if (lk && duong) {
      lk.href = duong;
      dat(lk, duong === '/giai-dau' ? T('Xem đội, sơ đồ và kết quả từng trận') : T('Xem bảng điểm đầy đủ của đợt'));
    }
    if (them) them.hidden = !duong;
    hop.hidden = false;
  }

  let hen = null;
  let lanTai = 0;
  async function tai() {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), CHO);
    try {
      const r = await fetch(API, { signal: bo.signal, cache: 'no-cache', credentials: 'same-origin' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(h); }
  }
  async function vong() {
    clearTimeout(hen);
    try { ve(await tai()); } catch { /* hỏng mạng: giữ bản đang hiện */ }
    lanTai = Date.now();
    hen = setTimeout(() => { if (!document.hidden) vong(); }, NHIP);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (Date.now() - lanTai >= NHIP) vong();
    else { clearTimeout(hen); hen = setTimeout(vong, NHIP - (Date.now() - lanTai)); }
  });
  vong();
})();
