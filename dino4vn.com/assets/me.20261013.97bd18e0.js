/* me.js — trang /me: thanh tab + dòng cảnh cáo + tab "Khủng long" (con ĐANG CHƠI, tiến độ Prime).
 *
 * Hai tab còn lại có file riêng: `me-quyen-loi.js` (bảo hiểm, quyền lợi ủng hộ) và
 * `me-chien-tich.js` (trận gần đây, bảng từng cú). File này là NGUỒN DUY NHẤT của "tab
 * nào đang mở": giữ ở `window.__dino4vnMeTab` và phát `dino4vn:me-tab` mỗi lần đổi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RÀNG BUỘC — ĐỀU LÀ YÊU CẦU, KHÔNG PHẢI SỞ THÍCH
 * ════════════════════════════════════════════════════════════════════════════
 *  · CSP `style-src 'self'` + quy ước repo: KHÔNG `style=`, KHÔNG chạm `.style` ở đâu
 *    hết. Bề rộng thanh chỉ số đi qua THUỘC TÍNH `width` của <rect> SVG.
 *  · KHÔNG `innerHTML`. Tên loài và lý do cảnh cáo là chuỗi do người khác gõ; CSP chặn
 *    <script> nội tuyến nhưng KHÔNG chặn `<img onerror>`.
 *  · KHÔNG <form> (`form-action 'none'`). Đăng nhập là một <a>.
 *  · `[hidden]` được ép bằng `!important` ở đầu site.css. Bật/tắt bằng `el.hidden`,
 *    đừng bao giờ bằng class có `display:`.
 *  · `null` KHÔNG PHẢI `0`. "Không hỏi được" phải hiện `—`, không bao giờ là một con số.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 BA CHỖ TRANG NÀY CÓ THỂ NÓI DỐI, VÀ CÁCH CHẶN
 * ════════════════════════════════════════════════════════════════════════════
 * 1. SỐ CŨ ĐỘI LỐT SỐ SỐNG. Server trả `song` và `luc_cuoi` là HAI object không bao giờ
 *    trộn. Khi vẽ từ `luc_cuoi`, trang đặt `data-cu="1"` để làm xám cả nhãn, số VÀ thanh
 *    — nên một ảnh chụp bị cắt mất cái pill vẫn không đọc nhầm được.
 * 2. BẢNG PRIME BỊA. `data-dat` có BA trạng thái: vắng = chưa biết, "0" = chưa đạt,
 *    "1" = đã đạt. Gộp "chưa biết" với "chưa đạt" là vẽ ra một bảng tiến độ không có thật.
 * 3. HỒ SƠ SẠCH GIẢ. `canh_cao` VẮNG MẶT (khác `[]`) nghĩa là không hỏi được. Từ
 *    2026-10-10 trang không còn câu "bạn sạch án" nào: dòng cảnh cáo CHỈ hiện khi có ít
 *    nhất một cảnh cáo, vắng khoá hay mảng rỗng đều ẩn — ẩn thì không khẳng định gì.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const KHOI_VAO = $("me-chuadangnhap");
  const KHOI_ND = $("me-noidung");
  if (!KHOI_ND) return;

  // ── tiện ích nhỏ ────────────────────────────────────────────────────────
  const so = (v) => (typeof v === "number" && isFinite(v)) ? v : null;

  const gio = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  /** Mốc thời gian theo giờ Việt Nam. Người chơi ở đây, máy chủ ở đây — đọc giờ máy của
   *  người xem sẽ cho ra một cái nhãn khác nhau tuỳ ai mở trang. */
  const khiNao = (ts) => gio.format(new Date(ts * 1000));

  function chu(el, s) { if (el) el.textContent = s; }

  // ── chỉ số bằng SỐ ──────────────────────────────────────────────────────
  // 2026-09-25 chủ server chốt bỏ thanh %: trần của vài chỉ số không phải lúc nào cũng có,
  // nên thanh chỗ vẽ được chỗ không và hàng thiếu trần lạc hẳn. Nay mọi hàng là chữ số.
  // ⚠️ Logic này có bản sao ở `gara.*.js::noiDungChiSo` (hai file không chia module) —
  //    sửa một chỗ thì sửa cả hai.

  /** Số kiểu Việt ("7.620"). Trần dưới 100 (đói của con non chỉ 16,5) thì giữ 1 chữ số lẻ,
   *  không thì làm tròn cả hai vế về 17 và cặp số mất nghĩa. */
  function soVN(v, co) {
    return v.toLocaleString("vi-VN", { maximumFractionDigits: co < 100 ? 1 : 0 });
  }

  /** Nội dung một hàng: `[chinh, phu]`, `phu` là phần " / trần" (có thể rỗng).
   *
   *  `ti` là tỉ lệ 0..1 (hoặc null). `abs`/`tran` là số tuyệt đối (hoặc null).
   *
   *  🔴 KHÔNG BAO GIỜ hiện cặp `abs / tran` khi nó vô lý. Ảnh mẫu của đối thủ hiện
   *  "Hunger 195 / 4" — trần 4 với giá trị 195 là bất khả. Đó đúng là bẫy lệch đơn vị
   *  §2.33 hiện lên màn hình. Không hợp lệ thì lùi về phần trăm, rồi về số thô.
   */
  function noiDungChiSo(khoa, ti, abs, tran) {
    if (khoa === "growth") {
      return ti === null ? ["—", ""] : [Math.round(Math.max(0, Math.min(1, ti)) * 100) + "%", ""];
    }
    const coAbs = abs !== null && abs >= 0;
    if (coAbs && tran !== null && tran > 0 && abs <= tran) {
      return [soVN(abs, tran), " / " + soVN(tran, tran)];
    }
    if (ti !== null) return [Math.round(Math.max(0, Math.min(1, ti)) * 100) + "%", ""];
    if (coAbs) return [soVN(abs, abs), ""];
    return ["—", ""];
  }

  /** Điền ô số của một hàng tĩnh trong `me.njk`. Chỉ đổi chữ — không tạo/xoá phần tử nào
   *  ngoài hai mảnh chữ trong ô số, nên không có cú nhảy bố cục khi dữ liệu về. */
  function veChiSo(id, khoa, ti, abs, tran) {
    const oSo = $(id) && $(id).querySelector(".stat__so");
    if (!oSo) return;
    const [chinh, phu] = noiDungChiSo(khoa, ti, abs, tran);
    oSo.textContent = chinh;
    if (phu) {
      const t = document.createElement("span");
      t.className = "stat__tran";
      t.textContent = phu;
      oSo.appendChild(t);
    }
  }

  // ── vẽ khối con dino ────────────────────────────────────────────────────
  const KEY = ["growth", "health", "stamina", "hunger", "thirst"];

  function veDino(d, cu, ghi) {
    chu($("me-loai"), (d && d.species) || "Chưa có con nào");

    const tt = $("me-tt");
    if (tt) {
      tt.textContent = "";
      const cham = document.createElement("span");
      cham.setAttribute("aria-hidden", "true");
      cham.textContent = "●";
      tt.appendChild(cham);
      tt.appendChild(document.createTextNode(cu ? " Ngoại tuyến" : " Đang chơi"));
      // Ngoại tuyến là màu XÁM, không phải đỏ: nó không phải lỗi.
      tt.className = "pill" + (cu ? "" : " pill--luc");
    }

    const gt = $("me-gt");
    if (gt) {
      const g = d && d.gender;
      gt.hidden = !(g === "male" || g === "female");
      gt.textContent = g === "female" ? "Cái" : (g === "male" ? "Đực" : "");
    }

    const bang = $("me-chiso");
    if (bang) {
      if (cu) bang.setAttribute("data-cu", "1");
      else bang.removeAttribute("data-cu");
    }

    for (const k of KEY) {
      const ti = d ? so(d[k]) : null;
      veChiSo("me-cs-" + k, k, ti, d ? so(d[k + "_abs"]) : null, d ? so(d[k + "_max"]) : null);
    }
    chu($("me-cs-ghi"), ghi);
  }

  // ── đột biến con đang chơi ──────────────────────────────────────────────
  /** `ds` = `song.dot_bien` từ server: [{nhan, ten: [{ten, vi}]}], nhóm trống đã bỏ.
   *  Cùng cách vẽ với thẻ ở /gara: mỗi nhóm một dòng, tên tiếng Anh như trong game, mô tả
   *  tiếng Việt ở `title`. Server KHÔNG gửi trường này khi ảnh chụp có thể đang tả con
   *  khác (vừa đổi con, vừa chết) — lúc đó ẩn hẳn, không đoán. */
  function veDotBien(ds) {
    const khoi = $("me-dotbien");
    if (!khoi) return;
    khoi.textContent = "";
    if (!Array.isArray(ds) || !ds.length) { khoi.hidden = true; return; }
    const td = document.createElement("p");
    td.className = "dotbien__td";
    td.textContent = "Đột biến";
    khoi.appendChild(td);
    const dl = document.createElement("dl");
    dl.className = "dotbien__ds";
    for (const nhom of ds) {
      const ten = Array.isArray(nhom.ten) ? nhom.ten : [];
      if (!ten.length) continue;
      const dt = document.createElement("dt");
      dt.textContent = nhom.nhan || "";
      const dd = document.createElement("dd");
      ten.forEach((t, i) => {
        if (i) dd.appendChild(document.createTextNode(", "));
        const s = document.createElement("span");
        s.textContent = t.ten;
        if (t.vi) { s.className = "dotbien__ten"; s.title = t.vi; }
        dd.appendChild(s);
      });
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    khoi.appendChild(dl);
    khoi.hidden = false;
  }

  // ── tiến độ Prime ───────────────────────────────────────────────────────
  function vePrime(pr, dat, duDieuKien, coPlugin, tt) {
    const ds = $("me-prime-ds");
    const hopLe = Array.isArray(pr) && pr.length === 10;

    if (ds) {
      const li = ds.children;
      for (let i = 0; i < li.length; i++) {
        // Vắng `data-dat` = CHƯA BIẾT. Đặt "0" khi chưa biết là bịa ra một bảng tiến độ.
        if (hopLe) li[i].setAttribute("data-dat", pr[i] ? "1" : "0");
        else li[i].removeAttribute("data-dat");
      }
    }

    const dem = $("me-prime-dem");
    if (hopLe) {
      const n = typeof dat === "number" ? dat : pr.reduce((a, b) => a + (b ? 1 : 0), 0);
      // 🔴 KHÔNG viết "(loài nhỏ 4)" ở đây. Ô này đếm CẢ MƯỜI ô, kể cả điều kiện 10
      //    mà năm loài nhỏ được tặng sẵn — nên "cần 4" đặt cạnh con số này là tự mâu
      //    thuẫn: một bạn Hypsi thấy "4/10 · cần 4" sẽ tưởng mình xong, trong khi
      //    engine vẫn báo chưa đủ. Ngưỡng trong binary luôn là 5, không có ngoại lệ.
      //    Phần giải thích "loài nhỏ chỉ phải tự làm 4" nằm ở /prime, nơi có chỗ nói
      //    cho hết câu.
      chu(dem, `${n}/10 điều kiện, cần 5 trước mốc 75%`);
    } else if (coPlugin) {
      chu(dem, "Đang đọc tiến độ…");
    } else {
      chu(dem, "Vào game để xem tiến độ của bạn");
    }

    const nhan = $("me-prime-nhan");
    if (nhan) {
      // 🔴 `prime_eligible` là kết luận CỦA CHÍNH ENGINE, không phải phép cộng của ta.
      //    Ngưỡng "5, loài nhỏ 4" là quy tắc cộng đồng — dùng nó để tự kết luận là đoán.
      nhan.hidden = duDieuKien !== true;
      nhan.textContent = "Đủ điều kiện";
    }
    const pill = $("me-prime-pill");
    if (pill) pill.hidden = duDieuKien !== true;

    // 🔴 Khi ĐANG có dữ liệu thì không nói gì. Câu cũ ("Đọc trực tiếp từ máy chủ trong lúc
    //    bạn đang chơi") là XUẤT XỨ DỮ LIỆU — người chơi không làm gì khác đi khi đọc nó,
    //    nên nó là chữ của lập trình viên. Chỉ nói khi có một HÀNH ĐỘNG để nói.
    chu($("me-prime-ghi"), hopLe ? "" : "Bảng này chỉ hiện khi bạn đang ở trong game.");
    // Truyền CẢ kết luận của engine xuống: ô tích và con số phải nói cùng một chuyện.
    // `tt` = `{c6: {...}, c5: {...}, c4: {...}}`. Ba nhiệm vụ, một hàm vẽ — chép ba lần
    // là ba bản sẽ trôi lệch, và lệch ở đây là một dòng nói dối tiến độ.
    // 🔴 `prime[]` 0-based: điều kiện 4 -> `pr[3]`, 5 -> `pr[4]`, 6 -> `pr[5]`.
    veTienDoNV(6, tt && tt.c6, hopLe ? !!pr[5] : false);
    veTienDoNV(5, tt && tt.c5, hopLe ? !!pr[4] : false);
    veTienDoNV(4, tt && tt.c4, hopLe ? !!pr[3] : false);
  }

  // Tiến độ vùng Tuần tra, gắn vào ĐÚNG dòng điều kiện 6.
  //
  // 🔴 VÌ SAO CẦN, TRONG KHI ĐÃ CÓ Ô TÍCH: ô tích chỉ là MỘT BIT — đủ 4 vùng hay chưa.
  // Người đã đi 3 vùng và người chưa đi vùng nào nhìn thấy y hệt nhau, nên không ai
  // biết mình còn thiếu mấy. Đó chính là câu hỏi họ đang hỏi.
  //
  // Nguồn KHÁC với `pr`: `pr` đọc từ engine, còn cái này do máy chủ tự đo. Nên nó vẫn
  // có mặt cả khi bảng mười điều kiện chưa đọc được — và đúng lúc đó nó là thứ duy
  // nhất còn nói được điều gì.
  function veTienDoNV(so, tt, engineXong) {
    const ds = $("me-prime-ds");
    const li = ds && ds.querySelector(`li[data-so="${so}"]`);
    if (!li) return;
    let o = li.querySelector(".dk-tt");
    const co = tt && typeof tt.ghe === "number" && typeof tt.can === "number" && tt.can > 0;
    // 🔴 Engine đã tích thì KHÔNG hiện phân số của ta nữa, dù bộ đếm mới 3/4. Con dino
    //    lấy từ gara mang sẵn cờ (gara khôi phục `PD_PRIMEDATA`) mà bộ đếm ta chưa hề
    //    thấy nó đi đâu — hiện "còn 1 vùng" cạnh một ô ĐÃ TÍCH là tự mâu thuẫn. Đã xảy
    //    ra thật 2026-09-02.
    if (engineXong) {
      if (o) o.remove();
      return;
    }
    if (!co) {
      // Không có dữ liệu thì GỠ HẲN, không giữ số cũ: một con số đứng im trông y hệt
      // một con số đang đúng.
      if (o) o.remove();
      return;
    }
    if (!o) {
      o = document.createElement("span");
      o.className = "dk-tt";
      li.appendChild(o);
    }
    // 🔴 Nhiệm vụ CHỈ CẦN MỘT VÙNG (điều kiện 4) thì không hiện phân số lúc chưa xong.
    //    " — 0/1, còn 1 vùng" không nói thêm gì so với một ô tích trống, mà lại gợi ý
    //    rằng có một DANH SÁCH vùng đang thiếu — trong khi cả nhiệm vụ chỉ có đúng một
    //    chỗ để đến. Xong thì vẫn nói "đã đủ", vì lúc đó nó là một tin vui.
    if (!tt.xong && tt.can === 1) { o.remove(); return; }
    const con = tt.can - tt.ghe;
    // Đủ rồi thì bỏ hẳn phân số: đi thêm vùng sau khi xong không cần hiện nữa, và
    // "7/4" là con số không giải thích được cho người chơi.
    o.textContent = tt.xong ? ": đã đủ" : `: ${tt.ghe}/${tt.can}, còn ${con} vùng`;
    o.title = (tt.ten && tt.ten.length) ? "Đã ghé: " + tt.ten.join(", ") : "";
    // 🔴 ĐỦ THEO TA **HOẶC** THEO ENGINE — chỉ BẬT, không bao giờ tắt.
    //    Đo trên production 2026-09-02: có người engine đã tích trong khi bộ đếm của
    //    ta mới 1-2/4 (đi đủ vùng TỪ TRƯỚC khi bộ đếm chạy). Ghi đè hai chiều sẽ làm
    //    dấu tích đang có của họ biến mất.
    if (tt.xong) li.setAttribute("data-dat", "1");
  }

  // ── cảnh cáo ────────────────────────────────────────────────────────────
  // Thay thẻ "Hồ sơ của bạn" (người dùng chốt 2026-10-10). Một dòng gọn, CHỈ hiện khi có
  // cảnh cáo. 🔴 `canh_cao` vắng mặt (không hỏi được) và `[]` (sạch) đều ẩn: ẩn thì không
  // khẳng định gì cả, nên không có câu nào có thể nói dối kiểu "bạn sạch án".
  const MUC = { 1: "nhắc nhở", 2: "cảnh cáo", 3: "nặng" };
  const ngayCC = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  });
  const ngayCua = (ts) => ngayCC.format(new Date(ts * 1000));
  // Mức 0 là mặc định của panel và là giá trị của gần như mọi cảnh cáo — gắn nhãn "mức 0"
  // lên tất cả còn tệ hơn không gắn gì.
  const mucCua = (c) => (c.muc > 0 && MUC[c.muc]) ? MUC[c.muc] : "";

  function veCanhCao(j) {
    const hop = $("me-cc");
    const dong = $("me-cc-td");
    const ds = $("me-cc-ds");
    const mo = $("me-cc-mo");
    if (!hop || !dong || !ds || !mo) return;
    const cc = (j && Array.isArray(j.canh_cao))
      ? j.canh_cao.filter((c) => c && typeof c.ts === "number") : [];
    hop.hidden = cc.length === 0;
    if (!cc.length) return;

    dong.textContent = "";
    ds.textContent = "";
    ds.hidden = true;
    mo.setAttribute("aria-expanded", "false");
    const dam = document.createElement("b");
    if (cc.length === 1 && !j.con_nua) {
      const c = cc[0];
      const muc = mucCua(c);
      dam.textContent = "Bạn đang có 1 cảnh cáo";
      dong.append(dam, " (" + ngayCua(c.ts) + (muc ? ", " + muc : "") + ")"
        + (c.ly_do ? ": " + c.ly_do : "."));
      mo.hidden = true;
      return;
    }
    // Server cắt danh sách ở 20 (`con_nua`): nói "ít nhất", đừng đưa một con số thiếu.
    dam.textContent = (j.con_nua ? "Bạn đang có ít nhất " : "Bạn đang có ")
      + cc.length + " cảnh cáo";
    dong.append(dam, ", gần nhất ngày " + ngayCua(cc[0].ts) + ".");
    for (const c of cc) {
      const li = document.createElement("li");
      const t = document.createElement("b");
      t.textContent = ngayCua(c.ts);
      const muc = mucCua(c);
      li.append(t, (muc ? ", " + muc : "") + (c.ly_do ? ": " + c.ly_do : ""));
      ds.appendChild(li);
    }
    mo.hidden = false;
    mo.textContent = "Xem cả " + cc.length;
  }

  {
    const mo = $("me-cc-mo");
    if (mo) mo.addEventListener("click", () => {
      const ds = $("me-cc-ds");
      if (!ds) return;
      const moRa = ds.hidden;
      ds.hidden = !moRa;
      mo.setAttribute("aria-expanded", moRa ? "true" : "false");
      mo.textContent = moRa ? "Thu gọn" : "Xem cả " + ds.children.length;
    });
  }

  // ── bộ xem 3D ───────────────────────────────────────────────────────────
  // Dùng lại nguyên sự kiện `dino4vn:xem3d` của `dino3d.js`. Đặt một tên sự kiện mới
  // nghĩa là phải sửa `dino3d.js`, tức là đổi tên file có vân tay của nó, tức là đổ dây
  // sang `gara.js` rồi `gara.njk` — không đổi lại được gì.
  const DINO3D = "/assets/dino3d.20261012.abc66f91.js";
  let daTiem = false;
  let mauMoiNhat = null;
  // 🔴 CHỮ KÝ của thứ đã vẽ. Trang tự hỏi lại mỗi vài giây, nên nếu cứ phát sự kiện mỗi
  //    vòng thì `dino3d.js` sẽ TẢI LẠI file .glb (~300 KB) mỗi vài giây — một vòng lặp
  //    ngốn băng thông mà trên màn hình không có gì đổi. Chỉ phát khi loài hoặc màu ĐỔI THẬT.
  let daVe = "";

  function xem3D() {
    if (!mauMoiNhat) return;


    if (isSpino && khung3d) {
      const c = $("gara-3d-canvas");
      if (c) c.hidden = true;
      let rImg = khung3d.querySelector(".v3d__render-img");
      if (!rImg) {
        rImg = document.createElement("img");
        rImg.className = "v3d__render-img";
        rImg.src = "/assets/img/spinosaurus_render.png";
        rImg.alt = "Spinosaurus (Bản dựng 3D The Isle • Gai lưng & Mắt xanh)";
        const san = khung3d.querySelector(".v3d__san");
        if (san) san.appendChild(rImg);
      }
      rImg.hidden = false;
      khung3d.setAttribute("data-state", "ready");
      chu($("gara-3d-ghi"), "Spinosaurus (Bản dựng 3D chính thức The Isle • Gai lưng & Mắt xanh)");
    }
    if (!mauMoiNhat) return;
    const d = mauMoiNhat;
    const ky = JSON.stringify([d.species, d.colors || null, d.growth]);
    if (daTiem && ky === daVe) return;
    daVe = ky;
    if (daTiem) {
      document.dispatchEvent(new CustomEvent("dino4vn:xem3d", { detail: d }));
      return;
    }
    daTiem = true;
    const khung = $("gara-3d");
    if (khung) khung.setAttribute("data-state", "loading-lib");
    chu($("gara-3d-msg"), "Đang tải mô hình…");

    const s = document.createElement("script");
    s.type = "module";
    s.src = DINO3D;
    // 🔴 PHÁT SỰ KIỆN SAU KHI MODULE CHẠY XONG. `gara.js` phát trước rồi dựa vào đường
    //    cứu trong `dino3d.js` (tự đọc lại `data-slot`) — nhưng con ĐANG CƯỠI không có ô
    //    nào, nên đường cứu đó không tồn tại và sự kiện sẽ rơi vào một trang chưa có
    //    listener. Không lỗi, chỉ là mô hình không bao giờ hiện.
    s.addEventListener("load", () => {
      document.dispatchEvent(new CustomEvent("dino4vn:xem3d", { detail: mauMoiNhat }));
    });
    s.addEventListener("error", () => {
      if (khung) khung.setAttribute("data-state", "error");
      chu($("gara-3d-msg"), "Không tải được bộ xem 3D.");
    });
    document.head.appendChild(s);
  }

  // ⚠️ TUYỆT ĐỐI KHÔNG đặt `data-slot` lên #gara-3d. `dino3d.js` đọc thuộc tính đó lúc
  //    nạp và tự fetch `/api/player/garage/<slot>` — trên trang này nó sẽ vẽ MỘT CON KHÁC
  //    với con đang hiện, hoặc 404.

  // ── vòng hỏi ────────────────────────────────────────────────────────────
  let hong = 0;
  let hen = null;

  async function layJSON(duong) {
    const r = await fetch(duong, { credentials: "same-origin" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  /** POST không thân yêu cầu. Trình duyệt tự gắn `Origin` + `Sec-Fetch-Site` cho lời gọi
   *  cùng nguồn — đó chính là hai thứ `check_csrf` phía server đọc, nên không cần token.
   *
   *  🔴 Đọc thân LỖI rồi mới ném: `_call` phía server trả 429/503 kèm `detail` tiếng Việt
   *  (\"bạn thao tác quá nhanh\", \"gara đang bảo trì\"). Ném thẳng \"HTTP 429\" là vứt đi
   *  đúng câu giải thích mà người chơi cần.
   */
  async function goiPOST(duong) {
    const r = await fetch(duong, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    let j = null;
    try { j = await r.json(); } catch (e) { /* server co the tra rong */ }
    if (r.status === 404) {
      // Trang tinh va dich vu API di bang hai duong deploy khac nhau. Trang len truoc la
      // chuyen binh thuong, khong phai su co — noi dung nhu vay thay vi mot cau loi chung.
      const e = new Error("Tính năng đang được bật, thử lại sau ít phút.");
      e.chuaCo = true;
      throw e;
    }
    if (!r.ok) throw new Error((j && (j.detail || j.err)) || ("HTTP " + r.status));
    return j;
  }

  function baoLoi(co) {
    const el = $("me-loi");
    if (!el) return;
    el.hidden = !co;
    // Không ẩn gì khác: mọi ô vẫn giữ `—`. Xoá sạch trang khi mạng chập chờn là làm người
    // chơi tưởng mất dữ liệu.
    if (co) el.textContent = "Chưa lấy được dữ liệu của bạn lúc này. Đang thử lại…";
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * TỰ KẾT LIỄU
   * ══════════════════════════════════════════════════════════════════════════
   * Đây là thao tác DUY NHẤT trên trang này không hoàn tác được, nên giao diện có ba
   * lớp chắn — và không lớp nào trong số đó là `confirm()`:
   *
   *  1. Nút chỉ TỒN TẠI khi người chơi đang cưỡi một con. Không có dino thì không có nút.
   *  2. Bấm lần đầu KHÔNG gửi gì cả, nó chỉ đổi nút thành \"bấm lần nữa để xác nhận\" và
   *     hiện dòng cảnh báo. Tự quay về sau 10 giây — một nút xác nhận nằm sẵn mãi trên
   *     màn hình rồi cũng có người bấm nhầm.
   *  3. Sau khi gửi vẫn còn cửa sổ đếm ngược để bấm HUỶ.
   *
   * 🔴 KHÔNG dùng `confirm()`: CSP thì không chặn nó, nhưng nó khoá luồng và trên trình
   *    duyệt trong ứng dụng Facebook (cửa vào chính của thị trường này) nó hiện ra rất
   *    khác nhau, có nơi không hiện.
   *
   * 🔴 `ok:true` KHÔNG phải \"đã chết\" — nó là \"máy chủ đã nhận việc\". Con dino chỉ chết
   *    sau khi người chơi đứng yên đủ số giây, và bị đánh trong lúc đó là huỷ. Giao diện
   *    phải nói đúng như vậy, đừng báo thành công sớm.
   */
  const KILL = (() => {
    const goc = $("me-kill");
    if (!goc) return { ve() {} };

    const the = document.createElement("div");
    the.className = "the";

    const tieu = document.createElement("p");
    tieu.className = "nhan";
    tieu.textContent = "Tự kết liễu";

    const mota = document.createElement("p");
    mota.className = "muted";
    mota.textContent = "Kết thúc con đang chơi để đổi sang loài khác, khỏi phải đi tìm chỗ chết. "
      + "Trong game gõ !slay cũng được.";

    const canh = document.createElement("p");
    canh.className = "canhbao";
    canh.hidden = true;

    const dem = document.createElement("p");
    dem.className = "dem";
    dem.hidden = true;

    const tin = document.createElement("p");
    tin.className = "dim nho";
    tin.hidden = true;

    const hang = document.createElement("p");
    hang.className = "hang-nut mb-0";
    const nut = document.createElement("button");
    nut.type = "button";
    const nutHuy = document.createElement("button");
    nutHuy.type = "button";
    nutHuy.className = "act";
    nutHuy.textContent = "Huỷ";
    nutHuy.hidden = true;
    hang.append(nut, nutHuy);

    the.append(tieu, mota, canh, dem, tin, hang);
    goc.append(the);

    let trangThai = "idle";          // idle | xacnhan | demnguoc
    let chuaCo = false;              // server chua co route -> thoi hien nut
    let henXacNhan = 0;              // setTimeout id
    let dongHo = 0;                  // setInterval id
    let conLai = 0;

    function noi(s) { tin.hidden = !s; tin.textContent = s || ""; }

    function datIdle() {
      trangThai = "idle";
      clearTimeout(henXacNhan); clearInterval(dongHo);
      nut.className = "act";
      nut.textContent = "Kết liễu con đang chơi";
      nut.disabled = false; nut.hidden = false;
      nutHuy.hidden = true; nutHuy.disabled = false;
      canh.hidden = true; dem.hidden = true;
    }

    function datXacNhan() {
      trangThai = "xacnhan";
      nut.className = "act act--primary";
      nut.textContent = "Bấm lần nữa để xác nhận";
      canh.hidden = false;
      canh.textContent = "Con này sẽ chết và mất VĨNH VIỄN — gara không giữ hộ, admin không hoàn.";
      noi("");
      clearTimeout(henXacNhan);
      henXacNhan = setTimeout(datIdle, 10000);
    }

    function datDem(giay, met) {
      trangThai = "demnguoc";
      clearTimeout(henXacNhan); clearInterval(dongHo);
      conLai = giay;
      nut.hidden = true;
      nutHuy.hidden = false;
      canh.hidden = true;
      dem.hidden = false;
      noi("");
      // Số mét lấy TỪ MÁY CHỦ (`di_xa_m` của op `slay`). Vắng hoặc 0 (cổng tắt) thì KHÔNG nhắc
      // số mét: hứa một phép đo không chạy là nói sai với người chơi.
      const huy = met > 0 ? "Đi quá " + met + " mét hoặc mất máu trong lúc chờ là huỷ."
                          : "Mất máu trong lúc chờ là huỷ.";
      const veDem = () => {
        dem.textContent = "Còn " + conLai + " giây, ĐỨNG YÊN trong game. " + huy;
      };
      veDem();
      dongHo = setInterval(() => {
        if (--conLai > 0) { veDem(); return; }
        clearInterval(dongHo);
        datIdle();
        // Nói đúng cái mình BIẾT. Trang này không quan sát được cú đánh trong game, nên
        // không được phép khẳng định "đã chết" — vòng hỏi tiếp theo mới cho biết.
        noi("Đã hết giờ chờ. Nếu con vẫn còn thì lệnh đã bị huỷ vì bạn di chuyển hoặc mất máu trong lúc chờ.");
      }, 1000);
    }

    // 🔴 Dựng xong PHẢI gọi `datIdle()` một lần. Nút được tạo bằng `createElement` nên nó
    //    ra đời KHÔNG CÓ CHỮ và KHÔNG CÓ CLASS; mọi nhãn đều do `datIdle()` đặt. Thiếu dòng
    //    này thì thẻ hiện ra với một ô trống bấm được — đã thấy tận mắt trên bản xem thử
    //    2026-09-01 trước khi có dòng này.
    datIdle();

    nut.addEventListener("click", async () => {
      if (trangThai === "idle") { datXacNhan(); return; }
      if (trangThai !== "xacnhan") return;
      nut.disabled = true;
      try {
        const j = await goiPOST("/api/player/kill");
        if (j && j.ok) {
          datDem((typeof j.cho === "number" && j.cho > 0) ? j.cho : 30,
                 (typeof j.di_xa_m === "number" && j.di_xa_m > 0) ? j.di_xa_m : 0);
        }
        else if (j && j.err === "unknown_op") {
          // Route da co nhung plugin chua co op — thu tu deploy nguoc lai voi truong hop 404.
          // Ca hai deu la "chua bat xong", va ca hai deu KHONG phai loi cua nguoi choi.
          datIdle(); noi("Tính năng đang được bật, thử lại sau ít phút.");
          nut.hidden = true; chuaCo = true;
        } else { datIdle(); noi((j && j.res) || "Chưa kết liễu được."); }
      } catch (e) {
        datIdle();
        noi(e.message || "Không gọi được máy chủ.");
        // Chua co route -> an han nut. Mot cai nut bam vao chi de doc "chua co" thi kem hon
        // han la khong co nut nao.
        if (e.chuaCo) { nut.hidden = true; chuaCo = true; }
      }
    });

    nutHuy.addEventListener("click", async () => {
      nutHuy.disabled = true;
      try {
        const j = await goiPOST("/api/player/kill/huy");
        datIdle();
        noi((j && j.ok) ? "Đã huỷ. Dino của bạn vẫn an toàn."
                        : ((j && j.res) || "Không huỷ được."));
      } catch (e) {
        nutHuy.disabled = false;
        noi(e.message || "Không gọi được máy chủ.");
      }
    });

    return {
      /** `coDino` = đang cưỡi một con. Giữ thẻ HIỆN trong lúc đếm ngược dù người chơi đã
       *  chết giữa chừng — ẩn nó đi lúc đó là cướp mất câu trả lời "chuyện gì vừa xảy ra". */
      ve(coDino) {
        if (chuaCo) { goc.hidden = true; return; }
        goc.hidden = !(coDino || trangThai === "demnguoc");
        if (!coDino && trangThai === "xacnhan") datIdle();
      },
    };
  })();

  async function motVong() {
    let j;
    try {
      j = await layJSON("/api/player/live");
      hong = 0;
      baoLoi(false);
    } catch (e) {
      if (++hong >= 3) { baoLoi(true); return 0; }   // 0 = thôi hẹn
      return 15000;
    }

    const song = j.song || {};
    const coPlugin = !!(j.caps && j.caps.prime_conditions);

    if (song.in_game === true) {
      veDino(song, false, "Số liệu trực tiếp · cập nhật lúc " + khiNao(Date.now() / 1000));
      veDotBien(song.dot_bien);
      vePrime(song.prime, song.prime_dat, song.prime_eligible, coPlugin,
              { c6: song.c6_tt, c5: song.c5_tt, c4: song.c4_tt });
      capNhatMau(song.species, false);
      // Chỉ có `species` mới nghĩa là ĐANG CƯỠI. `in_game` vẫn đúng khi người chơi đang ở
      // màn chọn loài — hiện nút kết liễu lúc đó là mời người ta bấm để nhận một lời từ chối.
      KILL.ve(!!song.species);
    } else if (j.luc_cuoi) {
      const lc = j.luc_cuoi;
      /* 🔴 "Ngoại tuyến" là SAI với người vừa chết — họ vẫn đang kết nối, đang đứng ở
         màn chọn loài. `da_chet` do dịch vụ người chơi phát riêng cho chuyện này
         (2026-09-23); không có nó thì trang chỉ còn cách đoán, và đoán sai. */
      const daChet = song.da_chet === true;
      // Chỉ số HỎNG theo thời gian, còn danh tính thì không. Quá một tuần thì bỏ số
      // nhưng GIỮ loài/giới tính/mô hình — chúng vẫn đúng.
      const quaCu = (lc.tuoi_s || 0) > 7 * 86400;
      veDotBien(null);   // chỉ hiện cho con ĐANG chơi
      veDino(quaCu ? { species: lc.species, gender: lc.gender } : lc, true,
        quaCu
          ? (daChet ? "Con này đã chết" : "Ngoại tuyến")
            + " · số liệu quá cũ nên không hiện nữa. Lần cuối thấy bạn: " + khiNao(lc.ts)
          : (daChet ? "Con này đã chết" : "Ngoại tuyến")
            + ". Đây là con gần nhất bọn mình thấy, lúc " + khiNao(lc.ts) + ".");
      vePrime(quaCu ? null : lc.prime, lc.prime_dat, lc.prime_eligible, coPlugin,
              quaCu ? null : { c6: lc.c6_tt, c5: lc.c5_tt, c4: lc.c4_tt });
      capNhatMau(lc.species, true, lc.colors, lc.growth);
      KILL.ve(false);
    } else {
      veDotBien(null);
      veDino(null, true, song.da_chet === true
        ? "Không có dữ liệu — con của bạn đã chết."
        : "Bạn chưa vào game lần nào, hoặc bọn mình chưa kịp thấy.");
      vePrime(null, null, null, coPlugin, null);
      chu($("gara-3d-msg"), "Chưa có con nào để xem.");
      KILL.ve(false);
    }

    return Math.max(2000, (so(j.nhip_s) || 10) * 1000);
  }

  // Màu da: hỏi RIÊNG và HIẾM — mỗi lượt là một lần chạm game thread đơn luồng.
  let loaiDaHoi = null;

  // `mauLuu` chỉ có ở nhánh NGOẠI TUYẾN: đó là màu server đã giữ lại từ lần cuối đọc được.
  //
  // 🔴 Không có tham số này thì nhánh ngoại tuyến vẫn gọi `/api/player/skin` — một lượt gọi
  //    KHÔNG THỂ thành công (plugin cần một con dino đang sống mới đọc được màu), mà vẫn
  //    tiêu một suất của hạn mức 4 lượt/60 giây. Hậu quả đo được: mở trang vài lần là dính
  //    429, rồi khi vào game thật thì hết suất để hỏi màu THẬT.
  async function capNhatMau(species, ngoaiTuyen, mauLuu, growthLuu) {
    // 🔴 NGOẠI TUYẾN THÌ KHÔNG BAO GIỜ HỎI PLUGIN. Không còn con dino nào đang sống để
    //    đọc màu, nên lượt gọi đó KHÔNG THỂ thành công — nó chỉ tiêu một suất của hạn mức
    //    4 lượt/60 giây. Đo được: mở trang vài lần là dính 429, rồi lúc vào game thật thì
    //    hết suất để hỏi màu THẬT. Có màu đã lưu thì dùng; không có thì vẽ hình không màu.
    if (ngoaiTuyen) {
      // Quên "đã hỏi loài này rồi". Không quên thì lúc người chơi vào lại game với CÙNG
      // loài, hàm này thoát sớm và mô hình giữ nguyên màu ĐÃ LƯU thay vì hỏi màu SỐNG —
      // sai đúng vào trường hợp chết rồi hồi sinh với bộ da khác.
      loaiDaHoi = null;
      const coMau = species && mauLuu && typeof mauLuu === "object"
        && Object.keys(mauLuu).length;
      mauMoiNhat = coMau
        ? { species, colors: mauLuu, growth: so(growthLuu) }
        : (species ? { species, growth: so(growthLuu) } : null);
      if (mauMoiNhat) xem3D();
      return;
    }
    if (!species || species === loaiDaHoi) {
      if (!mauMoiNhat && species) mauMoiNhat = { species };
      return;
    }
    loaiDaHoi = species;
    mauMoiNhat = { species };
    try {
      const j = await layJSON("/api/player/skin");
      // Chỉ dùng màu khi plugin nói về ĐÚNG con này. Hai nguồn khác nhịp: chỉ số tới qua
      // RCON (10–30 giây), màu tới qua plugin (100 ms) — nếu chúng nói về hai con khác
      // nhau thì thà vẽ mô hình không màu còn hơn vẽ sai màu.
      if (j && j.ok && j.species === species) {
        mauMoiNhat = { species, colors: j.colors || {}, growth: so(j.growth) };
      }
    } catch (e) { /* không có màu thì vẫn vẽ được hình dạng */ }
    // Mô hình hiện NGAY, không đợi bấm. Gọi ở đây chứ không sớm hơn vì tới lúc này ta mới
    // biết CHẮC là có con nào để vẽ — nạp three.js cho một trang không có dino nào là tiêu
    // nửa MB của người dùng để hiện một khung rỗng.
    xem3D();
  }

  function hen_lai(ms) {
    if (hen) clearTimeout(hen);
    if (ms > 0) hen = setTimeout(chay, ms);
  }

  // 🔴 LẦN VẼ ĐẦU LUÔN CHẠY, KỂ CẢ KHI TAB ĐANG ẨN.
  //    Bản đầu kiểm `document.hidden` NGAY ở đầu và thoát — nên một trang mở trong tab
  //    nền (bấm giữa chuột vào link, hoặc trình duyệt khôi phục tab lúc khởi động, hoặc
  //    trình duyệt trong ứng dụng Facebook) hiện `—` MÃI MÃI cho tới khi người dùng bấm
  //    vào tab. Đo được ngay lần xem thử đầu tiên: `document.hidden === true`, trang đứng
  //    im hoàn toàn, không một lỗi nào.
  //    Ẩn tab chỉ được phép làm CHẬM vòng hỏi, không được phép chặn lần vẽ đầu.
  let daVeLanDau = false;

  // 🔴 Chỉ hỏi `/api/player/live` khi tab Khủng long ĐANG MỞ (2026-10-10). Người đang đọc
  //    bảo hiểm hay chiến tích không cần trang hỏi game mỗi vài giây, và bộ xem 3D (nửa MB)
  //    chỉ được nạp từ `capNhatMau` trong vòng này — nên nó cũng chỉ nạp khi tab mở.
  //    Đổi về tab Khủng long thì `moTab` gọi `chay()` NGAY, không đợi nhịp kế.
  let dangNhap = false;
  let dangChay = false;

  async function chay() {
    if (!dangNhap || tabDangMo !== "khung-long") { hen_lai(0); return; }
    if (dangChay) return;
    if (document.hidden && daVeLanDau) { hen_lai(15000); return; }
    dangChay = true;
    let ms = 0;
    try {
      ms = await motVong();
    } finally {
      dangChay = false;
    }
    daVeLanDau = true;
    if (tabDangMo !== "khung-long") { hen_lai(0); return; }
    hen_lai(ms > 0 ? (document.hidden ? Math.max(ms, 15000) : ms) : 0);
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) chay(); });

  // ── thanh tab ───────────────────────────────────────────────────────────
  // Ba tab, mỗi tab một neo trong hash (chỉ chữ thường + gạch nối: khung xem artifact và
  // vài trình duyệt trong ứng dụng chỉ giữ neo trần). `replaceState` để không chất lịch sử
  // "Back" theo từng lần bấm tab.
  const TAB = [
    { nut: $("t-dino"), bang: $("p-dino"), neo: "khung-long" },
    { nut: $("t-bh"), bang: $("p-bh"), neo: "bao-hiem" },
    { nut: $("t-ct"), bang: $("p-ct"), neo: "chien-tich" },
  ].filter((t) => t.nut && t.bang);
  let tabDangMo = "khung-long";

  function moTab(neo, ghiHash) {
    const t = TAB.find((x) => x.neo === neo) || TAB[0];
    if (!t) return;
    for (const x of TAB) {
      const chon = x === t;
      x.nut.setAttribute("aria-selected", chon ? "true" : "false");
      x.nut.tabIndex = chon ? 0 : -1;
      x.bang.hidden = !chon;
    }
    const doi = tabDangMo !== t.neo;
    tabDangMo = t.neo;
    window.__dino4vnMeTab = t.neo;
    if (ghiHash) {
      try { history.replaceState(null, "", "#" + t.neo); } catch (e) { /* khung xem có thể chặn */ }
    }
    if (doi || ghiHash) {
      document.dispatchEvent(new CustomEvent("dino4vn:me-tab", { detail: { tab: t.neo } }));
    }
    if (t.neo === "khung-long") chay();
  }

  TAB.forEach((t, i) => {
    t.nut.addEventListener("click", () => moTab(t.neo, true));
    t.nut.addEventListener("keydown", (e) => {
      let j = -1;
      if (e.key === "ArrowRight") j = (i + 1) % TAB.length;
      if (e.key === "ArrowLeft") j = (i - 1 + TAB.length) % TAB.length;
      if (e.key === "Home") j = 0;
      if (e.key === "End") j = TAB.length - 1;
      if (j < 0) return;
      e.preventDefault();
      TAB[j].nut.focus();
      moTab(TAB[j].neo, true);
    });
  });

  // Mở đúng tab theo hash NGAY lúc nạp (trước khi hỏi đăng nhập) để trang không chớp tab
  // Khủng long rồi mới nhảy sang tab được link tới.
  {
    const h = (location.hash || "").slice(1);
    const coNeo = TAB.some((t) => t.neo === h);
    moTab(coNeo ? h : "khung-long", false);
  }
  window.addEventListener("hashchange", () => {
    const h = (location.hash || "").slice(1);
    if (TAB.some((t) => t.neo === h)) moTab(h, false);
  });

  // ── khởi động ───────────────────────────────────────────────────────────
  (async () => {
    let me;
    try {
      // `app.js` đã hỏi `/api/player/me` một lần và treo promise lên window — dùng lại,
      // đừng hỏi lần hai (đã đo và bỏ một vòng thừa vì đúng lý do này).
      me = await (window.__dino4vnMe || layJSON("/api/player/me"));
    } catch (e) {
      me = null;
    }

    if (!me || me.logged_in !== true) {
      KHOI_ND.hidden = true;
      if (KHOI_VAO) KHOI_VAO.hidden = false;
      // Không khẳng định "bạn chưa đăng nhập" khi ta còn không hỏi được.
      if (!me) baoLoi(true);
      return;
    }

    dangNhap = true;
    chay();
    try {
      veCanhCao(await layJSON("/api/player/ho-so"));
    } catch (e) {
      veCanhCao(null);
    }
  })();
})();
