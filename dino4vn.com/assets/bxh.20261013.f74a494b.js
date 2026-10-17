/* bxh.js — vẽ bảng xếp hạng công khai từ /api/bang-xep-hang.json
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 NĂM ĐIỀU KHÔNG ĐƯỢC PHÁ
 * ════════════════════════════════════════════════════════════════════════
 * 1. `km === null` NGHĨA LÀ "CHƯA ĐO", khác hẳn `0` ("đã đo, bằng 0"). Hiện
 *    `0` ở đây là nói với người chơi rằng họ đi được 0 km — bịa số.
 * 2. HỆ SỐ ĐỌC TỪ JSON, không viết cứng. Tuần 2 bật cột km chỉ là một lệnh
 *    UPDATE dưới server; trang phải tự đổi theo, kể cả caption công thức.
 *    (Bài học: trang chủ từng hardcode "Growth 1.3x" rồi Game.ini đổi mà
 *    không ai biết.)
 *    (2026-10-04) km và con trưởng thành nhân hệ số THEO LOÀI (máy chủ tính, không
 *    công khai). `coef.km`/`coef.adult` chỉ còn là hằng GỐC ⇒ trang
 *    KHÔNG in chúng ra nữa (in là nói sai với gần như mọi loài). `coef.km` vẫn quyết
 *    cột km bật hay "đang đo"; trần trưởng thành mỗi ngày đọc `adultToiDaNgay`.
 * 3. `textContent`, KHÔNG BAO GIỜ `innerHTML`. Tên người chơi do người lạ
 *    đặt; CSP chặn `<script>` inline nhưng không chặn `<img onerror>`.
 * 4. Dữ liệu quá cũ thì THÔI HIỆN, đừng đoán. Số cũ tệ hơn không có số.
 * 5. (2026-09-14) Bục top 3 vẽ con dino 3D bằng MÀU THẬT (`mau3d` từ máy chủ). Không
 *    có `mau3d` thì hiện HUY HIỆU tên loài — không bao giờ vẽ một con xám bịa ra.
 *    (2026-10-03) `mau3d` = con GẦN NHẤT CÓ MÀU THẬT của người đó, có thể KHÁC loài của hàng
 *    (`panel/app/pub.py::mau3d_tu_gara`); chữ loài dưới bục đi theo `mau3d.species`.
 *    Mỗi bộ xem giữ MỘT WebGL context: đổi tab phải `huy()` bộ cũ, không thì vài lần
 *    bấm là trình duyệt thu hồi context và khung đen trơn, không lỗi nào báo.
 *    (2026-09-15) Cùng con cùng màu ở tab kia thì DÙNG LẠI bộ xem, không huỷ-dựng lại.
 *    Bộ xem tự báo không vẽ được (không WebGL, tiết kiệm dữ liệu, chưa có mô hình) cũng
 *    rơi về huy hiệu — câu thông báo của nó viết cho /gara, không vừa ô bục.
 *
 * Không poll: bảng xếp hạng không phải thứ đổi từng giây, và người đọc có thể
 * tự tải lại. Máy chủ dựng lại vài phút một lần nên poll 30 giây chỉ tốn công.
 *
 * HAI CHỖ DÙNG (2026-10-02): trang `/bang-xep-hang` (`#bxh-than`) và khối "Ai dẫn đầu" trên
 * TRANG CHỦ (`#vd-bxh`: bục + hạng 4–8 + kỷ lục trong ngày `kyLucNgay`). Cùng một file để bục
 * 3D — phần khó nhất (WebGL context, dùng lại khung khi đổi tab) — chỉ có MỘT bản.
 */
(() => {
  'use strict';

  const T = window.D4V_T;
  const EN = document.documentElement.lang === 'en';
  const API = '/api/bang-xep-hang.json';
  const DUONG_3D = '/assets/dino3d.20261012.abc66f91.js';
  const QUA_CU = 1800000;   // 30 phút = 3 chu kỳ dựng lại bị lỡ liên tiếp
  const LECH   = 120000;
  const CHO    = 10000;

  const $ = (id) => document.getElementById(id);
  const than = $('bxh-than');        // trang /bang-xep-hang
  const vd = $('vd-bxh');            // khối trên trang chủ
  if (!than && !vd) return;

  const capt = $('bxh-caption'), buc = $('bxh-buc') || $('vd-buc'), tong = $('bxh-tong');
  const tuoiEl = $('bxh-tuoi');
  const tabNgay = $('tab-homnay') || $('vd-tab-homnay');
  const tabThang = $('tab-thangnay') || $('vd-tab-thangnay');
  let dulieu = null, dangXem = 'homnay';

  let hhmm;
  try {
    const f = new Intl.DateTimeFormat(EN ? 'en-GB' : 'vi-VN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
    });
    hhmm = (d) => f.format(d);
  } catch { hhmm = (d) => d.toISOString().slice(11, 16); }

  const so = (n, le = 0) => Number(n).toLocaleString(EN ? 'en-US' : 'vi-VN', {
    minimumFractionDigits: le, maximumFractionDigits: le,
  });

  function gio(phut) {
    // Làm tròn TỔNG phút trước rồi mới chia: làm tròn phần dư ra "11h 60m" với 719,7 phút (đo 2026-10-02).
    const t = Math.round(phut), h = Math.floor(t / 60), m = t % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  const tao = (tag, cls, chu) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (chu !== undefined && chu !== null) e.textContent = String(chu);
    return e;
  };

  /* ── Bộ xem 3D cho bục ──────────────────────────────────────────────────
     Cùng cầu nối với `gara.js`: `dino3d.js` là module ES, file này là script
     thường, nên đi qua `window.dino4vn3D` + sự kiện `dino4vn:3d-san-sang`.
     Module chỉ nạp khi bục THẬT SỰ lọt vào khung nhìn và có con để vẽ. */
  let choBoXem = null;
  function napBoXem() {
    if (choBoXem) return choBoXem;
    choBoXem = new Promise((xong, hong) => {
      if (window.dino4vn3D) { xong(window.dino4vn3D); return; }
      document.addEventListener('dino4vn:3d-san-sang', () => xong(window.dino4vn3D), { once: true });
      const s = document.createElement('script');
      s.type = 'module';
      s.src = DUONG_3D;
      s.onerror = () => hong(new Error('khong tai duoc bo xem 3D'));
      document.head.appendChild(s);
    });
    return choBoXem;
  }

  /* Mỗi mục: {khoa, khung, bx, daMo}. `khoa` = loài + màu — hai tab có cùng con thì dùng
     chung một mục (xem `veBuc`). */
  let boXemBuc = [];
  let quanSat = null;
  function huyMot(x) {
    try { if (x.bx) x.bx.huy(); } catch { /* bộ xem đã chết sẵn */ }
    x.bx = null;
  }
  function huyBuc() {
    if (quanSat) { quanSat.disconnect(); quanSat = null; }
    boXemBuc.forEach(huyMot);
    boXemBuc = [];
  }
  function khoaMau(m) {
    return m.species + '|' + JSON.stringify(Object.keys(m.colors).sort().map((k) => [k, m.colors[k]]));
  }

  function huyHieuLoai(loai) {
    const d = tao('div', 'buc__huy', loai || '?');
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  function khung3D() {
    const k = tao('section', 'v3d v3d--buc');
    k.setAttribute('data-tuquanly', '1');        // trang tự quản lý, module đừng tự gắn
    k.setAttribute('data-state', 'idle');
    const san = tao('div', 'v3d__san');
    const c = document.createElement('canvas');
    c.className = 'v3d__canvas';
    c.width = 1; c.height = 1;
    san.append(c, tao('p', 'v3d__msg', T('Đang tải mô hình…')));
    k.appendChild(san);
    return k;
  }

  /* Bộ xem không vẽ được -> huy hiệu tên loài (luật 5), và trả WebGL context. */
  function thayHuyHieu(x, loai) {
    huyMot(x);
    const i = boXemBuc.indexOf(x);
    if (i >= 0) boXemBuc.splice(i, 1);
    if (x.khung.isConnected) x.khung.replaceWith(huyHieuLoai(loai));
  }

  function moBoXem(x, m) {
    x.daMo = true;
    const k = x.khung;
    napBoXem().then((api) => {
      // Đổi tab trong lúc chờ và mục này không còn ai dùng -> bỏ.
      if (!api || !k.isConnected || !boXemBuc.includes(x)) return null;
      x.bx = api.tao(k);
      // Máy chủ không gửi `growth` cho bục (review PR #7) -> bộ xem vẽ con trưởng thành.
      return x.bx.ve({ species: m.species, colors: m.colors || {} });
    }).then(() => {
      const s = k.getAttribute('data-state');
      if (k.isConnected && (s === 'nogl' || s === 'error')) thayHuyHieu(x, m.species);
    }).catch(() => thayHuyHieu(x, m.species));
  }

  function veBuc(hang) {
    if (!buc) return;
    if (quanSat) { quanSat.disconnect(); quanSat = null; }
    const cu = boXemBuc;
    boXemBuc = [];
    buc.replaceChildren();
    if (hang.length < 3) { cu.forEach(huyMot); buc.hidden = true; return; }

    const cho = [];
    hang.slice(0, 3).forEach((r) => {
      const o = tao('div', 'buc__o' + (r.hang === 1 ? ' buc__o--1' : ''));
      const m = r.mau3d;
      let hinh;
      if (m && m.species && m.colors) {
        // Đổi tab mà vẫn là con đó, màu đó (top 3 "hôm nay" hay trùng "tháng này") thì
        // chuyển NGUYÊN khung sang ô mới: canvas giữ context, không tải lại .glb, không
        // chớp "Đang tải mô hình…" mỗi cú bấm.
        const khoa = khoaMau(m);
        const i = cu.findIndex((x) => x.khoa === khoa);
        const x = i >= 0 ? cu.splice(i, 1)[0] : { khoa, khung: khung3D(), bx: null, daMo: false };
        boXemBuc.push(x);
        hinh = x.khung;
        if (!x.daMo) cho.push([x, m]);
      } else {
        hinh = huyHieuLoai(r.loai);
      }
      o.append(
        hinh,
        tao('p', 'buc__hang', '#' + r.hang),
        tao('p', 'buc__ten', r.ten),
        /* Chữ loài THEO CON ĐƯỢC VẼ (chủ server chốt 2026-10-03): bục vẽ con gần nhất có màu thật, có
           thể khác loài hay chơi của hàng — chữ "Allosaurus" dưới một con Pachycephalosaurus là nói sai. */
        tao('p', 'buc__loai', (m && m.species && m.colors ? m.species : r.loai) || T('chưa rõ loài')),
        tao('p', 'buc__diem so', T('{n} điểm', { n: so(r.diem) })),
        tao('p', 'buc__loai so', T('{gio} sống sót', { gio: gio(r.phut) })),
      );
      buc.appendChild(o);
    });
    buc.hidden = false;
    cu.forEach(huyMot);                 // bộ xem không còn ô nào dùng -> trả context
    if (!cho.length) return;

    if (!('IntersectionObserver' in window)) {
      cho.forEach(([x, m]) => moBoXem(x, m));
      return;
    }
    // Dùng `ob` của CHÍNH callback, không dùng biến `quanSat`: một mục đã xếp hàng cho
    // observer cũ có thể bắn sau khi `veBuc`/`bao` đã thay hoặc xoá `quanSat`.
    quanSat = new IntersectionObserver((vao, ob) => {
      vao.forEach((e) => {
        if (!e.isIntersecting) return;
        ob.unobserve(e.target);
        const muc = cho.find(([x]) => x.khung === e.target);
        if (muc) moBoXem(muc[0], muc[1]);
      });
    }, { rootMargin: '200px' });
    cho.forEach(([x]) => quanSat.observe(x.khung));
  }

  /* Một dòng trống tử tế, KHÔNG phải một dòng lỗi. */
  function bao(chu, loi) {
    if (!than) { baoTrangChu(chu, loi); return; }
    than.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = loi ? 'trong canhbao' : 'trong';
    td.textContent = chu;
    tr.appendChild(td); than.appendChild(tr);
    huyBuc();
    if (buc) buc.hidden = true;
    if (tong) tong.hidden = true;
  }

  function o(nhan, chu, cls) {
    const td = document.createElement('td');
    td.setAttribute('data-nhan', nhan);
    if (cls) td.className = cls;
    if (chu instanceof Node) td.appendChild(chu); else td.textContent = chu;
    return td;
  }

  function veBang(hang, kmDangDo, trong) {
    than.replaceChildren();
    if (!hang.length) {
      bao(trong || T('Chưa ai đủ dữ liệu trong khoảng thời gian này.'));
      return;
    }
    const manh = document.createDocumentFragment();
    hang.forEach((r) => {
      const tr = document.createElement('tr');
      let km;
      if (kmDangDo || r.km === null || r.km === undefined) {
        km = document.createElement('span');
        km.className = 'pill'; km.textContent = T('đang đo');
      } else {
        km = so(r.km, 1) + ' km';
      }
      tr.append(
        o(T('Hạng'), '#' + r.hang, 'bxh__hang'),
        o(T('Người chơi'), r.ten, 'bxh__ten'),
        o(T('Khủng long'), r.loai || '—'),
        o(T('Thời gian sống'), gio(r.phut), 'so'),
        o(T('Quãng đường'), km, 'so'),
        o(T('Trưởng thành'), String(r.adult), 'so'),
        o(T('Điểm'), so(r.diem), 'bxh__diem so'),
      );
      manh.appendChild(tr);
    });
    than.appendChild(manh);
  }

  function veTong(hang) {
    if (!tong) return;
    const phut = hang.reduce((s, r) => s + r.phut, 0);
    const km = hang.reduce((s, r) => s + (r.km || 0), 0);
    const ad = hang.reduce((s, r) => s + r.adult, 0);
    $('tg-nguoi').textContent = so(hang.length);
    $('tg-gio').textContent = gio(phut);
    $('tg-km').textContent = km > 0 ? so(km, 1) + ' km' : T('chưa đo');
    $('tg-adult').textContent = so(ad);
    tong.hidden = false;
  }

  /* Caption công thức đổi theo JSON — không viết cứng con số nào (quy tắc 2). */
  function veCongThuc(d) {
    const c = d.coef || {};
    const p = $('ct-phut'), kmO = $('ct-km-o'), ghi = $('ct-ghichu');
    const loi = $('ct-km-loi'), tran = $('ct-tran'), meo = $('meo-adult');
    if (p && typeof c.phut === 'number') p.textContent = so(c.phut, 1);
    // Trần con trưởng thành được tính mỗi ngày; 0 = không trần.
    const n = d.adultToiDaNgay;
    if (typeof n === 'number' && n >= 0) {
      if (tran) tran.textContent = n > 0 ? T(', mỗi ngày tính tối đa {n} con', { n: so(n) }) : '';
      if (meo) {
        meo.textContent = n === 0
          ? T('Mỗi con nuôi tới 100% đều được cộng điểm thưởng.')
          : n === 1
            ? T('Mỗi ngày, một con nuôi tới 100% được cộng điểm thưởng. ')
              + T('Con thứ hai trong cùng ngày không cộng thêm.')
            : T('Mỗi ngày, tối đa {n} con nuôi tới 100% được cộng điểm thưởng.', { n: so(n) });
      }
    }
    if (!kmO) return;
    kmO.replaceChildren();
    if (d.kmDangDo || !c.km) {
      const pill = document.createElement('span');
      pill.className = 'pill'; pill.textContent = T('đang đo');
      kmO.appendChild(pill);
      if (ghi) {
        ghi.textContent = T('Cột Quãng đường đang được đo, bọn mình mới bắt đầu ghi. ')
          + T('Khi đủ dữ liệu, quãng đường sẽ được cộng điểm.');
        ghi.hidden = false;
      }
      // Mục "Muốn lên bảng?" cũng phải theo hệ số thật, nếu không nó hứa điểm
      // cho một cột chưa tính điểm.
      if (loi) loi.textContent = T('Quãng đường đang được đo, chưa cộng điểm. ')
        + T('Ai hay di cư, đi kiếm ăn xa sẽ có lợi khi cột này được bật.');
    } else {
      kmO.textContent = T('Có điểm thưởng theo quãng đường đi được');
      if (ghi) { ghi.textContent = ''; ghi.hidden = true; }
      if (loi) loi.textContent = T('Quãng đường được cộng điểm. ')
        + T('Ai hay di cư, đi kiếm ăn xa sẽ có lợi.');
    }
  }

  /* ── Khối "Ai dẫn đầu" trên TRANG CHỦ ───────────────────────────────────
     Bục là `veBuc` ở trên (cùng 3D, cùng luật). Ở đây chỉ thêm: hạng 4–8 vào năm dòng CÓ SẴN trong
     HTML (không dựng dòng mới — dòng thiếu thì `hidden`), tiêu đề theo tab, và kỷ lục trong ngày. */
  const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
  const laChu = (v) => typeof v === 'string' && v.trim() !== '';

  function baoTrangChu(chu, loi) {
    huyBuc();
    if (buc) buc.hidden = true;
    const ds = $('vd-ds');
    if (ds) ds.hidden = true;
    const t = $('vd-bxh-trong');
    if (t) {
      t.textContent = chu;
      t.className = loi ? 'trong canhbao' : 'trong';
      t.hidden = false;
    }
  }

  function veDsTrangChu(hang) {
    const ds = $('vd-ds');
    if (!ds) return;
    ds.hidden = false;
    Array.from(ds.children).forEach((li, i) => {
      const r = hang[i + 3];          // dòng đầu của danh sách là hạng 4
      li.hidden = !r;
      if (!r) return;
      const ten = li.querySelector('.vd__ten'), diem = li.querySelector('.vd__so');
      if (ten) {
        ten.replaceChildren(tao('b', null, r.ten), ' ', tao('span', null, r.loai || ''));
        ten.title = r.loai ? `${r.ten}, ${r.loai}` : r.ten;
      }
      if (diem) diem.textContent = T('{n} điểm', { n: so(r.diem) });
    });
  }

  /* `kyLucNgay` thiếu (máy chủ chưa deploy bản có nó) ⇒ GIỮ "—", không bịa. `null` ⇒ nói thật là chưa ai. */
  function veKyLuc(kl, kmDangDo) {
    if (!kl || typeof kl !== 'object') return;
    const dong = (id, ten, phu) => {
      const a = $(id), b = $(id + '-phu');
      if (a) a.textContent = ten;
      if (b) b.textContent = phu || ' ';   // dòng phụ không bao giờ rỗng: rỗng rồi có chữ là dòng cao lên
      /* Ô cắt dấu ba chấm ⇒ đủ tên + phần phụ ở `title`. */
      if (a && a.parentElement) a.parentElement.title = phu ? `${ten}, ${phu}` : ten;
    };
    const cuaLoai = (r) => (laChu(r.loai) ? `, ${r.loai}` : '');
    const s = kl.songLau, x = kl.diXa, n = kl.nuoiLon;
    if (s && laChu(s.ten) && laSo(s.phut)) dong('vd-kl-song', s.ten, T('{gio} sống sót', { gio: gio(s.phut) }) + cuaLoai(s));
    else dong('vd-kl-song', T('Chưa ai'), T('hôm nay chưa có số liệu'));
    if (x && laChu(x.ten) && laSo(x.km)) dong('vd-kl-xa', x.ten, `${so(x.km, 1)} km${cuaLoai(x)}`);
    else if (kmDangDo) dong('vd-kl-xa', T('Đang đo'), T('quãng đường chưa được tính'));
    else dong('vd-kl-xa', T('Chưa ai'), T('hôm nay chưa có số liệu'));
    if (n && laChu(n.ten) && laSo(n.adult)) dong('vd-kl-lon', n.ten, T('{n} con tới trưởng thành', { n: so(n.adult) }));
    else dong('vd-kl-lon', T('Chưa ai'), T('hôm nay chưa con nào tới trưởng thành'));
  }

  function veTrangChu(hang, homNay) {
    const td = $('vd-bxh-td');
    if (td) td.textContent = homNay ? T('Ai dẫn đầu hôm nay') : T('Ai dẫn đầu tháng này');
    const them = $('vd-them');
    if (them) {
      them.textContent = hang.length
        ? T('Xem đủ {n} người và cách tính điểm', { n: hang.length }) : T('Xem bảng xếp hạng và cách tính điểm');
    }
    veKyLuc(dulieu.kyLucNgay, dulieu.kmDangDo);
    /* Dưới ba người thì không có bục, và năm dòng 4–8 cũng trống — một câu thay cả khối. */
    if (hang.length < 3) {
      baoTrangChu(homNay
        ? T('Hôm nay chưa đủ ba người có số liệu. Xem tab Tháng này trong lúc chờ.')
        : T('Tháng này chưa đủ ba người có số liệu.'));
      return;
    }
    const t = $('vd-bxh-trong');
    if (t) t.hidden = true;
    veBuc(hang);
    veDsTrangChu(hang);
  }

  function ve() {
    if (!dulieu) return;
    const homNay = dangXem === 'homnay';
    const hang = (homNay ? dulieu.homNay : dulieu.thangNay) || [];
    if (!than) { veTrangChu(hang, homNay); return; }
    // Ngày của SỐ LIỆU (máy chủ ghi `ngayVN`), không phải đồng hồ máy người xem.
    const [, thang, ngay] = String(dulieu.ngayVN || '').split('-').map(Number);
    veBuc(hang);
    veBang(hang, dulieu.kmDangDo, homNay
      ? T('Hôm nay chưa ai có số liệu. Xem tab Tháng này trong lúc chờ.')
      : T('Tháng này chưa ai có số liệu.'));
    veTong(hang);
    if (capt) {
      capt.textContent = homNay
        ? T('{n} người chơi hôm nay', { n: hang.length }) + (ngay ? ` (${ngay}/${thang})` : '')
        : (thang
          ? T('{n} người chơi trong tháng {thang}', { n: hang.length, thang })
          : T('{n} người chơi trong tháng này', { n: hang.length }));
    }
  }

  function doiTab(ten) {
    dangXem = ten;
    if (tabNgay) tabNgay.setAttribute('aria-selected', String(ten === 'homnay'));
    if (tabThang) tabThang.setAttribute('aria-selected', String(ten === 'thangnay'));
    ve();
  }
  if (tabNgay) tabNgay.addEventListener('click', () => doiTab('homnay'));
  if (tabThang) tabThang.addEventListener('click', () => doiTab('thangnay'));

  async function nap() {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), CHO);
    let d;
    try {
      const r = await fetch(API, { signal: bo.signal });
      if (!r.ok) throw new Error(String(r.status));
      d = await r.json();
    } catch {
      bao(T('Chưa lấy được bảng xếp hạng. Thử tải lại trang, hoặc hỏi ở Discord.'), true);
      return;
    } finally { clearTimeout(h); }

    const t = (d.builtAt || Math.floor(Date.now() / 1000)) * 1000;
    dulieu = d;
    veCongThuc(d);
    ve();

    if (tuoiEl) {
      const mau = Math.round((d.sampleIntervalS || 600) / 60);
      let chu = T('Cập nhật lúc {gio} giờ Việt Nam. ', { gio: hhmm(new Date(t)) })
        + T('Số liệu lấy mẫu {mau} phút một lần.', { mau });
      if (d.doTuNgay) {
        const [y, m, ng] = d.doTuNgay.split('-');
        chu += ' ' + T('Bắt đầu đo từ {ngay}.', { ngay: `${ng}/${m}/${y}` });
      }
      tuoiEl.textContent = chu;
    }
  }

  nap();
})();
