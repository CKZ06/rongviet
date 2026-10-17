/* skin-gradient.js — CHUYỂN MÀU (`!gradient`) trên trang /skin: công tắc, chọn bộ, trạng thái.
 *
 * Quà ủng hộ (người dùng chốt 2026-09-27): bật lên thì plugin đổi liên tục 5 khe màu thân của con
 * đang cưỡi theo một bộ có sẵn; tắt hoặc cất gara là về MÀU GỐC.
 *
 * Hợp đồng: `GET/PUT /api/player/skin/gradient` (player/app/sacmau_api.py). Thân trả về:
 *   {ok, mo, duoc, hien, nhac:{bac,ten,nguong}|null, bat, bo_id, trang_thai, trang_thai_chu,
 *    chu_ky_ms, lech, bo:[{id, slug, ten, diem:["#rrggbb",…]}]}
 *
 * 🔴 FILE NÀY KHÔNG GIỮ MỘT CON SỐ NÀO CỦA LUẬT. Ai được dùng, mốc nào, bộ nào, nhịp bao lâu,
 *    câu trạng thái — tất cả do server cấp. Hàng rào thật ở server (`_bat_tat`); ẩn/hiện ở đây
 *    chỉ để khỏi hứa trước điều chưa mở.
 *
 * 🔴 LUẬT HIỆN (CLAUDE.md §6.6, "không hứa trước"): khối chỉ hiện khi `mo && (duoc || hien)`.
 *    `mo && !duoc && hien` ⇒ chỉ câu mời ủng hộ, không công tắc. Chưa đăng nhập / route chưa có /
 *    lỗi ⇒ IM LẶNG giữ ẩn: trang /skin phải y như trước.
 *
 * 🔴 KHÔNG HỎI DỒN. Nhịp hỏi lại ~10 s CHỈ khi đang bật VÀ tab đang hiện (trạng thái trong game
 *    chỉ có nghĩa lúc đang bật); tắt / ẩn tab ⇒ dừng hẳn. GET dùng chung hạn mức "read" với mọi
 *    lượt đọc khác của người này — hỏi dồn là làm cạn hạn mức của cả trang.
 *
 * Bốn kỷ luật của repo (chép từ skin-tu.js, cả bốn đều đã trả giá):
 *  1. `textContent`/`createElement`, KHÔNG BAO GIỜ `innerHTML` — tên bộ do admin gõ.
 *  2. KHÔNG đụng `.style`. Dải màu là <svg> + <linearGradient>, màu đi bằng THUỘC TÍNH `stop-color`.
 *  3. Không <form> (CSP form-action 'none').
 *  4. ES5: không `let`/`const`/mũi tên/chuỗi mẫu.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var API = "/api/player/skin/gradient";
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var NHIP_MS = 10000;          // hỏi lại trạng thái khi đang bật
  var NHIP_CHAM_MS = 30000;     // sau 429 / lỗi mạng: lùi lại, đừng đập tiếp
  var W = 120;                  // bề ngang dải trong hệ toạ độ của viewBox

  var TT = null;                // thân GET/PUT gần nhất
  var CHON = null;              // id bộ đang chọn trên trang (lúc tắt: chưa gửi đi đâu)
  var KY_BO = "";               // chữ ký danh sách bộ đã vẽ — đổi mới vẽ lại
  var HEN = null;               // hẹn giờ hỏi lại
  var DANG_HOI = false;
  var DANG_GUI = false;
  var CHUYEN_DONG_IT = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function svg(tag) { return document.createElementNS(NS, tag); }

  /** Như `api()` của skin-tu.js, nhưng giữ mã HTTP: 401/403/429 dẫn tới ba cách xử lý khác nhau. */
  function api(o) {
    o = o || {};
    o.credentials = "same-origin";
    o.headers = o.headers || {};
    if (o.body) o.headers["Content-Type"] = "application/json";
    return fetch(API, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var d = j.detail;
          // FastAPI 422 trả `detail` là MẢNG — in thẳng ra là "[object Object]".
          if (d && typeof d !== "string") d = "";
          var e = new Error(j.ly_do || d || ("HTTP " + r.status));
          e.ma = r.status;
          e.j = j;
          throw e;
        }
        return j;
      });
    });
  }

  function tien(n) { return (Number(n) || 0).toLocaleString("vi-VN") + " ₫"; }

  function ghi(chu, loi) {
    var e = $("skin-gr-ghichu");
    if (!e) return;
    e.textContent = chu || "";
    e.className = loi ? "dim nho mb-0 mt-2 canhbao" : "dim nho mb-0" + (chu ? " mt-2" : "");
  }

  /* Bộ chưa đủ gói (`khoa`, kho skin 2026-10-10) vẫn hiện để người ta biết có, nhưng không chọn được. */
  function boMo() {
    return ((TT && TT.bo) || []).filter(function (b) { return !b.khoa; });
  }

  function coBo(id) {
    var bo = boMo();
    for (var i = 0; i < bo.length; i++) if (bo[i].id === id) return true;
    return false;
  }

  function nenChuyenDong() {
    return !(CHUYEN_DONG_IT && CHUYEN_DONG_IT.matches);
  }

  /* ── Dải màu của một bộ ─────────────────────────────────────────────────────────────
     Dải KHÉP VÒNG như plugin vẽ (`sacmau_logic.h::tren_duong`: điểm cuối nối về điểm đầu, các
     điểm cách đều): điểm i ở offset i/n, thêm điểm đầu ở offset 1. `spreadMethod="repeat"` nên
     trượt đúng một bề ngang là liền mạch — không cần vẽ đôi dải. */
  function daiMau(b) {
    var s = svg("svg");
    s.setAttribute("class", "gr-chip__dai");
    s.setAttribute("viewBox", "0 0 " + W + " 18");
    s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    var defs = svg("defs");
    var g = svg("linearGradient");
    var gid = "skin-gr-dai-" + b.id;
    g.setAttribute("id", gid);
    g.setAttribute("gradientUnits", "userSpaceOnUse");
    g.setAttribute("x1", "0");
    g.setAttribute("y1", "0");
    g.setAttribute("x2", String(W));
    g.setAttribute("y2", "0");
    g.setAttribute("spreadMethod", "repeat");
    var diem = (b.diem || []).filter(function (h) { return HEX.test(String(h)); });
    if (!diem.length) return null;
    var n = diem.length;
    diem.concat([diem[0]]).forEach(function (h, i) {
      var st = svg("stop");
      st.setAttribute("offset", String(i / n));
      st.setAttribute("stop-color", h);
      g.appendChild(st);
    });
    defs.appendChild(g);
    s.appendChild(defs);
    var r = svg("rect");
    r.setAttribute("x", "0");
    r.setAttribute("y", "0");
    r.setAttribute("width", String(W));
    r.setAttribute("height", "18");
    r.setAttribute("rx", "2");
    r.setAttribute("fill", "url(#" + gid + ")");
    s.appendChild(r);
    return s;
  }

  /** Trượt dải của bộ đang CHẠY THẬT trong game — một vòng đúng bằng `chu_ky_ms` của server, nên
   *  web và game đổi cùng nhịp. Chuyển động có lý do dữ liệu, không phải trang trí. */
  function datChuyenDong(nut, bat) {
    var g = nut.querySelector("linearGradient");
    if (!g) return;
    var cu = g.querySelector("animateTransform");
    if (!bat) {
      if (cu) g.removeChild(cu);
      return;
    }
    var giay = Math.max(4, Math.round((Number(TT && TT.chu_ky_ms) || 24000) / 1000));
    if (cu && cu.getAttribute("dur") === giay + "s") return;
    if (cu) g.removeChild(cu);
    var a = svg("animateTransform");
    a.setAttribute("attributeName", "gradientTransform");
    a.setAttribute("type", "translate");
    a.setAttribute("from", "0 0");
    a.setAttribute("to", "-" + W + " 0");     // âm: một điểm đứng yên đi TỚI trên dải, như trong game
    a.setAttribute("dur", giay + "s");
    a.setAttribute("repeatCount", "indefinite");
    g.appendChild(a);
    // Thêm vào lúc tài liệu đã chạy: `begin` mặc định tính từ đầu trang — khởi động tường minh.
    if (typeof a.beginElement === "function") {
      try { a.beginElement(); } catch (e) { /* trình duyệt không SMIL: đứng yên là đủ */ }
    }
  }

  function kyBo(bo) {
    return JSON.stringify((bo || []).map(function (b) { return [b.id, b.ten, b.diem, !!b.khoa]; }));
  }

  /** Vẽ lại danh sách bộ CHỈ khi nó đổi: vẽ lại mỗi 10 s là giật mất ô người ta đang focus và
   *  cho dải đang trượt nhảy về đầu. */
  function veBo(choPhep) {
    var khung = $("skin-gr-bo");
    if (!khung || !TT) return;
    var ky = kyBo(TT.bo) + (choPhep ? "|1" : "|0");
    if (ky !== KY_BO) {
      KY_BO = ky;
      khung.textContent = "";
      (TT.bo || []).forEach(function (b) {
        var dai = daiMau(b);
        if (!dai) return;
        var o;
        if (choPhep && !b.khoa) {
          o = el("button", "gr-chip");
          o.type = "button";
          o.setAttribute("data-bo", String(b.id));
          o.setAttribute("aria-pressed", "false");
          o.addEventListener("click", function () { chonBo(b.id); });
        } else {
          o = el("span", "gr-chip gr-chip--xem");
        }
        o.appendChild(dai);
        o.appendChild(el("span", "gr-chip__ten", b.ten));
        if (b.khoa && b.goi_ten) o.appendChild(el("span", "gr-chip__goi", "Gói " + b.goi_ten));
        khung.appendChild(o);
      });
    }
    var chay = !!(TT.bat && TT.duoc) && nenChuyenDong();
    var nut = khung.querySelectorAll("[data-bo]");
    for (var i = 0; i < nut.length; i++) {
      var id = Number(nut[i].getAttribute("data-bo"));
      var dung = id === CHON;
      nut[i].setAttribute("aria-pressed", dung ? "true" : "false");
      // `aria-disabled`, KHÔNG `disabled`: vô hiệu một nút đang có focus là đẩy focus về <body> —
      // người dùng bàn phím vừa bấm Space là lạc chỗ. `chonBo` tự bỏ qua lượt bấm lúc đang gửi.
      nut[i].setAttribute("aria-disabled", DANG_GUI ? "true" : "false");
      datChuyenDong(nut[i], dung && chay && TT.bo_id === id);
    }
  }

  function veCongTac() {
    var c = $("skin-gr-cong");
    if (!c || !TT) return;
    // Người đã hết quyền mà còn đang bật (chờ vòng đẩy tự tắt, ≤ 60 s) vẫn phải TẮT được.
    c.hidden = !(TT.duoc || TT.bat);
    c.setAttribute("aria-checked", TT.bat ? "true" : "false");
    // Không có bộ nào thì bật lên chỉ nhận 409 — nhưng đang bật thì vẫn phải TẮT được.
    var khongBo = !TT.bat && !boMo().length;
    c.setAttribute("aria-disabled", (DANG_GUI || khongBo) ? "true" : "false");
    var chu = $("skin-gr-cong-chu");
    if (chu) chu.textContent = TT.bat ? "Bật" : "Tắt";
  }

  function veKhoa() {
    var e = $("skin-gr-khoa");
    if (!e) return;
    e.textContent = "";
    e.hidden = !!TT.duoc;
    if (e.hidden) return;
    var n = TT.nhac;
    var cau = (n && n.ten)
      ? "Dành cho người ủng hộ từ mốc " + n.ten
        + (n.nguong ? " (" + tien(n.nguong) + ")" : "") + ". "
      : "Dành cho người ủng hộ server. ";
    e.appendChild(document.createTextNode(cau));
    var a = el("a", null, "Xem cách ủng hộ");
    a.href = "/donate";
    e.appendChild(a);
  }

  function veTrangThai() {
    var mo = $("skin-gr-mo");
    if (mo) mo.hidden = !(TT.duoc || TT.bat);    // còn bật mà hết quyền: vẫn cần chỗ báo lúc tắt
    var e = $("skin-gr-tt");
    if (!e) return;
    var chu;
    if (!TT.bat && !boMo().length) {
      chu = "Hiện chưa có bộ màu nào để chọn.";
    } else if (!TT.bat) {
      chu = "Đang tắt. Chọn một bộ rồi bật công tắc.";
    } else if (!coBo(TT.bo_id)) {
      chu = (TT.trang_thai_chu || "Bộ màu không còn") + ". Chọn một bộ khác ở trên.";
    } else if (TT.trang_thai_chu) {
      chu = "Trạng thái: " + TT.trang_thai_chu + ".";
    } else {
      // Vòng đẩy chưa báo lại (thường ≤ ~10 s sau khi bật). "Chưa biết" khác "không có gì" — và
      // KHÔNG hứa "vài giây": plugin không trả lời thì câu đó thành lời nói dối đứng mãi.
      chu = "Đã bật, đang chờ game báo lại trạng thái.";
    }
    // Chỉ ghi khi đổi: `aria-live` đọc lại MỖI lần ghi, kể cả ghi cùng chữ.
    if (e.textContent !== chu) e.textContent = chu;

    var goc = $("skin-gr-goc");
    if (goc) goc.hidden = !TT.bat;
  }

  function an() {
    var the = $("skin-gr-the");
    if (the) the.hidden = true;
    var goc = $("skin-gr-goc");
    if (goc) goc.hidden = true;
    huyHen();
  }

  function ve(j) {
    TT = j;
    if (!j || !j.mo || !(j.duoc || j.hien)) { an(); return; }
    if (j.bat) {
      // Đang bật: ô sáng là bộ ĐANG CHẠY THẬT (có thể vừa đổi bằng lệnh chat). Bộ đó đã bị gỡ thì
      // không sáng ô nào — sáng ô đầu tiên là nói dối "đang chạy bộ này".
      CHON = coBo(j.bo_id) ? j.bo_id : null;
    } else if (CHON === null || !coBo(CHON)) {
      CHON = coBo(j.bo_id) ? j.bo_id : (boMo().length ? boMo()[0].id : null);
    }
    var the = $("skin-gr-the");
    if (the) the.hidden = false;
    veCongTac();
    veBo(!!(j.duoc || j.bat));
    veKhoa();
    veTrangThai();
    henLai(NHIP_MS);
  }

  /* ── Hỏi lại ─────────────────────────────────────────────────────────────────────── */
  function huyHen() {
    if (HEN !== null) { clearTimeout(HEN); HEN = null; }
  }

  function henLai(ms) {
    huyHen();
    if (!(TT && TT.bat) || document.visibilityState === "hidden") return;
    HEN = setTimeout(hoiLai, ms);
  }

  function hoiLai() {
    HEN = null;
    if (DANG_HOI || DANG_GUI) { henLai(NHIP_MS); return; }
    DANG_HOI = true;
    api().then(function (j) {
      DANG_HOI = false;
      ve(j);
    }).catch(function (e) {
      DANG_HOI = false;
      if (e.ma === 401) { an(); return; }          // phiên hết: khối về trạng thái chưa đăng nhập
      henLai(NHIP_CHAM_MS);                        // 429 / mạng / 5xx: lùi, giữ nguyên thứ đang hiện
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { huyHen(); return; }
    if (TT && TT.bat) hoiLai();                    // quay lại tab: đúng lúc người ta nhìn vào nó
  });

  if (CHUYEN_DONG_IT) {
    var doiChuyenDong = function () { if (TT) veBo(!!(TT.duoc || TT.bat)); };
    if (typeof CHUYEN_DONG_IT.addEventListener === "function") {
      CHUYEN_DONG_IT.addEventListener("change", doiChuyenDong);
    } else if (typeof CHUYEN_DONG_IT.addListener === "function") {
      CHUYEN_DONG_IT.addListener(doiChuyenDong);
    }
  }

  /* ── Ghi ─────────────────────────────────────────────────────────────────────────── */
  function gui(than, dangLam, xong) {
    if (DANG_GUI) return;
    DANG_GUI = true;
    huyHen();
    ghi(dangLam, false);
    veCongTac();
    veBo(!!(TT.duoc || TT.bat));
    api({ method: "PUT", body: JSON.stringify(than) }).then(function (j) {
      DANG_GUI = false;
      ve(j);
      ghi(xong, false);
    }).catch(function (e) {
      DANG_GUI = false;
      var j = e.j || {};
      if (e.ma === 401) {
        an();
        return;
      }
      if (e.ma === 403 && j.err === "chua_mo") {   // chủ server vừa đóng tính năng
        an();
        return;
      }
      if (e.ma === 403 && j.err === "chua_du_bac") {
        // Server vừa nói người này chưa đủ bậc — vẽ lại đúng trạng thái đó (câu mời nếu `hien`).
        ve({ ok: true, mo: true, duoc: false, hien: TT.hien, nhac: j.nhac || TT.nhac,
             bat: TT.bat, bo_id: TT.bo_id, trang_thai: TT.trang_thai,
             trang_thai_chu: TT.trang_thai_chu, chu_ky_ms: TT.chu_ky_ms, lech: TT.lech,
             bo: TT.bo });
        // Không in thêm `ly_do`: câu mời ủng hộ vừa vẽ đã nói đúng điều đó (và nếu chủ server
        // không cho hiện thì cả khối đã ẩn — in lỗi vào một khối ẩn là nói với không ai).
        return;
      }
      veCongTac();
      veBo(!!(TT.duoc || TT.bat));
      henLai(NHIP_MS);
      ghi(e.ma === 429 ? "Bạn bấm hơi nhanh, chờ một chút rồi thử lại."
        : (e.ma ? "Không đổi được: " + e.message
          : "Không kết nối được máy chủ, thử lại sau giây lát."), true);
    });
  }

  function tenBo(id) {
    var bo = (TT && TT.bo) || [];
    for (var i = 0; i < bo.length; i++) if (bo[i].id === id) return bo[i].ten;
    return "";
  }

  function chonBo(id) {
    if (!TT || DANG_GUI || !(TT.duoc || TT.bat)) return;
    if (id === CHON && (!TT.bat || TT.bo_id === id)) return;
    CHON = id;
    if (!TT.bat) {
      // Đang tắt: chỉ chọn trên trang, bật công tắc mới gửi đi. Bấm một ô màu mà con dino đổi màu
      // ngay là bất ngờ người ta không xin.
      veBo(true);
      ghi("Đã chọn “" + tenBo(id) + "”. Bật công tắc để dùng.", false);
      return;
    }
    gui({ bat: true, bo_id: id }, "Đang đổi sang “" + tenBo(id) + "”…",
        "Đã đổi sang “" + tenBo(id) + "”.");
  }

  function batTat() {
    var c = $("skin-gr-cong");
    if (!TT || DANG_GUI || (c && c.getAttribute("aria-disabled") === "true")) return;
    if (TT.bat) {
      gui({ bat: false }, "Đang tắt…", "Đã tắt. Con dino sẽ về lại màu gốc.");
    } else {
      var than = { bat: true };
      if (CHON !== null && coBo(CHON)) than.bo_id = CHON;
      var ten = tenBo(than.bo_id);
      gui(than, "Đang bật…", ten ? "Đã bật “" + ten + "”." : "Đã bật.");
    }
  }

  /* ── Khởi động ────────────────────────────────────────────────────────────────────
     Cùng khuôn skin-tu.js: không có tính năng (công tắc chủ tắt / chưa đăng nhập / dịch vụ cũ
     chưa có route) ⇒ IM LẶNG giữ ẩn. Một khối chết nằm giữa trang là tệ hơn không có. */
  function batDau() {
    var c = $("skin-gr-cong");
    if (c) c.addEventListener("click", batTat);
    api().then(ve).catch(function () { /* giữ ẩn */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", batDau);
  } else {
    batDau();
  }
})();
