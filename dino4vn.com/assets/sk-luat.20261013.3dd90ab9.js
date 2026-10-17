/* sk-luat.js — LUẬT ƯU TIÊN trạng thái khối sự kiện ở trang chủ (2026-09-27).
 *
 * Bản JS GƯƠNG của hàm Python phía máy chủ sinh `/api/su-kien.js` (hợp đồng H3,
 * `ops/daisan/HOP-DONG.md`). Hai bản phải cho CÙNG một kết quả trên mọi ca của
 * `ops/daisan/fixture-su-kien.json` — `panel/tests/test_web_sukien.py` chạy file này
 * thật trên bộ ca đó. Đổi luật hay hằng số ở đây mà không đổi bên kia (và fixture) là:
 *   · `/api/su-kien.js` dựng sẵn khung cho trạng thái A trước lần vẽ đầu,
 *   · `nha.js` đọc JSON xong lại tính ra trạng thái B ⇒ khối nhảy hoặc sập dưới mắt người
 *     đang đọc, đúng thứ cơ chế giữ chỗ sinh ra để tránh.
 *
 * Thứ tự thắng: dang > bao > xong > lich > null (null = không có khối).
 *   dang  `vay-trum.json` có `dang` và `ts` còn trong TUOI_DANG_MS. Người dẫn chết giữa đợt để lại
 *         một `dang` mồ côi — `ts` là nhịp tim của nó (ghi ít nhất 15 s/lần trong đợt).
 *   bao   `vay-trum.json` có `sap.mo_luc_ms` (đạo diễn ghi lúc bắt đầu đếm ngược báo trước) và chưa
 *         quá giờ mở BAO_QUA_MS. Đạo diễn chết giữa đếm ngược thì `sap` ở lại — mốc này tự dọn nó.
 *   xong  `gan_nhat.dong_ms` trong XONG_MS vừa qua (chấp nhận lệch đồng hồ LECH_MS về tương lai).
 *   lich  `su-kien.json` có `lich.mo_luc_ms` ở TƯƠNG LAI (tới giờ là thôi, dù đợt chưa mở).
 *
 * "Là số" = số hữu hạn: `true` và `"1790…"` KHÔNG phải số. Một tài liệu chỉ được dùng khi là object
 * có `schema === 1`. Hàm THUẦN: không đọc đồng hồ, không đụng DOM — `now` do bên gọi đưa vào (giờ
 * máy chủ theo header `Date`, không phải giờ máy người xem).
 */
(() => {
  'use strict';

  const TUOI_DANG_MS = 600000;    // 10 phút — cùng mốc "đợt mồ côi" của vaytrum.js / HOP-DONG §7
  const BAO_QUA_MS = 300000;      // 5 phút ân hạn sau giờ mở (người dẫn cần vài giây mới ghi `dang`)
  const XONG_MS = 5400000;        // 90 phút giữ kết quả trên trang chủ
  const LECH_MS = 600000;         // `dong_ms` ở tương lai tối đa ngần này vẫn nhận (lệch đồng hồ)

  const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
  const laObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hopLe = (d) => (laObj(d) && d.schema === 1 ? d : null);

  function trangThai(suKien, vayTrum, now) {
    const vt = hopLe(vayTrum);
    const sk = hopLe(suKien);
    if (vt && laObj(vt.dang) && laSo(vt.ts) && now - vt.ts <= TUOI_DANG_MS) return 'dang';
    if (vt && laObj(vt.sap) && laSo(vt.sap.mo_luc_ms) && now <= vt.sap.mo_luc_ms + BAO_QUA_MS) return 'bao';
    if (vt && laObj(vt.gan_nhat) && laSo(vt.gan_nhat.dong_ms)) {
      const qua = now - vt.gan_nhat.dong_ms;
      if (qua <= XONG_MS && qua >= -LECH_MS) return 'xong';
    }
    if (sk && laObj(sk.lich) && laSo(sk.lich.mo_luc_ms) && sk.lich.mo_luc_ms > now) return 'lich';
    return null;
  }

  /* ── Hai hàm CHỈ của trang, KHÔNG có bản gương Python ─────────────────────────────────────────
     `/api/su-kien.js` là trạng thái LÚC TẢI; hai hàm dưới đây lo chuyện GIỮA PHIÊN (HOP-DONG §8 H4),
     nên fixture chung không phủ chúng — `test_web_sukien.py` có bộ ca riêng. */

  /* Dữ liệu để vẽ trạng thái `t` CÒN trong bản đã tải hay không. KHÔNG xét đồng hồ (việc của `trangThai`). */
  function coDuLieu(t, suKien, vayTrum) {
    const vt = hopLe(vayTrum);
    const sk = hopLe(suKien);
    if (t === 'lich') return !!(sk && laObj(sk.lich) && laSo(sk.lich.mo_luc_ms));
    if (t === 'bao') return !!(vt && laObj(vt.sap) && laSo(vt.sap.mo_luc_ms));
    if (t === 'dang') return !!(vt && laObj(vt.dang));
    if (t === 'xong') return !!(vt && laObj(vt.gan_nhat) && laSo(vt.gan_nhat.dong_ms));
    return false;
  }

  /* Trạng thái trang HIỆN sau một lượt tính, khi đã có cả hai tệp.
     `truoc` = trạng thái đang hiện, `daXacNhan` = JSON đã xác nhận `truoc` trong phiên này, `moi` = `trangThai(…)`.
     Luật ra `null` chỉ vì ĐỒNG HỒ (hết 90 phút giữ kết quả, tới giờ hẹn mà chưa có `sap`, quá ân hạn báo trước)
     trong khi dữ liệu của `truoc` vẫn còn ⇒ GIỮ `truoc`: khối ~310px biến mất dưới mắt người đang xem là cả hero
     nhảy lên (đo 0,24 CLS). Không giữ khi: `moi` khác null (luôn thắng) · `truoc` chưa được JSON xác nhận (`data-sk`
     của tệp .js có thể cũ hàng giờ khi panel chết — lượt JSON đầu được quyền sửa nó, kể cả thành không có) ·
     dữ liệu đã biến mất THẬT (admin xoá lịch, đạo diễn huỷ báo trước). */
  function giuKhung(truoc, daXacNhan, moi, suKien, vayTrum) {
    if (moi !== null || !truoc || !daXacNhan) return moi;
    return coDuLieu(truoc, suKien, vayTrum) ? truoc : null;
  }

  window.dino4vnSK = Object.freeze({
    trangThai, coDuLieu, giuKhung, TUOI_DANG_MS, BAO_QUA_MS, XONG_MS, LECH_MS,
  });
})();
