/* skin-tu.js — QUÀ SKIN trên trang /skin: tủ bộ màu · bảng màu miễn phí · bộ sự kiện · nhắc quà.
 *
 * Người dùng chốt 2026-09-14 (research/skin-doanh-thu-2026-09-14.md):
 *   bậc 0 (miễn phí) 1 bộ, chỉ màu trong bảng · bậc 1 "Góp nước" 5 bộ · bậc 2 15 bộ · bậc 3 ∞;
 *   từ bậc 1: mã màu tự do + TỰ ÁP bộ mặc định khi respawn; hết hạn thì KHOÁ, KHÔNG XOÁ.
 *
 * 🔴 FILE NÀY KHÔNG GIỮ MỘT CON SỐ NÀO CỦA LUẬT. Số bộ, tên bậc, ngưỡng tiền của bậc kế tiếp
 *    — tất cả tới từ GET /api/player/skin/quyen. Hàng rào THẬT nằm ở server
 *    (`player/app/skin_qua.py::kiem`); bắt màu về bảng ở đây chỉ để người dùng khỏi ăn 403.
 *
 * Bốn kỷ luật của repo (chép từ skin.js / donate.js — cả bốn đều đã trả giá):
 *  1. `textContent`/`createElement`, KHÔNG BAO GIỜ `innerHTML` — tên bộ do người chơi gõ.
 *  2. KHÔNG đụng `.style`. Ô màu vẽ bằng <rect> SVG đổi thuộc tính `fill` (CSP style-src 'self').
 *  3. Không <form> (CSP form-action 'none'), không hộp thoại `confirm()` — xoá bấm hai lần.
 *  4. ES5: không `let`/`const`/mũi tên/chuỗi mẫu.
 *
 * Nói chuyện với trình sửa QUA `window.Dino4VNSkin` (skin.js mở năm hàm), không đọc DOM của nó.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var KHE_XEM = ["body", "flank", "markings", "underbelly", "maleDisplay"];
  var Q = null;                 // quyền skin của người đang đăng nhập (server trả)
  var BANG = [];                // [{hex, lab}] — chỉ có khi bị giới hạn bảng màu
  var KHE_CHON = "body";        // khe mà bảng màu miễn phí sẽ tô vào khi bấm
  var TEN_KHE = {};

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function S() { return window.Dino4VNSkin || null; }

  function api(duong, o) {
    o = o || {};
    o.credentials = "same-origin";
    o.headers = o.headers || {};
    if (o.body) o.headers["Content-Type"] = "application/json";
    return fetch(duong, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.ly_do || j.detail || j.err || ("HTTP " + r.status));
          e.j = j;
          throw e;
        }
        return j;
      });
    });
  }

  function ghi(chu, loi) {
    var e = $("skin-tu-ghichu");
    if (!e) return;
    e.textContent = chu;
    e.className = loi ? "dim nho canhbao" : "dim nho";
  }

  function ngay(ts) {
    if (!ts) return "—";
    return new Date(Number(ts) * 1000).toLocaleDateString("vi-VN");
  }

  function tien(n) { return (Number(n) || 0).toLocaleString("vi-VN") + " ₫"; }

  function vo(bo) {
    return (Q && Q.vo_han && bo >= Q.vo_han) ? "không giới hạn" : String(bo);
  }

  /** Một ô màu bằng SVG — `fill` là THUỘC TÍNH, không phải style. */
  function oMau(hex, nhan) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("class", "o-mau");
    s.setAttribute("viewBox", "0 0 22 22");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", nhan || hex);
    var r = document.createElementNS(NS, "rect");
    r.setAttribute("x", "0");
    r.setAttribute("y", "0");
    r.setAttribute("width", "22");
    r.setAttribute("height", "22");
    r.setAttribute("fill", hex);
    s.appendChild(r);
    return s;
  }

  function nut(chu, fn, chinh) {
    var b = el("button", chinh ? "act act--nho act--primary" : "act act--nho", chu);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  /* ── Màu gần nhất trong bảng (CIE Lab, ΔE76) ──────────────────────────────────
     Chỉ để BẮT VỀ cho người dùng khỏi ăn 403. Server so ĐÚNG MÃ HEX, không so gần đúng. */
  function lab(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var x = (0.4124564 * c[0] + 0.3575761 * c[1] + 0.1804375 * c[2]) / 0.95047;
    var y = 0.2126729 * c[0] + 0.7151522 * c[1] + 0.0721750 * c[2];
    var z = (0.0193339 * c[0] + 0.1191920 * c[1] + 0.9503041 * c[2]) / 1.08883;
    var f = function (t) { return t > 216 / 24389 ? Math.pow(t, 1 / 3) : (24389 / 27 * t + 16) / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }

  function trongBang(hex) {
    var h = String(hex || "").toLowerCase();
    for (var i = 0; i < BANG.length; i++) if (BANG[i].hex === h) return true;
    return false;
  }

  function ganNhat(hex) {
    var l = lab(hex);
    if (!l || !BANG.length) return null;
    var tot = null, dTot = Infinity;
    BANG.forEach(function (b) {
      var d = Math.pow(l[0] - b.lab[0], 2) + Math.pow(l[1] - b.lab[1], 2) + Math.pow(l[2] - b.lab[2], 2);
      if (d < dTot) { dTot = d; tot = b.hex; }
    });
    return tot;
  }

  /* ── Trạng thái quà + nhắc quà ─────────────────────────────────────────────── */
  function veTrangThai() {
    var e = $("skin-tu-trangthai");
    if (!e || !Q) return;
    e.textContent = "";
    var dong;
    if (Q.bac > 0) {
      dong = "Quà ủng hộ: " + (Q.ten || "") + " · tới " + ngay(Q.den) + " · tủ "
        + Q.so_bo + "/" + vo(Q.bo) + " bộ"
        + (Q.tudo ? " · mã màu tự do" : "")
        + (Q.tuap ? " · tự áp khi respawn" : "") + ".";
    } else {
      dong = "Tủ miễn phí: " + Q.so_bo + "/" + vo(Q.bo) + " bộ"
        + (Q.gioi_han_mau ? ", màu chọn trong bảng màu miễn phí." : ".");
    }
    e.appendChild(el("span", null, dong));
    if (Q.nhac) {
      var p = el("p", "dim nho mb-0");
      p.appendChild(document.createTextNode(
        "Người ủng hộ từ " + tien(Q.nhac.nguong) + " (" + Q.nhac.ten + ") được lưu "
        + vo(Q.nhac.bo) + " bộ, dùng mã màu tự do và tự áp màu mỗi lần respawn. "));
      var a = el("a", null, "Xem cách ủng hộ");
      a.href = "/donate";
      p.appendChild(a);
      e.appendChild(p);
    }
  }

  /* ── Bảng màu miễn phí ─────────────────────────────────────────────────────── */
  function veBang() {
    var khung = $("skin-bangfree");
    if (!khung) return;
    khung.hidden = !(Q && Q.gioi_han_mau && BANG.length);
    if (khung.hidden) return;
    var nhan = $("skin-bangfree-khe");
    if (nhan) nhan.textContent = TEN_KHE[KHE_CHON] || KHE_CHON;
    var luoi = $("skin-bangfree-luoi");
    if (!luoi || luoi.childNodes.length) return;       // vẽ MỘT lần
    BANG.forEach(function (b) {
      var n = el("button", "khe__nut");
      n.type = "button";
      n.title = b.hex;
      n.setAttribute("aria-label", "Màu " + b.hex);
      n.appendChild(oMau(b.hex));
      n.addEventListener("click", function () {
        if (S() && S().datMotKhe(KHE_CHON, b.hex)) {
          ghi("Đã tô " + (TEN_KHE[KHE_CHON] || KHE_CHON) + " = " + b.hex + ".", false);
        }
      });
      luoi.appendChild(n);
    });
  }

  function ganChonKhe() {
    var mau = $("skin-mau");
    if (!mau) return;
    var hang = mau.querySelectorAll("[data-khe]");
    for (var i = 0; i < hang.length; i++) {
      TEN_KHE[hang[i].getAttribute("data-khe")] =
        ((hang[i].querySelector(".khe__ten") || {}).textContent || "");
    }
    // Khe đang chọn = khe người dùng vừa bấm/nhập vào. `focusin` nổi bọt, `focus` thì không.
    mau.addEventListener("focusin", function (ev) {
      var h = ev.target && ev.target.closest ? ev.target.closest("[data-khe]") : null;
      if (!h) return;
      KHE_CHON = h.getAttribute("data-khe");
      var nhan = $("skin-bangfree-khe");
      if (nhan) nhan.textContent = TEN_KHE[KHE_CHON] || KHE_CHON;
    });
    // Bị giới hạn bảng: màu CHỐT (`change`, không phải `input` — kéo ô màu bắn `input` liên
    // tục, bắt về giữa lúc kéo là giật tay người dùng) nằm ngoài bảng thì bắt về màu gần nhất.
    mau.addEventListener("change", function (ev) {
      if (!(Q && Q.gioi_han_mau && BANG.length && S())) return;
      var h = ev.target && ev.target.closest ? ev.target.closest("[data-khe]") : null;
      if (!h) return;
      var ma = h.getAttribute("data-khe");
      var v = String(ev.target.value || "").toLowerCase();
      if (!/^#?[0-9a-f]{6}$/.test(v)) return;
      if (v.charAt(0) !== "#") v = "#" + v;
      if (trongBang(v)) return;
      var g = ganNhat(v);
      if (g && S().datMotKhe(ma, g)) {
        ghi("Màu " + v + " nằm ngoài bảng màu miễn phí — đã đổi sang màu gần nhất " + g
          + ". Người ủng hộ được dùng mã màu tự do.", false);
      }
    });
  }

  function taiBang() {
    return api("/api/player/skin/bang-mau").then(function (j) {
      BANG = (j.mau || []).map(function (x) {
        return { hex: String(x.hex).toLowerCase(), lab: lab(x.hex) };
      }).filter(function (x) { return x.lab; });
      veBang();
    });
  }

  /* ── Tủ bộ màu ─────────────────────────────────────────────────────────────── */
  function lyKhoa(b) {
    return b.ly_khoa === "vuot_so_bo"
      ? "Đang khoá — tủ vượt số bộ của bậc hiện tại. Bộ vẫn còn nguyên."
      : "Đang khoá — có màu ngoài bảng màu miễn phí. Bộ vẫn còn nguyên.";
  }

  /* Một bộ trong tủ = MỘT DÒNG (2026-10-12, cùng đợt làm lại kho): dải màu bên trái, tên + loài +
     trạng thái + nút bên phải. Bản cũ mỗi bộ một thẻ to với năm ô màu xếp dọc. */
  function veMotBo(b, taiLai) {
    var the = el("div", "tu-dong");
    the.appendChild(daiMau(b.mau || {}, "tu-dong__dai"));
    var than = el("div", "tu-dong__than");
    var ten = el("p", "tu-dong__ten mb-0", b.ten);
    ten.appendChild(el("span", "dim", ", " + b.loai));
    than.appendChild(ten);
    the.appendChild(than);

    if (b.khoa) than.appendChild(el("p", "dim nho canhbao mb-0", lyKhoa(b)));
    if (b.mac_dinh) {
      than.appendChild(el("p", "dim nho mb-0", Q && Q.tuap
        ? "Tự áp khi bạn respawn thành " + b.loai + "."
        : "Đã chọn tự áp, nhưng tự áp dành cho người ủng hộ — hiện chưa chạy."));
    }

    var hang = el("div", "nut-nho");
    than.appendChild(hang);
    hang.appendChild(nut("Nạp vào trình sửa", function () {
      if (!S()) return;
      S().nap(b.mau, b.bien_the);
      ghi("Đã nạp “" + b.ten + "” vào trình sửa. Bấm “Áp vào game” để dùng.", false);
    }));
    if (!b.khoa) {
      hang.appendChild(nut("Áp vào game", function () {
        var bt = this;
        bt.disabled = true;
        ghi("Đang áp “" + b.ten + "”…", false);
        api("/api/player/bo-mau/" + b.id + "/ap", { method: "POST" })
          .then(function (j) {
            if (!j.ok) { ghi("Không áp được: " + (j.res || j.err || "không rõ lý do"), true); return; }
            ghi("Xong. Nhìn vào màn hình game để xem “" + b.ten + "”.", false);
          })
          .catch(function (e) { ghi("Không áp được: " + e.message, true); })
          .then(function () { bt.disabled = false; });
      }));
    }
    hang.appendChild(nut(b.mac_dinh ? "Tắt tự áp" : "Tự áp khi respawn", function () {
      api("/api/player/bo-mau/" + b.id + "/mac-dinh",
          { method: "POST", body: JSON.stringify({ bat: !b.mac_dinh }) })
        .then(function () { taiLai(); })
        .catch(function (e) { ghi("Không đổi được: " + e.message, true); });
    }));
    var xoa = nut("Xoá", function () {
      // Không `confirm()` (chặn luồng sự kiện của cả trang) — bấm hai lần trong 4 giây.
      if (xoa.getAttribute("data-cho") !== "1") {
        xoa.setAttribute("data-cho", "1");
        xoa.textContent = "Bấm lần nữa để xoá";
        setTimeout(function () { xoa.removeAttribute("data-cho"); xoa.textContent = "Xoá"; }, 4000);
        return;
      }
      api("/api/player/bo-mau/" + b.id, { method: "DELETE" })
        .then(function () { ghi("Đã xoá “" + b.ten + "”.", false); taiLai(); })
        .catch(function (e) { ghi("Không xoá được: " + e.message, true); });
    });
    hang.appendChild(xoa);
    return the;
  }

  function taiTu() {
    return api("/api/player/bo-mau").then(function (j) {
      var ds = $("skin-tu-ds");
      if (!ds) return;
      ds.textContent = "";
      var bo = j.bo || [];
      if (Q) { Q.so_bo = bo.length; veTrangThai(); }
      if (!bo.length) {
        ds.appendChild(el("p", "dim nho mb-0", "Chưa có bộ màu nào. Chỉnh màu ở trên rồi bấm “Lưu bộ đang chỉnh”."));
        return;
      }
      bo.forEach(function (b) { ds.appendChild(veMotBo(b, taiTu)); });
    });
  }

  function luuBo() {
    if (!S()) { ghi("Trình sửa chưa sẵn sàng, thử lại sau giây lát.", true); return; }
    var ten = String(($("skin-tu-ten") || {}).value || "").trim();
    var bien = S().bien(), bt = {};
    ["variation", "pattern", "theme"].forEach(function (t) {
      if (bien && bien[t] !== null && bien[t] !== undefined) bt[t] = bien[t];
    });
    // 🔴 Trình sửa mở ra mang màu ĐANG CÓ trên con dino (đọc từ game) — gần như không trùng đúng
    //    mã với bảng free. Lệnh lưu gửi đủ 10 khe, nên người bị giới hạn bảng sẽ bị 403
    //    `ngoai_bang` cho cả những khe họ còn chưa chạm. Bắt các khe đó về màu gần nhất NGAY
    //    TRONG trình sửa (người chơi thấy đúng cái sẽ được lưu) rồi mới gửi. Server vẫn kiểm chặt.
    var doi = 0;
    if (Q && Q.gioi_han_mau && BANG.length) {
      var hien = S().mau();
      Object.keys(hien).forEach(function (ma) {
        var v = String(hien[ma] || "").toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(v) || trongBang(v)) return;
        var g = ganNhat(v);
        if (g && S().datMotKhe(ma, g)) doi++;
      });
    }
    var nutLuu = $("skin-tu-luu");
    nutLuu.disabled = true;
    api("/api/player/bo-mau", { method: "POST", body: JSON.stringify({
      loai: S().loai(), ten: ten, mau: S().mau(), bien_the: bt }) })
      .then(function (j) {
        ghi("Đã lưu “" + j.bo.ten + "” cho " + j.bo.loai + "."
          + (doi ? " " + doi + " khe ngoài bảng màu miễn phí đã đổi sang màu gần nhất." : ""), false);
        if ($("skin-tu-ten")) $("skin-tu-ten").value = "";
        return taiTu();
      })
      .catch(function (e) { ghi("Không lưu được: " + e.message, true); })
      .then(function () { nutLuu.disabled = false; });
  }

  /* ── Kho bộ màu (2026-10-10, plan/skin-kho-admin.md; làm lại thành lưới 2026-10-12) ─────────
     Server (`/api/player/skin/kho`) đã lọc theo gói, hẹn giờ và công tắc: bộ người này không được
     thấy thì không có trong danh sách; bộ thấy mà chưa đủ gói mang `khoa: true`. Ở đây chỉ vẽ.
     Công tắc kho còn tắt (`ca_kho: false`) thì chỉ có bộ của dịp đang mở, y như khối "Bộ màu sự
     kiện" trước khi có kho. Lọc theo loài đang chọn ở trình sửa (nghe `dino4vn:xem3d`, sự kiện
     skin.js phát mỗi lần đổi con đang xem). Bộ glitch luôn đứng đầu (server xếp).

     Lưới 2026-10-12 — chủ server: "danh sách skins trải dài, giao diện còn thừa rất nhiều diện
     tích" (bản cũ: mỗi bộ một thẻ to xếp dọc, hàng trăm bộ). Mỗi bộ nay là một ô nhỏ (dải màu +
     tên), `TRANG` ô mỗi lượt + "Xem thêm", tìm theo tên, lọc nhóm / gói / màu chủ đạo. Bấm một ô
     = XEM THỬ trên mô hình (`Dino4VNSkin.xemThu`), KHÔNG nạp vào trình sửa: bấm lướt hàng chục bộ
     không được xoá màu người chơi đang chỉnh dở. Muốn chỉnh tiếp thì bấm "Nạp vào trình sửa". */
  var KHO = [];
  var KHO_CA = false;
  var LOAI_XEM = "";
  var TRANG = 24;               // số ô mỗi lượt "Xem thêm" — chia hết cho 2, 3, 4, 6 cột
  var LOC = { tim: "", nhom: "", goi: "", mau: "" };
  var SO_HIEN = TRANG;
  var CHON = null;              // id bộ đang xem thử trên mô hình
  /* Cuộn tới đâu nạp tới đó (chủ server 2026-10-12: "scroll to load"): danh sách ĐÃ LỌC giữ ở đây,
     IntersectionObserver canh `#skin-kho-cuoi` trong khung cuộn `#skin-kho-cuon` và VẼ THÊM 24 ô
     (không vẽ lại cả lưới). Trình duyệt không có IntersectionObserver thì hiện nút "Xem thêm". */
  var DS_HIEN = [];
  var SO_LOAI = 0;
  var IO = null;

  function taiKho() {
    return api("/api/player/skin/kho").then(function (j) {
      KHO = j.bo || [];
      KHO_CA = !!j.ca_kho;
      HO_CUA = {};
      HO_KHO = null;
      LOAI_XEM = S() ? S().loai() : "";
      veKho();
    });
  }

  function ghiKho(chu, loi) {
    var e = $("skin-kho-ghichu");
    if (!e) { ghi(chu, loi); return; }
    e.textContent = chu;
    e.className = loi ? "dim nho mb-0 canhbao" : "dim nho mb-0";
  }

  function apKho(b, nutAp) {
    nutAp.disabled = true;
    ghiKho("Đang áp “" + b.ten + "”…", false);
    api("/api/player/skin/kho/" + b.id + "/ap", { method: "POST" })
      .then(function (j2) {
        if (!j2.ok) { ghiKho("Không áp được: " + (j2.res || j2.err || "không rõ lý do"), true); return; }
        ghiKho("Xong. Nhìn vào màn hình game để xem “" + b.ten + "”.", false);
      })
      .catch(function (e) { ghiKho("Không áp được: " + e.message, true); })
      .then(function () { nutAp.disabled = false; });
  }

  function mauBo(b) { return b.mau || b.xem || {}; }   // glitch: chỉ có màu XEM TRƯỚC (đã kẹp)

  /* Màu chủ đạo của một bộ = khe Thân (không có thì khe đầu tiên có màu), xếp vào một họ — CÙNG
     ngưỡng với `ops/skin-kho-nhap/dung-bo-nhap.py::ho_mau`, để bộ nhập tên "Đỏ 012" nằm đúng
     dưới nút lọc "Đỏ". */
  var HO = ["Đỏ", "Cam", "Nâu", "Vàng", "Lục", "Ngọc", "Lam", "Tím", "Hồng", "Trắng", "Xám", "Đen"];
  var HUE = [[15, "Đỏ"], [40, "Cam"], [65, "Vàng"], [160, "Lục"], [195, "Ngọc"], [255, "Lam"],
             [290, "Tím"], [335, "Hồng"], [361, "Đỏ"]];
  var HO_CUA = {};              // id bộ -> họ màu (tính một lần mỗi lần tải kho)
  // Ô màu đại diện cho từng họ trên nút lọc — màu DỮ LIỆU (như ô màu của bộ), không phải màu giao diện.
  var MAU_HO = { "Đỏ": "#c62828", "Cam": "#ef6c00", "Nâu": "#6d4c41", "Vàng": "#f2c40f",
                 "Lục": "#2e9e44", "Ngọc": "#1aa39a", "Lam": "#2f6fd6", "Tím": "#7b3fc4",
                 "Hồng": "#e0559c", "Trắng": "#f2f2f2", "Xám": "#8a8a8a", "Đen": "#141414" };

  function hoMau(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
    var r = parseInt(h.substr(0, 2), 16) / 255, g = parseInt(h.substr(2, 2), 16) / 255,
        bl = parseInt(h.substr(4, 2), 16) / 255;
    var mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), l = (mx + mn) / 2, s = 0, hue = 0;
    if (mx !== mn) {                       // = colorsys.rgb_to_hls của Python
      var d = mx - mn;
      s = l <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
      var rc = (mx - r) / d, gc = (mx - g) / d, bc = (mx - bl) / d;
      hue = r === mx ? bc - gc : (g === mx ? 2 + rc - bc : 4 + gc - rc);
      hue = ((hue / 6) % 1 + 1) % 1;
    }
    var deg = hue * 360;
    if (l < 0.10) return "Đen";
    if (l > 0.90 && s < 0.6) return "Trắng";
    if (s < 0.15) return "Xám";
    if (deg >= 15 && deg < 50 && l < 0.40) return "Nâu";
    for (var i = 0; i < HUE.length; i++) if (deg < HUE[i][0]) return HUE[i][1];
    return "Đỏ";
  }

  /* Nút "Ngẫu nhiên" của trình sửa (`skin.js`) chỉ được ra phối màu KHÁC HỌ MÀU với các bộ trong
     kho (chủ server 2026-10-12): bấm ngẫu nhiên không được là đường tắt ra một bộ trong kho. Luật cùng
     dạng với chốt chống chép phía server (`skin_kho.bo_bi_chep`) nhưng thô hơn, theo HỌ màu (12 họ,
     `hoMau`): trùng họ ở ≥ 4 trong 5 khe chính của một bộ có ≥ 4 khe chính ⇒ coi là trùng. Đo trên
     952 bộ thật: ~25% lượt bốc ngẫu nhiên bị loại, nên bốc lại vài lần là đủ. */
  var KHE_SO = ["body", "flank", "markings", "underbelly", "maleDisplay"];
  var HO_KHO = null;            // [[họ của 5 khe chính] mỗi bộ có ≥ 4 khe chính] — tính lại sau mỗi lần tải kho

  function hoKho() {
    if (HO_KHO) return HO_KHO;
    HO_KHO = [];
    KHO.forEach(function (b) {
      var m = mauBo(b);
      var ho = KHE_SO.map(function (k) { return hoMau(m[k]); });
      if (ho.filter(Boolean).length >= 4) HO_KHO.push(ho);
    });
    return HO_KHO;
  }

  function trungHoMau(mau) {
    var cua = KHE_SO.map(function (k) { return hoMau((mau || {})[k]); });
    var ds = hoKho();
    for (var i = 0; i < ds.length; i++) {
      var khop = 0;
      for (var j = 0; j < KHE_SO.length; j++) if (ds[i][j] && ds[i][j] === cua[j]) khop++;
      if (khop >= 4) return true;
    }
    return false;
  }
  window.Dino4VNKho = { trungHoMau: trungHoMau };

  function hoCuaBo(b) {
    if (HO_CUA[b.id] === undefined) {
      var m = mauBo(b);
      var dau = m.body || m[KHE_XEM.filter(function (k) { return m[k]; })[0]];
      HO_CUA[b.id] = hoMau(dau);
    }
    return HO_CUA[b.id];
  }

  function boDau(s) {
    s = String(s || "");
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  }

  /** Thứ tự gói: free < nuoc < m1 < m2 < … (khoá gói của `ops/donate/bac.py::ds_goi`). */
  function hangGoi(k) {
    if (k === "free") return 0;
    if (k === "nuoc") return 0.5;
    var m = /^m(\d+)$/.exec(k || "");
    return m ? Number(m[1]) : 99;
  }

  function hopLoai(b) { return !b.loai || !LOAI_XEM || b.loai === LOAI_XEM; }

  function locBo(ds) {
    var tim = boDau(LOC.tim).trim();
    return ds.filter(function (b) {
      if (LOC.nhom && (b.nhom || "") !== LOC.nhom) return false;
      if (LOC.goi === "duoc" && b.khoa) return false;
      if (LOC.goi && LOC.goi !== "duoc" && b.goi_tu !== LOC.goi) return false;
      if (LOC.mau && hoCuaBo(b) !== LOC.mau) return false;
      if (tim && boDau(b.ten).indexOf(tim) < 0) return false;
      return true;
    });
  }

  /** Dải màu của một bộ: mỗi khe một sọc dọc, vẽ bằng <rect fill> (CSP: không `.style`). */
  function daiMau(m, cls) {
    var co = KHE_XEM.filter(function (k) { return m[k]; });
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("class", cls);
    s.setAttribute("viewBox", "0 0 " + Math.max(co.length, 1) + " 1");
    s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("aria-hidden", "true");
    co.forEach(function (k, i) {
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", String(i));
      r.setAttribute("y", "0");
      r.setAttribute("width", "1.02");     // phủ khe nửa điểm ảnh giữa hai sọc khi co giãn
      r.setAttribute("height", "1");
      r.setAttribute("fill", m[k]);
      s.appendChild(r);
    });
    return s;
  }

  function hinhKhoa() {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("class", "kho-o__khoa");
    s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M5 7V5a3 3 0 0 1 6 0v2h1.5v7.5h-9V7H5zm1.6 0h2.8V5a1.4 1.4 0 0 0-2.8 0v2z");
    s.appendChild(p);
    return s;
  }

  /** Một ô trong lưới: dải màu + tên + một dòng phụ (đặc biệt / gói cần / hạn). */
  function oBo(b) {
    var laGlitch = b.kieu === "glitch";
    var o = el("button", "kho-o" + (laGlitch ? " kho-o--dac-biet" : "") + (b.khoa ? " kho-o--khoa" : ""));
    o.type = "button";
    o.setAttribute("data-id", String(b.id));
    o.setAttribute("aria-pressed", CHON === b.id ? "true" : "false");
    // Bộ dành riêng (`rieng`, 2026-10-12): server chỉ gửi nó cho chính người được tặng.
    var phu = laGlitch ? "Đặc biệt" : (b.rieng ? "Dành riêng cho bạn"
      : (b.khoa ? (b.goi_ten || "Cần ủng hộ") : (b.den ? "Tới " + ngay(b.den) : "")));
    o.setAttribute("aria-label", b.ten + (laGlitch ? ", skin đặc biệt" : "")
      + (b.khoa ? ", dành cho gói " + (b.goi_ten || "cao hơn") : ""));
    o.appendChild(daiMau(mauBo(b), "kho-o__dai"));
    o.appendChild(el("span", "kho-o__ten", b.ten));
    if (phu || b.khoa) {
      var dong = el("span", "kho-o__phu");
      if (b.khoa) dong.appendChild(hinhKhoa());
      dong.appendChild(document.createTextNode(phu));
      o.appendChild(dong);
    }
    o.addEventListener("click", function () { chonBo(b); });
    return o;
  }

  function chonBo(b) {
    if (CHON === b.id) {
      CHON = null;
      if (S() && S().xemLai) S().xemLai();
    } else {
      CHON = b.id;
      if (S() && S().xemThu) S().xemThu(mauBo(b));
    }
    ghiKho("", false);
    var o = document.querySelectorAll("#skin-sukien-ds .kho-o");
    for (var i = 0; i < o.length; i++) {
      o[i].setAttribute("aria-pressed", o[i].getAttribute("data-id") === String(CHON) ? "true" : "false");
    }
    veChon();
  }

  /** Khung chi tiết của bộ đang xem thử: tên, màu, ghi chú, các nút. */
  function veMotBoKho(b) {
    var laGlitch = b.kieu === "glitch";
    var k = el("div", "kho-chon__bo" + (laGlitch ? " kho-chon__bo--dac-biet" : ""));
    var ten = el("div", "skin-bo-ten");
    ten.appendChild(el("h3", null, b.ten));
    if (laGlitch) ten.appendChild(el("span", "skin-dac-biet", "Skin đặc biệt"));
    else if (b.rieng) ten.appendChild(el("span", "skin-dac-biet", "Dành riêng cho bạn"));
    k.appendChild(ten);
    var mv = mauBo(b);
    var mau = el("div", "swatch mt-2");
    KHE_XEM.forEach(function (kh) {
      if (mv[kh]) mau.appendChild(oMau(mv[kh], (TEN_KHE[kh] || kh) + " " + mv[kh]));
    });
    k.appendChild(mau);
    // Skin đặc biệt: KHÔNG có dòng mô tả (chủ server 2026-10-12: "các skin đặc biệt: bỏ các mô tả
    // như này"). Ổ khoá trên ô + nhãn "Skin đặc biệt" + link ủng hộ đã nói đủ.
    if (!laGlitch) {
      var ghiChu = b.loai ? "Dành cho " + b.loai + "." : "Dùng cho mọi loài.";
      if (b.den) ghiChu += " Mở tới " + ngay(b.den) + ".";
      if (b.khoa) ghiChu += " Dành cho người ủng hộ gói " + b.goi_ten + " trở lên.";
      else if (b.goi_tu === "free" && b.den) ghiChu += " Ai cũng áp được trong dịp này.";
      k.appendChild(el("p", "dim nho mb-0 mt-2", ghiChu));
    }
    var hang = el("div", "nut-nho mt-2");
    if (!b.khoa) {
      var nAp = nut("Áp vào game", function () { apKho(b, nAp); });
      hang.appendChild(nAp);
    }
    // Bộ KHOÁ không có màu thật trên trình duyệt (chỉ `xem` đã làm tròn — `skin_kho.xem_khoa`), nên
    // không có gì để nạp: nạp màu xem trước là mời chép một bộ khoá (server vẫn chặn, nhưng đừng mời).
    if (!laGlitch && !b.khoa && b.mau) {
      hang.appendChild(nut("Nạp vào trình sửa", function () {
        if (!S()) return;
        S().nap(b.mau, b.loai ? b.bien_the : null);
        ghiKho("Đã nạp “" + b.ten + "” vào trình sửa. Chưa đổi gì trong game.", false);
      }));
    }
    // Lưu vào tủ theo quyền MÃ MÀU TỰ DO (server `kho_luu` chặn đúng theo cờ này). Bộ lưu từ kho
    // mang gói của bộ gốc: hết gói thì khoá trong tủ, không mất.
    if (!b.khoa && !laGlitch && Q && Q.tudo) {
      hang.appendChild(nut("Lưu vào tủ", function () {
        api("/api/player/skin/kho/" + b.id + "/luu", { method: "POST",
            body: JSON.stringify({ loai: b.loai || (S() ? S().loai() : "") }) })
          .then(function () { ghiKho("Đã lưu “" + b.ten + "” vào tủ.", false); return taiTu(); })
          .catch(function (e) { ghiKho("Không lưu được: " + e.message, true); });
      }));
    }
    if (b.khoa && Q && Q.hien) {
      var a = el("a", "nho", "Xem cách ủng hộ");
      a.href = "/donate";
      hang.appendChild(a);
    }
    hang.appendChild(nut("Bỏ chọn", function () { chonBo(b); }));
    k.appendChild(hang);
    return k;
  }

  function veChon() {
    var khung = $("skin-kho-chon");
    if (!khung) return;
    khung.textContent = "";
    var b = null;
    KHO.forEach(function (x) { if (x.id === CHON) b = x; });
    if (!b || !hopLoai(b)) {
      CHON = null;
      khung.hidden = true;            // chưa chọn bộ nào: không có gì để nói
      return;
    }
    khung.hidden = false;
    khung.appendChild(veMotBoKho(b));
  }

  function luaChon(sel, ds, giaTri) {
    sel.textContent = "";
    var co = false;
    ds.forEach(function (x) {
      var op = el("option", null, x[1]);
      op.value = x[0];
      if (x[0] === giaTri) { op.selected = true; co = true; }
      sel.appendChild(op);
    });
    return co ? giaTri : "";
  }

  /** Dựng lại các điều khiển lọc từ danh sách ĐANG hợp loài (đổi loài là đổi nhóm/gói/màu có mặt). */
  function veLoc(ds) {
    var nhieu = ds.length > 12;           // vài bộ của một dịp thì không cần bộ lọc
    var loc = $("skin-kho-loc");
    if (loc) loc.hidden = !nhieu;
    var nhom = [], daNhom = {};
    var goi = [], tenGoi = {}, coKhoa = false, coMo = false;
    var dem = {};
    ds.forEach(function (b) {
      var n = b.nhom || "";
      if (!daNhom[n]) { daNhom[n] = 1; nhom.push(n); }
      if (b.goi_tu && !tenGoi[b.goi_tu]) { tenGoi[b.goi_tu] = b.goi_ten || b.goi_tu; goi.push(b.goi_tu); }
      if (b.khoa) coKhoa = true; else coMo = true;
      var h = hoCuaBo(b);
      if (h) dem[h] = (dem[h] || 0) + 1;
    });
    var sNhom = $("skin-kho-nhom");
    if (sNhom) {
      sNhom.hidden = nhom.length < 2;
      LOC.nhom = luaChon(sNhom, [["", "Mọi nhóm"]].concat(nhom.map(function (n) {
        return [n, n || "Bộ khác"];
      })), LOC.nhom);
    }
    var sGoi = $("skin-kho-goi");
    if (sGoi) {
      goi.sort(function (a, c) { return hangGoi(a) - hangGoi(c); });
      var dsGoi = [["", "Mọi gói"]];
      if (coKhoa && coMo) dsGoi.push(["duoc", "Bạn dùng được"]);
      goi.forEach(function (g) { dsGoi.push([g, "Gói " + tenGoi[g]]); });
      sGoi.hidden = dsGoi.length < 3;
      LOC.goi = luaChon(sGoi, dsGoi, LOC.goi);
    }
    var mau = $("skin-kho-mau");
    if (mau) {
      mau.textContent = "";
      var ho = HO.filter(function (h) { return dem[h]; });
      mau.hidden = !nhieu || ho.length < 2;
      if (LOC.mau && !dem[LOC.mau]) LOC.mau = "";
      [""].concat(ho).forEach(function (h) {
        var c = el("button", h ? "kho-chip" : "kho-chip kho-chip--chu", h ? null : "Mọi màu");
        c.type = "button";
        if (h) {                           // ô màu: tên + số bộ ở nhãn đọc màn hình và tooltip
          c.setAttribute("aria-label", h + ", " + dem[h] + " bộ");
          c.title = h + " (" + dem[h] + ")";
          c.appendChild(oMau(MAU_HO[h], h));
        }
        c.setAttribute("aria-pressed", LOC.mau === h ? "true" : "false");
        c.addEventListener("click", function () {
          LOC.mau = h;
          SO_HIEN = TRANG;
          veKho();
        });
        mau.appendChild(c);
      });
    }
  }

  function veKho() {
    var khung = $("skin-sukien");
    var ds = $("skin-sukien-ds");
    if (!khung || !ds) return;
    var theoLoai = KHO.filter(hopLoai);
    khung.hidden = !theoLoai.length;
    var xem = $("skin-kho-xem");
    if (xem) xem.hidden = khung.hidden;
    var td = $("skin-sukien-td");
    if (td) td.textContent = KHO_CA ? "Kho bộ màu" : "Bộ màu sự kiện";
    veLoc(theoLoai);
    DS_HIEN = locBo(theoLoai);
    SO_LOAI = theoLoai.length;
    ds.textContent = "";
    var cuon = $("skin-kho-cuon");
    if (cuon) cuon.scrollTop = 0;             // lọc khác = danh sách khác: về đầu khung
    DS_HIEN.slice(0, SO_HIEN).forEach(function (b) { ds.appendChild(oBo(b)); });
    if (!DS_HIEN.length) {
      ds.appendChild(el("p", "dim nho mb-0 kho-luoi__trong",
        "Không có bộ nào khớp. Bỏ bớt bộ lọc để xem thêm."));
    }
    capNhatDem();
    veChon();
    canhLai();
  }

  /** Vẽ THÊM một lượt vào cuối lưới (không vẽ lại các ô đã có). */
  function themMotLuot() {
    var ds = $("skin-sukien-ds");
    if (!ds || SO_HIEN >= DS_HIEN.length) return;
    DS_HIEN.slice(SO_HIEN, SO_HIEN + TRANG).forEach(function (b) { ds.appendChild(oBo(b)); });
    SO_HIEN += TRANG;
    capNhatDem();
    canhLai();
  }

  /** Canh lại điểm cuối: IntersectionObserver chỉ báo khi trạng thái ĐỔI, nên vừa vẽ thêm mà điểm
   *  cuối vẫn trong tầm (khung cao, lưới ngắn) thì phải đăng ký lại để nó báo lần nữa. */
  function canhLai() {
    var cuoi = $("skin-kho-cuoi");
    if (!IO || !cuoi) return;
    IO.unobserve(cuoi);
    if (SO_HIEN < DS_HIEN.length) IO.observe(cuoi);
  }

  function capNhatDem() {
    var dem = $("skin-kho-dem");
    var n = Math.min(SO_HIEN, DS_HIEN.length);
    if (dem) {
      dem.textContent = DS_HIEN.length < SO_LOAI
        ? n + " / " + DS_HIEN.length + " bộ khớp, trong " + SO_LOAI + " bộ"
        : (n < DS_HIEN.length ? n + " / " : "") + DS_HIEN.length + " bộ";
    }
    var them = $("skin-kho-them"), hang = $("skin-kho-them-hang");
    var con = DS_HIEN.length - SO_HIEN;
    if (hang) hang.hidden = IO !== null || con <= 0;   // có cuộn-tự-nạp thì không cần nút
    if (them && con > 0) them.textContent = "Xem thêm " + Math.min(TRANG, con) + " bộ (còn " + con + ")";
  }

  /** Gắn điều khiển lọc MỘT lần (các phần tử này không bị vẽ lại). */
  function ganKho() {
    var hen = null;
    var tim = $("skin-kho-tim");
    if (tim) {
      tim.addEventListener("input", function () {
        clearTimeout(hen);
        hen = setTimeout(function () { LOC.tim = tim.value; SO_HIEN = TRANG; veKho(); }, 150);
      });
    }
    var sNhom = $("skin-kho-nhom");
    if (sNhom) {
      sNhom.addEventListener("change", function () { LOC.nhom = sNhom.value; SO_HIEN = TRANG; veKho(); });
    }
    var sGoi = $("skin-kho-goi");
    if (sGoi) {
      sGoi.addEventListener("change", function () { LOC.goi = sGoi.value; SO_HIEN = TRANG; veKho(); });
    }
    var them = $("skin-kho-them");
    if (them) them.addEventListener("click", themMotLuot);
    var cuoi = $("skin-kho-cuoi");
    if (cuoi && window.IntersectionObserver) {
      IO = new window.IntersectionObserver(function (ds) {
        for (var i = 0; i < ds.length; i++) if (ds[i].isIntersecting) { themMotLuot(); return; }
      }, { root: $("skin-kho-cuon"), rootMargin: "0px 0px 400px 0px" });   // nạp trước ~400px
    }
  }

  document.addEventListener("dino4vn:xem3d", function (ev) {
    var l = ev && ev.detail && ev.detail.species;
    if (typeof l === "string" && l && l !== LOAI_XEM) {
      LOAI_XEM = l;
      SO_HIEN = TRANG;
      veKho();
    }
  });

  /* ── Khởi động ─────────────────────────────────────────────────────────────
     Không có quà (công tắc tắt / chưa đăng nhập / dịch vụ cũ chưa có route) => IM LẶNG ẩn
     khung: trang /skin phải chạy y như trước. Một khung tủ chết nằm giữa trang là tệ hơn
     không có. */
  function batDau() {
    api("/api/player/skin/quyen").then(function (q) {
      Q = q;
      if (!q.mo) return;
      var the = $("skin-tu-the");
      if (the) the.hidden = false;
      ganChonKhe();
      ganKho();
      veTrangThai();
      var luu = $("skin-tu-luu");
      if (luu) luu.addEventListener("click", luuBo);
      var viec = [taiTu(), taiKho()];
      if (q.gioi_han_mau) viec.push(taiBang());
      return Promise.all(viec);
    }).catch(function () { /* chưa đăng nhập / route chưa có: giữ trang như cũ */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", batDau);
  } else {
    batDau();
  }
})();
