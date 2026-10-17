/* me-quyen-loi.js — tab "Bảo hiểm và ủng hộ" của /me (2026-10-10). Chỉ XEM, không có nút thao tác.
 *
 *  · Bảo hiểm: `GET /api/player/bao-hiem` — sổ lượt của panel đưa sang qua file chung. Bộ ba
 *    `luot` / `da_dung` / `con_luot` là ĐÚNG bộ admin thấy ở tab Bảo hiểm của panel; "còn X/Y"
 *    tính y như `panel/web/bao-hiem-chung.js::luotChu` (còn = max(0, luot − da_dung)).
 *  · Quyền lợi: `GET /api/donate/cua-toi` — route có sẵn của dịch vụ donate (trang /donate cũng
 *    dùng). Không hiện tổng tiền (`tong`): người dùng chốt không công khai số tiền.
 *
 * RÀNG BUỘC (giống `me.js`): không `innerHTML`, không `.style`, bật tắt bằng `.hidden`, và
 * `null` KHÔNG PHẢI `0` — số chưa biết thì nói "chưa xem được", không bao giờ in 0.
 *
 * Chỉ gọi API khi tab này mở LẦN ĐẦU; mở lại sau hơn 60 giây thì gọi lại. Tab nào đang mở là
 * do `me.js` giữ (`window.__dino4vnMeTab` + sự kiện `dino4vn:me-tab`).
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  if (!$("p-bh")) return;

  const NEO = "bao-hiem";
  const GOI_LAI_MS = 60000;

  const fNgay = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  });
  const fGio = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const laSo = (v) => typeof v === "number" && isFinite(v);
  const ngay = (ts) => fNgay.format(new Date(ts * 1000));
  /* "05/10 21:14" — Intl ghép giờ và ngày theo thứ tự của vi-VN ("21:14 05/10"), nên dựng tay
     từ từng phần để cột giờ đọc từ trái sang như các danh sách khác trên trang. */
  function ngayGio(ts) {
    const p = {};
    for (const x of fGio.formatToParts(new Date(ts * 1000))) p[x.type] = x.value;
    return p.day + "/" + p.month + " " + p.hour + ":" + p.minute;
  }

  /** Câu có phần in đậm: ["chữ", {b: "đậm"}, {a: "chữ", href}]. */
  function cau(el, phan) {
    el.textContent = "";
    for (const x of phan) {
      if (typeof x === "string") el.append(x);
      else if (x.b != null) { const b = document.createElement("b"); b.textContent = x.b; el.append(b); }
      else if (x.a) { const a = document.createElement("a"); a.textContent = x.a; a.href = x.href; el.append(a); }
    }
  }
  function chu(el, s) {
    if (!el) return;
    el.textContent = s || "";
    el.hidden = !s;
  }

  async function lay(duong) {
    try {
      const r = await fetch(duong, { credentials: "same-origin" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  // ── bảo hiểm ────────────────────────────────────────────────────────────
  const TINH = {
    tinh: ["tính 1 lượt", ""],
    khong: ["không tính lượt", " pill--mo"],
    xac_nhan: ["đang xác nhận", " pill--vang"],
  };

  function veLichSu(ls) {
    const ul = $("bh-ls");
    ul.textContent = "";
    ul.hidden = false;
    $("bh-ls-td").hidden = false;
    const ds = Array.isArray(ls) ? ls.filter((x) => x && laSo(x.luc) && TINH[x.tinh]) : [];
    if (!ds.length) {
      const li = document.createElement("li");
      li.className = "me-moc--trong";
      li.textContent = "60 ngày qua bạn chưa được hoàn con nào.";
      ul.appendChild(li);
      return;
    }
    for (const x of ds) {
      const li = document.createElement("li");
      const gio = document.createElement("span");
      gio.className = "me-moc__gio";
      gio.textContent = ngayGio(x.luc);
      const than = document.createElement("div");
      than.className = "me-moc__than";
      const p = document.createElement("p");
      p.className = "me-moc__cau";
      const loai = document.createElement("b");
      loai.textContent = x.loai || "Không rõ loài";
      p.append(loai);
      if (laSo(x.growth)) p.append(" " + Math.round(Math.max(0, Math.min(1, x.growth)) * 100) + "%");
      const pill = document.createElement("span");
      pill.className = "pill" + TINH[x.tinh][1];
      pill.textContent = TINH[x.tinh][0];
      than.append(p, pill);
      li.append(gio, than);
      ul.appendChild(li);
    }
  }

  function veLuot(luot, dung) {
    const o = $("bh-luot");
    o.textContent = "";
    o.hidden = false;
    const con = Math.max(0, luot - dung);
    o.setAttribute("aria-label", "Đã dùng " + dung + ", còn " + con + " lượt");
    for (let i = 0; i < luot; i++) {
      const s = document.createElement("span");
      const daDung = i < dung;
      s.className = "me-luot__o " + (daDung ? "me-luot__o--dung" : "me-luot__o--con");
      s.setAttribute("aria-hidden", "true");
      s.textContent = daDung ? "✕" : "";
      o.appendChild(s);
    }
    const g = document.createElement("span");
    g.className = "me-luot__ghi";
    g.textContent = "đã dùng " + dung + ", còn " + con;
    o.appendChild(g);
  }

  function veBaoHiem(j) {
    const tong = $("bh-tong");
    const luot = $("bh-luot");
    const ghi = $("bh-ghi");
    tong.className = "me-tong";
    luot.hidden = true;
    chu(ghi, "");

    const bh = j && j.ok === true && j.bao_hiem && typeof j.bao_hiem === "object" ? j.bao_hiem : null;
    if (!bh || bh.co === null || bh.co === undefined) {
      tong.className = "me-tong canhbao";
      tong.textContent = "Chưa xem được bảo hiểm lúc này, thử lại sau ít phút.";
      // Lịch sử hoàn là sổ của panel, vẫn đúng khi dịch vụ donate không trả lời.
      if (bh && Array.isArray(bh.ls)) veLichSu(bh.ls);
      else {
        // Không đọc được gì cả: không có lịch sử nào để nói, ẩn luôn tiêu đề của nó.
        $("bh-ls").hidden = true;
        $("bh-ls-td").hidden = true;
      }
      return;
    }
    veLichSu(bh.ls);

    if (bh.co === false) {
      cau(tong, ["Bạn chưa có bảo hiểm khủng long. ", { a: "Xem các mốc ủng hộ", href: "/donate" }]);
      return;
    }

    const den = laSo(bh.den) && bh.den > 0 ? ngay(bh.den) : "";
    const ky = bh.ky && typeof bh.ky === "object" ? bh.ky : null;
    const biet = ky && laSo(bh.luot) && laSo(bh.da_dung) && typeof bh.con_luot === "boolean";
    const dau = den ? ["Bảo hiểm còn tới ", { b: den }] : ["Bạn đang có bảo hiểm khủng long"];
    if (!biet) {
      cau(tong, dau.concat([". Chưa xem được số lượt hoàn lúc này."]));
    } else if (bh.con_luot) {
      cau(tong, dau.concat([", chu kỳ này còn ",
        { b: Math.max(0, bh.luot - bh.da_dung) + "/" + bh.luot }, " lượt hoàn."]));
    } else {
      cau(tong, dau.concat([", nhưng chu kỳ này đã hết lượt hoàn (",
        { b: bh.da_dung + "/" + bh.luot }, ")."]));
    }
    if (biet && bh.luot > 0) {
      veLuot(bh.luot, Math.max(0, bh.da_dung));
      if (laSo(ky.tu) && ky.tu > 0) chu(ghi, "Chu kỳ bắt đầu " + ngay(ky.tu) + ".");
    }
    if (j.trang_thai === "qua_cu") chu(ghi, (ghi.textContent ? ghi.textContent + " " : "") + "Số liệu hơi cũ.");
  }

  // ── quyền lợi ủng hộ ────────────────────────────────────────────────────
  function veQuyenLoi(d) {
    const tong = $("ql-tong");
    const ds = $("ql-ds");
    const ghi = $("ql-ghi");
    tong.className = "me-tong";
    ds.textContent = "";
    ds.hidden = true;
    chu(ghi, "");

    if (!d || d.ok !== true) {
      tong.className = "me-tong canhbao";
      tong.textContent = "Chưa xem được quyền lợi ủng hộ lúc này, thử lại sau ít phút.";
      return;
    }
    const bayGio = Date.now() / 1000;
    const muc = d.co === true && laSo(d.muc) ? d.muc : 0;
    if (!muc) {
      tong.textContent = "Bạn chưa có mốc ủng hộ nào.";
      if (laSo(d.o_gara) && d.o_gara > 0) chu(ghi, "Gara của bạn đang có " + d.o_gara + " ô.");
      return;
    }
    const han = laSo(d.han) && d.han > 0 ? d.han : 0;
    const ten = typeof d.ten === "string" && d.ten ? d.ten : "ủng hộ";
    cau(tong, han ? ["Mốc ", { b: ten }, ", quyền lợi tới ", { b: ngay(han) }, "."]
                  : ["Mốc ", { b: ten }, "."]);

    const muc_ = [];
    if (laSo(d.o_gara) && d.o_gara > 0) muc_.push(d.o_gara + " ô gara");
    if (d.uu_tien === true) muc_.push("Vào thẳng server khi đông, không phải xếp hàng");
    if (d.bao_hiem === true) muc_.push("Bảo hiểm khủng long");
    for (const x of muc_) {
      const li = document.createElement("li");
      li.textContent = x;
      ds.appendChild(li);
    }
    ds.hidden = !muc_.length;

    if (d.da_lam_moi === true && laSo(d.bh_den) && d.bh_den > 0) {
      chu(ghi, "Đã gia hạn bảo hiểm tới " + ngay(d.bh_den) + ".");
    } else if (d.gia_han_mo === true) {
      chu(ghi, "Đang trong thời gian gia hạn.");
    } else if (han && laSo(d.gia_han_tu) && d.gia_han_tu > bayGio) {
      chu(ghi, "Gia hạn được từ " + ngay(d.gia_han_tu) + ".");
    }
  }

  // ── khi nào gọi ─────────────────────────────────────────────────────────
  let lanCuoi = 0;
  let dangGoi = false;

  async function khiMo() {
    if (dangGoi) return;
    if (lanCuoi && Date.now() - lanCuoi < GOI_LAI_MS) return;
    let me = null;
    try { me = await (window.__dino4vnMe || lay("/api/player/me")); } catch (e) { me = null; }
    if (!me || me.logged_in !== true) return;   // `me.js` đã hiện khối "Đăng nhập bằng Steam"
    dangGoi = true;
    lanCuoi = Date.now();
    try {
      const [bh, dn] = await Promise.all([lay("/api/player/bao-hiem"), lay("/api/donate/cua-toi")]);
      veBaoHiem(bh);
      veQuyenLoi(dn);
    } finally {
      dangGoi = false;
    }
  }

  document.addEventListener("dino4vn:me-tab", (e) => {
    if (e.detail && e.detail.tab === NEO) khiMo();
  });
  if (window.__dino4vnMeTab === NEO) khiMo();
})();
