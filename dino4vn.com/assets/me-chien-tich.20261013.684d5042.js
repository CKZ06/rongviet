/* me-chien-tich.js — tab "Chiến tích" của /me (2026-10-10).
 *
 *  · Trái: trận 14 ngày qua — `GET /api/player/chien-tich` (≤ 30 trận, mới nhất trước; số
 *    "hạ / bị hạ" là đếm trên CẢ 14 ngày).
 *  · Phải: "Chi tiết pha" — bảng TỪNG CÚ của trận đang chọn, lấy LƯỜI theo id
 *    (`GET /api/player/chien-tich/<id>`), nhớ trong phiên trang. Không còn biểu đồ (người dùng
 *    chốt "theo từng cú đánh, bỏ cái biểu đồ đi").
 *
 * AI LÀ AI (người dùng chốt 2026-10-10): "Bạn" là nhãn `.me-ai--ban`; người chơi khác hiện
 * bằng SteamID ĐỦ 17 SỐ trong nhãn `.me-ai--khac`; AI là `.me-ai--may`. Không hiện tên.
 *
 * MỘT DÒNG CỦA BẢNG (`dong[]`, server đã dịch sẵn góc nhìn): `ke`/`nn` ∈ "b" (người xem),
 * "d" (đối thủ của pha), SteamID (người thứ ba), "ai:<Loài>", "" (không có kẻ);
 * `kieu`: "d" cú trực tiếp (máu = HP) · "m" chảy máu (đơn vị BLOOD, khác HP — ghi "huyết",
 * cột % không đổi) · "x" mất HP không rõ đòn (bám, vồ…) · "c" đòn kết liễu không có trong
 * nhật ký (máu "không ghi"). `pb`/`pd` = % HP của người xem / đối thủ SAU dòng đó; null = chưa
 * biết ⇒ "—", không bao giờ 0.
 *
 * RÀNG BUỘC (giống `me.js`): không `innerHTML`, không `.style`, bật tắt bằng `.hidden`.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  if (!$("p-ct")) return;

  const NEO = "chien-tich";
  const GOI_LAI_MS = 60000;
  const RE_SID = /^7656\d{13}$/;

  const fGio = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const laSo = (v) => typeof v === "number" && isFinite(v);
  const so = (n) => Math.round(n).toLocaleString("vi-VN");
  function ngayGio(ms) {
    const p = {};
    for (const x of fGio.formatToParts(new Date(ms))) p[x.type] = x.value;
    return p.day + "/" + p.month + " " + p.hour + ":" + p.minute;
  }
  const phut = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const pt = (g) => (laSo(g) ? " " + Math.round(Math.max(0, Math.min(1, g)) * 100) + "%" : "");

  function the(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function them(el, phan) {
    for (const x of phan) el.append(x);
    return el;
  }
  function cau(el, phan) {
    el.textContent = "";
    for (const x of phan) {
      if (typeof x === "string") el.append(x);
      else if (x && x.b != null) el.append(the("b", null, x.b));
      else if (x) el.append(x);
    }
  }

  async function lay(duong) {
    try {
      const r = await fetch(duong, { credentials: "same-origin" });
      if (!r.ok) return { loi: r.status };
      return await r.json();
    } catch (e) {
      return { loi: 0 };
    }
  }

  // ── trạng thái ──────────────────────────────────────────────────────────
  let ds = [];            // các trận hợp lệ
  // Số đếm 14 ngày THẬT của server (đếm trên mọi trận, không chỉ các trận trong `ds`). null = không biết.
  let demTran = { ha: null, bi: null };
  let loc = "tat";        // tat | ha | bi
  let chon = null;        // id trận đang chọn
  const chiTiet = new Map();   // id -> phản hồi chi tiết ĐỦ ("du"), chỉ nhớ bản đủ

  // ── nhãn ai là ai ───────────────────────────────────────────────────────
  /** Nhãn cho một vai trong trận `r`: "b" = Bạn, "d" = đối thủ, SteamID, "ai:<Loài>". */
  function nhan(r, k) {
    if (k === "b") return the("span", "me-ai me-ai--ban", "Bạn");
    if (k === "d") {
      if (RE_SID.test(r.doi || "")) return the("span", "me-ai me-ai--khac", r.doi);
      return the("span", "me-ai me-ai--may", "AI " + (r.doi_loai || "khủng long"));
    }
    if (typeof k === "string" && k.startsWith("ai:")) return the("span", "me-ai me-ai--may", "AI " + k.slice(3));
    if (RE_SID.test(k || "")) return the("span", "me-ai me-ai--khac", k);
    return the("span", "me-ai me-ai--may", "Không rõ");
  }
  const loaiNgoac = (loai, g) => the("span", "me-moc__loai", "(" + (loai || "không rõ loài") + pt(g) + ")");

  /** Câu một trận: "[Hạ] [Bạn] (Allosaurus 76%) hạ [7656…] (Carnotaurus 54%)." */
  function cauTran(r) {
    const p = the("span", "me-moc__cau");
    const pill = the("span", "pill" + (r.vai === "ha" ? " pill--luc" : ""), r.vai === "ha" ? "Hạ" : "Bị hạ");
    const ai = !RE_SID.test(r.doi || "");
    const doi = ai ? [nhan(r, "d"), pt(r.doi_g) ? " (" + pt(r.doi_g).trim() + ")" : ""]
                   : [nhan(r, "d"), " ", loaiNgoac(r.doi_loai, r.doi_g)];
    const ta = [nhan(r, "b"), " ", loaiNgoac(r.ta_loai, r.ta_g)];
    if (r.vai === "ha") return them(p, [pill, " "].concat(ta, [" hạ "], doi, ["."]));
    if (r.cach === "PTERA_THA") {
      return them(p, [pill, " "].concat(doi, [" quắp thả ", nhan(r, "b"), " rơi ", loaiNgoac(r.ta_loai, r.ta_g), "."]));
    }
    if (r.cach === "NGAM") return them(p, [pill, " "].concat(doi, [" ngậm "], ta, [" tới chết."]));
    return them(p, [pill, " "].concat(doi, [" hạ "], ta, [r.cach === "CRUSH" ? " bằng Crush." : "."]));
  }

  /** Câu khi pha KHÔNG có bảng cú (theo `tt`), null nếu có. */
  function cauKhongSo(r, tt) {
    if (tt === "du") return null;
    if (tt === "dang") return "Đang tính số đòn cho pha này, quay lại sau ít phút.";
    if (tt === "het_han") return "Pha này đã quá cũ, không còn số đòn.";
    if (r.cach === "PTERA_THA" && r.vai === "bi") return "Bạn chết do rơi, pha này không có đòn đánh nào.";
    return "Không có đòn đánh nào được ghi cho pha này.";
  }
  function dongPhu(r) {
    const p = the("span", "me-moc__phu");
    if (r.tt === "du" && laSo(r.gay) && laSo(r.nhan)) {
      cau(p, ["gây ", { b: so(r.gay) }, ", nhận ", { b: so(r.nhan) }]);
    } else if (r.tt === "dang") p.textContent = "đang tính";
    else if (r.tt === "het_han") p.textContent = "không còn số đòn";
    else if (r.cach === "PTERA_THA" && r.vai === "bi") p.textContent = "chết do rơi";
    else p.textContent = "không có số đòn";
    return p;
  }

  // ── danh sách trận ──────────────────────────────────────────────────────
  function hopLe(r) {
    return r && laSo(r.id) && r.id > 0 && laSo(r.t) && (r.vai === "ha" || r.vai === "bi")
      && typeof r.tt === "string";
  }

  function veDanhSach() {
    const ol = $("tr-ds");
    ol.textContent = "";
    const hien = ds.filter((r) => loc === "tat" || r.vai === loc);
    if (!hien.length) {
      // 🔴 `ds` chỉ là các trận GẦN NHẤT; số 14 ngày là `demTran`. Lọc rỗng mà số đếm > 0 thì chỉ được nói
      //    về các trận đang hiện — nói "14 ngày qua bạn chưa hạ ai" là cãi lại chính dòng tổng phía trên.
      const dem = loc === "ha" ? demTran.ha : demTran.bi;
      const li = the("li", "me-moc--trong", loc === "tat" ? "Chưa có trận nào để hiện."
        : dem === 0 ? (loc === "ha" ? "14 ngày qua bạn chưa hạ ai." : "14 ngày qua bạn chưa bị ai hạ.")
        : so(ds.length) + (loc === "ha" ? " trận gần nhất không có trận nào bạn hạ."
          : " trận gần nhất không có trận nào bạn bị hạ."));
      ol.appendChild(li);
      $("pha").hidden = true;
      return;
    }
    if (!hien.some((r) => r.id === chon)) chon = hien[0].id;
    for (const r of hien) {
      const li = the("li");
      const b = the("button", "me-tran__nut");
      b.type = "button";
      b.setAttribute("aria-pressed", r.id === chon ? "true" : "false");
      b.setAttribute("aria-controls", "pha");
      const than = the("span", "me-moc__than");
      than.append(cauTran(r), dongPhu(r));
      b.append(the("span", "me-moc__gio", ngayGio(r.t)), than);
      b.addEventListener("click", () => {
        chon = r.id;
        for (const x of ol.querySelectorAll(".me-tran__nut")) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        }
        vePha();
        if (window.matchMedia("(max-width: 959px)").matches) $("pha").scrollIntoView({ block: "start" });
      });
      li.appendChild(b);
      ol.appendChild(li);
    }
    $("pha").hidden = false;
    vePha();
  }

  function veTong(j) {
    const tong = $("tr-tong");
    const locEl = $("tr-loc");
    const ol = $("tr-ds");
    tong.className = "me-tong";
    const ch = j && j.ok === true && j.chien && typeof j.chien === "object" ? j.chien : null;
    if (!ch) {
      tong.className = "me-tong canhbao";
      tong.textContent = "Chưa xem được chiến tích lúc này, thử lại sau ít phút.";
      locEl.hidden = true; ol.hidden = true; $("pha").hidden = true;
      return;
    }
    ds = (Array.isArray(ch.ds) ? ch.ds : []).filter(hopLe);
    const ha = laSo(ch.ha) ? ch.ha : null;
    const bi = laSo(ch.bi_ha) ? ch.bi_ha : null;
    demTran = { ha, bi };
    if (!ds.length && ha === 0 && bi === 0) {
      tong.textContent = "14 ngày qua bạn chưa hạ ai và chưa bị ai hạ.";
      locEl.hidden = true; ol.hidden = true; $("pha").hidden = true;
      return;
    }
    if (ha !== null && bi !== null) {
      cau(tong, ["14 ngày qua bạn hạ ", { b: so(ha) }, " con và bị hạ ", { b: so(bi) }, " lần."]);
    } else {
      tong.textContent = "Trận 14 ngày qua của bạn.";
    }
    if (j.trang_thai === "qua_cu") tong.append(" Số liệu hơi cũ.");
    locEl.hidden = false;
    ol.hidden = false;
    veDanhSach();
  }

  // ── chi tiết pha ────────────────────────────────────────────────────────
  const CACH_CUOI = {
    CRUSH: (a, b) => [a, " hạ ", b, " bằng Crush"],
    NGAM: (a, b) => [a, " ngậm ", b, " tới chết"],
    PTERA_THA: (a, b) => [a, " quắp thả ", b, " rơi"],
  };
  const TRUOC_CUOI = { CRUSH: " trước đòn Crush", NGAM: " trước khi bị ngậm", PTERA_THA: " trước khi bị quắp thả" };

  function hopLeDong(x) {
    return x && laSo(x.s) && (x.nn === "b" || x.nn === "d") && ["d", "m", "x", "c"].includes(x.kieu);
  }
  const ptO = (v) => (laSo(v) ? Math.round(v) + "%" : "—");

  function dongBang(r, x) {
    const pNn = x.nn === "b" ? x.pb : x.pd;
    const ha = (x.kieu === "d" || x.kieu === "x") && laSo(pNn) && pNn <= 0;
    const tr = the("tr", x.kieu === "m" ? "me-cu--mau" : (ha || x.kieu === "c") ? "me-cu--ha" : null);
    tr.append(the("td", "me-cu__s", laSo(x.den) && x.den > x.s ? phut(x.s) + "–" + phut(x.den) : phut(x.s)));
    const don = the("td", "me-cu__don");
    const ke = x.ke ? nhan(r, x.ke) : null;
    if (x.kieu === "m") them(don, [nhan(r, x.nn), " chảy máu"]);
    else if (x.kieu === "x") them(don, [nhan(r, x.nn), " mất máu không rõ đòn"]);
    else if (x.kieu === "c") {
      const a = ke || nhan(r, x.nn === "b" ? "d" : "b");
      them(don, (CACH_CUOI[r.cach] || ((p, q) => [p, " hạ ", q]))(a, nhan(r, x.nn)));
    } else them(don, [ke || nhan(r, "d"), ha ? " hạ " : " đánh ", nhan(r, x.nn)]);
    tr.append(don);
    let mau;
    if (x.kieu === "c") mau = the("td", "me-cu__so me-cu__ghi", "không ghi");
    else if (!laSo(x.mau)) mau = the("td", "me-cu__so me-cu__ghi", "—");
    else if (x.kieu === "m") mau = the("td", "me-cu__so me-cu__mau", so(x.mau) + " huyết");
    else mau = the("td", "me-cu__so me-cu__mau", so(x.mau));
    tr.append(mau);
    const tut = x.kieu !== "m";
    tr.append(the("td", "me-cu__so me-cu__hp" + (tut && x.nn === "b" ? " me-cu__hp--tut" : ""), ptO(x.pb)));
    tr.append(the("td", "me-cu__so me-cu__hp" + (tut && x.nn === "d" ? " me-cu__hp--tut" : ""), ptO(x.pd)));
    return tr;
  }

  function veBang(r, d) {
    const dong = (Array.isArray(d.dong) ? d.dong : []).filter(hopLeDong);
    const tong = $("pha-tong");
    const khung = $("pha-cu");
    const khac = $("pha-khac");
    const ghi = $("pha-ghi");
    if (!dong.length) {
      tong.textContent = cauKhongSo(r, "khong_co");
      khung.hidden = true; khac.hidden = true; ghi.hidden = true;
      return;
    }
    let gay = 0, nhan_ = 0;
    const nguoiKhac = new Map();       // ke -> {b: máu vào Bạn, d: máu vào đối thủ}
    let cuoi = null;
    for (const x of dong) {
      if (x.kieu === "c") cuoi = x;
      if (!laSo(x.mau)) continue;
      if (x.kieu === "d" && x.ke === "b" && x.nn === "d") gay += x.mau;
      if ((x.kieu === "d" || x.kieu === "x") && x.nn === "b") nhan_ += x.mau;
      if (x.kieu === "d" && x.ke && x.ke !== "b" && x.ke !== "d") {
        const g = nguoiKhac.get(x.ke) || { b: 0, d: 0 };
        g[x.nn] += x.mau;
        nguoiKhac.set(x.ke, g);
      }
    }
    const dur = laSo(d.dur) ? Math.max(0, Math.round(d.dur)) : 0;
    const phan = dur >= 1 ? ["Pha kéo dài ", { b: so(dur) + " giây" }, ". "] : ["Pha diễn ra chưa tới 1 giây. "];
    phan.push("Bạn gây ", { b: so(gay) }, " máu");
    if (cuoi && cuoi.nn === "d" && TRUOC_CUOI[r.cach]) phan.push(TRUOC_CUOI[r.cach]);
    phan.push(", nhận ", { b: so(nhan_) });
    if (cuoi && cuoi.nn === "b" && TRUOC_CUOI[r.cach]) phan.push(TRUOC_CUOI[r.cach]);
    phan.push(".");
    cau(tong, phan);

    const tb = $("pha-bang");
    tb.textContent = "";
    for (const x of dong) tb.appendChild(dongBang(r, x));
    khung.hidden = false;
    khung.scrollTop = 0;

    khac.textContent = "";
    khac.hidden = false;
    if (nguoiKhac.size) {
      khac.append("Người khác cùng đánh: ");
      let i = 0;
      for (const [ke, g] of nguoiKhac) {
        if (i++) khac.append("; ");
        const muc = [];
        if (g.b > 0) muc.push([" đánh ", nhan(r, "b"), " ", the("b", null, so(g.b)), " máu"]);
        if (g.d > 0) muc.push([(g.b > 0 ? ", " : " ") + "đánh ", nhan(r, "d"), " ", the("b", null, so(g.d)), " máu"]);
        khac.append(nhan(r, ke));
        // Loài của người thứ ba (server chỉ gửi khi đọc được từ nhật ký trận).
        const loaiKhac = d.khac && typeof d.khac[ke] === "string" ? d.khac[ke] : "";
        if (loaiKhac) khac.append(" (" + loaiKhac + ")");
        for (const m of muc) them(khac, m);
      }
      khac.append(".");
    } else {
      khac.textContent = "Không ai khác nhảy vào pha này.";
    }
    const cat = laSo(d.cat) && d.cat > 0 ? d.cat : 0;
    ghi.textContent = cat ? "Pha dài, bảng chỉ giữ các cú cuối (bỏ " + so(cat) + " dòng đầu)." : "";
    ghi.hidden = !cat;
  }

  let luotVe = 0;
  async function vePha() {
    const r = ds.find((x) => x.id === chon);
    if (!r) return;
    const dau = $("pha-dau");
    dau.textContent = "";
    dau.append(the("span", "me-pha__gio", ngayGio(r.t)), cauTran(r));
    const tong = $("pha-tong");
    const khung = $("pha-cu");
    const khac = $("pha-khac");
    const ghi = $("pha-ghi");
    khung.hidden = true; khac.hidden = true; ghi.hidden = true;

    const loi = cauKhongSo(r, r.tt);
    if (loi) { tong.textContent = loi; return; }
    let d = chiTiet.get(r.id);
    if (!d) {
      tong.textContent = "Đang tải các cú đánh…";
      const ve = ++luotVe;
      d = await lay("/api/player/chien-tich/" + encodeURIComponent(String(r.id)));
      if (ve !== luotVe || chon !== r.id) return;      // người xem đã chọn trận khác
      if (!d || d.ok !== true) {
        tong.textContent = "Chưa xem được chi tiết pha này, thử lại sau ít phút.";
        return;
      }
      if (d.tt === "du") chiTiet.set(r.id, d);
    }
    const loi2 = cauKhongSo(r, d.tt || "khong_co");
    if (loi2) { tong.textContent = loi2; return; }
    veBang(r, d);
  }

  // ── bộ lọc ──────────────────────────────────────────────────────────────
  {
    const nut = Array.from($("tr-loc").querySelectorAll("[role=tab]"));
    const chonLoc = (b) => {
      for (const x of nut) {
        const c = x === b;
        x.setAttribute("aria-selected", c ? "true" : "false");
        x.tabIndex = c ? 0 : -1;
      }
      loc = b.dataset.loc || "tat";
      veDanhSach();
    };
    nut.forEach((b, i) => {
      b.addEventListener("click", () => chonLoc(b));
      b.addEventListener("keydown", (e) => {
        let j = -1;
        if (e.key === "ArrowRight") j = (i + 1) % nut.length;
        if (e.key === "ArrowLeft") j = (i - 1 + nut.length) % nut.length;
        if (j < 0) return;
        e.preventDefault();
        nut[j].focus();
        chonLoc(nut[j]);
      });
    });
  }

  // ── khi nào gọi ─────────────────────────────────────────────────────────
  let lanCuoi = 0;
  let dangGoi = false;

  async function khiMo() {
    if (dangGoi) return;
    if (lanCuoi && Date.now() - lanCuoi < GOI_LAI_MS) return;
    let me = null;
    try { me = await (window.__dino4vnMe || lay("/api/player/me")); } catch (e) { me = null; }
    if (!me || me.logged_in !== true) return;
    dangGoi = true;
    lanCuoi = Date.now();
    try {
      veTong(await lay("/api/player/chien-tich"));
    } finally {
      dangGoi = false;
    }
  }

  document.addEventListener("dino4vn:me-tab", (e) => {
    if (e.detail && e.detail.tab === NEO) khiMo();
  });
  if (window.__dino4vnMeTab === NEO) khiMo();
})();
