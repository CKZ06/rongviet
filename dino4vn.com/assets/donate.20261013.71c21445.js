/* donate.js — trang /donate: thanh kéo thử, lấy mã chuyển khoản, bảng top.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ 🔴 KHÔNG ĐƯỢC VIẾT CỨNG MỘT CON SỐ NÀO CỦA LUẬT                            │
 * └───────────────────────────────────────────────────────────────────────────┘
 * Mốc, bước 10k, ngưỡng lời nhắn — tất cả tới từ `/api/donate.json` (khoá `luat`),
 * do `ops/donate/bac.py` phát ra. Viết cứng ở đây là tạo BẢN THỨ HAI của cùng một
 * luật, và hai bản sẽ trôi ra xa nhau trong im lặng: thanh kéo hứa 15 ô còn hệ thống
 * cấp 10, người donate không có cách nào biết ai đúng.
 * `ops/donate/test_donate.py::test_donate_js_KHONG_chua_mot_con_so_nao_cua_luat`
 * grep thẳng file này và ĐỎ nếu thấy các số đó.
 *
 * Ba kỷ luật khác, chép từ `bxh.js:4-17` vì cả ba đều đã trả giá:
 *  1. `textContent`, KHÔNG BAO GIỜ `innerHTML` — tên và lời nhắn do người lạ nhập.
 *     CSP chặn `<script>` nhưng KHÔNG chặn `<img onerror>`.
 *  2. KHÔNG đụng `.style` — đổi hình thì đổi thuộc tính của `<rect>` SVG (khối "BA RÀNG BUỘC CỨNG" đầu site.css).
 *  3. Mọi thứ động phải CHIẾM SẴN CHỖ; nội dung hiện ra sau là nhảy layout.
 */
(function () {
  'use strict';

  const T = window.D4V_T;

  var API = '/api/donate.json';
  var NHIP_HOI = 4000;          // hỏi trạng thái mỗi 4 giây sau khi lấy mã
  var TOI_DA_HOI = 150;         // ~10 phút rồi thôi, đừng gõ cửa mãi

  var $ = function (id) { return document.getElementById(id); };
  var DEFAULT_LUAT = {
    o_mac_dinh: 3,
    o_toi_da: 98,
    muc1_nguong: 150000,
    muc1_them_o: 7,
    muc2_nguong: 300000,
    muc3_nguong: 450000,
    buoc_o: 10000,
    nhan_toi_thieu: 20000,
    keo_toi_da: 5000000,
    keo_giua: 500000,
    keo_buoc_xa: 100000,
    nhap_toi_da: 100000000,
    loa_giay: 30,
    uu_tien_muc: 2,
    bao_hiem_muc: 2,
    chon_loai_muc: 3,
    so_ngay_hieu_luc: 30,
    gia_han_ngay: 5,
    bh_luot_chu_ky: 3,
    skin_nguong: 50000,
    skin_bo_0: 9999,
    skin_bo_1: 9999,
    skin_bo_2: 9999,
    skin_bo_3: 9999,
    skin_tudo_bac: 0,
    skin_tuap_bac: 0,
    gradient_bac: 3,
    nguong_chat: false,
    ten_muc: { "1": "Góp gạo", "2": "Góp thịt", "3": "Góp PC" }
  };
  var LUAT = DEFAULT_LUAT;
  var dangXem = 'ngay';
  var duLieu = null;

  // ── định dạng ────────────────────────────────────────────────────────────
  function tien(n) {
    return (Number(n) || 0).toLocaleString(T('vi-VN')) + T(' ₫');
  }

  function dat(t, nguong) {
    return LUAT.nguong_chat ? t > nguong : t >= nguong;
  }

  // Bản gương của `bac.so_o()`. Nếu ai sửa một bên mà quên bên kia, cái sai sẽ hiện
  // ra ở đây TRƯỚC khi ai mất tiền — nhưng đừng dựa vào may mắn đó: sửa cả hai.
  function soO(t) {
    var o = LUAT.o_mac_dinh;
    if (dat(t, LUAT.muc1_nguong)) { o += LUAT.muc1_them_o; }
    if (dat(t, LUAT.muc2_nguong)) {
      o += Math.floor((t - LUAT.muc2_nguong) / LUAT.buoc_o);
    }
    // 🔴 TRẦN — thêm 2026-09-10. Plugin (`store_io::set_quota`) TỪ CHỐI mọi giá trị > 99
    // vì ô 99 là ô bảo hiểm, nên trần thật là 98. Thiếu dòng này thì thanh kéo hứa một
    // con số mà hệ thống không cấp được, và người donate chỉ biết sau khi đã chuyển tiền:
    // đã xảy ra thật với một người trả 2.750.000 ₫ (hứa 255 ô, nhận 95).
    // Vẫn KHÔNG viết cứng con số ở đây — nó tới từ `/api/donate.json` như mọi luật khác.
    return Math.min(o, LUAT.o_toi_da);
  }

  // Bản gương của `bac.muc()` — phải có ĐỦ mọi mốc.
  // 🔴 Dẫm phải 2026-09-17: thêm mốc 3 vào `bac.py`, thêm dòng quà vào `donate.njk`, phát
  // `chon_loai_muc` ra API — mà QUÊN chính hàm này. `m` kịch ở 2 nên `m >= chon_loai_muc`
  // không bao giờ đúng: trang PHỦ NHẬN một quyền lợi backend đang cấp thật, và phủ nhận
  // im lặng (không lỗi, không cảnh báo, dòng quà chỉ hiện "—"). Thêm một mốc = sửa BA chỗ:
  // `bac.muc()`, hàm này, và vạch trong `veThuoc()`.
  // `dat(t, undefined)` = false, nên API đời cũ (chưa phát `muc3_nguong`) tự rơi về mốc 2.
  function muc(t) {
    if (dat(t, LUAT.muc3_nguong)) { return 3; }
    if (dat(t, LUAT.muc2_nguong)) { return 2; }
    if (dat(t, LUAT.muc1_nguong)) { return 1; }
    return 0;
  }

  // ── thanh kéo thử ────────────────────────────────────────────────────────
  /* 🔴 GIÁ TRỊ CỦA THANH KÉO LÀ SỐ NẤC, KHÔNG PHẢI SỐ TIỀN (từ 2026-10-03).
     Thanh kéo tới `keo_toi_da` (5 triệu) nhưng mọi mốc đều dưới `keo_giua` (500k). Chia đều
     thì ba vạch mốc dồn vào mép trái và mỗi pixel nhảy hàng chục nghìn đồng, nên thanh gãy
     làm hai đoạn có số nấc gần bằng nhau:
         đoạn gần: 0 → keo_giua, mỗi nấc buoc_o
         đoạn xa : keo_giua → keo_toi_da, mỗi nấc keo_buoc_xa
     Ba khoá đều đọc từ LUAT (`bac.py`). API đời cũ (thiếu khoá) hoặc khoá vô nghĩa ⇒ một
     đoạn chia đều, đúng như trước.
     Mọi chỗ đổi qua lại giữa nấc và tiền phải đi qua hai hàm dưới: vạch mốc, phần tô, vị
     trí con trượt. Một chỗ tự chia `t / keo_toi_da` là vạch mốc nằm sai chỗ, im lặng. */
  function thangKeo() {
    var max = LUAT.keo_toi_da || 0;
    var b = LUAT.buoc_o || 1;
    var g = LUAT.keo_giua;
    var bx = LUAT.keo_buoc_xa;
    if (!(g > 0 && g < max && bx > 0)) { g = max; bx = 0; }
    var nGan = Math.ceil(g / b);
    var nXa = bx > 0 ? Math.ceil((max - g) / bx) : 0;
    return { max: max, giua: g, buoc: b, buocXa: bx, nGan: nGan, nTong: nGan + nXa };
  }

  function tienTuNac(p) {
    var k = thangKeo();
    if (p <= k.nGan) { return Math.min(p * k.buoc, k.giua); }
    return Math.min(k.giua + (p - k.nGan) * k.buocXa, k.max);
  }

  // Ngược của `tienTuNac`, trả số nấc LẺ (vạch mốc cần vị trí đúng, không làm tròn). Quá
  // `keo_toi_da` thì kẹp ở cuối thanh.
  // 🔴 Hai đầu mút (`keo_giua`, `keo_toi_da`) trả ĐÚNG nấc nguyên của chúng, không chia: khi
  //    khoá không chia hết cho bước, phép chia ra số lẻ, làm tròn xuống một nấc, và con trượt
  //    nhảy ngược ngay dưới tay người đang kéo (`datThu` ghi lại vị trí sau mỗi lần kéo).
  function nacTuTien(t) {
    var k = thangKeo();
    if (!(t > 0)) { return 0; }
    if (t >= k.max) { return k.nTong; }
    if (t < k.giua) { return t / k.buoc; }
    // Tới đây thì `giua < max`, tức đang có đoạn xa và `buocXa > 0` (xem `thangKeo`).
    return k.nGan + (t - k.giua) / k.buocXa;
  }

  function veThuoc(t) {
    var n = thangKeo().nTong || 1;
    var pct = function (v) { return Math.max(0, Math.min(100, (nacTuTien(v) / n) * 100)); };
    // setAttribute, không phải `.style` — quy ước cứng của repo.
    $('dn-thuoc-dat').setAttribute('width', String(pct(t)));
    $('dn-moc1').setAttribute('x', String(pct(LUAT.muc1_nguong)));
    $('dn-moc2').setAttribute('x', String(pct(LUAT.muc2_nguong)));
    // Vạch mốc 3 ("Góp PC"). Rộng 0 khi API chưa phát `muc3_nguong` — cùng kỷ luật với vạch
    // bậc skin: chưa có luật thì KHÔNG vẽ, chứ không vẽ một vạch ở x=0 (vạch ở mép trái trông
    // như một mốc 0 ₫ có thật).
    var m3 = $('dn-moc3');
    if (m3) {
      m3.setAttribute('x', String(pct(LUAT.muc3_nguong || 0)));
      m3.setAttribute('width', LUAT.muc3_nguong ? '0.6' : '0');
    }
    // Vạch bậc skin ("Góp nước"). 🔴 CHỈ vẽ khi trang được phép hứa quà skin (`skin_hien`):
    // hứa trước khi tính năng mở là để người ta chuyển tiền cho một thứ chưa tồn tại.
    var m0 = $('dn-moc0');
    if (m0) {
      m0.setAttribute('x', String(pct(LUAT.skin_nguong || 0)));
      m0.setAttribute('width', LUAT.skin_hien ? '0.6' : '0');
    }
  }

  // Bản gương của `bac.bac_skin()` — CÙNG phép so `dat()` với `muc()`, để người chuyển đúng
  // ngưỡng không lệch mốc một đằng bậc skin một nẻo. Ngưỡng đọc từ LUAT, không viết cứng.
  function bacSkin(t) {
    if (dat(t, LUAT.muc2_nguong)) { return 3; }
    if (dat(t, LUAT.muc1_nguong)) { return 2; }
    if (dat(t, LUAT.skin_nguong)) { return 1; }
    return 0;
  }

  function moTaSkin(t) {
    var b = bacSkin(t);
    var bo = LUAT['skin_bo_' + b];
    // Thiếu khoá => nói KHÔNG BIẾT, đừng đoán (cùng luật với `dn-thu-ut`).
    if (bo === undefined || !LUAT.skin_vo_han || LUAT.skin_tudo_bac === undefined
        || LUAT.skin_tuap_bac === undefined) { return '?'; }
    var phan = [bo >= LUAT.skin_vo_han ? T('Lưu không giới hạn bộ') : T('Lưu {n} bộ', { n: bo })];
    phan.push(b >= LUAT.skin_tudo_bac ? T('mã màu tự do') : T('bảng màu miễn phí'));
    // Hai khoá ĐỘC LẬP, panel đổi riêng được: hứa quà tự áp theo khoá màu tự do là hứa một
    // thứ player từ chối khi ngưỡng tự áp cao hơn.
    if (b >= LUAT.skin_tuap_bac) { phan.push(T('tự áp khi respawn')); }
    return phan.join(' · ');
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     MỘT SỐ TIỀN, BA CHỖ NÓI VỀ NÓ — và `soThu` là chỗ duy nhất giữ sự thật.

     Ba chỗ: thanh kéo (`dn-keo`), ô số gõ được (`dn-keo-so`), và ô "Số tiền" của
     thẻ gửi (`dn-tien`). Nếu để mỗi chỗ tự giữ giá trị của mình thì chúng sẽ lệch
     nhau, và cái lệch đó **không tự lộ ra**: bảng quà hiện một đằng, số tiền gửi đi
     một nẻo. Nên mọi thứ đọc/ghi qua `datThu()`.

     🔴 THANH KÉO KHÔNG CÒN LÀ TRẦN. Nó dừng ở `keo_toi_da` (5 triệu) vì kéo xa hơn
     thì mỗi pixel nhảy quá nhiều tiền — nhưng `soThu` được phép vượt qua nó, và bảng
     quà tính theo `soThu` chứ không theo giá trị đã bị kẹp của thanh kéo. Đây chính
     là chỗ bản đầu sai: xem thử bị chặn ở 1 triệu.
     ═══════════════════════════════════════════════════════════════════════════ */
  var soThu = 0;

  function docSoNhap(v) {
    // Chỉ lấy chữ số: người ta gõ "1.500.000", "1 500 000", "1500000đ" đều phải hiểu
    // được. Ép `Number()` lên chuỗi có dấu chấm sẽ ra NaN hoặc — tệ hơn — ra 1.5.
    var chuSo = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    if (!chuSo) { return 0; }
    var n = Number(chuSo);
    return isFinite(n) ? n : 0;
  }

  function veThu(t) {
    var m = muc(t);
    var ten = T((LUAT.ten_muc && LUAT.ten_muc[String(m)]) || '');
    $('dn-thu-ten').textContent = ten || ' ';
    $('dn-thu-o').textContent = String(soO(t));
    // 🔴 MỐC ĐỌC TỪ /api/donate.json, KHÔNG viết cứng ở đây — kể cả một số nhỏ như 2.
    // Trước 2026-09-12 hai dòng này chép `m >= 1` / `m >= 2`, và `cau_hinh_cong_khai`
    // không phát mốc nào cả, nên trang là bản chép DUY NHẤT còn sót của luật: deploy
    // ops mà quên `web/deploy.sh` là trang hứa một quyền lợi backend đã ngừng cấp.
    // Trang này nói cho NGƯỜI SẮP TRẢ TIỀN, nên nó luôn nói luật HIỆN HÀNH. Ai được
    // giữ mốc cũ là chuyện của người đã trả tiền trước lúc đổi luật, và nó không hiện
    // ở đây — hiện ra thì trang lại hứa 150k có ưu tiên cho người mới, đúng lỗi 09-12.
    var mUt = LUAT.uu_tien_muc, mBh = LUAT.bao_hiem_muc, mCl = LUAT.chon_loai_muc;
    // Không đọc được mốc => nói KHÔNG BIẾT, đừng đoán. Một dấu '—' thì người ta hỏi;
    // một chữ 'Có' sai thì người ta chuyển tiền rồi mới biết.
    $('dn-thu-ut').textContent = mUt ? (m >= mUt ? T('Có') : '—') : '?';
    $('dn-thu-bh').textContent = mBh ? (m >= mBh ? T('Có') : '—') : '?';
    // Chọn được loài đang bị khoá vì đủ trần người chơi (mốc 3). Cùng luật đọc-từ-API như
    // hai dòng trên: mốc nằm ở `/api/donate.json`, trang không giữ bản chép nào.
    $('dn-thu-cl').textContent = mCl ? (m >= mCl ? T('Có') : '—') : '?';
    // Quà skin — 🔴 ẩn hoàn toàn cho tới khi `skin_hien` bật (xem `veThuoc`).
    var liMau = $('dn-thu-mau-li');
    if (liMau) {
      liMau.hidden = !LUAT.skin_hien;
      if (LUAT.skin_hien) {
        $('dn-thu-mau').textContent = moTaSkin(t);
        // Dưới mốc 1 mà đạt bậc skin: tên bậc là tên DUY NHẤT người đó thấy.
        if (!ten && bacSkin(t) > 0) { $('dn-thu-ten').textContent = T(LUAT.ten_skin || ' '); }
      }
    }
    // Chuyển màu gradient — cờ HIỆN riêng; bậc tối thiểu đọc từ LUAT (`gradient_bac`, bậc skin).
    // Thiếu khoá thì nói KHÔNG BIẾT ('?'), đừng đoán.
    var liGrad = $('dn-thu-grad-li');
    if (liGrad) {
      liGrad.hidden = !LUAT.gradient_hien;
      if (LUAT.gradient_hien) {
        $('dn-thu-grad').textContent = LUAT.gradient_bac === undefined ? '?'
          : (bacSkin(t) >= LUAT.gradient_bac ? T('Có') : '—');
      }
    }
    veThuoc(t);
  }

  /* Đặt số tiền đang xem thử.
     `dangGo` = lệnh gọi này đến TỪ ô số mà người dùng đang gõ dở. Khi đó tuyệt đối
     không được ghi đè nội dung ô — viết lại giữa lúc gõ sẽ nhảy con trỏ về cuối và
     người ta không sửa được chữ số ở giữa. */
  function datThu(t, dangGo) {
    var tran = (LUAT && LUAT.nhap_toi_da) || 0;
    if (!(t >= 0)) { t = 0; }                 // bắt cả NaN
    if (tran > 0 && t > tran) { t = tran; }
    soThu = Math.floor(t);

    // Thanh kéo bị KẸP về dải của nó; `soThu` thì không. Kẹp ở đây chứ không kẹp
    // `soThu` — nếu kẹp `soThu` thì gõ 8 triệu sẽ lặng lẽ thành 5 triệu.
    // Giá trị của thanh là SỐ NẤC (xem `thangKeo`), nên trình đọc màn hình phải được nói
    // số tiền qua `aria-valuetext`, nếu không nó đọc "52".
    var keo = $('dn-keo');
    keo.value = String(Math.round(nacTuTien(soThu)));
    keo.setAttribute('aria-valuetext', tien(soThu));

    if (!dangGo) { $('dn-keo-so').value = tien(soThu); }
    veThu(soThu);
    capNhatNutNhanh(soThu);
  }

  function capNhatNutNhanh(t) {
    var nuts = document.querySelectorAll('.dn-nut-muc');
    if (!nuts.length) { return; }
    var daChon = false;
    nuts.forEach(function (nut) {
      var tienNut = Number(nut.getAttribute('data-tien')) || 0;
      if (tienNut > 0 && tienNut === t) {
        nut.classList.add('dn-nut-muc--active');
        daChon = true;
      } else {
        nut.classList.remove('dn-nut-muc--active');
      }
    });
    var nutTuyTam = $('dn-nut-tuytam');
    if (nutTuyTam) {
      if (!daChon) {
        nutTuyTam.classList.add('dn-nut-muc--active');
      } else {
        nutTuyTam.classList.remove('dn-nut-muc--active');
      }
    }
  }

  // Giữ tên cũ: `apLuat()` và chỗ khác đang gọi.
  function capNhatKeo() {
    datThu(tienTuNac(Number($('dn-keo').value) || 0), false);
  }

  // ── ai đang xem ──────────────────────────────────────────────────────────
  function aiDangXem() {
    // `app.js` đã gọi /api/player/me một lần cho cả trang và chia sẻ qua biến này.
    // Gọi lại là thêm một vòng mạng không cần thiết cho mọi lượt mở trang.
    var p = window.__dino4vnMe;
    if (!p) { return Promise.resolve(null); }
    return p.then(function (me) { return me && me.logged_in ? me : null; })
            .catch(function () { return null; });
  }

  /* ── hạn quyền lợi của CHÍNH người đang xem ───────────────────────────────
     🔴 Từ 2026-09-13 mỗi người một hạn riêng (30 ngày kể từ lúc chuyển tiền), thay cho
     "hết tháng dương lịch" chung cho tất cả. Một cái hạn riêng mà chủ nhân không có chỗ
     nào xem được thì mới xong một nửa: họ sẽ đi hỏi admin, hoặc ủng hộ lại sớm vì tưởng
     đã hết. Hỏng thì IM LẶNG bỏ qua — đây là thông tin thêm, không được làm vỡ trang gửi
     tiền. */
  function hienHanCuaToi() {
    fetch('/api/donate/cua-toi', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.co || !d.han) { anGiaHan(); return; }
        var el = $('dn-han');
        // 🔴 Ngày mở gia hạn lấy từ máy chủ (`gia_han_tu`), KHÔNG tự trừ một con số ở đây —
        //    con số "nhắc trước 3 ngày" từng chép ở năm chỗ và lệch nhau đúng như cảnh báo.
        // `da_lam_moi`: vừa gia hạn trong cửa sổ này. Mốc không bị cắt nên hạn mốc có thể đứng
        // yên (tiền cũ chồng tiền mới tới đúng hạn cũ) — nói rõ bảo hiểm đã kéo tới đâu.
        el.textContent = T(' · Quyền lợi tới {ngay}', { ngay: ngay(d.han) })
          + (d.da_lam_moi ? T(' (đã gia hạn bảo hiểm tới {ngay})', { ngay: ngay(d.bh_den) })
             : (!d.gia_han_mo && d.gia_han_tu > Date.now() / 1000
                ? T(', gia hạn từ {ngay}', { ngay: ngay(d.gia_han_tu) }) : ''));
        el.hidden = false;
        hienLuaChon(d);
      })
      .catch(function () { /* không có gì để nói thêm là không nói */ });
  }

  function anGiaHan() {
    var ch = $('dn-cho');
    if (ch) { ch.hidden = true; }
  }

  /* Hai lựa chọn trong cửa sổ gia hạn (`gia_han_mo`, máy chủ quyết) — CHỈ cho người đang có
     bảo hiểm: gia hạn chỉ đổi chu kỳ bảo hiểm, người không có bảo hiểm thì không có gì để chọn.
     🔴 Không có đoạn giải thích nào (người dùng chốt 2026-10-09: người chơi tự biết hoặc hỏi
     admin). Đoạn "quyền lợi hết hạn … không gia hạn thì còn …" đã gỡ khỏi đây và khỏi `/gara`.
     🔴 PHẢI ẨN LẠI khi cửa sổ đóng: `hienHanCuaToi` được gọi lại ở [1500, 6000, 15000] ms
     sau một lượt trả tiền thành công — ô chọn còn nằm đó ngay sau khi người ta vừa gia hạn là
     mời gia hạn lần hai. */
  function hienLuaChon(d) {
    var ch = $('dn-cho');
    if (!ch) { return; }
    ch.hidden = !(d.gia_han_mo && d.bao_hiem && Number(d.gia_han_lam_moi_tu) > 0);
  }

  function ngay(ts) {
    // 🔴 PHẢI GHIM `Asia/Ho_Chi_Minh`, đúng như `app.js`/`bxh.js`/`map.js`/`me.js`.
    // `getDate()` đọc theo múi giờ MÁY KHÁCH: một hạn lúc 00:30 ngày 13 giờ VN hiện
    // thành ngày 12 cho người xem ở UTC (hoặc bất kỳ ai đặt sai đồng hồ), tức nói với
    // người chơi rằng quyền lợi hết sớm hơn một ngày — đúng nỗi hoang mang mà cái hạn
    // này sinh ra để dập. Cả `db.py` mở đầu bằng một khối chú thích về chuyện không để
    // trình duyệt/UTC quyết định một khoản tiền thuộc về ngày nào.
    return new Date(ts * 1000).toLocaleDateString(T('vi-VN ngày'), {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  // ── lấy mã ───────────────────────────────────────────────────────────────
  function hienLoi(s) {
    var el = $('dn-loi');
    el.textContent = s;
    el.hidden = !s;
  }

  var soLanHoi = 0;
  var hen = null;

  function hoiTrangThai(ma) {
    if (soLanHoi++ > TOI_DA_HOI) { return; }
    fetch('/api/donate/trang-thai/' + encodeURIComponent(ma), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.daNhan) {
          hen = setTimeout(function () { hoiTrangThai(ma); }, NHIP_HOI);
          return;
        }
        var s = T('Đã nhận {so}. Cảm ơn bạn.', { so: tien(d.soTien) });
        // Khoản GIA HẠN (làm mới chu kỳ bảo hiểm): nói rõ chu kỳ mới bắt đầu từ hôm nay.
        if (d.lamMoi) { s += T(' Chu kỳ bảo hiểm mới bắt đầu từ hôm nay.'); }
        if (d.quyenLoi && d.quyenLoi.ten) {
          s += T(' Mốc {ten}, {o} ô gara.', { ten: T(d.quyenLoi.ten), o: d.quyenLoi.o_gara });
        }
        $('dn-tt').textContent = s;
        // 🔴 GỌI MỘT LẦN LÀ HỤT. Bảng công khai đi qua hai nhịp nối tiếp phía máy chủ
        // (dịch vụ dựng lại → unit chép ra `/var/www`), nên ngay lúc tiền vào thì file
        // gần như chắc chắn CHƯA có hàng đó. Bản đầu gọi đúng một lần với chú thích
        // "thử ngay cho chắc" — và nó gần như luôn trượt.
        // Bám theo vài nhịp: người vừa trả tiền là người quan tâm nhất, họ đáng được
        // thấy tên mình mà không phải tự bấm F5.
        [1500, 6000, 15000, 30000].forEach(function (ms) {
          setTimeout(taiBang, ms);
        });
        // Hạn của CHÍNH họ cũng vừa đổi — và người vừa trả tiền là người quan tâm nhất.
        // Lúc mở trang họ chưa có hạn nào (hoặc có hạn cũ), nên không gọi lại ở đây là
        // để họ nhìn "Đã nhận …" mà KHÔNG thấy quyền lợi tới ngày nào — đúng cái mà
        // route `/api/donate/cua-toi` sinh ra để tránh. Bám cùng nhịp với bảng.
        [1500, 6000, 15000].forEach(function (ms) {
          setTimeout(hienHanCuaToi, ms);
        });
      })
      .catch(function () {
        hen = setTimeout(function () { hoiTrangThai(ma); }, NHIP_HOI * 2);
      });
  }

  function layMa() {
    hienLoi('');
    if (!$('dn-dk').checked) { hienLoi(T('Cần tick đồng ý điều khoản.')); return; }
    var nut = $('dn-gui');
    nut.disabled = true;
    nut.textContent = T('Đang tạo mã…');

    var soTien = Number($('dn-tien').value) || 0;
    var ma = 'RV' + Math.floor(100000 + Math.random() * 900000);
    var bankTen = 'Techcombank';
    var bankSo = '1903 3228 2290 12';
    var bankSoRaw = '19033228229012';
    var bankChu = 'DANG THI LAM';

    var qrUrl = 'https://img.vietqr.io/image/970407-' + bankSoRaw + '-compact2.png?addInfo=' + encodeURIComponent(ma) + '&accountName=' + encodeURIComponent(bankChu);
    if (soTien > 0) {
      qrUrl += '&amount=' + soTien;
    }

    setTimeout(function () {
      nut.disabled = false;
      nut.textContent = T('Lấy mã chuyển khoản');

      $('dn-ma').textContent = ma;
      $('dn-nh').textContent = bankTen;
      $('dn-so').textContent = bankSo;
      $('dn-chu').textContent = bankChu;
      $('dn-sotien').textContent = soTien > 0 ? tien(soTien) : T('Tùy tâm (nhập trên app)');

      var qrImg = $('dn-qr');
      if (qrImg) {
        qrImg.setAttribute('src', qrUrl);
        qrImg.onerror = function () {
          this.src = 'assets/img/qr-techcombank.jpg';
        };
        qrImg.hidden = false;
      }

      $('dn-form').hidden = true;
      $('dn-kq').hidden = false;
      $('dn-tt').textContent = T('Vui lòng quét mã QR hoặc chuyển khoản với nội dung: ') + ma;
      soLanHoi = 0;
      if (hen) { clearTimeout(hen); }
      hen = setTimeout(function () { hoiTrangThai(ma); }, NHIP_HOI);
      $('dn-kq').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }

  // Thân yêu cầu tạo mã. `cho_ky` CHỈ gửi khi ô lựa chọn đang hiện (trong cửa sổ gia hạn):
  // ngoài cửa sổ nó vô nghĩa, và không gửi thì máy chủ dùng mặc định "gia hạn".
  function thanTao() {
    var than = {
      so_tien: Number($('dn-tien').value) || null,
      loi_nhan: $('dn-nhan').value || '',
      an_danh: !!($('dn-andanh') && $('dn-andanh').checked),
      dong_y_dieu_khoan: true
    };
    var ch = $('dn-cho');
    if (ch && !ch.hidden) {
      var chon = ch.querySelector('input[name="dn-cho-ky"]:checked');
      than.cho_ky = chon ? chon.value : 'sau';
    }
    return than;
  }

  function loiThanhChu(err) {
    if (err === 'chua_dong_y_dieu_khoan') { return T('Cần tick đồng ý điều khoản.'); }
    if (err === 'qua_nhip') { return T('Bạn lấy mã hơi nhanh. Chờ vài phút rồi thử lại.'); }
    if (err === 'chua_cau_hinh_so_tai_khoan') { return T('Kênh ủng hộ đang tạm đóng.'); }
    return T('Chưa tạo được mã. Thử lại sau ít phút.');
  }

  // ── quà 3D (kiểu TikTok) ─────────────────────────────────────────────────
  // Hai lúc chiếu quà — người dùng chốt 2026-09-26:
  //  1. MỞ TRANG: quà của người đứng đầu HÔM NAY, theo đúng số tiền hôm nay của họ (số
  //     đang hiện trong bảng top) quy ra mốc. Cùng người + cùng mốc thì trong 10 tiếng không
  //     chiếu lại (nhớ bằng localStorage của trình duyệt này). Top đổi người hoặc lên mốc
  //     cao hơn thì chiếu ngay. Hôm nay chưa ai donate thì không chiếu gì.
  //  2. ĐANG MỞ TRANG: mỗi lượt donate MỚI chiếu quà của đúng lượt đó, trễ tối đa một nhịp
  //     làm mới bảng (NHIP_BANG).
  // 🔴 Lượt mới lấy từ `chayChu`, mà `chayChu` chỉ có lượt từ `nhan_toi_thieu` trở lên
  //    (ngưỡng chống spam của dải cảm ơn). Lượt nhỏ hơn KHÔNG có hoạt cảnh realtime — cố
  //    ý: quà 3D phủ cả màn hình, rải lượt 1.000 ₫ để chiếm nó còn hời hơn chiếm dải chữ.
  // 🔴 File quà nặng (three.js + bloom) nên CHỈ gắn khi có quà để chiếu, bằng một thẻ
  //    `<script type="module">` riêng: 3D hỏng thì trang donate vẫn chạy nguyên vẹn.
  // 🔴 Mốc quà đi qua `muc()` ở trên. KHÔNG chép thêm một bản ngưỡng nào ở đây.
  var DUONG_QUA = '/assets/qua3d.20260926.1b24fc8d.js';
  var KHOA_DA_CHIEU = 'dino4vn.qua.dachieu';
  // 10 tiếng — người dùng chốt 2026-09-26 (3 phút -> 30 phút -> 10 tiếng cùng ngày: mở lại
  // trang nhiều lần thì quà top 1 lặp quá dày). Quà realtime từng lượt mới KHÔNG bị giờ chờ này.
  var CHO_CHIEU_LAI = 10 * 60 * 60 * 1000;
  var TON_TOI_DA = 3;          // quay lại tab sau lâu: chỉ chiếu 3 lượt mới nhất, không dồn cả chục
  var sanKhau = null;          // promise -> sân khấu quà, tạo một lần cho cả trang
  var daXetLucMo = false;
  var daThay = {};             // lượt trong `chayChu` đã thấy (chiếu rồi, hoặc có sẵn lúc mở)
  var nguoiXem = null;         // /api/player/me của người đang xem (null = chưa đăng nhập)

  function napSanKhau() {
    if (sanKhau) { return sanKhau; }
    sanKhau = new Promise(function (xong, hong) {
      function lay() {
        var q = window.__dino4vnQua;
        if (!q) { return false; }
        xong(q.taoSanKhau({ dinhDangTien: tien }));
        return true;
      }
      if (lay()) { return; }
      window.addEventListener('dino4vn:qua-san-sang', lay, { once: true });
      var s = document.createElement('script');
      s.type = 'module';
      s.src = DUONG_QUA;
      s.onerror = function () { hong(new Error('khong tai duoc qua 3D')); };
      document.head.appendChild(s);
    });
    sanKhau.catch(function () { /* 3D hỏng: trang vẫn dùng được, chỉ là không có quà */ });
    return sanKhau;
  }

  function chieuQua(ten, soTien) {
    var m = muc(Number(soTien) || 0);
    napSanKhau().then(function (sk) {
      sk.tang({ ten: ten, soTien: soTien, muc: m });
    }).catch(function () { /* đã nuốt ở napSanKhau */ });
  }

  // 'YYYY-MM-DD' theo giờ Việt Nam, cùng định dạng `ngay` của `donate.json`.
  function ngayVN(ms) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(ms));
    } catch (e) { return ''; }
  }

  function khoaNguoi(h) { return (h.steam4 || '') + '|' + h.ten; }
  // Khoá của lần chiếu lúc mở trang: NGƯỜI + MỐC. Lên mốc là khoá đổi, nên chiếu ngay.
  function khoaTop(h) { return khoaNguoi(h) + '|' + muc(Number(h.soTien) || 0); }
  function khoaLuot(h) { return String(h.khi) + '|' + khoaNguoi(h) + '|' + h.soTien; }

  // Top 1 để chiếu quà lúc mở trang. Nhiều người ĐỒNG HẠNG nhất (cùng số tiền với hàng đầu)
  // mà người đang xem nằm trong nhóm đó thì lấy hàng CỦA HỌ — người dùng chốt 2026-09-26.
  // Còn lại giữ thứ tự bảng (`xuatban._gom`: cùng tiền thì ai donate sớm hơn đứng trước).
  // ⚠️ Nhận người xem bằng `steam4` (4 số cuối SteamID) vì JSON công khai CỐ Ý không phát
  //    SteamID đầy đủ (`xuatban.py` luật 1). Hai người đồng hạng trùng 4 số cuối thì có thể
  //    chọn nhầm người kia — chỉ lệch TÊN hiện trong quà trên máy người xem, không đụng gì khác.
  // Tên lấy từ chính hàng trong bảng: ai tick ẩn danh thì quà cũng ghi "Ẩn danh", khớp với
  // bảng top họ đang nhìn thấy.
  function chonTop(ds) {
    var dau = ds[0];
    var s4 = nguoiXem ? String(nguoiXem.steamid || '').slice(-4) : '';
    if (!dau || s4.length !== 4) { return dau; }
    for (var i = 0; i < ds.length && Number(ds[i].soTien) === Number(dau.soTien); i++) {
      if (ds[i].steam4 === s4) { return ds[i]; }
    }
    return dau;
  }

  function docDaChieu() {
    try { return JSON.parse(localStorage.getItem(KHOA_DA_CHIEU) || 'null'); } catch (e) { return null; }
  }
  function ghiDaChieu(khoa) {
    try {
      localStorage.setItem(KHOA_DA_CHIEU, JSON.stringify({ k: khoa, t: Date.now() }));
    } catch (e) { /* trình duyệt riêng tư: không nhớ được, lần sau chiếu lại — chấp nhận */ }
  }

  function xetQua(d) {
    if (!LUAT) { return; }
    var chay = d.chayChu || [];
    var top = chonTop(d.topNgay || []);
    // `donate.json` chỉ dựng lại khi có thay đổi: qua nửa đêm mà chưa ai donate thì
    // `topNgay` vẫn là của HÔM QUA. So với ngày VN phía người xem trước khi gọi là "hôm nay".
    var laHomNay = !!d.ngay && d.ngay === ngayVN(Date.now());
    if (!daXetLucMo) {
      daXetLucMo = true;
      chay.forEach(function (h) { daThay[khoaLuot(h)] = 1; });
      if (!top || !laHomNay) { return; }
      var cu = docDaChieu();
      var bayGio = Date.now();
      // `bayGio >= cu.t`: đồng hồ máy bị chỉnh lùi thì coi như đã hết giờ chờ.
      if (cu && cu.k === khoaTop(top) && bayGio >= cu.t && bayGio - cu.t < CHO_CHIEU_LAI) { return; }
      ghiDaChieu(khoaTop(top));
      chieuQua(top.ten, top.soTien);
      return;
    }
    var moi = chay.filter(function (h) { return !daThay[khoaLuot(h)]; });
    if (!moi.length) { return; }
    moi.forEach(function (h) { daThay[khoaLuot(h)] = 1; });
    moi.sort(function (a, b) { return (Number(a.khi) || 0) - (Number(b.khi) || 0); });
    moi.slice(-TON_TOI_DA).forEach(function (h) { chieuQua(h.ten, h.soTien); });
    // Người vừa được chiếu realtime mà thành top 1: refresh trong 10 tiếng không chiếu lại họ.
    if (top && laHomNay && moi.some(function (h) { return khoaNguoi(h) === khoaNguoi(top); })) {
      ghiDaChieu(khoaTop(top));
    }
  }

  // ── bảng top ─────────────────────────────────────────────────────────────
  function veBang() {
    var than = $('dn-top-than');
    while (than.firstChild) { than.removeChild(than.firstChild); }
    var ds = (duLieu && (dangXem === 'ngay' ? duLieu.topNgay : duLieu.topThang)) || [];
    $('dn-top-caption').textContent = ds.length
      ? (dangXem === 'ngay' ? T('Ủng hộ hôm nay') : T('Ủng hộ tháng này'))
      : T('Chưa có ai ủng hộ trong khoảng này.');
    ds.forEach(function (h) {
      var tr = document.createElement('tr');
      [String(h.hang), h.ten, tien(h.soTien)].forEach(function (v, i) {
        var td = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) { td.setAttribute('scope', 'row'); }
        if (i === 2) { td.className = 'giua so'; }
        td.textContent = v;          // 🔴 textContent, không innerHTML
        tr.appendChild(td);
      });
      than.appendChild(tr);
    });
  }

  function doiTab(t) {
    dangXem = t;
    $('dn-tab-ngay').setAttribute('aria-selected', String(t === 'ngay'));
    $('dn-tab-thang').setAttribute('aria-selected', String(t === 'thang'));
    veBang();
  }

  function apLuat(d) {
    LUAT = d.luat;
    // 🔴 SỐ NGÀY CŨNG LÀ LUẬT, và nó phải tới từ `/api/donate.json` như mọi con số khác.
    // Bản đầu viết cứng "30 ngày" thẳng trong `.njk` — nơi cổng grep chống-viết-cứng
    // KHÔNG nhìn tới. Đổi `so_ngay_hieu_luc` bằng một lệnh UPDATE khi đó sẽ để trang nói
    // 30 còn máy chủ cấp 45, im lặng.
    if (LUAT && LUAT.so_ngay_hieu_luc) {
      var eln = document.getElementById('dn-so-ngay');
      if (eln) { eln.textContent = String(LUAT.so_ngay_hieu_luc); }
    }
    var keo = $('dn-keo');
    keo.setAttribute('min', '0');
    keo.setAttribute('max', String(thangKeo().nTong));
    keo.setAttribute('step', '1');           // một nấc; nấc ra bao nhiêu tiền là việc của `tienTuNac`
    datThu(LUAT.muc1_nguong, false);          // mở ra là đã đứng ở mốc 1
  }

  function taiBang() {
    return fetch(API, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) { return; }
        duLieu = d;
        if (d.luat) { apLuat(d); }
        veBang();
        $('dn-tuoi').textContent = '';
        // Chờ biết ai đang xem rồi mới xét quà: đồng hạng nhất thì ưu tiên hàng của họ.
        // `aiDangXem()` dùng lại lời gọi /api/player/me của `app.js`, không thêm vòng mạng.
        aiDangXem().then(function (me) { nguoiXem = me; xetQua(d); });
      })
      .catch(function () { /* trang vẫn dùng được, chỉ là chưa có bảng */ });
  }

  // Nhịp làm mới bảng top của RIÊNG trang này. Dày hơn dải chạy (60 giây) vì đây là
  // trang người ta mở ra để nhìn đúng cái bảng đó — trong khi dải chạy nằm ở mọi trang
  // nên nhịp dày là nhân lên theo số trang đang mở.
  var NHIP_BANG = 15000;

  function caiDatNutNhanh() {
    var nuts = document.querySelectorAll('.dn-nut-muc');
    nuts.forEach(function (nut) {
      nut.addEventListener('click', function () {
        var tienNut = Number(nut.getAttribute('data-tien')) || 0;
        if (tienNut > 0) {
          $('dn-tien').value = String(tienNut);
          datThu(tienNut, false);
        } else {
          // Tùy tâm: xoá active các nút mốc, bật active nút Tùy tâm
          nuts.forEach(function (n) { n.classList.remove('dn-nut-muc--active'); });
          nut.classList.add('dn-nut-muc--active');
          var oTien = $('dn-tien');
          oTien.focus();
          oTien.select();
        }
      });
    });
  }

  function caiDatSaoChep() {
    document.querySelectorAll('[data-chep]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-chep');
        var el = $(id);
        if (!el) { return; }
        var text = (el.textContent || '').trim();
        if (id === 'dn-so') {
          text = text.replace(/\s+/g, '');
        }
        function daChepXong() {
          var cu = btn.textContent;
          btn.textContent = '✓ ' + T('Đã chép');
          btn.classList.add('dn-chep--xong');
          setTimeout(function () {
            btn.textContent = cu;
            btn.classList.remove('dn-chep--xong');
          }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(daChepXong).catch(function () {
            fallbackChep(text, daChepXong);
          });
        } else {
          fallbackChep(text, daChepXong);
        }
      });
    });
  }

  function fallbackChep(text, cb) {
    var t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('class', 'skip');
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(t);
    if (cb) { cb(); }
  }

  function caiDatModalQr() {
    var moBtn = $('dn-xem-qr-goc');
    var moBtn2 = $('dn-qr-goc-nut');
    var modal = $('dn-modal-qr');
    var dongBtn = $('dn-modal-dong');
    var doiSoBtn = $('dn-doi-so');
    var taiQrBtn = $('dn-tai-qr');

    function moModal() {
      if (modal) { modal.hidden = false; }
    }
    function dongModal() {
      if (modal) { modal.hidden = true; }
    }

    if (moBtn) { moBtn.addEventListener('click', moModal); }
    var miniQr = $('dn-mini-qr');
    if (miniQr) { miniQr.addEventListener('click', moModal); }
    if (moBtn2) { moBtn2.addEventListener('click', moModal); }
    if (dongBtn) { dongBtn.addEventListener('click', dongModal); }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) { dongModal(); }
      });
    }

    if (doiSoBtn) {
      doiSoBtn.addEventListener('click', function () {
        $('dn-kq').hidden = true;
        $('dn-form').hidden = false;
        $('dn-tien').focus();
      });
    }

    if (taiQrBtn) {
      taiQrBtn.addEventListener('click', function () {
        var qrImg = $('dn-qr');
        if (!qrImg || !qrImg.src) { return; }
        var a = document.createElement('a');
        a.href = qrImg.src;
        a.download = 'QR_Techcombank_DangThiLam_RongViet.jpg';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }
  }

  // ── khởi động ────────────────────────────────────────────────────────────
  function batDau() {
    $('dn-keo').addEventListener('input', capNhatKeo);

    // ── ô số gõ được ──────────────────────────────────────────────────────────
    var oSo = $('dn-keo-so');
    // Bấm vào thì bỏ định dạng, để sửa số cho dễ. Giữ nguyên "150.000 ₫" mà bắt người
    // ta sửa giữa các dấu chấm là một cách chắc chắn để họ gõ sai.
    oSo.addEventListener('focus', function () {
      oSo.value = soThu ? String(soThu) : '';
      oSo.select();
    });
    oSo.addEventListener('input', function () {
      datThu(docSoNhap(oSo.value), true);
    });
    // Rời ô thì định dạng lại TỪ `soThu`, không phải từ chữ đang có trong ô — nhờ vậy
    // số vượt trần hiện ra đúng bằng con số đã bị kẹp, thay vì kẹp thầm.
    oSo.addEventListener('blur', function () { oSo.value = tien(soThu); });
    oSo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { oSo.blur(); }
    });

    $('dn-thu-dung').addEventListener('click', function () {
      $('dn-tien').value = String(soThu);
      $('dn-tien').focus();
    });

    // 🔴 Gõ ở ô "Số tiền" cũng phải cập nhật bảng quà. Không có dây này thì người ta
    // gõ 2.000.000 rồi nhìn lên vẫn thấy quà của 150.000 — trang nói dối về thứ họ
    // sắp nhận, và nói dối một cách hoàn toàn im lặng.
    $('dn-tien').addEventListener('input', function () {
      datThu(docSoNhap($('dn-tien').value), false);
    });
    $('dn-dk').addEventListener('change', function () {
      $('dn-gui').disabled = !$('dn-dk').checked;
    });
    $('dn-gui').addEventListener('click', layMa);
    caiDatNutNhanh();
    caiDatSaoChep();
    caiDatModalQr();
    $('dn-tab-ngay').addEventListener('click', function () { doiTab('ngay'); });
    $('dn-tab-thang').addEventListener('click', function () { doiTab('thang'); });

    aiDangXem().then(function (me) {
      var roi = !!me;
      $('dn-ai-chua').hidden = roi;
      $('dn-ai-roi').hidden = !roi;
      $('dn-tick-andanh').hidden = !roi;
      if (roi) {
        $('dn-ai-ten').textContent = 'Steam ...' + String(me.steamid || '').slice(-4);
        hienHanCuaToi();
      }
    });

    apLuat({ luat: DEFAULT_LUAT });
    taiBang();

    // 🔴 TỰ LÀM MỚI. Bản đầu gọi `taiBang()` đúng một lần lúc mở trang, nên một tab
    // đang mở hiện bảng cũ **vĩnh viễn** — chủ server báo 2026-09-05 là "danh sách
    // donate bị cache". Ba tầng trễ phía máy chủ cộng lại chỉ tới ~3 phút; tầng làm
    // hỏng trải nghiệm là tầng này, và nó không có giới hạn.
    setInterval(function () {
      // Tab ẩn thì thôi hỏi — không để một tab bỏ quên chạy suốt đêm.
      if (document.visibilityState !== 'hidden') { taiBang(); }
    }, NHIP_BANG);
    // Quay lại tab thì làm mới NGAY: đó đúng là lúc người ta nhìn vào nó.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { taiBang(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', batDau);
  } else {
    batDau();
  }
})();
