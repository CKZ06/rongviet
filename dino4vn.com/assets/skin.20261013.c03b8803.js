/* ============================================================================
   Dino4VN — trình sửa ngoại trang (/skin).

   RÀNG BUỘC, KHÔNG PHẢI SỞ THÍCH:
   ·  CSP `style-src 'self'`  -> KHÔNG inline style. Quy ước repo còn chặt hơn:
      KHÔNG đụng `.style` gì cả. Ô màu ở đây là chính `<input type="color">` —
      nó tự vẽ lấy màu, nên không cần một dòng CSS động nào.
   ·  CSP `script-src 'self'` -> không inline script, không onclick=.
   ·  CSP `form-action 'none'`-> KHÔNG thẻ <form>. Ô nhập đứng ngoài form hợp lệ.
   ·  KHÔNG BAO GIỜ `innerHTML` — chỉ `textContent`.
   ·  ES5 thuần (var, function). File này KHÔNG bao giờ nạp three.js: bộ xem 3D
      là module riêng, tiêm sau khi biết người dùng đã đăng nhập.

   🔴 MƯỜI KHE MÀU KHÔNG ĐƯỢC KHAI Ở ĐÂY.
      Repo đã có ba bản danh sách đó (`gara.js`, `player/app/main.py:_KHE_MAU`,
      `plugin/src/skin.h`). Bản thứ tư sẽ là bản trôi lệch đầu tiên vì nó xa
      engine nhất. Danh sách sống ở `skin.njk` dưới dạng `data-khe`, file này
      chỉ đọc lại bằng `querySelectorAll`.
   ========================================================================= */
(function () {
  "use strict";

  var HEX = /^#?[0-9a-fA-F]{6}$/;          // cùng luật với `_HEX` ở player/app/main.py
  var XAM = "#808080";
  var CHEP_V = "d4v1";                     // phiên bản định dạng chép/dán

  /* ── DẢI THẬT của ba chỉ số biến thể ──────────────────────────────────────
     🔴 KHÔNG phải 0..63. Con số 63 cũ trong file này là một mắt xích của một vòng
     nhân quả đã làm hỏng dữ liệu thật:

        plugin đọc `SkinVariation` (usmap: **Float**) bằng `int32_t`
          -> trả về bit-pattern (float 8.0 đọc nhầm ra 1090519040)
          -> ô nhập `max=63` kẹp con số đó xuống 63
          -> trang này gửi 63 đi VÔ ĐIỀU KIỆN mỗi lần bấm "Áp"
          -> plugin ghi SỐ NGUYÊN 63 vào ô float -> 8.83e-44, xấp xỉ 0.

     Đo 2026-09-05 trên 598 blob gara: 403 con đã hỏng theo đúng đường đó. Không
     một bước nào trong chuỗi trên báo lỗi — mỗi bước đều "kẹp cho an toàn".

     `variation` là một TẬP RỜI RẠC (195 blob còn lành chỉ có bốn giá trị này),
     không phải một khoảng. `pattern`/`theme` thì tuỳ LOÀI: 3..6 hoạ tiết, 2..3 chủ
     đề — bảng thật ở `panel/web/skin-bien-the.json`, nhưng bảng đó CHƯA có đường
     nào ra tới trình duyệt, nên ở đây chỉ chặn được theo TRẦN CHUNG của loài rộng
     nhất.

     ⚠️ Trần chung ở đây KHÔNG phải hàng rào cuối cùng, và đừng đọc nó như vậy: hàng
     rào thật là `player/app/main.py::_kep_bien_the`, và nó CHẶT HƠN — nó tra đúng
     loài đang cưỡi rồi trả 400 kèm câu giải thích (`api()` in câu đó ra). Nên phần
     nằm giữa hai trần (ví dụ Kentrosaurus chỉ có 3 hoạ tiết mà ô ở đây cho gõ tới 5)
     là vùng mà web nhận nhưng server từ chối. Đó là lý do `skin.njk` phải NÓI RA
     rằng hàng rào này lỏng: một hàng rào lỏng mà im lặng thì trông như một lời bảo
     đảm, và người bị 400 sẽ tưởng lệnh bị nuốt. */
  var VARIATION_HL = [0, 2, 8, 16];
  var PATTERN_MAX = 5;                     // loài nhiều nhất có 6 hoạ tiết -> 0..5 (lùi khi chưa biết loài)
  var THEME_MAX = 2;                       // loài nhiều nhất có 3 chủ đề   -> 0..2

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function hienKhoi(id) {
    ["skin-dangtai", "skin-chuadangnhap", "skin-noidung"].forEach(function (k) {
      var n = $(k);
      if (n) n.hidden = (k !== id);
    });
  }

  function api(duong, o) {
    o = o || {};
    o.credentials = "same-origin";
    o.headers = o.headers || {};
    if (o.body) o.headers["Content-Type"] = "application/json";
    return fetch(duong, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        // `ly_do` trước `err`: từ 2026-09-14 chốt bảng màu free trả 403 `{err: "ngoai_bang",
        // ly_do: "<câu tiếng Việt>"}`. In `err` là in một mã máy cho người chơi đọc.
        if (!r.ok) throw new Error(j.ly_do || j.detail || j.err || ("HTTP " + r.status));
        return j;
      });
    });
  }

  function thongBao(chu, loi) {
    var e = $("skin-ghichu");
    if (!e) return;
    e.textContent = chu;
    e.className = loi ? "dim nho canhbao" : "dim nho";
  }

  function chuanHoa(v) {
    if (!HEX.test(String(v || ""))) return null;
    var h = String(v).replace(/^#/, "").toLowerCase();
    return "#" + h;
  }

  /* ── Bảng khe: đọc TỪ DOM, không khai lại ────────────────────────────────
     Trả mảng {ma, ten, o, hex, khoa, datlai, hang} theo đúng thứ tự trong
     `skin.njk`.                                                             */
  var KHE = [];
  function docKhe() {
    KHE = [];
    var ds = document.querySelectorAll("#skin-mau [data-khe]");
    for (var i = 0; i < ds.length; i++) {
      var h = ds[i];
      KHE.push({
        ma: h.getAttribute("data-khe"),
        ten: (h.querySelector(".khe__ten") || {}).textContent || "",
        hang: h,
        o: h.querySelector('[data-vai="o"]'),
        hex: h.querySelector('[data-vai="hex"]'),
        khoa: h.querySelector('[data-vai="khoa"]'),
        datlai: h.querySelector('[data-vai="datlai"]'),
      });
    }
    return KHE;
  }

  function bangMau() {
    var m = {};
    KHE.forEach(function (k) { m[k.ma] = k.o.value; });
    return m;
  }

  /** Đặt màu cho một khe. `tu` = "o" hoặc "hex" cho biết bên nào vừa đổi, để
   *  KHÔNG ghi ngược lại chính nó — ghi ngược lúc người dùng đang gõ dở sẽ nuốt
   *  phím (input color luôn chuẩn hoá về 7 ký tự chữ thường). */
  function datKhe(k, hex, tu) {
    var h = chuanHoa(hex);
    if (!h) { if (tu === "hex") k.hex.setAttribute("aria-invalid", "true"); return false; }
    k.hex.removeAttribute("aria-invalid");
    if (tu !== "o") k.o.value = h;
    if (tu !== "hex") k.hex.value = h;
    return true;
  }

  function datBang(mau, tu) {
    KHE.forEach(function (k) {
      if (mau[k.ma]) datKhe(k, mau[k.ma], tu);
    });
  }

  /* ── Nói chuyện với bộ xem 3D: chỉ qua sự kiện DOM ────────────────────── */
  function goi3D(chiTiet) {
    document.dispatchEvent(new CustomEvent("dino4vn:3d", { detail: chiTiet }));
  }
  function xem3D(chiTiet) {
    document.dispatchEvent(new CustomEvent("dino4vn:xem3d", { detail: chiTiet }));
  }

  /** Bảng màu gửi cho bộ xem: bỏ `maleDisplay` khi đang xem giới Cái.
   *  Chỉ ảnh hưởng BẢN XEM THỬ — lệnh ghi vào game vẫn gửi đủ 10 khe. */
  function mauChoXem() {
    var m = bangMau();
    if (gioi === "cai") delete m.maleDisplay;
    return m;
  }

  var daTiem = false;
  function tiem3D() {
    if (daTiem) return;
    daTiem = true;
    var s = document.createElement("script");
    s.type = "module";
    s.src = "/assets/dino3d.20261012.abc66f91.js";
    s.onerror = function () {
      var k = document.querySelector(".v3d");
      if (k) k.setAttribute("data-state", "error");
      var m = document.querySelector(".v3d__msg");
      if (m) m.textContent = "Không tải được bộ xem 3D.";
    };
    document.head.appendChild(s);
  }

  /* ── Trạng thái trang ────────────────────────────────────────────────── */
  var goc = {};              // đường cơ sở: màu lúc mở trang, để nút "Đặt lại" quay về
  var gioi = "duc";
  var loai = "";

  /* 🔴 Đường cơ sở đến TỪ ĐÂU. Thêm 2026-09-08.
     `duongCoSo()` có hai đường lùi im lặng (mượn con trong gara -> mười ô xám bịa), và
     `cs.nguon` trước đây là biến cục bộ trong `.then` nên `apVaoGame()` KHÔNG có cách nào
     biết nó đang so với con thật hay con của người khác. Đo production 2 ngày:
     **370/2.359 = 15,7% lượt mở trang chạy trên đường cơ sở KHÔNG PHẢI con đang cưỡi.**
     Một luật "chỉ gửi khe khác đường cơ sở" mà không biết đường cơ sở từ đâu ra thì đúng
     84,3% thời gian và sai IM LẶNG phần còn lại. */
  var nguonCoSo = "";        // "dang cuoi" | "gara o N" | "mac dinh" | "" (chưa nạp)
  var lechLoai = "";         // loài THẬT của con đang cưỡi, khi nó khác loài đang xem thử

  /* Manifest mô hình, GIỮ LẠI thay vì vứt đi sau `napLoai()`. Nó mang `khe_tuoi` —
     %diện tích thật của từng khe theo (loài × bậc tuổi) — tức câu trả lời cho
     "khe này có tô được gì trên con của tôi không". Trước 2026-09-08 câu đó được lấy từ
     sự kiện `dino4vn:3d-xong`, nên máy KHÔNG CÓ WebGL — đúng máy cần cảnh báo nhất vì họ
     không xem thử được — thì lời cảnh báo biến mất sạch. */
  var manifest = null;

  /* Đường cơ sở của BA CHỈ SỐ, tách khỏi `goc` (màu) vì nó có thêm một trạng thái
     mà màu không có: `null` = KHÔNG ĐỌC ĐƯỢC. Ba trạng thái chứ không phải hai —
     "đọc được và bằng 0" khác hẳn "không biết là bao nhiêu", và gộp chúng lại
     chính là cách ta ghi số 0 lên con của người khác mà vẫn báo "xong". */
  var gocBien = { variation: null, pattern: null, theme: null };

  function lon() {
    var v = parseInt(($("skin-lon") || {}).value, 10);
    return (isNaN(v) ? 100 : v) / 100;
  }

  /** Một số có nằm trong dải hợp lệ không. `null` = không. Cố ý KHÔNG kẹp: kẹp là
   *  cách biến một giá trị vô nghĩa thành một giá trị trông hợp lệ rồi ghi nó đi. */
  function hopLeSo(v, tran) {
    if (typeof v !== "number" || !isFinite(v)) return null;
    if (v !== Math.floor(v) || v < 0 || v > tran) return null;
    return v;
  }

  function hopLeBien(v) {
    return VARIATION_HL.indexOf(v) >= 0 ? v : null;
  }

  /** Đọc một ô số. `null` = ô trống, gõ bậy, hoặc ngoài dải — và `null` phải đi
   *  được tới tận chỗ gửi. Hàm `so()` cũ trả `0` cho ô trống, tức là không phân
   *  biệt nổi "người dùng muốn số 0" với "chẳng có gì ở đây cả". */
  function docO(id, tran) {
    var e = $(id);
    if (!e) return null;
    var s = String(e.value === undefined || e.value === null ? "" : e.value).trim();
    if (s === "") return null;
    return hopLeSo(parseInt(s, 10), tran);
  }

  function docBien() {
    var e = $("skin-variation");
    if (!e) return null;
    // Ô "Giữ nguyên" mang value="" -> parseInt ra NaN -> không nằm trong danh sách.
    return hopLeBien(parseInt(String(e.value), 10));
  }

  /** Ba chỉ số ĐANG hiện trên giao diện. Trường nào `null` là "không có gì". */
  function baSo() {
    return {
      variation: docBien(),
      pattern: docO("skin-pattern", tranHoaTiet()),
      theme: docO("skin-theme", THEME_MAX),
    };
  }

  /* Trần hoạ tiết CỦA LOÀI (2026-10-12): `data-so-hoa-tiet` trên ô Hoạ tiết do Eleventy sinh từ
     `player/app/skin_bien_the.json` — cùng bảng server kẹp (`_kep_bien_the`: 0..so_pattern-1).
     Loài lạ / thiếu bảng thì lùi về trần chung `PATTERN_MAX`: lỏng, server vẫn chặn đúng. */
  var SO_HOA_TIET = null;
  function tranHoaTiet(l) {
    if (SO_HOA_TIET === null) {
      SO_HOA_TIET = {};
      var e = $("skin-pattern");
      try { SO_HOA_TIET = JSON.parse((e && e.getAttribute("data-so-hoa-tiet")) || "{}") || {}; }
      catch (x) { SO_HOA_TIET = {}; }
    }
    var n = Number(SO_HOA_TIET[l === undefined ? loai : l]);
    return (isFinite(n) && n > 0 && n === Math.floor(n)) ? n - 1 : PATTERN_MAX;
  }
  function veDaiHoaTiet() {
    var t = tranHoaTiet(), e = $("skin-pattern"), nh = $("skin-pattern-dai");
    if (e) e.setAttribute("max", String(t));
    if (nh) nh.textContent = "(0–" + t + ")";
  }

  /* Cảnh nền của khung 3D (2026-10-12). Danh sách từ `manifest.canh` (`tools/extract/gen_canh.py`);
     lựa chọn nhớ trong trình duyệt của người xem (chỉ là tiện ích).
     Mặc định "Rừng mưa" (chủ server 2026-10-12: "Để mặc định nền là: Rừng mưa"). Người ĐÃ TỰ CHỌN
     "Nền tối" thì giữ: `getItem` trả "" (đã chọn nền tối) khác `null` (chưa chọn bao giờ). Cảnh mặc định
     mà không còn trong manifest (đổi tên/bỏ) ⇒ về nền tối, không chọn bừa cảnh khác. */
  var KHOA_CANH = "dino4vn.skin.canh";
  var CANH_MAC_DINH = "rainforest_trail";
  function ganCanh() {
    var o = $("skin-canh");
    var ds = (manifest && manifest.canh) || [];
    if (!o || !ds.length) return;
    var luu = null;
    try { luu = localStorage.getItem(KHOA_CANH); } catch (e) { luu = null; }
    var co = function (id) { return ds.some(function (c) { return c.id === id; }); };
    if (luu === null || (luu !== "" && !co(luu))) luu = co(CANH_MAC_DINH) ? CANH_MAC_DINH : "";
    o.textContent = "";
    [{ id: "", ten: "Nền tối" }].concat(ds).forEach(function (c) {
      var op = document.createElement("option");
      op.value = c.id; op.textContent = c.ten;
      if (c.id === luu) op.selected = true;
      o.appendChild(op);
    });
    o.hidden = false;
    o.addEventListener("change", function () {
      try { localStorage.setItem(KHOA_CANH, o.value); } catch (e) { /* không nhớ được, vẫn chạy */ }
      goi3D({ canh: o.value });
    });
  }
  function canhDangChon() {
    var o = $("skin-canh");
    return (o && !o.hidden) ? o.value : "";
  }

  function datSo(ten, v) {
    var e = $("skin-" + ten);
    if (e) e.value = (v === null || v === undefined) ? "" : String(v);
  }

  /* ── Nạp danh sách loài ──────────────────────────────────────────────────
     Giao của `config.species` (loài server ĐANG BẬT) và `dino-models.json.loai`
     (loài CÓ mô hình). Liệt kê một loài không bật là mời người ta thiết kế cho
     một con họ không vào game được.

     `status.json` chết hoặc quá cũ -> lùi về đủ danh sách mô hình. Thà thừa còn
     hơn ra một dropdown RỖNG mà không nói vì sao.                            */
  function napLoai(mac_dinh) {
    var chon = $("skin-loai");
    if (!chon) return Promise.resolve();
    return fetch("/dino-models.json", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (man) {
        // Giữ lại: `khe_tuoi` trong đây là nguồn DUY NHẤT cho câu "khe nào có tác dụng".
        // Vứt nó đi rồi đi hỏi bộ xem 3D là cách cũ, và cách cũ im lặng khi không có WebGL.
        manifest = man || null;
        var coMoHinh = Object.keys((man && man.loai) || {});
        return fetch("/api/status.json", { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; })
          .then(function (tt) {
            var bat = tt && tt.config && tt.config.species;
            // 🔴 `config.species` là `AllowedClasses` trong Game.ini — và `tranloai` GỠ loài khỏi đó
            //    lúc loài chạm trần (khoá ở màn chọn). Lọc chỉ theo nó thì đúng lúc Rex đông nhất,
            //    người đang cưỡi Rex mở /skin không thấy Rex. Loài bị khoá LUÔN còn người chơi
            //    (khoá = đã đủ trần), nên gộp thêm loài đang có người (`speciesLive`) và loài của
            //    chính người xem. Trang chủ cũ chết đúng kiểu này trước PR #7 (2026-09-15).
            var song = (tt && tt.speciesLive && typeof tt.speciesLive === "object") ? tt.speciesLive : {};
            var dsBat = (bat && bat.length) ? bat.slice() : null;
            if (dsBat) {
              Object.keys(song).forEach(function (s) {
                if (Number(song[s]) > 0 && dsBat.indexOf(s) < 0) dsBat.push(s);
              });
              if (mac_dinh && dsBat.indexOf(mac_dinh) < 0) dsBat.push(mac_dinh);
            }
            var ds = dsBat
              ? dsBat.filter(function (s) { return coMoHinh.indexOf(s) >= 0; })
              : coMoHinh;
            ds.sort();
            chon.textContent = "";
            ds.forEach(function (s) {
              var o = document.createElement("option");
              o.value = s; o.textContent = s;
              chon.appendChild(o);
            });
            if (mac_dinh && ds.indexOf(mac_dinh) >= 0) chon.value = mac_dinh;
            loai = chon.value || ds[0] || "";
          });
      });
  }

  /* ── Khe nào THẬT SỰ tô được gì trên con này ─────────────────────────────
     🔴 VIẾT LẠI 2026-09-08. Bản cũ trả lời SAI CÂU HỎI, và câu trả lời của nó nói
     ngược sự thật.

     Nó đọc `kheVeDuoc` từ sự kiện `dino4vn:3d-xong`, tức nó trả lời *"bản xem thử
     có VẼ được khe này không"*. Rồi nó trấn an: **"Vẫn nhập và vẫn áp vào game
     được."** Với khe `Điểm nhấn` (detail1) câu đó là SAI SỰ THẬT — đo trên
     `DT_SkinDataList` + overlay: khe đó có **0,0% diện tích trên 21/22 loài**, áp
     vào game cũng không đổi một pixel.

     Câu hỏi người chơi thật sự hỏi là *"tô ô này thì trong game có gì đổi không"*,
     và câu đó là DỮ LIỆU (`khe_tuoi` trong manifest), không phải kết quả của một
     lần render. Đọc thẳng dữ liệu còn sửa luôn một lỗ im lặng: máy không có WebGL
     — đúng máy cần lời cảnh báo nhất vì họ không xem thử được — thì sự kiện 3D
     không bao giờ bắn, `kheVeDuoc` ở nguyên `null`, và cả câu cảnh báo biến mất.

     BA sự thật khác nhau, ba câu khác nhau. Gộp chúng lại chính là cách câu cũ trở
     thành một lời bảo đảm sai:
       (1) loài này KHÔNG CÓ vùng đó  -> tô vào game không đổi gì
       (2) răng/miệng/vuốt            -> game có, nhưng bản xem thử không vẽ được
       (3) mắt                        -> chưa đo được nó có ăn không                */
  var KHE_TMC = ["teeth", "mouth", "claws"];

  /** Bậc tuổi mà bản xem thử đang dùng, theo `nguong_tuoi` trong manifest.
   *  ⚠️ Ngưỡng này là của BẢN XEM THỬ (xấp xỉ, `gan_overlay.py` tự khai). Ngưỡng thật
   *  của engine chưa ai đo. Nhưng kết luận không phụ thuộc nó: `maleDisplay` = 0,0% ở
   *  CẢ hatchling LẪN juvenile trên 21/22 loài. */
  function bacTuoi() {
    var ng = (manifest && manifest.nguong_tuoi) || { hatchling: 0.35, juvenile: 0.75 };
    var g = lon();
    if (g < ng.hatchling) return "hatchling";
    if (g < ng.juvenile) return "juvenile";
    return "adult";
  }

  /** `{khe: {...}, nen: %}` của loài + bậc tuổi đang xem, hoặc `null` nếu chưa biết.
   *  🔴 `null` ≠ "tất cả bằng 0". Không đọc được manifest thì KHÔNG được làm mờ ô nào
   *  và KHÔNG được doạ người dùng — im lặng còn hơn nói sai.
   *
   *  🔴 HAI KHÔNG GIAN TÊN, PHẢI DỊCH QUA `man.loai`:
   *      `manifest.loai`   khoá là TÊN HIỂN THỊ  — "Allosaurus"  (giá trị = slug)
   *      `manifest.mohinh` khoá là SLUG          — "allosaurus"
   *  Biến `loai` lấy từ `Object.keys(man.loai)` nên nó là TÊN HIỂN THỊ. Tra thẳng
   *  `manifest.mohinh[loai]` cho `undefined` ở MỌI loài — và vì hàm này fail-safe
   *  (không đọc được thì im lặng), cả hệ cảnh báo sẽ **chết câm mà mọi test vẫn xanh**.
   *  Đã dẫm đúng chuyện đó ngày 2026-09-08; `dino3d.js` làm đúng phép dịch này từ trước.
   */
  function vungKhe() {
    var slug = (manifest && manifest.loai && manifest.loai[loai]) || "";
    var mh = slug && manifest.mohinh && manifest.mohinh[slug];
    var kt = mh && mh.khe_tuoi;
    var e = kt && kt[bacTuoi()];
    return (e && e.khe) ? e : null;
  }

  /* Ghi chú khe nằm ở CHÚ THÍCH (`title`) trên tên khe, không còn là một đoạn chữ dưới bảng màu
     (chủ server 2026-10-12: "Bỏ các dòng mô tả"). Khe không có vùng vẫn mờ đi + dấu " ·" (CSS
     `.khe--tat`) — thứ người chơi THẤY không cần rê chuột. */
  var CHU_KHE = {
    khongVung: "Loài này không có vùng này: tô vào không thấy gì trong game.",
    khongXem: "Bản xem thử không vẽ, trong game vẫn ăn.",
    chuaDo: "Chưa đo được có ăn trong game không."
  };

  function veGhiChuKhe() {
    var vung = vungKhe();
    var pct = vung && vung.khe;
    KHE.forEach(function (k) {
      var chet = false;
      var chu = "";
      if (k.ma === "eyes") {
        chu = CHU_KHE.chuaDo;
      } else if (KHE_TMC.indexOf(k.ma) >= 0) {
        // Trong game chúng dùng param riêng (`TeethColor`/`MouthColor`/`ClawColor`),
        // không nằm trong overlay vùng — nên bản xem thử không vẽ được, NHƯNG game có.
        chu = CHU_KHE.khongXem;
      } else if (pct && !pct[k.ma]) {
        chu = CHU_KHE.khongVung;
        chet = true;
      }
      // Chỉ làm mờ khe THẬT SỰ không có vùng. Làm mờ cả răng/miệng/vuốt sẽ nói với
      // người chơi rằng chúng vô dụng — trong khi chúng chạy, chỉ là không xem trước được.
      k.hang.classList.toggle("khe--tat", chet);
      var ten = k.hang.querySelector(".khe__ten");
      if (ten) {
        if (chu) ten.title = chu;
        else ten.removeAttribute("title");
      }
    });
  }

  // 🔴 KHÔNG còn lắng nghe `dino4vn:3d-xong` để dựng ghi chú. Sự kiện đó trả lời
  //    "bản xem thử VẼ được gì", không phải "trong game có gì đổi" — và nó không bao
  //    giờ bắn trên máy thiếu WebGL, đúng máy cần lời cảnh báo nhất. Nay `veGhiChuKhe()`
  //    đọc thẳng `khe_tuoi` trong manifest, nên nó đúng kể cả khi bộ xem 3D chết hẳn.

  /* ── Gắn sự kiện ────────────────────────────────────────────────────────── */
  /* 🔴 `k.dung` — "người dùng THẬT SỰ chạm ô này". Thêm 2026-09-08.
     `<input type="color">` không có trạng thái rỗng, nên không có cách nào phân biệt
     "màu đang hiển thị vì tôi chọn nó" với "màu đang hiển thị vì đó là thứ trang tự
     điền". Bản 09-05 thay nó bằng phép so với đường cơ sở, và tự nhận đánh đổi: ai
     muốn đặt đúng màu xám `#808080` trong khi đường cơ sở cũng là `#808080` thì thao
     tác bị nuốt im lặng. Một cờ boolean rẻ hơn hẳn đánh đổi đó — và nó là thứ DUY NHẤT
     phân biệt được "giữ nguyên" với "tôi chọn xám". */
  function chamKhe(k) { k.dung = true; }

  function ganBangMau() {
    KHE.forEach(function (k) {
      k.o.addEventListener("input", function () {
        chamKhe(k);
        datKhe(k, k.o.value, "o");
        goi3D({ mau: mauChoXem() });
      });
      k.hex.addEventListener("input", function () {
        // Chỉ đẩy sang ô màu khi chuỗi ĐÃ hợp lệ — người dùng gõ "#ff" thì để yên.
        if (datKhe(k, k.hex.value, "hex")) { chamKhe(k); goi3D({ mau: mauChoXem() }); }
      });
      k.khoa.addEventListener("click", function () {
        var dang = k.khoa.getAttribute("aria-pressed") === "true";
        k.khoa.setAttribute("aria-pressed", dang ? "false" : "true");
      });
      k.datlai.addEventListener("click", function () {
        datKhe(k, goc[k.ma] || XAM);
        // 🔴 Đặt lại = RÚT LẠI lựa chọn, nên phải xoá cả dấu "đã chạm". Không xoá thì ở
        //    nhánh đường-cơ-sở-ĐOÁN khe này vẫn bị gửi đi, và giá trị gửi đi chính là màu
        //    XÁM BỊA — tức bản vá 2026-09-05 quay lại qua cửa sau.
        k.dung = false;
        goi3D({ mau: mauChoXem() });
      });
    });
  }

  function daKhoa(k) { return k.khoa.getAttribute("aria-pressed") === "true"; }

  /* Bốc lại tối đa chừng này lần cho tới khi phối màu KHÁC HỌ MÀU với mọi bộ trong kho (chủ server
     2026-10-12: ngẫu nhiên không được ra một bộ trong kho). Luật nằm ở `skin-tu.js::trungHoMau` — nơi
     giữ danh sách kho; chưa tải kho (chưa đăng nhập, quà tắt) thì không lọc gì. Khe đã KHOÁ thì giữ,
     nên nếu chính các khe khoá đã trùng một bộ thì có bốc bao nhiêu lần cũng trùng — hết lượt thì nhận
     lượt cuối (lựa chọn của người dùng), chốt chống chép phía server vẫn đứng sau. */
  var NGAU_NHIEN_LUOT = 40;

  function ngauNhien() {
    var b = new Uint8Array(3);
    var kho = window.Dino4VNKho;
    var moi = {};
    for (var luot = 0; luot < NGAU_NHIEN_LUOT; luot++) {
      var mau = {};
      KHE.forEach(function (k) {
        if (daKhoa(k)) { mau[k.ma] = k.o.value; return; }   // khoá = giữ nguyên, đó là cả công dụng
        crypto.getRandomValues(b);
        var h = "#";
        for (var i = 0; i < 3; i++) h += ("0" + b[i].toString(16)).slice(-2);
        mau[k.ma] = moi[k.ma] = h;
      });
      if (!(kho && kho.trungHoMau && kho.trungHoMau(mau))) break;
    }
    KHE.forEach(function (k) {
      if (!moi[k.ma]) return;
      chamKhe(k);                            // bấm "Ngẫu nhiên" LÀ một lựa chọn của người dùng
      datKhe(k, moi[k.ma]);
    });
    goi3D({ mau: mauChoXem() });
    thongBao("Đã đổi ngẫu nhiên các khe chưa khoá.", false);
  }

  /** Chuỗi chép/dán CÓ PHIÊN BẢN. Chuỗi lạ bị từ chối thẳng, không "cố hiểu". */
  function chuoiChep() {
    var p = [CHEP_V];
    KHE.forEach(function (k) { p.push(k.ma + "=" + k.o.value.replace(/^#/, "")); });
    // Không đọc được thì KHÔNG ghi khoá đó vào chuỗi. Chép ra "variation=0" cho một
    // con mà ta không biết vân da của nó là gieo một số 0 bịa vào máy người khác —
    // và chuỗi thì đi xa hơn cái tab này rất nhiều.
    var b = baSo();
    ["variation", "pattern", "theme"].forEach(function (t) {
      if (b[t] !== null) p.push(t + "=" + b[t]);
    });
    return p.join("|");
  }

  function nhanChuoi(chu) {
    chu = String(chu || "").trim();
    if (chu.indexOf(CHEP_V + "|") !== 0) {
      thongBao("Chuỗi không đúng định dạng của Dino4VN (phải bắt đầu bằng \"" + CHEP_V + "|\").", true);
      return false;
    }
    var mau = {}, soMoi = {}, hopLe = 0, boQua = [];
    chu.split("|").slice(1).forEach(function (o) {
      var i = o.indexOf("=");
      if (i < 0) return;
      var khoa = o.slice(0, i), gtri = o.slice(i + 1);
      if (khoa === "variation" || khoa === "pattern" || khoa === "theme") {
        // 🔴 KHÔNG kẹp về dải. Chuỗi cũ đang lưu hành mang "variation=63" — di sản
        //    của chính cái lỗi vừa vá. Kẹp 63 xuống 16 là lặng lẽ chọn hộ người ta
        //    một mức vân da mà họ chưa từng thấy; bỏ qua rồi NÓI RA thì họ còn cơ
        //    hội tự chọn.
        var n = parseInt(gtri, 10);
        var d = (khoa === "variation") ? hopLeBien(n)
              : hopLeSo(n, khoa === "pattern" ? tranHoaTiet() : THEME_MAX);
        if (d !== null) { soMoi[khoa] = d; hopLe++; } else { boQua.push(khoa); }
      } else if (chuanHoa(gtri)) {
        mau[khoa] = chuanHoa(gtri); hopLe++;
      }
    });
    if (!hopLe) { thongBao("Chuỗi đúng đầu nhưng không đọc được giá trị nào.", true); return false; }
    // Dán một chuỗi LÀ một lựa chọn của người dùng cho đúng những khe có trong chuỗi.
    // Khe không có trong chuỗi thì KHÔNG đánh dấu — người dán không hề nói gì về chúng.
    KHE.forEach(function (k) { if (mau[k.ma]) chamKhe(k); });
    datBang(mau);
    ["variation", "pattern", "theme"].forEach(function (t) {
      if (soMoi[t] !== undefined) datSo(t, soMoi[t]);
    });
    goi3D({ mau: mauChoXem() });
    thongBao(boQua.length
      ? ("Đã nhận bảng màu từ chuỗi. Bỏ qua " + boQua.length
         + " giá trị nằm ngoài mức game dùng — hãy tự chọn lại ở khối “Con nào”.")
      : "Đã nhận bảng màu từ chuỗi.", false);
    return true;
  }

  function ganNutMau() {
    $("skin-ngaunhien").addEventListener("click", ngauNhien);

    $("skin-chep").addEventListener("click", function () {
      var chu = chuoiChep();
      var xong = function () { thongBao("Đã chép bảng màu. Dán cho bạn bè để họ dùng lại.", false); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(chu).then(xong).catch(function () { hienODan(chu); });
      } else {
        hienODan(chu);
      }
    });

    // 🔴 `readText()` KHÔNG có trên Firefox và Chrome thì hỏi quyền. Không có
    //    đường lùi thì "Dán" là một nút bấm-không-có-gì-xảy-ra — đúng loại lỗi
    //    mà repo này liên tục vấp (§2.19 link chết, §2.27 verify no-op).
    $("skin-dan").addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText()
          .then(function (t) { if (!nhanChuoi(t)) hienODan(""); })
          .catch(function () { hienODan(""); });
      } else {
        hienODan("");
      }
    });

    $("skin-dan-ok").addEventListener("click", function () {
      nhanChuoi($("skin-dan-chu").value);
    });

    $("skin-datlai").addEventListener("click", function () {
      datBang(goc);
      KHE.forEach(function (k) { k.dung = false; });   // xem nut dat lai TUNG KHE
      goi3D({ mau: mauChoXem() });
      thongBao("Đã quay về bảng màu lúc mở trang.", false);
    });
  }

  function hienODan(giaTri) {
    var o = $("skin-dan-o");
    if (!o) return;
    o.hidden = false;
    var i = $("skin-dan-chu");
    if (i) { i.value = giaTri || ""; i.focus(); if (giaTri) i.select(); }
    if (giaTri) thongBao("Trình duyệt không cho chép tự động — hãy sao chép chuỗi trong ô này.", false);
    else thongBao("Trình duyệt không cho đọc clipboard — hãy dán chuỗi vào ô rồi bấm Nhận.", false);
  }

  function ganDieuKhien() {
    var truot = $("skin-lon"), soLon = $("skin-lon-so");
    var chờ = false;
    truot.addEventListener("input", function () {
      soLon.textContent = truot.value + "%";
      // Gộp nhiều tick vào MỘT khung hình: kéo thanh trượt bắn `input` liên tục.
      if (chờ) return;
      chờ = true;
      requestAnimationFrame(function () {
        chờ = false;
        goi3D({ lon: lon() });
        // 🔴 Ghi chú khe PHẢI cập nhật theo thanh này, không chỉ theo loài. Khe có tác
        //    dụng hay không đổi theo BẬC TUỔI: đo được `maleDisplay` = 0,0% ở cả
        //    hatchling lẫn juvenile trên 21/22 loài, mà 81,2% con đang cưỡi trên server
        //    có growth < 0.75. Bỏ dòng này thì phần lớn người chơi đọc lời cảnh báo của
        //    một bậc tuổi họ không ở — im lặng và sai đúng chiều bất lợi nhất.
        veGhiChuKhe();
      });
    });

    $("skin-loai").addEventListener("change", function () {
      loai = $("skin-loai").value;
      veGhiChuKhe();
      veDaiHoaTiet();
      xem3D({ species: loai, colors: mauChoXem(), growth: lon() });
    });

    var nutGioi = $("skin-gioi").querySelectorAll("button");
    for (var i = 0; i < nutGioi.length; i++) {
      (function (b) {
        b.addEventListener("click", function () {
          gioi = b.getAttribute("data-gioi");
          for (var j = 0; j < nutGioi.length; j++) {
            nutGioi[j].setAttribute("aria-pressed",
              nutGioi[j] === b ? "true" : "false");
          }
          goi3D({ mau: mauChoXem() });
        });
      })(nutGioi[i]);
    }

    $("skin-apdung").addEventListener("click", apVaoGame);
  }

  /* ── Áp vào game ──────────────────────────────────────────────────────────
     🔴 CHỈ GỬI TRƯỜNG NGƯỜI DÙNG THẬT SỰ ĐỔI.

     Bản trước gửi cả ba chỉ số VÔ ĐIỀU KIỆN. Nghe vô hại — "gửi lại đúng giá trị
     đang có thì có mất gì đâu" — nhưng giá trị "đang có" ở đây đọc từ một đường
     hỏng (xem khối DẢI THẬT ở đầu file), nên mỗi lần một người vào chỉ để đổi MỘT
     MÀU là một lần ghi đè vân da của chính họ bằng một con số bịa. Đó là đường đẻ
     ra 403 blob hỏng.

     Cùng một cái bẫy đã có tên trong repo (CLAUDE.md §2.49): **một phép ghi "no-op"
     chỉ vô hại khi chính nó vừa đọc lại ngay trước khi ghi.** Ở đây không có phép
     đọc lại nào cả, nên "no-op" là một lệnh ghi mù.

     Cả ba trường đều không bắt buộc ở phía nhận (`player/app/main.py`: `v is None
     -> continue`; `plugin/src/skin.cpp`: cờ `co_variation`/`co_pattern`/`co_theme`),
     nên VẮNG MẶT nghĩa là "giữ nguyên" — đúng thứ ta cần, không phải một quy ước
     ta tự đặt ra ở đây.

     ✅ SỬA 2026-09-05 — 10 khe màu nay đi theo ĐÚNG LUẬT của ba con số.

     Trước đó chúng được gửi VÔ ĐIỀU KIỆN, và khe nào không đọc được thì `batDau()`
     cho rơi về `XAM` rồi gửi luôn cái màu xám đó đi. Nhánh đắt nhất không phải
     "engine không trả nổi MỘT khe" mà là nhánh CẢ BẢNG: `duongCoSo()` có hai đường
     lùi (`gara o N` và `mac dinh`), và ở đường `mac dinh` thì `cs.mau = {}` ⇒ cả
     mười khe cùng thành `#808080`, nút "Áp vào game" vẫn bật, một cú bấm là con
     đang cưỡi mất sạch bảng màu. Có `thongBao` báo nguồn — nhưng một dòng chữ
     không phải một hàng rào.

     🔑 Lời giải KHÔNG cần trạng thái rỗng cho `<input type="color">` (thứ HTML không
     có, và là lý do bản trước hoãn lại). Nó là đúng một câu, y hệt câu đã dùng cho
     `variation`/`pattern`/`theme`: **chỉ gửi khe nào KHÁC đường cơ sở.** Ở nhánh
     `mac dinh`, đường cơ sở CHÍNH LÀ `XAM`, nên mười ô đang hiển thị `#808080` bằng
     đúng đường cơ sở ⇒ không khe nào được gửi ⇒ không có gì bị ghi đè. Không cần
     tập trạng thái thứ hai, không đụng bản xem thử 3D.

     ⚠️ ĐÁNH ĐỔI ĐÃ BIẾT, nói ra chứ không giấu: nếu đường cơ sở của một khe là
     `XAM` do KHÔNG ĐỌC ĐƯỢC, và người chơi thật sự muốn đặt khe đó thành xám
     `#808080`, thao tác đó sẽ không được gửi. Đổi lại: không bao giờ ghi một màu mà
     người chơi chưa hề chọn. Mất một thao tác hiếm hoi còn hơn xoá cả bảng màu của
     một con dino, và chiều mất mát này người dùng NHÌN THẤY (ô không đổi) chứ không
     im lặng.

     Phía nhận đã sẵn sàng từ trước: `player/app/main.py` bỏ qua khe vắng mặt
     ("không gửi = giữ nguyên"), `plugin/src/skin.cpp` dùng cờ `Mau::co`. */
  /** Đọc lại đường cơ sở NGAY TRƯỚC khi ghi, nếu nó chưa phải con đang cưỡi.
   *
   *  🔑 Đây là CLAUDE.md §2.49 đọc theo chiều xuôi: *một phép ghi "no-op" chỉ vô hại khi
   *  chính nó vừa đọc lại ngay trước khi ghi.* Ca hay gặp nhất trên trang này là **mở
   *  trang trước, vào game sau**: lúc mở thì `skin_get` trả `no_pawn` nên đường cơ sở rơi
   *  xuống con trong gara (hoặc mười ô xám), tới lúc bấm "Áp" thì người ta đã cưỡi rồi.
   *  Một lượt đọc ở đây biến 15,7% lượt-mở-trang-sai-cơ-sở thành đường THẬT, và không đổi
   *  một dòng nào phía server.
   *
   *  🔴 KHÔNG đặt lại các ô màu sau khi đọc. Người dùng đang nhìn thứ họ vừa chọn; ghi đè
   *  bảng màu ngay trước khi gửi là cướp mất lựa chọn của họ đúng lúc họ vừa bấm nút.
   *  Ta chỉ sửa lại ĐƯỜNG CƠ SỞ — thứ quyết định khe nào được gửi. */
  function docLaiCoSo() {
    if (nguonCoSo === "dang cuoi") return Promise.resolve(true);
    thongBao("Đang kiểm lại con bạn đang cưỡi…", false);
    return api("/api/player/skin")
      .then(function (j) {
        if (!j || !j.ok || !j.colors) throw new Error("khong doc duoc");
        KHE.forEach(function (k) { goc[k.ma] = chuanHoa(j.colors[k.ma]) || XAM; });
        nguonCoSo = "dang cuoi";
        // 🔴 Bản xem thử vẫn đang vẽ loài của đường cơ sở CŨ (con trong gara), và ta cố ý
        //    KHÔNG đổi nó giữa lúc người dùng vừa bấm nút. Nhưng phải NHỚ lại sự lệch đó:
        //    nếu không, câu "Xong" ở cuối sẽ nói với giọng chắc chắn trong khi mô hình bên
        //    trái là một con vật khác — người chơi so hai bên, thấy khác, và đi báo hỏng.
        lechLoai = (j.species && j.species !== loai) ? j.species : "";
        return true;
      })
      .catch(function () { return false; });
  }

  function apVaoGame() {
    var nut = $("skin-apdung");
    nut.disabled = true;
    docLaiCoSo()
      .then(function (coSoThat) { return guiApVaoGame(coSoThat); })
      .catch(function (e) { thongBao("Không đổi được: " + e.message, true); })
      .then(function () { nut.disabled = false; });
  }

  function guiApVaoGame(coSoThat) {
    var than = {};
    // Xét ĐỦ 10 khe kể cả khi đang xem giới Cái: `maleDisplay` bị ẩn khỏi BẢN XEM
    // THỬ, không phải bị xoá khỏi con dino.
    //
    // 🔴 HAI LUẬT, chọn theo việc đường cơ sở có THẬT hay không:
    //
    //   coSoThat  -> gửi khe KHÁC đường cơ sở. Đây là luật đúng, và nó cho phép một
    //                lệnh ghi "no-op" thật sự vô hại vì `goc` vừa được đọc lại.
    //   !coSoThat -> chỉ gửi khe người dùng TỰ CHẠM (`k.dung`). Lúc này chín khe kia
    //                đang hiển thị màu của MỘT CON KHÁC (hoặc màu xám bịa); gửi chúng
    //                đi là ghi đè bảng màu con đang cưỡi bằng thứ người ta chưa hề chọn.
    //
    // ⚠️ ĐỪNG "đơn giản hoá" thành gửi vô điều kiện cả 10 khe. Ở nhánh `mac dinh` việc
    //    đó xoá sạch bảng màu con đang cưỡi bằng `#808080` — chính là lý do bản vá
    //    2026-09-05 ra đời. Và cũng đừng bỏ nhánh `k.dung` để luôn so với `goc`: khi
    //    `goc` là bịa thì phép so đó vô nghĩa, và nó IM LẶNG.
    // 🔴 `k.dung` là điều kiện CẦN ở CẢ HAI nhánh — sửa 2026-09-08 sau khi review bắt được.
    //
    //    Bản đầu viết `coSoThat ? (v !== goc) : k.dung`, tức nhánh "cơ sở thật" chỉ so màu.
    //    Nó hỏng đúng ở ca mà `docLaiCoSo()` sinh ra: mở trang lúc chưa cưỡi (ô màu hiện màu
    //    con TRONG GARA), vào game, đổi MỘT khe rồi bấm Áp. `docLaiCoSo()` làm mới `goc` bằng
    //    màu con đang cưỡi nhưng CỐ Ý không đặt lại các ô — nên chín khe kia vẫn mang màu con
    //    gara, khác `goc` mới, và **cả chín bị gửi đi**. Bảng màu con đang cưỡi bị ghi đè bằng
    //    một con người chơi không hề chọn: đúng thảm hoạ mà `k.dung` sinh ra để chặn.
    //
    //    Đọc theo chiều ngữ nghĩa thì luật mới đơn giản hơn luật cũ: **chỉ gửi ô người dùng
    //    thật sự chạm**, và khi đường cơ sở là THẬT thì bỏ thêm những ô họ đã đổi rồi đổi về
    //    như cũ. Khi đường cơ sở là ĐOÁN thì không bỏ gì — vì lúc đó `goc` là màu bịa, so với
    //    nó là vô nghĩa (kể cả khi người ta cố tình chọn đúng màu xám `#808080`).
    KHE.forEach(function (k) {
      var v = chuanHoa(k.o.value);
      if (!v || !k.dung) return;
      if (!coSoThat || v !== goc[k.ma]) than[k.ma] = v;
    });

    var dang = baSo(), doi = [];
    ["variation", "pattern", "theme"].forEach(function (t) {
      // `null` (ô trống / "Giữ nguyên") -> không gửi: ta không biết giá trị thật.
      // Bằng đường cơ sở -> không gửi: người dùng không đổi gì ở ô đó.
      // Người dùng đổi rồi đổi NGƯỢC LẠI về cũ cũng rơi vào nhánh này, đúng ý.
      if (dang[t] === null || dang[t] === gocBien[t]) return;
      than[t] = dang[t];
      doi.push(t);
    });

    // Không đổi gì thì đừng chạm vào game thread. `player/app/main.py` trả 400 cho thân
    // rỗng (có test chốt) — mà "400" là một câu trả lời tệ cho "tôi không đổi gì cả".
    if (Object.keys(than).length === 0) {
      thongBao(coSoThat
        ? "Bạn chưa đổi gì so với con đang cưỡi."
        : "Chưa đọc được con bạn đang cưỡi, và bạn chưa tự đổi ô nào — nên không gửi gì cả."
          + " Vào game rồi bấm lại.", true);
      return;
    }

    thongBao("Đang đổi ngoại trang…", false);
    return api("/api/player/skin", { method: "POST", body: JSON.stringify(than) })
      .then(function (j) {
        // Plugin ĐỌC LẠI sau khi ghi, nên `ok` ở đây mạnh hơn hẳn "đã nhận": nó nghĩa là đã ghi
        // VÀ đọc lại khớp. Trạng thái "ghi rồi mà không ăn" có mã riêng.
        if (!j.ok) { thongBao("Không đổi được: " + (j.res || "không rõ lý do"), true); return; }
        // Chỉ nói ra ở CHIỀU IM LẶNG — trường hợp không gửi ô nào ở khối "Con nào".
        // Đó là chiều duy nhất người dùng không có bằng chứng nào khác: họ bấm "Áp",
        // thấy "Xong", rồi vào game thấy vân da y nguyên và tưởng game nuốt lệnh.
        // Chiều ngược lại (có gửi) thì chính màn hình game là bằng chứng, không cần
        // liệt kê lại tên trường ở đây.
        gocBien.variation = (dang.variation === null) ? gocBien.variation : dang.variation;
        gocBien.pattern = (dang.pattern === null) ? gocBien.pattern : dang.pattern;
        gocBien.theme = (dang.theme === null) ? gocBien.theme : dang.theme;
        // 🔴 Ở chế độ ĐƯỜNG CƠ SỞ KHÔNG THẬT, phải nói ra — nếu không người chơi sẽ so
        //    bản xem thử với game, thấy khác, và đi báo là game hỏng. Chín khe họ không
        //    chạm vẫn mang màu THẬT của con dino, còn bản xem thử bên trái thì không.
        var them = coSoThat
          ? ((lechLoai
              ? " Con bạn đang cưỡi là " + lechLoai + ", khác loài đang xem thử bên trái —"
                + " màu đã vào đúng con đó, chỉ bản xem thử là chưa khớp."
              : "")
             + (doi.length ? "" : " (Chỉ gửi màu — ba ô ở khối “Con nào” không đổi nên giữ nguyên.)"))
          : (" Chưa đọc được con bạn đang cưỡi nên chỉ gửi " + Object.keys(than).length
             + " ô bạn tự đổi; các ô khác giữ nguyên màu thật trong game, và bản xem thử"
             + " bên trái có thể khác.");
        thongBao("Xong. Nhìn vào màn hình game để xem kết quả." + them, false);
      });
  }

  /* ── Khởi động ──────────────────────────────────────────────────────────
     Thứ tự đường cơ sở, từ đúng nhất tới kém nhất — và LUÔN nói ra đang dùng
     cái nào. Bịa một bảng màu rồi để người dùng tưởng đó là con của họ là cách
     nhanh nhất khiến họ áp nhầm.                                             */
  /** Hình dạng CHUNG cho cả hai nguồn màu. `GET /api/player/skin` và một ô gara
   *  trả về CÙNG một khuôn — `skin: {variation, pattern, theme}` lồng, `female` và
   *  `growth` ở gốc — nên ở đây chỉ có MỘT nhánh đọc.
   *
   *  🔴 Bản đầu của tôi làm `skin: j` rồi đọc `cs.skin.variation`. Với hình dạng
   *  lồng thì đó là `undefined`, và ba ô số sẽ lặng lẽ ở nguyên 0 thay vì lấy từ
   *  con đang cưỡi. Không lỗi, không dấu hiệu — chỉ là bảng màu đúng mà ba con số
   *  thì sai. */
  function goiChung(j, nguon) {
    var b = j.skin || {};
    return {
      mau: j.colors || {},
      loai: j.species || "",
      bien: { variation: b.variation, pattern: b.pattern, theme: b.theme },
      nu: (typeof j.female === "boolean") ? j.female : null,
      lon: (typeof j.growth === "number") ? j.growth : null,
      nguon: nguon,
    };
  }

  function duongCoSo() {
    return api("/api/player/skin")
      .then(function (j) {
        if (!j || !j.ok || !j.colors) throw new Error("khong doc duoc");
        return goiChung(j, "dang cuoi");
      })
      .catch(function () {
        // Chưa vào game (hoặc dịch vụ chết) -> mượn con trong gara.
        return api("/api/player/garage").then(function (j) {
          var ds = (j.slots || []).slice().sort(function (a, b) {
            return (a.slot || 0) - (b.slot || 0);      // KHÔNG dựa vào thứ tự DB trả về
          });
          if (!ds.length) throw new Error("gara trong");
          return goiChung(ds[0], "gara o " + ds[0].slot);
        });
      })
      .catch(function () {
        return goiChung({}, "mac dinh");
      });
  }

  function batDau() {
    docKhe();
    api("/api/player/me").then(function (j) {
      if (!j.logged_in) { hienKhoi("skin-chuadangnhap"); return; }
      hienKhoi("skin-noidung");
      return duongCoSo().then(function (cs) {
        // 🔴 Nâng `cs.nguon` lên biến mô-đun. `apVaoGame()` PHẢI biết đường cơ sở này là
        //    con đang cưỡi hay là con mượn từ gara / mười ô xám bịa — nếu không, luật
        //    "chỉ gửi khe khác đường cơ sở" đúng 84,3% thời gian và sai IM LẶNG phần còn lại.
        nguonCoSo = cs.nguon || "";
        KHE.forEach(function (k) { goc[k.ma] = chuanHoa(cs.mau[k.ma]) || XAM; });
        datBang(goc);
        // 🔴 ĐƯỜNG CƠ SỞ CỦA BA CHỈ SỐ — chỉ nhận giá trị NẰM TRONG dải thật.
        //
        //    Hôm nay `GET /api/player/skin` trả `variation` do plugin đọc ô float
        //    bằng int32, nên một con LÀNH cho ra 1090519040 (bit-pattern của 8.0)
        //    chứ không ra 8, còn một con ĐÃ HỎNG lại cho ra đúng 63 — tức con số
        //    "trông hợp lệ" mới là con số của dữ liệu hỏng.
        //
        //    CỐ Ý KHÔNG giải mã bit-pattern ở đây. Bản vá plugin (gói khác) sẽ làm
        //    endpoint trả 8 thật, và một bộ giải mã bit sẽ hỏng đúng vào ngày đó —
        //    lại là một chỗ hỏng im lặng nữa. Cách này đúng ở CẢ HAI phía bản vá:
        //    đọc được thì hiện, không đọc được thì để trống và KHÔNG GỬI.
        var thieu = [];
        gocBien.variation = hopLeBien(cs.bien.variation);
        gocBien.pattern = hopLeSo(cs.bien.pattern, tranHoaTiet(cs.loai || ""));
        gocBien.theme = hopLeSo(cs.bien.theme, THEME_MAX);
        [["variation", "vân da"], ["pattern", "hoạ tiết"], ["theme", "chủ đề"]]
          .forEach(function (c) {
            datSo(c[0], gocBien[c[0]]);
            if (gocBien[c[0]] === null && $("skin-" + c[0])) thieu.push(c[1]);   // ô đã bỏ thì thôi
          });
        // Nói ra chỗ mình KHÔNG biết. Ô trống mà không giải thích thì người dùng sẽ
        // tự điền một số cho "đủ" — và số đó là số bịa, y như số 0 mà bản trước điền hộ.
        var eBien = $("skin-bien-ghi");
        if (eBien) {
          eBien.textContent = thieu.length
            ? ("Chưa đọc được " + thieu.join(", ") + ", để trống là giữ nguyên.")
            : "";
        }
        if (cs.nu !== null) {
          gioi = cs.nu ? "cai" : "duc";
          var nut = $("skin-gioi").querySelectorAll("button");
          for (var i = 0; i < nut.length; i++) {
            nut[i].setAttribute("aria-pressed",
              nut[i].getAttribute("data-gioi") === gioi ? "true" : "false");
          }
        }
        // Mức trưởng thành THẬT của con đang cưỡi, nếu đọc được. Mặc định 100% chỉ
        // đúng khi ta không biết gì — mở sẵn ở 100% cho một con non là nói sai cỡ.
        if (cs.lon !== null && $("skin-lon")) {
          var pc = Math.round(Math.max(0.05, Math.min(1, cs.lon)) * 100);
          $("skin-lon").value = String(pc);
          if ($("skin-lon-so")) $("skin-lon-so").textContent = pc + "%";
        }
        ganBangMau();
        ganNutMau();
        ganDieuKhien();

        if (cs.nguon === "dang cuoi" && !cs.loai) {
          // 🔴 Đọc được MÀU mà không đọc được LOÀI. Hộp chọn sẽ rơi về loài đầu
          //    danh sách, nên nếu không nói ra thì người chơi thấy một con KHÁC
          //    mang màu của mình và tin đó là con của họ.
          thongBao("Chưa đọc được loài con đang cưỡi, hãy chọn đúng loài ở ô Loài.", false);
        } else if (cs.nguon === "dang cuoi") {
          // Đọc được đúng con đang cưỡi = trạng thái bình thường: không nói gì (chủ server
          // 2026-10-12 bỏ câu "Màu lấy từ con đang cưỡi."). Chỉ báo khi có điều cần làm.
        } else if (cs.nguon === "mac dinh") {
          thongBao("Chưa đọc được con nào, đang dùng màu mặc định. Vào game rồi tải lại trang.", false);
        } else {
          thongBao("Chưa đọc được con đang cưỡi, màu lấy từ " + cs.nguon + ".", false);
        }

        return napLoai(cs.loai).then(function () {
          // 🔴 Vẽ ghi chú khe NGAY, không chờ bộ xem 3D. `napLoai` vừa chốt `loai` và
          //    vừa nạp `manifest` — đủ để trả lời "khe nào có tác dụng". Đợi 3D là đợi
          //    một thứ có thể không bao giờ tới (máy thiếu WebGL), và đó đúng là máy
          //    cần lời cảnh báo này nhất.
          veGhiChuKhe();
          veDaiHoaTiet();
          ganCanh();
          tiem3D();
          // Module 3D nạp bất đồng bộ; nó tự lắng nghe nên phát sự kiện ngay là
          // đủ — nhưng phát TRƯỚC khi module chạy thì mất. Phát lại một nhịp sau.
          // `canh` đi KÈM lượt mở: phát riêng lúc này thì module 3D chưa nạp, sự kiện rơi mất.
          var mo = function () {
            xem3D({ species: loai, colors: mauChoXem(), growth: lon(), canh: canhDangChon() });
          };
          mo();
          setTimeout(mo, 400);
        });
      });
    }).catch(function () {
      // Dịch vụ chết -> vẫn phải cho người ta thấy nút đăng nhập, đừng để trang
      // treo mãi ở "Đang tải".
      hienKhoi("skin-chuadangnhap");
    });
  }

  /* ── Cửa cho `skin-tu.js` (quà skin: tủ bộ màu, bảng màu miễn phí) ────────────
     Tủ bộ màu cần ĐỌC trình sửa (lưu bộ đang chỉnh) và ĐIỀN trình sửa (nạp một bộ, bấm một
     ô trong bảng màu). Mở đúng năm hàm thay vì để file kia đọc DOM trực tiếp: `k.dung`
     (dấu "đã chạm") chỉ tồn tại ở đây, và điền màu mà không đánh dấu nó là để nút "Áp vào
     game" lặng lẽ KHÔNG gửi màu người ta vừa chọn (xem khối "CHỈ GỬI TRƯỜNG NGƯỜI DÙNG THẬT
     SỰ ĐỔI"). Mọi hàm đọc trạng thái LÚC GỌI, nên gắn ở đây — trước `batDau` — là đủ. */
  window.Dino4VNSkin = {
    mau: function () { return bangMau(); },
    loai: function () { return loai; },
    bien: function () { return baSo(); },
    thongBao: thongBao,
    datMotKhe: function (ma, hex) {
      var k = null;
      KHE.forEach(function (x) { if (x.ma === ma) k = x; });
      if (!k || !datKhe(k, hex)) return false;
      chamKhe(k);
      goi3D({ mau: mauChoXem() });
      return true;
    },
    nap: function (mau, bien) {
      mau = mau || {};
      KHE.forEach(function (k) { if (chuanHoa(mau[k.ma])) chamKhe(k); });
      datBang(mau);
      if (bien) {
        ["variation", "pattern", "theme"].forEach(function (t) {
          if (bien[t] !== undefined && bien[t] !== null) datSo(t, bien[t]);
        });
      }
      goi3D({ mau: mauChoXem() });
    },
    // Xem thử một bộ của kho trên mô hình MÀ KHÔNG đụng trình sửa (2026-10-12): bấm lướt qua
    // hàng chục bộ không được xoá màu người chơi đang chỉnh dở. Khe bộ không có thì giữ màu
    // của trình sửa — đúng như lúc áp vào game (khe vắng = giữ màu đang có).
    xemThu: function (mau) {
      var m = mauChoXem();
      mau = mau || {};
      KHE.forEach(function (k) {
        var h = chuanHoa(mau[k.ma]);
        if (h && !(gioi === "cai" && k.ma === "maleDisplay")) m[k.ma] = h;
      });
      goi3D({ mau: m });
    },
    xemLai: function () { goi3D({ mau: mauChoXem() }); }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", batDau);
  } else {
    batDau();
  }
})();
