/* chay.js — dải cảm ơn người ủng hộ, ở MỌI trang.
 *
 * Làm lại 2026-09-14 (chủ server chốt): KHÔNG chạy chữ nữa. Hiện LẦN LƯỢT một người —
 * tên, số tiền, lời nhắn — đổi mỗi 8 giây. Lời nhắn bắt buộc phải hiện được:
 * `/dieu-khoan-donate` hứa "lời nhắn hiển thị công khai trên website", và đây là chỗ
 * duy nhất hiện nó.
 *
 * Ba kỷ luật, không đổi so với bản chạy chữ:
 *  1. `textContent`, KHÔNG BAO GIỜ `innerHTML`. Lời nhắn do người lạ nhập và dải này
 *     hiện trên MỌI trang — chỗ tệ nhất có thể để lọt một `<img onerror>`.
 *  2. KHÔNG đụng `.style`. Hiệu ứng đổi người là một CLASS (`chay__muc--vao`) trong
 *     site.css, và site.css tắt nó dưới `prefers-reduced-motion`.
 *  3. HTML tĩnh đã mang sẵn một câu. Script này chỉ THAY nội dung. Không có dữ liệu,
 *     fetch hỏng hay JSON rác đều cùng một kết cục: giữ nguyên câu tĩnh.
 *
 * Thêm 2026-09-15 (review PR #7):
 *  4. Nội dung tự đổi quá 5 giây cạnh nội dung khác phải DỪNG ĐƯỢC (WCAG 2.2.2) — nút
 *     `#chay-dung`, không chỉ rê chuột/Tab. Người bật `prefers-reduced-motion` thì dải
 *     KHÔNG tự đổi ngay từ đầu; họ bấm "Chạy tiếp" nếu muốn.
 *  5. Danh sách về RỖNG (lượt ủng hộ bị ẩn/hoàn tiền) hoặc dữ liệu đã quá cũ thì QUAY VỀ
 *     câu tĩnh — không để tab mở từ hôm qua cứ cảm ơn mãi một danh sách không còn đúng.
 *
 * Vì sao MỘT người mỗi lượt chứ không nối cả danh sách: bản chạy chữ cần nhân đôi danh
 * sách để nối vòng, và đã có lần chủ server đọc thành "một lượt ủng hộ bị ghi hai lần"
 * (2026-09-05). Một người một lượt thì không có bản sao nào để hiểu nhầm.
 */
(function () {
  'use strict';

  var API = '/api/donate.json';
  var QUA_CU = 30 * 60 * 1000;   // dữ liệu cũ hơn 30 phút thì thôi hiện, khớp `bxh.js`
  var LECH = 2 * 60 * 1000;      // dung sai đồng hồ máy người xem
  var NHIP_DOI = 8000;           // đổi người mỗi 8 giây (chủ server chốt)
  // 60 giây vì dải này nằm ở MỌI trang: nhịp dày hơn là nhân số yêu cầu với số trang
  // đang mở. Trang `/donate` có nhịp riêng, dày hơn (xem `donate.js`).
  var NHIP_LAM_MOI = 60000;

  var dai = document.getElementById('chay');
  var muc = document.getElementById('chay-day');
  if (!dai || !muc) { return; }
  var nut = document.getElementById('chay-dung');

  // Bản sao câu tĩnh — để quay về được khi danh sách rỗng hoặc dữ liệu đã cũ.
  var tinh = muc.cloneNode(true);

  var ds = [];          // danh sách đang hiển thị
  var chiSo = 0;        // người đang hiện
  var dung = false;     // đang hover/focus -> không đổi người
  var hen = 0;
  var builtAtCuoi = 0;  // mốc dựng (ms) của danh sách đang hiện

  var giamChuyenDong = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var nguoiDung = giamChuyenDong;   // người xem đã bấm dừng (hoặc giảm chuyển động)

  // Chữ cố định theo ngôn ngữ trang (`<html lang>`); tiếng Việt là mặc định.
  var en = document.documentElement.lang === 'en';
  var CHU = en
    ? { tiep: 'Resume', dung: 'Pause', camOn: 'Thanks', anDanh: 'Anonymous' }
    : { tiep: 'Chạy tiếp', dung: 'Dừng', camOn: 'Cảm ơn', anDanh: 'Ẩn danh' };

  function tien(n) {
    return (Number(n) || 0).toLocaleString(en ? 'en-US' : 'vi-VN') + ' ₫';
  }

  function veNut() {
    if (!nut) { return; }
    nut.hidden = ds.length < 2;
    nut.textContent = nguoiDung ? CHU.tiep : CHU.dung;
    nut.setAttribute('aria-pressed', nguoiDung ? 'true' : 'false');
  }

  function ve(h) {
    while (muc.firstChild) { muc.removeChild(muc.firstChild); }

    var dan = document.createElement('span');
    dan.className = 'chay__dan';
    dan.textContent = CHU.camOn;
    muc.appendChild(dan);

    var ten = document.createElement('b');
    ten.textContent = h.ten || CHU.anDanh;
    muc.appendChild(ten);

    var so = document.createElement('i');
    so.className = 'chay__so';
    so.textContent = tien(h.soTien);
    muc.appendChild(so);

    var day_du = (h.ten || CHU.anDanh) + ' ' + tien(h.soTien);
    if (h.loiNhan) {
      var n = document.createElement('span');
      n.className = 'chay__nhan';
      n.textContent = h.loiNhan;         // 🔴 textContent, không innerHTML
      muc.appendChild(n);
      day_du += ' “' + h.loiNhan + '”';
    }
    // Lời nhắn dài bị cắt một dòng bằng CSS; `title` giữ bản đầy đủ để rê chuột đọc được.
    muc.setAttribute('title', day_du);

    // Đổi class để chạy lại hiệu ứng hiện ra. Đọc `offsetWidth` ép trình duyệt tính lại
    // layout giữa hai lần gán — không có nó, gỡ rồi gắn cùng một class trong một khung
    // hình là không có gì chạy lại.
    muc.classList.remove('chay__muc--vao');
    void muc.offsetWidth;
    muc.classList.add('chay__muc--vao');
  }

  /* Về lại câu tĩnh của HTML — cùng kết cục với "chưa từng có dữ liệu". */
  function veTinh() {
    if (!ds.length) { return; }
    ds = [];
    chiSo = 0;
    builtAtCuoi = 0;
    if (hen) { clearInterval(hen); hen = 0; }
    while (muc.firstChild) { muc.removeChild(muc.firstChild); }
    for (var c = tinh.firstChild; c; c = c.nextSibling) { muc.appendChild(c.cloneNode(true)); }
    muc.removeAttribute('title');
    muc.classList.remove('chay__muc--vao');
    veNut();
  }

  function doi() {
    if (builtAtCuoi && Date.now() - builtAtCuoi > QUA_CU + LECH) { veTinh(); return; }
    if (dung || nguoiDung || ds.length < 2 || document.visibilityState === 'hidden') { return; }
    chiSo = (chiSo + 1) % ds.length;
    ve(ds[chiSo]);
  }

  function nhan(moi, builtAtMs) {
    // Danh sách làm mới mỗi 60 giây: giữ người đang hiện nếu còn trong danh sách, để dải
    // không giật về người đầu mỗi phút.
    var dangHien = ds[chiSo];
    ds = moi;
    builtAtCuoi = builtAtMs;
    var giu = dangHien ? moi.findIndex(function (h) {
      return h.ten === dangHien.ten && h.soTien === dangHien.soTien && h.loiNhan === dangHien.loiNhan;
    }) : -1;
    var lanDau = !dangHien;
    chiSo = giu >= 0 ? giu : 0;
    if (lanDau || giu < 0) { ve(ds[chiSo]); }
    if (!hen) { hen = setInterval(doi, NHIP_DOI); }
    veNut();
  }

  // Người đang đọc (rê chuột hoặc Tab tới link "Ủng hộ server") thì thôi đổi.
  dai.addEventListener('mouseenter', function () { dung = true; });
  dai.addEventListener('mouseleave', function () { dung = false; });
  dai.addEventListener('focusin', function () { dung = true; });
  dai.addEventListener('focusout', function () { dung = false; });

  if (nut) {
    nut.addEventListener('click', function () {
      nguoiDung = !nguoiDung;
      veNut();
    });
  }

  function nap() {
    return fetch(API, { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) { doi(); return; }          // HTTP lỗi: giữ tạm, `doi()` tự bỏ khi đã quá cũ
      // Trang chủ (`nha.js`, khối "Cảm ơn người góp server") dùng lại CHÍNH bản này thay vì tải
      // `donate.json` lần hai. Phát TRƯỚC các phép kiểm bên dưới: bên nhận tự kiểm độ cũ theo luật
      // của nó. Bản mới nhất nằm ở `window.__dino4vnDonate` cho bên nào chạy sau lượt phát đầu.
      window.__dino4vnDonate = d;
      try { document.dispatchEvent(new CustomEvent('dino4vn:donate', { detail: d })); } catch (e) { /* trình duyệt cổ */ }
      var builtAtMs = (Number(d.builtAt) || 0) * 1000;
      // Dữ liệu quá cũ thì THÔI HIỆN, đừng hiện số cũ như số mới (`bxh.js`).
      if (Date.now() - builtAtMs > QUA_CU + LECH) { veTinh(); return; }
      // Máy chủ nói danh sách RỖNG: quay về câu tĩnh, đừng cảm ơn tiếp người đã bị ẩn.
      if (!Array.isArray(d.chayChu) || !d.chayChu.length) { veTinh(); return; }
      nhan(d.chayChu, builtAtMs);
    })
    .catch(function () { doi(); /* mạng hỏng: giữ tạm, quá cũ thì `doi()` tự về câu tĩnh */ });
  }

  nap();
  // `visibilityState`: tab ẩn thì thôi hỏi. Một người mở 10 tab rồi để đó không nên
  // thành 10 luồng yêu cầu chạy suốt đêm.
  setInterval(function () {
    if (document.visibilityState !== 'hidden') { nap(); }
  }, NHIP_LAM_MOI);
  // Quay lại tab thì làm mới NGAY: đó chính là lúc người ta nhìn vào nó.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { nap(); }
  });
})();
