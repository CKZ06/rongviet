/* app.js — chạy ở MỌI trang.
 *
 * Ba việc:
 *   1. Trạng thái server (/api/status.json): thẻ lớn trang chủ + phát cho script khác
 *      (`window.__dino4vnTT`, /map dùng). Thanh app KHÔNG còn hiện "N/M người đang chơi"
 *      (chủ server bỏ 2026-09-27) — số người chỉ còn là tiêu đề trang chủ.
 *   2. Trạng thái đăng nhập trên thanh app (/api/player/me)
 *   3. Bảng "mọi người đang chơi loài gì" ở trang chủ (`speciesLive`)
 *
 * Từ 2026-09-14 file này KHÔNG còn đổ số liệu Game.ini (`data-cfg`) vào trang nào:
 * chủ server chốt không công khai cấu hình server trên web. Đừng thêm lại.
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 BA KỶ LUẬT KHÔNG ĐƯỢC PHÁ
 * ════════════════════════════════════════════════════════════════════════
 * 1. `players === null` NGHĨA LÀ "KHÔNG HỎI ĐƯỢC", khác hẳn `0` ("đã hỏi,
 *    không có ai"). Trộn hai cái đó lại là BỊA SỐ.
 * 2. Số cũ còn tệ hơn không có số. Quá `QUA_CU` thì thôi hiện, đừng đoán.
 * 3. Dựng DOM bằng `textContent`, KHÔNG BAO GIỜ `innerHTML`. CSP chặn
 *    `<script>` inline nhưng KHÔNG chặn `innerHTML` chèn `<img onerror>`,
 *    và tên người chơi là dữ liệu do người lạ đặt.
 *
 * Bản trước (`status.js`) có HAI `return` sớm khi trang không có thẻ trạng
 * thái, nên mọi phần phía sau đứng yên trên các trang khác. Bản này tách hẳn:
 * thiếu phần tử nào thì bỏ qua đúng phần đó, không thoát cả file.
 */
(() => {
  'use strict';

  /* i18n: KHOÁ = CHÍNH CÂU TIẾNG VIỆT. `T('Đang chạy')` trả nguyên câu Việt trên trang Việt; trên trang
     `<html lang="en">` tra `window.D4V_EN` (các tệp `i18n.en.*.js`, nạp đồng bộ TRƯỚC file này) và
     rơi về câu Việt nếu thiếu — thiếu bản dịch là chữ Việt lộ ra, không phải chữ rỗng. Tham số:
     `T('{n} người đang chơi', { n: 5 })`, `{n}` đứng cùng tên ở cả khoá lẫn bản dịch.
     🔴 Chỉ truyền VĂN BẢN CỐ ĐỊNH làm khoá (literal), không ghép chuỗi: bộ kiểm
     `tools/kiem-i18n-web.py` gom khoá bằng cách đọc literal. */
  if (!window.D4V_T) {
    const en = document.documentElement.lang === 'en';
    window.D4V_T = (khoa, tham) => {
      let c = (en && window.D4V_EN && window.D4V_EN[khoa]) || khoa;
      if (tham) c = c.replace(/\{(\w+)\}/g, (m, k) => (k in tham ? String(tham[k]) : m));
      return c;
    };
  }
  const T = window.D4V_T;

  const API_TT = '/api/status.json';
  const API_ME = '/api/player/me';
  const NHIP    = 30000;   // nhịp hỏi lại trạng thái
  const QUA_CU  = 180000;  // JSON cũ hơn 3 phút -> thôi hiện số
  const LECH    = 120000;  // dung sai đồng hồ máy người đọc (cả hai chiều)
  const CHO     = 8000;

  const $ = (id) => document.getElementById(id);
  const dat = (el, chu) => { if (el && el.textContent !== chu) el.textContent = chu; };

  /* Luôn in giờ Việt Nam, không phụ thuộc múi giờ máy người đọc. */
  let hhmm;
  try {
    const f = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
    });
    hhmm = (d) => f.format(d);
  } catch { hhmm = (d) => d.toISOString().slice(11, 16); }

  async function nap(duong) {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), CHO);
    try {
      const r = await fetch(duong, { signal: bo.signal, credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(h); }
  }

  /* Lời hứa DÙNG CHUNG cho cả trang — xem ghi chú đầy đủ ở `nhipTaiKhoan()`.
     `.catch` đặt ở đây, không phải ở chỗ dùng: promise bị từ chối mà chưa ai
     `await` sẽ nổ `unhandledrejection` ngay khi dịch vụ người chơi chết. */
  window.__dino4vnMe = nap(API_ME).catch(() => null);

  /* ── 1. Trạng thái server ─────────────────────────────────────────────── */
  let cuoi = null;

  /* Số người đứng trong hàng chờ — CHỈ khi là số nguyên dương, ngoài ra 0.
     `null`/vắng = poller không hỏi được; 0 = không ai chờ. Cả hai đều ẩn (người
     dùng chốt 2026-09-13: hàng chờ bằng 0 thì không nói gì), nhưng là vì hai lý
     do khác nhau — đừng dùng hàm này ở chỗ cần phân biệt hai trường hợp đó. */
  const soCho = (d) => (Number.isInteger(d.queueLength) && d.queueLength > 0
    ? d.queueLength : 0);

  /* Thẻ trạng thái lớn ở trang chủ (không phải trang nào cũng có). */
  function veTheLon(d) {
    const chinh = $('tth-chinh');
    if (!chinh) return;
    const phu = $('tth-phu'), meta = $('tth-meta'), ten = $('tth-ten');
    const t = d && d.updatedAt ? Date.parse(d.updatedAt) : Date.now();
    const tuoi_ok = !!(d && (d.online === true || d.ok === true));

    if (d && (d.name || d.server_display || d.server)) dat(ten, d.name || d.server_display || d.server);
    /* "trên đảo Gateway" chỉ đúng khi có số sống. Bảo trì hay số cũ mà vẫn hiện thì
       tiêu đề thành "Đang bảo trì trên đảo Gateway" — một câu nói sai. */
    const dao = $('tth-dao');
    if (dao) dao.hidden = !(tuoi_ok && (d.online === true || d.ok === true));
    if (!tuoi_ok) {
      dat(chinh, T('Chưa rõ trạng thái'));
      dat(phu, T('Không lấy được số liệu mới. Hỏi ở Discord nếu cần gấp.'));
      dat(meta, '');
      return;
    }
    if (d.online !== true && d.ok !== true) {
      dat(chinh, T('Đang bảo trì'));
      dat(phu, T('Server sẽ quay lại sau ít phút. Thông báo chi tiết ở Discord.'));
      dat(meta, T('Cập nhật lúc {gio} giờ Việt Nam', { gio: hhmm(new Date(t)) }));
      return;
    }
    if (typeof d.players !== 'number') {
      dat(chinh, T('Đang chạy'));
      dat(phu, T('Chưa đếm được số người lúc này.'));
    } else {
      const toi = typeof d.maxPlayers === 'number' ? d.maxPlayers : (typeof d.max_players === 'number' ? d.max_players : 200);
      const trong = toi ? toi - d.players : null;
      /* Dưới 8 người thì đếm CHỖ TRỐNG nghe mời gọi hơn là đếm người —
         nhưng luôn nêu cả hai con số để không ai thấy bị giấu. */
      dat(chinh, d.players < 8 && trong !== null
        ? T('Còn {n} chỗ trống', { n: trong }) : T('{n} người đang chơi', { n: d.players }));
      /* Ẩn dòng thông tin slot/mật khẩu theo yêu cầu */
      dat(phu, '');
    }
    dat(meta, T('Cập nhật lúc {gio} giờ Việt Nam', { gio: hhmm(new Date(t)) }));
  }

  /* ── 3. Bảng "mọi người đang chơi loài gì" (trang chủ) ─────────────────
     Thay danh sách 20 tên loài kèm huy hiệu số không nhãn (2026-09-14). Chỉ loài CÓ
     người mới lên bảng, xếp đông trước; quá `TOP_LOAI` thì gộp thành "N loài khác".
     Thanh vẽ bằng thuộc tính `width` của <rect> SVG — CSP `style-src 'self'` và quy
     ước repo cấm `.style`. Không cần `config`: dữ liệu là `speciesLive`.
     Số cũ còn tệ hơn không có số: quá `QUA_CU` hoặc server không chạy thì nói thật. */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TOP_LOAI = 9;

  function thanhSvg(phan) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'dieu-tra__thanh');
    svg.setAttribute('viewBox', '0 0 100 8');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const nen = document.createElementNS(SVG_NS, 'rect');
    nen.setAttribute('class', 'dieu-tra__nen');
    nen.setAttribute('width', '100');
    nen.setAttribute('height', '8');
    const day = document.createElementNS(SVG_NS, 'rect');
    day.setAttribute('class', 'dieu-tra__dat');
    day.setAttribute('width', String(phan));
    day.setAttribute('height', '8');
    svg.append(nen, day);
    return svg;
  }

  function veDieuTra(d) {
    const ds = $('dieu-tra-ds');
    /* Kiểm cả `replaceChildren`: harness node của `test_web_hangcho.py` giả mọi id bằng một
       đối tượng tối thiểu. Thiếu phép kiểm này thì test chết vì một trang không liên quan. */
    if (!ds || typeof ds.replaceChildren !== 'function') return;
    const ghi = $('dieu-tra-ghi');
    const t = d && d.updatedAt ? Date.parse(d.updatedAt) : Date.now();
    const tuoi_ok = !!(d && (d.online === true || d.ok === true));
    const song = (d && (d.online === true || d.ok === true) && (d.speciesLive || d.top_species))
      ? (d.speciesLive || d.top_species) : null;

    if (!song) {
      ds.replaceChildren();
      dat(ghi, (d && d.online === false && tuoi_ok)
        ? T('Server đang bảo trì.') : T('Chưa lấy được số người theo loài lúc này.'));
      return;
    }
    const rawEntries = Array.isArray(song)
      ? song.map((s, idx) => [s, Math.max(1, 10 - idx)])
      : Object.entries(song);
    const co = rawEntries
      .map(([ten, n]) => [ten, Number(n) || 0])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!co.length) {
      ds.replaceChildren();
      dat(ghi, T('Chưa ai chọn loài nào lúc này.'));
      return;
    }

    const dong = co.slice(0, TOP_LOAI);
    const con = co.slice(TOP_LOAI);
    if (con.length) dong.push([T('{n} loài khác', { n: con.length }), con.reduce((tong, [, n]) => tong + n, 0)]);
    const lonNhat = Math.max(...dong.map(([, n]) => n));

    const manh = document.createDocumentFragment();
    for (const [ten, n] of dong) {
      const li = document.createElement('li');
      li.className = 'dieu-tra__dong';
      const tenEl = document.createElement('span');
      tenEl.className = 'dieu-tra__ten';
      tenEl.textContent = ten;
      const so = document.createElement('span');
      so.className = 'dieu-tra__so';
      so.textContent = String(n);
      so.setAttribute('aria-label', T('{n} người', { n }));
      li.append(tenEl, thanhSvg(Math.max(2, Math.round((n / lonNhat) * 100))), so);
      manh.appendChild(li);
    }
    ds.replaceChildren(manh);
    const tong = co.reduce((cong, [, n]) => cong + n, 0);
    dat(ghi, T('{tong} người đã chọn loài. Cập nhật lúc {gio} giờ Việt Nam.', { tong, gio: hhmm(new Date(Number.isFinite(t) ? t : Date.now())) }));
  }

  async function nhipTrangThai() {
    try {
      cuoi = await nap(API_TT);
    } catch {
      /* Fetch hỏng: vẽ lại từ payload cuối. Dấu thời gian vẫn già đi, nên sau
         QUA_CU nó TỰ chuyển sang "chưa rõ" mà không cần code riêng.
         Chưa từng có payload nào: nói thật "chưa rõ" ở thẻ lớn và bảng loài (hai hàm
         đó coi `null` là số cũ), thay vì để "Đang kiểm tra server…" nằm đó mãi — trước
         2026-09-27 câu "chưa lấy được" nằm ở `#tt` trên thanh app, nay đã bỏ. */
      if (!cuoi) {
        veTheLon(null);
        veDieuTra(null);
        return;
      }
    }
    veTheLon(cuoi);
    veDieuTra(cuoi);
    phatTrangThai(cuoi);
  }

  /* Đưa payload trạng thái cho các script khác của trang.

     Cùng lý do với `window.__dino4vnMe` ở trên: `/api/status.json` đã được
     file này poll sẵn mỗi 30 giây rồi, nên `map.js` gọi lần thứ hai là một
     vòng khứ hồi thừa — đúng thứ `nha.js` đã từng làm sai với `/api/player/me`.

     ⚠️ Người nghe đăng ký MUỘN vẫn nhận được payload cuối ngay lập tức.
        Không có điều đó thì `map.js` (nạp sau, và còn phải đợi `bando.json`)
        sẽ trống cho tới nhịp poll sau — tải 30 giây mới có số.                    */
  const nguoiNghe = [];
  window.__dino4vnTT = {
    moiNhat: null,
    nghe(fn) {
      nguoiNghe.push(fn);
      if (this.moiNhat) { try { fn(this.moiNhat); } catch { /* một người nghe hỏng
        không được kéo theo nhịp poll của cả trang */ } }
    },
  };
  function phatTrangThai(d) {
    window.__dino4vnTT.moiNhat = d;
    for (const fn of nguoiNghe) { try { fn(d); } catch { /* như trên */ } }
  }

  /* ── 2. Trạng thái đăng nhập ──────────────────────────────────────────
     Chạy MỘT lần. Phiên sống 30 ngày nên không có lý do gì hỏi lại mỗi 30 giây.
     Ba phần tử đều chiếm sẵn chỗ -> không nhảy layout khi có kết quả.        */
  /* Lat nav sang bo danh cho nguoi da dang nhap.
     Nguoi da vao khong con can "Cach vao / Noi quy / Cong dong" o thanh dieu
     huong (chung van o footer); ho can loi tat toi trang cua ho, gara, xep hang.
     Danh sach va THU TU nam o `_data/site.js`, khong phai o day — them mot muc
     la sua mot dong du lieu, khong phai sua JS.
     ⚠️ Tach RIENG khoi `nhipTaiKhoan()`: ham do thoat som khi thieu mot trong
        ba phan tu `#tk-*`. Gop vao la nav dung im tren bat ky trang nao lo mat
        mot phan tu — dung lop loi "hai return som" cua `status.js` ma ban nay
        sinh ra de tranh. */
  function doiNav(daVao) {
    const la  = document.querySelectorAll('.nav__trong [data-nav="la"]');
    const vao = document.querySelectorAll('.nav__trong [data-nav="vao"]');
    if (!vao.length) return;              // chua co muc nao cho nguoi dang nhap
    la.forEach((a)  => { a.hidden = daVao; });
    vao.forEach((a) => { a.hidden = !daVao; });
    chiaHang();
  }

  /* Thanh app một hàng hay hai hàng (2026-10-10). Bề rộng nav + `.tk` đổi theo ngôn ngữ, trạng thái
     đăng nhập và lúc font web nạp xong, nên không mốc CSS cố định nào đúng cho mọi trường hợp: mốc
     1099 cũ để màn 1100–1290 px mất 3–4 mục nav, không vệt mờ nào báo. Ở đây ĐO thật: bỏ class,
     xem nav còn tràn ở bố cục một hàng không, rồi gắn lại. Luật của class nằm ở site.css cạnh khối
     `max-width: 1099px` (cùng bộ luật).
     Gọi lại sau MỌI thứ đổi bề rộng: lật nav đăng nhập, hiện `.tk`, font nạp xong, đổi cỡ cửa sổ.
     Chỉ đổi class, không đụng `.style` (quy ước CSP của repo). */
  const thanhApp = document.querySelector('header.app');
  const navTrong = thanhApp && thanhApp.querySelector('.nav__trong');
  function chiaHang() {
    if (!navTrong) return;
    thanhApp.classList.remove('app--hai-hang');
    /* +1: scrollWidth/clientWidth làm tròn số nguyên; lệch dưới 1 px không che chữ nào.
       Ở ≤1099px media query đã đưa nav xuống hàng riêng; phép đo khi đó hỏi "cả một hàng có
       đủ không", và class gắn thêm cũng chỉ lặp lại đúng bộ luật đang áp. */
    thanhApp.classList.toggle('app--hai-hang', navTrong.scrollWidth > navTrong.clientWidth + 1);
  }
  chiaHang();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(chiaHang);
  let choChiaHang = 0;
  window.addEventListener('resize', () => {
    if (choChiaHang) return;
    choChiaHang = requestAnimationFrame(() => { choChiaHang = 0; chiaHang(); });
  });

  async function nhipTaiKhoan() {
    const vao = $('tk-vao'), ten = $('tk-ten'), ra = $('tk-ra');
    if (!vao || !ten || !ra) return;
    let d = null;
    /* 🔑 MỘT lần gọi cho CẢ TRANG. Trước đây `nha.js` gọi `/api/player/me`
       lần thứ hai trên trang chủ — đo được 2 request mỗi lần tải. Bytes thì
       nhỏ (48 B) nhưng đó là một vòng khứ hồi thừa tới dịch vụ người chơi,
       trên đúng đường đi của người mới bấm từ Facebook vào.
       `app.js` và `nha.js` đều `defer` nên thứ tự chạy được đảm bảo: file này
       luôn chạy trước, nên nó là chỗ đúng để giữ lời hứa dùng chung.
       `.catch` nằm ở CHỖ GÁN phía trên, không phải ở đây — lý do ghi tại đó. */
    d = await window.__dino4vnMe;                   // không bao giờ reject (xem trên)
    if (!d || d.logged_in !== true) return;          // hỏng/chưa vào: giữ nút đăng nhập
    /* Hiển thị Avatar và Tên tài khoản Steam nhận được */
    const id = String(d.steamid || '');
    vao.hidden = true;
    const tenHienThi = d.name || d.personaname || ('Steam …' + id.slice(-4));
    if (d.avatar) {
      ten.innerHTML = `<img src="${d.avatar}" alt="" style="width:22px;height:22px;border-radius:4px;vertical-align:middle;margin-right:6px;object-fit:cover;"><span>${tenHienThi}</span>`;
    } else {
      ten.textContent = tenHienThi;
    }
    ten.hidden = false;
    ten.style.display = 'inline-flex';
    ten.style.alignItems = 'center';
    ra.hidden = false;
    document.body.classList.add('da-dang-nhap');

    /* Cập nhật khối thông tin Steam trong trang me.html nếu có */
    const spBox = $('steam-profile-box');
    if (spBox) {
      const spAvatar = $('steam-avatar');
      const spName = $('steam-name');
      const spId = $('steam-id');
      const spLink = $('steam-link');
      const spCountry = $('steam-country');

      if (spName) spName.textContent = d.name || d.personaname || ('Steam ' + id);
      if (spId) spId.textContent = id;
      if (spAvatar && d.avatar) {
        spAvatar.src = d.avatar;
        spAvatar.hidden = false;
      }
      if (spLink && d.profileurl) {
        spLink.href = d.profileurl;
        spLink.hidden = false;
      }
      if (spCountry && d.country) {
        spCountry.textContent = 'Quốc gia: ' + d.country;
        spCountry.hidden = false;
      }
    }

    const thoat = $('tk-thoat');
    if (thoat) {
      thoat.hidden = false;
      thoat.addEventListener('click', async () => {
        /* Khoá nút ngay: bấm hai lần là hai POST, lần thứ hai chạy khi cookie đã
           bị xoá -> 403 CSRF, và người dùng thấy một lỗi cho một thao tác ĐÃ
           thành công. */
        thoat.disabled = true;
        try {
          await fetch('/api/player/logout',
                      { method: 'POST', credentials: 'same-origin' });
        } catch {
          /* Mạng hỏng: KHÔNG tự ý coi là đã đăng xuất. Trả nút về để bấm lại —
             nói dối "đã đăng xuất" trong khi phiên còn sống là kiểu sai tệ nhất
             ở đây. */
          thoat.disabled = false;
          return;
        }
        /* Tải lại thay vì tự sửa DOM: trạng thái đăng nhập ảnh hưởng thanh app,
           nav (`navDangNhap`), và nội dung của /gara lẫn /map. Dựng lại từ server
           là cách DUY NHẤT chắc chắn cả ba khớp nhau.
           `location.pathname` chứ không phải `href`: bỏ mọi query đang có. */
        location.assign(location.pathname);
      });
    }
    chiaHang();                                      // `.tk` vừa rộng ra
  }

  /* Nav chay DOC LAP voi `nhipTaiKhoan()` — cung mot loi hua, hai nguoi tieu thu.
     Hong thi giu nguyen nav khach: mot nguoi da dang nhap nhin thay thua vai muc
     chi la thua; nguoc lai — an mat "Noi quy" cua nguoi CHUA dang nhap vi mot
     loi mang — la lay mat duong toi thong tin ho can. */
  (async () => {
    const d = await window.__dino4vnMe;
    doiNav(!!(d && d.logged_in === true));
  })();

  const bat = () => { nhipTrangThai(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bat(); });
  bat();
  setInterval(() => { if (!document.hidden) bat(); }, NHIP);
  nhipTaiKhoan();
})();
