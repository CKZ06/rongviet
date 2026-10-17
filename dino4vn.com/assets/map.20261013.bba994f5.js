/* map.js — bản đồ Gateway công khai tại /map.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BỐN LUẬT, KHÔNG PHÁ
 * ══════════════════════════════════════════════════════════════════════════
 * 1. CHẤM VỊ TRÍ TRỰC TIẾP chỉ có đúng một loại: của CHÍNH người đang đăng nhập,
 *    lấy từ phiên của họ. Không theo tên, không "ẩn danh", không "3 con ăn thịt gần
 *    Delta". Một bản đồ chỉ ra được MỘT người ĐANG Ở ĐÂU BÂY GIỜ là công cụ đi săn.
 *
 *    🔴 **NGOẠI LỆ ĐÃ MỞ RỘNG 2026-09-17 — chủ server chốt, có cân nhắc.**
 *    Lớp "Heatmap" (`duong_di`) vẽ **quỹ đạo THẬT của từng con**, không gộp, không
 *    làm thô theo lưới. Bản trước gộp vào lưới 64×64 + k-anonymity; nó bảo vệ riêng
 *    tư tốt nhưng **không thể** trông như đường đi — mọi nét bị snap về trục lưới và
 *    dày lên thì thành giấy kẻ ô. Đó là trần của BIỂU DIỄN, không phải của bảng màu.
 *    Chủ server đọc đánh đổi rồi chọn hình ảnh.
 *
 *    **Nói thẳng cái giá:** một hành trình là re-identify được. Ai biết một người
 *    chơi ở đâu lúc nào thì nhặt ra được đường của người đó, và **ai chụp được một
 *    khung là giữ vĩnh viễn — không rút lại được.**
 *
 *    HAI điều còn giữ, và chúng là lý do lớp này vẫn công khai được:
 *      (a) TRỄ — cửa sổ là một giờ TRÒN đã đóng, công bố ≥ 1 giờ sau khi giờ đó hết.
 *          Bỏ nó là biến lớp này thành một cái radar đuổi theo thời gian thực. Giờ
 *          tròn chứ không phải cửa sổ trượt, để hai bản liền nhau không so được.
 *      (b) CẮT HAI ĐẦU PHIÊN — bỏ 10 phút mỗi đầu mỗi phiên chơi. The Isle không có
 *          logout an toàn: thoát ở đâu thì vào lại vẫn nằm đúng đó, nên chỗ thoát
 *          game là tấm bản đồ "tới đây giết nó lúc đang load". Đây là kiểu hại cụ
 *          thể nhất và nó gần như miễn phí để chặn.
 *    Và một điều không đổi: **không tên, không SteamID, không loài, không mốc giờ
 *    bên trong cửa sổ** — thứ tự mảng cũng không được phụ thuộc SteamID (ghép được
 *    nhiều giờ lại thành một ngày của một người). Có test ghim từng cái.
 *
 * 1b. 🔴 HAI LỚP ĐÓ XẢY RA Ở SERVER, TRƯỚC KHI BYTE RỜI MÁY. File này KHÔNG được
 *    chứa một phép lọc riêng tư nào. Lọc ở client nghĩa là dữ liệu chưa lọc đã đi
 *    qua dây mạng và nằm trong DevTools của bất kỳ ai — tức là đã công bố. Cái gì
 *    `map.js` đọc được thì coi như đã công khai vĩnh viễn.
 *    Luật sống ở `ops/duongdi/duongdi.py`. Xem `docs/08` §1.3①, `docs/06` Q49, và
 *    `telemetry.py` luật 1 (luật ĐÓ không đổi: nó cấm fan-out snapshot TRỰC TIẾP,
 *    và lớp này trễ một giờ nên không phải fan-out).
 *
 * 2. `null` KHÁC `0`. `players: null` là "không hỏi được", `0` là "đã hỏi,
 *    không có ai". Trộn hai cái đó lại là bịa số.
 *
 * 3. Dữ liệu cũ TỆ HƠN không có. Quá `QUA_CU` thì XOÁ chấm, không làm mờ,
 *    không giữ ở chỗ cũ. Một chấm sai vị trí trông y hệt một chấm đúng.
 *
 * 4. Dựng DOM bằng `textContent`, KHÔNG `innerHTML`, KHÔNG `style="…"`.
 *    Tên địa danh là dữ liệu, và CSP của site là `style-src 'self'` — một
 *    thuộc tính `style=` do JS sinh ra sẽ bị chặn, và nhãn mất màu trong im
 *    lặng. Màu CHỮ nằm hết trong `site.css` dưới dạng class.
 *
 * ⚠️ NGOẠI LỆ về `.style`: Leaflet ghi `el.style.transform` liên tục để định vị.
 *    Đó là CSSOM nên CSP không chặn, và không tắt được. Chi tiết ở `NGUON.md`
 *    trong thư mục vendor. File NÀY không đụng `.style` dòng nào.
 *
 * 🔴 MÀU CHẤM/HÌNH ĐI BẰNG TUỲ CHỌN LEAFLET, KHÔNG BẰNG CSS — bẫy đã dẫm phải:
 *    `preferCanvas: true` khiến Leaflet vẽ bằng `ctx.fill()` và KHÔNG dựng phần
 *    tử DOM nào, nên `className` không có gì để bám và CSS không bao giờ được áp.
 *    Mọi chấm ra màu xanh mặc định trong khi CSS trông hoàn toàn đúng, 0 lỗi.
 *    Nhãn CHỮ thì ngược lại (divIcon = DOM thật) nên dùng class. Xem CLAUDE.md §2.39.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * KHÔNG CÓ MỘT PHÉP TOÁN TOẠ ĐỘ NÀO TRONG FILE NÀY — CÓ CHỦ Ý
 * ══════════════════════════════════════════════════════════════════════════
 * `bando.json` đã chứa sẵn `lat`/`lng`, sinh lúc build bởi
 * `tools/build-pois-latlng.py` (import thẳng `panel/app/coords.py`). Vị trí
 * người chơi cũng do server tính sẵn. Lý do: RCON gọi `X`/`Y` NGƯỢC với
 * `LAT`/`LONG` trong game (`CLAUDE.md` §2.23), và đảo nhầm KHÔNG ném lỗi,
 * KHÔNG rơi khỏi khung — bản đồ chỉ lật theo đường chéo trong im lặng.
 *
 * HAI ngoại lệ, và cả hai cùng một lý do: chúng chỉ chia khung ảnh ĐÃ CHIẾU cho
 * một số nguyên, không đụng `min_X`/`divisor`, nên không có trục nào để lật sai.
 *   1. `oLuoi()` chia khung thành 12×12 để ra "F7".
 *   2. `veDuongDi()` chia khung cho `d.dpg` để đổi thang công bố ra pixel canvas.
 *      Số `dpg` do SERVER gửi và server đã chiếu toạ độ bằng chính `coords.py` —
 *      client không bao giờ thấy `min_X`/`min_Y` để mà lật sai.
 */
(() => {
  'use strict';

  /* i18n: `T(khoá tiếng Việt, {tham số})`, định nghĩa ở app.js (nạp trước). Trang Việt trả nguyên khoá. */
  const T = window.D4V_T || ((k, t) => (t ? k.replace(/\{(\w+)\}/g, (m, n) => (n in t ? String(t[n]) : m)) : k));

  const hop = document.getElementById('bando');
  if (!hop || typeof L === 'undefined') return;

  const DU_LIEU   = '/du-lieu/bando.json';
  const API_TOI   = '/api/player/map';
  const API_SK    = '/api/player/su-kien';
  /* Bản xuất công khai của `panel/web/nen.json`: admin chọn bộ ảnh nền ở MỘT chỗ
     (tab Bản đồ bên panel), rồi ba mặt — panel · web · lớp phủ HUD — cùng đọc một
     lựa chọn. File TĨNH, cùng kênh với `/api/bang-xep-hang.json`: panel ghi ra
     `/var/lib/dino4vn-pub`, `dino4vn-pub-publish` copy sang web root.

     🔴 CADDY PHỤC VỤ `/api/` THEO ALLOWLIST TỪNG ĐƯỜNG DẪN, và mọi thứ không khai
        rơi vào `handle /api/* { respond 404 }`. Đặt file vào `/var/www/dino4vn/api/`
        là CHƯA ĐỦ — phải có một khối `handle /api/ban-do-nen.json` trong
        `web/server/caddy/dino4vn.com.Caddyfile-block` **và** trong `/etc/caddy/Caddyfile`
        trên máy. Thiếu nó thì đường này trả 404 vĩnh viễn, `chonBoNen()` trả `null`,
        và trang lặng lẽ chạy đường lùi mãi mãi: nút đổi nền bên panel bấm vẫn "được"
        mà web không bao giờ đổi. Chú thích ngay tại chỗ trong Caddyfile đã cảnh báo
        đúng chuyện này ("them mot file moi vao /var/www/dino4vn/api/ KHONG tu dong
        phuc vu duoc") — đây là con trỏ tới nó. */
  const API_NEN   = '/api/ban-do-nen.json';
  const NHIP_SK   = 60000;

  /* ── Lớp "Đường đi giờ trước" ────────────────────────────────────────────────
     Cùng kênh với `/api/ban-do-nen.json`: `dino4vn1-duongdi` ghi ra
     `/var/lib/dino4vn1/duongdi`, `dino4vn-pub-publish` chép sang web root.
     🔴 Đường này CŨNG cần một khối `handle /api/duong-di.json` trong Caddyfile —
        thiếu nó là 404 vĩnh viễn và hàng trong bảng chọn ẩn hẳn, trông y hệt
        "chưa deploy". Xem khối chú thích của `API_NEN` ở trên. */
  const API_DD    = '/api/duong-di.json';
  /* Tệp đổi 60 phút/lần; hỏi lại mỗi 10 phút chỉ để MỐC GIỜ trên nhãn không ôi và
     để phép kiểm tuổi có nhịp chạy. */
  const NHIP_DD   = 600000;
  const CHO_DD    = 3000;
  /* Tuổi BÌNH THƯỜNG tối đa của một bản công bố: trễ 60' + 60' tới lượt sau + dư.
     3 giờ = đúng một chu kỳ hụt để nới, rồi mới tuyên bố là chết. */
  const DD_QUA_CU = 10800000;
  /* Trần CỨNG phía client, song song với trần ở server. Hai đầu cùng canh để một
     lần tune sai ở server không lặng lẽ đẩy toạ độ mịn hơn ra công khai. */
  const DD_DPG_MAX = 4096;
  /* Cạnh canvas raster. 2048 = đúng thang công bố ⇒ một đơn vị là một pixel, không
     có bước nội suy nào giữa dữ liệu và nét. */
  const DD_RA_PX  = 2048;
  const DD_MO     = 0.92;
  /* 🔴 MỘT SẮC ĐỎ, NÉT MẢNH, CỘNG DỒN — người dùng chốt 2026-09-17 theo ảnh tham
        chiếu của server Petits Pieds.

     🔴 `lighter` ở đây là ĐÚNG, và đó là chỗ khác hẳn bản trước. Bản trước server
        GỘP SẴN thành cạnh nên mỗi nét vẽ đúng một lần ⇒ cộng dồn không cộng được
        gì ⇒ phải dùng `source-over` với alpha cao. Bản này server gửi **từng đường
        đi riêng**, chúng CHỒNG LÊN NHAU thật, nên độ sáng tự nó là lưu lượng: một
        lối mòn nhiều người đi sáng lên thành cam rồi vàng, một chuyến đi lẻ vẫn là
        một nét đỏ mờ. Không có bảng mức nào cả — không cần, và cũng không nên có:
        mã hoá lưu lượng hai lần (mức + chồng nét) là tự mâu thuẫn.

     ⚠️ Vì thế alpha phải THẤP. Alpha cao thì 3 nét đã trắng xoá và toàn bộ dải
        động biến mất — đúng lỗi ngược với lần bảng màu vô hình 2026-09-17 sáng.
     🔴 Màu nằm ở ĐÂY chứ không ở CSS: nét vẽ bằng `ctx.stroke()` nên CSS không với
        tới (cùng bệnh `preferCanvas`, §2.39). Bản sao BẮT BUỘC là chấm mẫu
        `.bd__cham--du` trong `site.css` — mẫu là DOM nên nó phải là CSS. */
  const DD_MAU  = 'rgba(214, 34, 26, 0.30)';
  /* 🔴 BỀ RỘNG NÉT TÍNH THEO MỨC PHÓNG, không phải một hằng số trên canvas.
     Canvas luôn 2048 px còn bản đồ trên màn hình rộng ~440 px ở mức phóng mặc định
     (toàn đảo) và ~7.800 px khi phóng hết ⇒ chênh nhau **17 lần**. Một nét 2 px cố
     định trên canvas thành 0,43 px trên màn hình ở mức mặc định — trình duyệt trộn
     nó với nền và alpha còn ~0,13 ⇒ **lớp gần như vô hình đúng ở chỗ hầu hết người
     ta nhìn**. Đã đo trên trang thật 2026-09-17, lần thứ HAI của cùng một họ lỗi.
     Nên ta chốt bề rộng TRÊN MÀN HÌNH rồi suy ngược ra bề rộng canvas, và vẽ lại
     mỗi lần đổi mức phóng. Kẹp hai đầu: quá mảnh thì mất alpha, quá dày thì cả đảo
     thành một vệt đỏ. */
  const DD_NET_MAN_HINH = 1.5;      // px TRÊN MÀN HÌNH, mọi mức phóng
  const DD_RONG_MIN = 1.0;
  const DD_RONG_MAX = 9.0;

  /* ĐƯỜNG LÙI của ảnh nền — bộ "cu", đã chạy từ 2026-08-30.
     🔴 HAI TÊN FILE NÀY LÀ ĐƯỜNG LÙI, KHÔNG PHẢI "BỘ MẶC ĐỊNH".
        `nen.json` có khoá `mac_dinh` riêng (hiện là "dep") nhưng nó chỉ có nghĩa
        ở PHÍA PANEL — nơi đọc được bảng `settings`. Trang công khai không đọc
        được `settings`, nên khi bản xuất chưa có / hỏng / trả rác thì việc đúng
        đắn là vẽ bằng đúng bộ đã chạy nhiều ngày qua, KHÔNG phải đoán tên file
        của bộ kia. Bịa một URL rồi để Leaflet im lặng 404 là tệ hơn hẳn.
     ⚠️ Nhánh lùi này là nhánh chạy THẬT, không phải nhánh lý thuyết: bản xuất
        chưa tồn tại cho tới lần deploy panel đầu tiên.
     ⚠️ `gateway-v0.21.7-1950.webp` còn là ẢNH THAM CHIẾU của phép đăng ký toạ độ
        vùng Đại Di Cư (`CLAUDE.md` §2.53) — đổi NỘI DUNG nó là làm lệch một vùng
        đang ghi cờ Prime lên dino người chơi thật. Chỉ được THÊM file mới. */
  const LUI_XA    = '/assets/map/gateway-v0.21.7-0975.webp';   // 209 KB, nạp ngay
  const LUI_GAN   = '/assets/map/gateway-v0.21.7-1950.webp';   // 733 KB, nạp khi zoom
  /* Bộ ảnh ĐANG DÙNG. Gán ĐÚNG MỘT LẦN, ngay trước `dungMap()`, rồi không đổi nữa
     trong suốt phiên — và đó chính là lý do `daNangAnh` được phép ở lại là một cờ
     MỘT CHIỀU. Admin đổi bộ ở panel thì người đang mở trang phải tải lại mới thấy;
     đổi ngầm giữa phiên chỉ để tiết kiệm một lần tải lại, đổi lấy một đường trạng
     thái nữa phải nuôi, là đánh đổi sai.
     NGOẠI LỆ DUY NHẤT: `anhNenHong()` kéo cả hai về đường lùi khi ảnh không tải
     được — đó là sửa lỗi, không phải đổi lựa chọn. */
  let ANH_XA      = LUI_XA;
  let ANH_GAN     = LUI_GAN;
  const ZOOM_NANG = -3;
  const CHO       = 8000;
  /* Hạn RIÊNG, ngắn hơn `CHO`, cho bản xuất ảnh nền. Nó chạy SONG SONG với
     `bando.json` (35 KB) trên cùng một kết nối nên thực tế không tốn thêm giây
     nào; hạn ngắn chỉ để chắc rằng một file cấu hình ~600 byte không bao giờ giữ
     bản đồ lại 8 giây. Quá hạn = "KHÔNG ĐO ĐƯỢC" ⇒ đi đường lùi, không chờ tiếp. */
  const CHO_NEN   = 1500;
  /* Nguồn thật là vòng poll RCON 10–30 giây của panel, cộng `STALE_S = 90` bên
     dịch vụ người chơi. 120 giây là ngưỡng đúng cho NHỊP ĐÓ — không chép mù
     `QUA_CU = 180000` của `app.js`, vì trạng thái server có nhịp khác hẳn. */
  const QUA_CU    = 120000;
  const LECH      = 120000;
  const O_CHU     = 'ABCDEFGHIJKL';
  const O_SO      = 12;

  const $ = (id) => document.getElementById(id);
  const dat = (el, s) => { if (el) el.textContent = s; };

  /* ───────────────────────────────────────────── tiện ích */
  /* `cho` cho phép người gọi đặt hạn riêng. Mặc định `CHO` = 8 giây hợp cho dữ
     liệu bản đồ; với một file cấu hình tí hon thì 8 giây là quá dài — xem `CHO_NEN`. */
  async function nap(duong, cho) {
    const bo = new AbortController();
    const h = setTimeout(() => bo.abort(), cho || CHO);
    try {
      const r = await fetch(duong, { signal: bo.signal, credentials: 'same-origin' });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.ma = r.status; throw e; }
      return await r.json();
    } finally { clearTimeout(h); }
  }

  /* Đường dẫn ảnh chỉ được nhận khi nó TUYỆT ĐỐI và CÙNG GỐC.
     CSP của site là `img-src 'self' data:` nên một URL trỏ sang host khác sẽ bị
     chặn — và Leaflet KHÔNG báo gì khi ảnh nền hỏng, bản đồ chỉ trống trơn. Một
     bản xuất hỏng phải rơi về đường lùi, tuyệt đối không được biến thành khung
     trắng. `//host/…` cũng là khác gốc, nên ký tự thứ hai không được là `/`.

     🔴 GẠCH CHÉO NGƯỢC CŨNG LÀ KHÁC GỐC — đo được, không phải suy (2026-09-07):
        trình duyệt coi `\` y hệt `/` khi phân giải URL của lược đồ http(s), nên
        `/\evil.com/a.webp` — vượt qua đúng phép kiểm ở trên vì ký tự thứ hai là
        `\` chứ không phải `/` — phân giải ra `https://evil.com/a.webp`.
        Kiểm bằng chính bộ phân giải của trình duyệt:
          new URL('/\\evil.com/a.webp', 'https://dino4vn.com/map/').origin
          -> 'https://evil.com'      (còn '/evil.com/a.webp' -> 'https://dino4vn.com')
        Nên chuỗi có `\` bị loại thẳng. Đường thật không bao giờ chứa nó, và một
        đường "cùng gốc" mà lại trỏ ra ngoài là đúng thứ hàm này sinh ra để chặn.
     ⚠️ Phép kiểm này chạy THẬT trong `panel/tests/test_map_js.py` (trích nguyên
        hàm ra rồi chạy bằng node, đối chiếu với `new URL(...).origin`) — không
        phải một phép kiểm đọc chữ, vì đọc chữ chỉ chép lại chính biểu thức này. */
  /* Chỉ nhận đường dẫn THẬT SỰ cùng gốc.
   *
   * 🔴 VÌ SAO KHÔNG CHỈ CẤM `\` VÀ `//` — một bản vá trước đã dừng ở đó và VẪN LỌT.
   * Bộ phân giải URL của trình duyệt XOÁ tab / xuống dòng / CR khỏi chuỗi TRƯỚC khi
   * phân giải. Nên `"/<TAB>/evil.com/a.webp"` — ký tự thứ hai không phải `/`, không có
   * `\`, qua sạch mọi phép kiểm cấu trúc — vẫn phân giải thành `https://evil.com`.
   * Đo được, không phải suy:
   *     new URL('/\t/evil.com/a.webp', 'https://dino4vn.com/map/').origin
   *       === 'https://evil.com'
   *
   * 🔑 Bài học rộng hơn chính lỗi này: một phép kiểm bằng regex LUÔN chạy sau lưng một
   *    bộ phân giải có quyền SỬA chuỗi đầu vào trước khi dùng. Cách duy nhất không thua
   *    cuộc chạy đua đó là hỏi CHÍNH bộ phân giải sẽ dùng chuỗi này. Cùng khuôn với
   *    §2.53 (dùng oracle độc lập thay vì tin phép đo của chính mình).
   *
   * Gốc giả `https://x.invalid` chứ không phải `location.href`: cho ra CÙNG một kết quả
   * trong trình duyệt lẫn trong node, nên test chạy đúng thứ production chạy. Câu hỏi
   * cần trả lời là "đường dẫn này có THOÁT khỏi gốc không", và nó không phụ thuộc gốc nào.
   */
  function duongAnh(x) {
    if (typeof x !== 'string' || x.length >= 300) return null;
    // Chặn trước mọi ký tự mà bộ phân giải có thể cắt bỏ hoặc diễn giải lại.
    if (/[\u0000-\u0020\u007f\\]/.test(x)) return null;
    if (!/^\/[^/]/.test(x)) return null;
    try {
      if (new URL(x, 'https://x.invalid/map/').origin !== 'https://x.invalid') return null;
    } catch { return null; }
    return x;
  }

  /* Bộ ảnh nền admin ĐANG chọn, đọc ĐÚNG MỘT LẦN lúc tải trang.

     Trả `null` cho MỌI đường không chắc chắn: hỏng mạng, quá hạn, 404 (bản xuất
     chưa tồn tại), JSON rác, thiếu khoá, `chon` trỏ tới một mã không có trong
     danh sách, đường dẫn khác gốc.

     🔴 `null` ở đây nghĩa là "KHÔNG ĐO ĐƯỢC", và người gọi phải đọc nó thành
        "dùng đường lùi" — KHÔNG phải "admin đã chọn bộ cu". Hai chuyện khác nhau,
        và chỉ chuyện thứ nhất mới đúng trong những ngày panel chưa deploy lần nào.
     🔴 KHÔNG đọc khoá `panel` kể cả khi bản xuất lỡ mang nó theo: đó là đường nội
        bộ (`/static/…`) của giao diện admin, trang công khai không với tới được,
        và dùng nó là tự tay dựng một ảnh nền 404. */
  async function chonBoNen() {
    let d;
    try { d = await nap(API_NEN, CHO_NEN); } catch { return null; }
    if (!d || typeof d.chon !== 'string' || !Array.isArray(d.nen)) return null;
    const bo = d.nen.find((x) => x && x.ma === d.chon);
    if (!bo) return null;
    const xa = duongAnh(bo.web_xa), gan = duongAnh(bo.web_gan);
    if (!xa || !gan) return null;
    return { ma: bo.ma, xa: xa, gan: gan };
  }

  /* Tooltip trả về ELEMENT chứ không phải chuỗi — an toàn tuyệt đối, không cần
     thoát HTML. Leaflet đặt chuỗi bằng innerHTML, nên đây là khác biệt thật. */
  function nhan(ten, nhomLabel) {
    const box = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = ten || T('(không tên)');
    box.appendChild(b);
    if (nhomLabel) {
      const s = document.createElement('div');
      s.className = 'nho dim';
      s.textContent = T(nhomLabel);
      box.appendChild(s);
    }
    return box;
  }

  function gio(ts) {
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(ts));
    } catch { return ''; }
  }

  /* ───────────────────────────────────────────── trạng thái dùng chung */
  let map = null, lopAnh = null, daNangAnh = false, KHUNG = null;
  let lopLuoi = null, chamToi = null, viTriToi = null, vongTam = null, PX_MOI_CM = null;
  const lopTheoNhom = new Map();
  const lopTrucTiep = new Map();   // lớp lấy hình từ API lúc chạy
  let BIEN = null;                 // [[0,0],[cao,rong]] — dùng chung cho mọi lớp ảnh
  /* Trạng thái lớp "Đường đi giờ trước". CỐ Ý không nằm trong `lopTheoNhom`: map đó
     điều khiển `sapXep()` (bringToFront theo `z`) và `sapNhan()` (tránh chồng nhãn),
     mà một lớp ẢNH không có hình để xếp cũng không có nhãn để tránh. */
  const DD = { lop: null, d: null, hang: null, veRoi: false };
  let henSK = 0;
  const moiDiem = [];               // để ô tìm kiếm

  /* Ô lưới "F7" từ lat/lng ĐÃ CHIẾU. Người chơi gọi chỗ cho nhau bằng ô, không
     bằng số — đây là cách panel admin đang dùng, và nó vô hại để công khai. */
  function oLuoi(lat, lng) {
    if (!KHUNG || typeof lat !== 'number' || typeof lng !== 'number') return '';
    const i = Math.floor(lng / (KHUNG.rong / O_SO));
    const j = Math.floor((KHUNG.cao - lat) / (KHUNG.cao / O_SO));
    if (i < 0 || i >= O_SO || j < 0 || j >= O_SO) return T('ngoài lưới');
    return O_CHU[i] + (j + 1);
  }

  /* ───────────────────────────────────────────── dựng bản đồ */
  function dungMap(khung, pxMoiCm) {
    KHUNG = khung;
    PX_MOI_CM = pxMoiCm;
    const H = khung.cao, W = khung.rong;
    map = L.map(hop, {
      crs: L.CRS.Simple,
      minZoom: -5, maxZoom: 1,
      zoomSnap: 0.5,
      preferCanvas: true,
      attributionControl: false,
      zoomControl: false,          // tự làm — xem ghi chú trong `map.njk`
    });
    const bien = [[0, 0], [H, W]];
    BIEN = bien;
    /* 🔴 HAI PANE RIÊNG CHO HAI LỚP ẢNH — và việc dời ẢNH NỀN ra khỏi `overlayPane`
       LÀ bản vá, không phải dọn dẹp.
       Mặc định `L.imageOverlay` nằm ở `overlayPane` (z-index 400) CHUNG với renderer
       canvas của lớp vector. Nếu để nguyên và đặt lớp đường đi ở 350 (như
       `panel/web/heat.js` đang làm — bên panel ảnh nền ở pane riêng 250 nên ở đó
       đúng), thì lớp đường đi nằm DƯỚI một ảnh nền 7800 px đục ⇒ vô hình hoàn toàn,
       Leaflet không báo gì.
       Thứ tự: 200 nền < 250 đường đi < 400 vùng/POI < 600 nhãn.
       z-index đặt trong `site.css` theo LUẬT 4 (file này không đụng `.style`);
       ở đây chỉ tạo pane, Leaflet tự gán class `.leaflet-<ten>-pane`.
       ⚠️ Tên pane KHÔNG được chứa chữ "Pane" ở giữa: Leaflet dùng
          `t.replace("Pane","")` và `.replace` chỉ thay lần xuất hiện ĐẦU. */
    map.createPane('bdnenPane');
    map.createPane('duongdiPane');
    /* Cảnh báo "hai canvas chồng nhau nuốt sự kiện chuột" ở `sapXep()` KHÔNG áp cho
       hai pane này: chúng chứa `<img>`, không phải canvas renderer, và `site.css`
       đặt `pointer-events: none` cho cả hai. */
    lopAnh = L.imageOverlay(ANH_XA, bien, { pane: 'bdnenPane' }).addTo(map);
    /* 🔴 CỔNG NGHIỆM THU LÚC CHẠY CHO BỘ ẢNH MỚI.
       Ảnh nền 404 — hoặc bị CSP chặn — thì Leaflet KHÔNG ném, KHÔNG log, bản đồ
       chỉ đơn giản trống: đúng lớp hỏng-im-lặng mà repo này canh. `imageOverlay`
       CÓ bắn sự kiện `error`, nên đây là chỗ duy nhất biết được chuyện đó và kéo
       về đường lùi. Không có nó thì một tên file gõ sai bên `nen.json` sẽ xoá bản
       đồ khỏi trang công khai mà mọi cổng khác vẫn báo xanh.
       ⚠️ KHÔNG dùng `errorOverlayUrl` của Leaflet: nó thay được ảnh đang hiện
          nhưng KHÔNG sửa `ANH_GAN`, nên lần zoom sau lại nạp tiếp một file hỏng. */
    lopAnh.on('error', anhNenHong);
    map.fitBounds(bien);
    /* Chặn kéo ra ngoài đảo — không có nó thì người dùng dễ lạc vào vùng xám
       vô tận rồi tưởng trang hỏng. (Đã loại trừ: đây KHÔNG phải nguyên nhân
       control zoom mặc định không chạy — bỏ nó đi vẫn không chạy.) */
    map.setMaxBounds([[-H * 0.1, -W * 0.1], [H * 1.1, W * 1.1]]);
    /* `moveend` chứ không chỉ `zoomend`.
       Hai lý do, cái thứ hai là lỗi thật đã đo được:
       (a) `sapNhan()` LOẠI nhãn nằm ngoài khung nhìn, nên kéo bản đồ mà không tính
           lại sẽ để lại một mảng trống ở phần vừa trôi vào.
       (b) Gọi `sapNhan()` ngay trong `bat()` lúc dựng lớp cho ra vị trí CHƯA ỔN
           ĐỊNH — đo được hai nhãn chồng nhau 16,9 px trên trang thật, trong khi
           phép kiểm hộp lẽ ra phải loại một cái. `moveend` bắn sau khi Leaflet đã
           đặt xong khung nhìn, nên lần chạy đó mới là lần tính trên số thật.
       Gộp về một khung hình bằng rAF: một thao tác zoom bắn nhiều sự kiện, mà tính
       lại 90 nhãn ba lần trong một khung là phí. */
    let henNhan = 0;
    const xepLai = () => {
      if (henNhan) return;
      henNhan = requestAnimationFrame(() => { henNhan = 0; sapNhan(); });
    };
    xepNhanSom = xepLai;
    map.on('moveend zoomend resize', xepLai);
    map.on('zoomend', () => { napAnhNet(); veVongTam(); ddVeLai(); });
    map.whenReady(xepLai);
    dungLuoi(H, W);
  }

  /* Ảnh nền đang dùng KHÔNG tải được -> lùi về bộ "cu", và NÓI RA.
     Chạy đúng MỘT lần: nếu chính ảnh lùi cũng hỏng thì không còn chỗ nào để lùi
     nữa, mà một vòng `setUrl` -> `error` -> `setUrl` là vòng lặp vô tận.
     `console.warn` là dấu vết DUY NHẤT của lỗi này — không hiện gì lên trang, vì
     người xem không sửa được và một bản đồ cũ vẫn dùng bình thường. */
  let daLuiAnh = false;
  function anhNenHong() {
    if (daLuiAnh) return;
    daLuiAnh = true;
    console.warn('[map] anh nen khong tai duoc, lui ve bo cu');
    ANH_XA = LUI_XA;
    ANH_GAN = LUI_GAN;
    daNangAnh = false;                 // cho phép nâng nét lại, lần này bằng ảnh lùi
    if (lopAnh) lopAnh.setUrl(LUI_XA);
    if (map) napAnhNet();              // đang zoom sâu thì nâng lại ngay, khỏi chờ zoom
  }

  function napAnhNet() {
    if (daNangAnh || !lopAnh || map.getZoom() < ZOOM_NANG) return;
    daNangAnh = true;
    const truoc = new Image();
    truoc.onload = () => lopAnh.setUrl(ANH_GAN);
    /* 🔴 Ở ĐÂY CỐ Ý *KHÔNG* GỌI `anhNenHong()`, khác hẳn nhánh ảnh xa.
       Nhánh này đã tự lành sẵn: nạp trước bằng `new Image()` nên ảnh hỏng KHÔNG
       bao giờ được đặt vào bản đồ, và `daNangAnh = false` cho phép thử lại ở lần
       zoom sau. Kéo nó về đường lùi là biến một trục trặc mạng THOÁNG QUA thành
       một lần xuống cấp CẢ PHIÊN — người xem mất bộ ảnh đẹp tới khi tải lại trang,
       vì một cú nghẽn 2 giây.
       Trường hợp hỏng THẬT (gõ sai `web_gan` bên `nen.json`) đã bị chặn ở tầng
       tĩnh: `panel/tests/test_map_js.py` đòi tên file trong `nen.json` khớp đúng
       danh sách mà `web/deploy.sh` kiểm trên đĩa. Nên chỗ này chỉ cần NÓI RA —
       im lặng mới là thứ bị cấm, không phải "không lùi". */
    truoc.onerror = () => {
      daNangAnh = false;
      console.warn('[map] khong nap duoc anh net: ' + ANH_GAN + ' (se thu lai o lan zoom sau)');
    };
    truoc.src = ANH_GAN;
  }

  /* Lưới 12×12 + nhãn ô. Dựng sẵn nhưng KHÔNG add vào map — tắt mặc định. */
  function dungLuoi(H, W) {
    lopLuoi = L.layerGroup();
    for (let i = 0; i <= O_SO; i++) {
      lopLuoi.addLayer(L.polyline([[0, (W / O_SO) * i], [H, (W / O_SO) * i]],
        { color: '#8FA89A', weight: 1, opacity: 0.45, interactive: false }));
      lopLuoi.addLayer(L.polyline([[(H / O_SO) * i, 0], [(H / O_SO) * i, W]],
        { color: '#8FA89A', weight: 1, opacity: 0.45, interactive: false }));
    }
    for (let i = 0; i < O_SO; i++) {
      for (let j = 0; j < O_SO; j++) {
        /* divIcon nhận CHUỖI qua innerHTML => KHÔNG được có `style=` (CSP chặn).
           Nhãn ô là chữ+số do TA sinh, không phải dữ liệu người dùng, nên gán
           thẳng là an toàn. Cỡ/màu nằm ở class `.o-luoi` trong site.css. */
        lopLuoi.addLayer(L.marker(
          [H - (H / O_SO) * (j + 0.5), (W / O_SO) * (i + 0.5)],
          { interactive: false,
            icon: L.divIcon({ className: 'o-luoi', html: O_CHU[i] + (j + 1),
                              iconSize: [0, 0] }) }));
      }
    }
  }

  /* ───────────────────────────────────────────── lớp địa danh */
  /* ───────────────────────────────────────────── lớp địa danh

     🔴 KHÔNG CÓ BẢNG MÀU Ở ĐÂY NỮA — CÓ CHỦ Ý.
     Trước 2026-09-01 màu 15 nhóm tồn tại BỐN bản: `MAU` ở đây, `.bd__cham--*` và
     `.bando-lop__cham--*` (CSS chết) trong site.css, và `BASEMAP_STYLE` bên panel —
     mà panel dùng MÀU KHÁC web cho cùng một nhóm. Nay tất cả đến từ
     `panel/web/lop.json`, bake sẵn vào `bando.json` lúc build.

     ⚠️ Bản sao DUY NHẤT còn lại là `.bd__cham--*` / `.poi-nhan--*` / `.vung-nhan--*`
        trong site.css, và nó BẮT BUỘC phải tồn tại: `preferCanvas: true` khiến hình
        vẽ bằng `ctx.fill()` (CSS không với tới) còn nhãn chữ là divIcon = DOM thật
        (chỉ CSS với tới được). `panel/tests/test_lop.py` chốt hai bên khớp từng hex. */
  let LOP = {}, MUC = {};

  /* Chấm "chỗ tôi đứng".

     🔴 XOÁ NHẦM 2026-09-01 rồi trả lại. Hằng số này nằm lọt trong khối bảng màu cũ
        (`MAU`/`MAU_NHOM`) mà tôi thay nguyên khối — nên nó biến mất cùng, trong khi
        `veToi()` cách đó 580 dòng vẫn dùng. Hậu quả: `ReferenceError` ở đúng nhánh
        vẽ chấm, chấm vị trí người chơi KHÔNG BAO GIỜ hiện, còn phần bản đồ thì vẫn
        chạy hoàn hảo nên nhìn qua tưởng lành. `node --check` KHÔNG bắt được — biến
        chưa khai báo là lỗi lúc CHẠY, không phải lỗi cú pháp.
        `panel/tests/test_web_assets.py::test_map_js_khong_dung_bien_chua_khai` nay
        chốt lại chuyện này.

     🔴 `L.marker` + `divIcon` chứ KHÔNG `circleMarker`: `preferCanvas: true` khiến
        `circleMarker` được vẽ bằng `ctx.fill()` — không có phần tử DOM nào, nên
        KHÔNG CSS-animate được. Hai vòng lan toả bắt buộc phải là DOM. Đây cũng đúng
        cách launcher làm (`gate0.html` dựng `div.vong`).

     Chuỗi dưới là TĨNH, do ta viết — không có dữ liệu người dùng, không có
     `style="…"` (CSP chặn). Màu/kích thước nằm ở `site.css` (`.ct__*`).

     ⚠️ KHÁC launcher một điểm CÓ LÝ DO: launcher vẽ MŨI TÊN xoay theo `yaw`, web vẽ
        CHẤM TRÒN. `yaw` chỉ có từ vòng bơm 10 Hz của plugin, mà người xem web không
        đăng ký vào đó nên KHÔNG BAO GIỜ có. Một mũi tên không có hướng sẽ chỉ bừa
        về một phía — tệ hơn hẳn một chấm không hứa gì về hướng. */
  const HTML_CHAM_TOI =
    '<span class="ct__vong"></span>' +
    '<span class="ct__vong ct__vong--sau"></span>' +
    '<span class="ct__cham"></span>';

  /* Trọng tâm DIỆN TÍCH (shoelace) + bán kính. Dùng để đặt nhãn vùng và để xếp
     thứ tự tránh chồng (hình to giữ nhãn trước hình nhỏ).
     KHÔNG dùng tâm bao (bbox): với đa giác lõm mạnh nó lệch hẳn ra khỏi hình. */
  function tamHinh(kind, toaDo) {
    if (kind === 2) return { lat: toaDo[0], lng: toaDo[1], r: toaDo[2] };
    const n = Math.floor(toaDo.length / 2);
    if (!n) return null;
    let a = 0, cx = 0, cy = 0;
    for (let k = 0; k < n; k++) {
      const x1 = toaDo[2 * k], y1 = toaDo[2 * k + 1];
      const m = (k + 1) % n;
      const x2 = toaDo[2 * m], y2 = toaDo[2 * m + 1];
      const f = x1 * y2 - x2 * y1;
      a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
    }
    let lat, lng;
    if (Math.abs(a) < 1e-9) {                 // đường thẳng / suy biến -> trung bình
      lat = 0; lng = 0;
      for (let k = 0; k < n; k++) { lat += toaDo[2 * k]; lng += toaDo[2 * k + 1]; }
      lat /= n; lng /= n;
    } else { lat = cx / (3 * a); lng = cy / (3 * a); }
    let r = 0;
    for (let k = 0; k < n; k++) {
      r = Math.max(r, Math.hypot(toaDo[2 * k] - lat, toaDo[2 * k + 1] - lng));
    }
    return { lat, lng, r };
  }

  /* Hộp nhãn tính bằng PIXEL MÀN HÌNH — ĐO THẬT, không ước lượng.

     🔴 Bản đầu ước `0.55em × số ký tự`. Sai hai lần: (a) hệ số đó chỉ đúng gần
        đúng cho ASCII và sẽ lệch khi có tên tiếng Việt; (b) quan trọng hơn, nó
        không nói gì về việc nhãn được NEO ở đâu — mà hai họ nhãn neo khác nhau.
     `measureText` cho bề rộng thật của đúng font đang render, tính MỘT LẦN cho
     mỗi nhãn (font và chữ không đổi, nên kích thước không phụ thuộc zoom).

     ⚠️ `font` phải khớp CSS: `.poi-nhan` và `.vung-nhan` đều `font-weight: 700`,
        cỡ chữ lấy từ `cot_chu` của `lop.json` — và `site.css` cũng sinh cỡ đó từ
        cùng một chỗ, nên hai bên không lệch được. */
  let _doChu = null;
  function hopNhan(chu, cot) {
    if (!_doChu) {
      _doChu = document.createElement('canvas').getContext('2d');
      _doChu.dinoFont = getComputedStyle(document.body).fontFamily;
    }
    _doChu.font = '700 ' + cot + 'px ' + _doChu.dinoFont;
    let w = 18;
    try { w = Math.max(18, _doChu.measureText(chu).width); } catch { w = chu.length * cot * 0.55; }
    /* `cot * 1.5` là chiều cao dòng ĐO ĐƯỢC, không phải ước lượng: đối chiếu
       `getBoundingClientRect()` trên trang thật — 11px→16.5, 12px→18.0, 13px→19.5.
       Bản đầu để `cot + 4` và thiếu 2 px ở cỡ 12-13.

       Trả về SỐ ĐO THUẦN của chữ. Khoảng thở do `hopManHinh()` nới ra, vì chỉ ở
       đó mới biết nhãn được neo kiểu nào — nới vào bề rộng ở đây thì nhãn neo
       bên trái chỉ được thở về một phía. */
    return { rong: w, cao: cot * 1.5 };
  }

  /* Hộp trên MÀN HÌNH của một nhãn, theo đúng cách nó được NEO.

     🔴 Hai họ nhãn neo KHÁC NHAU, và `iconSize: [0, 0]` của Leaflet là lý do:
        phần tử có `width: 0` nên `transform: translate(-50%, -50%)` dịch đi
        **0 pixel** — nó trông như đã căn giữa nhưng thực ra không làm gì. Đã dẫm
        phải: nhãn vùng và nhãn khu vực CÙNG TÊN hiện cạnh nhau ("Highland
        Highland") vì phép kiểm chồng lấn tính trên hai hộp đặt sai chỗ.
        `site.css` nay ép `width: max-content` cho hai họ đó, nên transform mới
        thật sự có tác dụng — và hàm này phải phản ánh đúng transform đó. */
  function hopManHinh(p, n, b) {
    const w = b.rong, h = b.cao;
    const o = n.neo === 'tam'
      ? [p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2]   // .vung-nhan
      : [p.x + 7, p.y - h / 2, p.x + 7 + w, p.y + h / 2];      // .poi-nhan
    /* Nới ĐỀU bốn phía. Không nới vào `rong` ở `hopNhan()`: nhãn điểm neo mép
       TRÁI, nên cộng vào bề rộng chỉ cho nó thở về bên phải. */
    return [o[0] - THO_X, o[1] - THO_Y, o[2] + THO_X, o[3] + THO_Y];
  }

  /* 🔴 NEO BẰNG `iconAnchor`, KHÔNG BẰNG CSS `transform` — đây là chỗ đã sai một lần.
     Leaflet định vị mọi marker bằng `el.style.transform = translate3d(...)` (inline
     style, do chính nó ghi). Một quy tắc `transform` trong `site.css` KHÔNG BAO GIỜ
     thắng được inline style, nên nhãn vẫn neo ở góc trên-trái trong khi cả `site.css`
     lẫn `hopManHinh()` đều tưởng nó đã căn giữa. Hậu quả đo được: hai nhãn chồng
     nhau **16,9 px** trên trang thật, mà phép kiểm hộp vẫn báo "không chồng" — vì nó
     tính trên một cách neo không tồn tại.
     `iconAnchor` thì Leaflet áp bằng `margin-left`/`margin-top`, không đụng
     `transform`, nên nó thật sự có tác dụng. `iconSize: [0, 0]` giữ nguyên để
     `width: max-content` trong CSS quyết định bề rộng theo chữ.

     ⚠️ `hopManHinh()` PHẢI khớp từng số với hai `iconAnchor` ở đây. Đổi một bên mà
        quên bên kia là dựng lại đúng lỗi trên, và nó hỏng IM LẶNG. */
  function icNhan(cls, rong, cao, neo) {
    return L.divIcon({
      className: cls, iconSize: [0, 0],
      iconAnchor: neo === 'tam' ? [rong / 2, cao / 2] : [-7, cao / 2],
    });
  }

  /* Icon ẢNH cho lớp khai `icon: true` trong `lop.json`.

     🔴 KHÔNG có URL ảnh ở đây. Ảnh đến từ `background-image` của `.bd-ic--<ma>` trong
        `site.css` — một chỗ duy nhất, cùng luật với bảng màu. Truyền URL qua JS sẽ
        cần một thuộc tính style nội tuyến, mà CSP là `style-src 'self'` và
        `web/deploy.sh` có cổng chặn grep đúng chuỗi đó trong cả JS tự viết.
        (Không viết chuỗi ấy ra đây kể cả trong chú thích — cổng grep không phân biệt
        chú thích với mã, và một cổng kêu oan là một cổng người ta thôi đọc.)

     Marker là DOM thật nên CSS bám được — khác hình vẽ canvas của `preferCanvas`
     (§2.39), đó là lý do màu HÌNH đi bằng tuỳ chọn Leaflet còn cái này thì không. */
  const IC_ANH_PX = 28;

  function icAnh(ma) {
    return L.divIcon({
      className: 'bd-ic bd-ic--' + ma, iconSize: [IC_ANH_PX, IC_ANH_PX],
      iconAnchor: [IC_ANH_PX / 2, IC_ANH_PX / 2],
    });
  }

  /* Bỏ dấu + gộp khoảng trắng, để "Highland" và "highland" bị coi là MỘT chữ. */
  function chuanChu(x) { return boDau(String(x)).replace(/\s+/g, ' ').trim(); }

  function dungNhom(ten, o) {
    const S = LOP[ten] || {};
    const ma = S.ma || 'dd';
    const mau = S.mau || '#E2E8F0';
    const lop = L.layerGroup();
    const nhanDS = [];                       // {mk, ll, rong, cao, r} cho sapNhan()
    const cot = S.cot_chu || 11;
    const coNhan = typeof S.tier === 'number' && cot > 0;

    for (const [tenDiem, lat, lng] of (o.d || [])) {
      const cham = L.circleMarker([lat, lng], {
        radius: S.cham || 3, weight: 0, fillOpacity: 0.85,
        color: mau, fillColor: mau, interactive: true,
      });
      cham.bindTooltip(nhan(T(tenDiem), o.nhan));
      lop.addLayer(cham);
      if (!coNhan) continue;
      const tam = document.createElement('span');
      tam.textContent = T(tenDiem);
      const hd = hopNhan(T(tenDiem), cot);
      const mk = L.marker([lat, lng], {
        interactive: false, keyboard: false,
        icon: icNhan('poi-nhan poi-nhan--' + ma, hd.rong, hd.cao, 'phai'),
      });
      nhanDS.push({ mk, ll: [lat, lng], r: 0, neo: 'phai',
                    bien: [{ chu: tenDiem, ic: mk.options.icon, ...hd }] });
    }

    /* Kiểu vẽ lấy TỪNG SỐ từ `lop.json`. Trước đây cả bốn lớp vùng dùng chung
       `weight: 1.5, opacity: 0.7, fillOpacity: 0.06` — chụp production thấy vùng
       gần như vô hình, chấm POI nổi hơn hẳn chính vùng. */
    const goc = { weight: S.vien || 1.5, opacity: 0.95, color: mau, fillColor: mau };
    if (S.net) goc.dashArray = S.net;
    for (const [tenHinh, kind, toaDo, maVung] of (o.h || [])) {
      let hinh;
      if (kind === 2) {
        hinh = L.circle([toaDo[0], toaDo[1]],
          Object.assign({ radius: toaDo[2], fillOpacity: S.to || 0.06 }, goc));
      } else {
        const diem = [];
        for (let k = 0; k + 1 < toaDo.length; k += 2) diem.push([toaDo[k], toaDo[k + 1]]);
        hinh = (kind === 1)
          ? L.polygon(diem, Object.assign({ fillOpacity: S.to || 0.07 }, goc))
          : L.polyline(diem, Object.assign({}, goc));
      }
      hinh.bindTooltip(nhan(T(tenHinh), o.nhan));
      /* Rê chuột làm hình DÀY và ĐẬM lên. Với 61 vùng Tuần tra chồng nhau đây là
         cách duy nhất biết mình đang trỏ vào hình nào. Đi bằng TUỲ CHỌN Leaflet
         chứ không phải CSS — `preferCanvas` (xem khối đầu mục này). */
      hinh.on('mouseover', () => hinh.setStyle(
        { weight: (S.vien || 1.5) + 1.5, fillOpacity: (S.to || 0.06) + 0.10 }));
      hinh.on('mouseout', () => hinh.setStyle(
        { weight: S.vien || 1.5, fillOpacity: S.to || 0.06 }));
      /* `ma` (sha1 cua ten actor, 6 byte) đi kèm mỗi hình để nối được với dữ liệu
         ngoài. Chưa ai dùng — giữ vì nó là khoá NỐI DUY NHẤT đúng: `ten` trùng nhau
         giữa các lớp (6 tên), còn `eps` thì không được lộ ra trang công khai. */
      hinh.dino4vnMa = maVung || null;
      lop.addLayer(hinh);

      const t = tamHinh(kind, toaDo);

      /* Icon ở TÂM hình, dựng TRƯỚC khối nhãn và KHÔNG bị `coNhan` chặn: nhãn có thể
         bị `sapNhan` loại khi chen chúc, còn icon thì không — nó là thứ nhận ra lớp
         này ở mọi mức zoom. Lớp không khai `icon` thì không tốn marker nào. */
      if (S.icon && t) {
        L.marker([t.lat, t.lng], { interactive: false, keyboard: false,
                                   icon: icAnh(ma) }).addTo(lop);
      }

      if (!coNhan) continue;
      if (!t) continue;
      /* HAI biến thể chữ cho một nhãn vùng, và đây là điểm mấu chốt của cả mục này.

         `build-zones.py` đặt tên vùng = tên KHU VỰC gần nhất, nên phần lớn nhãn
         vùng trùng đúng chữ với một nhãn `areas` cách đó vài chục pixel. Đo trên
         dữ liệu thật: 8/19 nhãn vùng rơi vào trong 40 px của một nhãn khu vực
         VIẾT ĐÚNG CHỮ ĐÓ — và kết quả trên màn hình là "Highland Highland".
         Hai hộp đó KHÔNG chồng nhau, nên phép tránh chồng không bắt được.

         Thay vì bỏ nhãn đi (mất thông tin), hiện LOẠI VÙNG: chỗ đó thành
         "Highland" (khu vực) + "SANCTUARY" (vùng). Người chơi vừa biết mình ở đâu
         vừa biết vùng đó là loại gì — chính là câu hỏi họ đang hỏi. */
      const cls = 'vung-nhan vung-nhan--' + ma;
      const bien = [T(tenHinh), T(S.nhan_ngan || o.nhan)].map((chu) => {
        const h = hopNhan(chu, cot);
        return { chu, ic: icNhan(cls, h.rong, h.cao, 'tam'), ...h };
      });
      const mk = L.marker([t.lat, t.lng], {
        interactive: false, keyboard: false, icon: bien[0].ic,
      });
      nhanDS.push({ mk, ll: [t.lat, t.lng], r: t.r, neo: 'tam', bien });
    }
    return { lop, nhanDS };
  }

  /* ───────────────────────────────────────────── nhãn: ngưỡng zoom + TRÁNH CHỒNG

     🔴 NGƯỠNG ZOOM MỘT MÌNH KHÔNG ĐỦ. Đo trên chính `bando.json`: nếu vẽ hết nhãn
        thì lớp Tuần tra có 145 cặp chồng nhau ở z=-5, 81 cặp ở z=-4.5 (zoom mà
        điện thoại 360x640 mở ra), và **vẫn còn 2 cặp ở z=0** — tức là không có
        ngưỡng nào làm nó hết chồng. Nên phải có bước tránh chồng lúc chạy.

     Thuật toán tham lam, một chủ sở hữu duy nhất: sắp theo ĐỘ ƯU TIÊN NHÃN
     (`nhan_uu`, cao thắng) rồi bán kính giảm dần; giữ nhãn nếu hộp màn hình của nó
     không cắt hộp nào đã giữ.

     ⚠️ `nhan_uu` KHÁC `z`. `z` là thứ tự VẼ HÌNH (vùng to nằm dưới); `nhan_uu` là
        quyền giữ CHỖ CHỮ. Tên khu vực (`areas`) ưu tiên cao nhất vì nhiều tên vùng
        trùng đúng chữ với tên khu vực gần nó — bỏ cái trùng đi thì không mất gì.

     Thêm/bớt bằng addLayer/remove chứ KHÔNG `.style.display`: vừa đúng quy ước
     "không đụng .style", vừa thật sự gỡ DOM ra — trên điện thoại đó là khác biệt
     đo được. */
  /* Hai nhãn CÙNG CHỮ gần nhau hơn ngần này thì coi là trùng. 150 px: đủ rộng để
     bắt cặp "tên vùng ↔ tên khu vực" (đo được 8/19 cặp nằm trong 40 px), đủ hẹp để
     hai chỗ thật sự khác nhau mà tình cờ cùng tên vẫn hiện được cả hai. */
  const TRUNG_CHU_PX = 150;
  /* Khoảng thở quanh mỗi nhãn, nới ĐỀU bốn phía trong `hopManHinh()`.
     🔴 Phải LỚN HƠN quầng chữ. Mỗi nhãn mang `text-shadow: 0 0 6px` (viền tối để
        đọc được trên ảnh nền sáng), nên hai nhãn cách nhau 5 px vẫn có hai quầng
        chồng lên nhau và mắt đọc ra một từ dính liền — đã thấy đúng chuỗi
        "SANCTUARYghland" trên màn hình trong khi phép kiểm hộp báo "không chồng".
        Một phép kiểm chỉ đúng bằng cái nó đo, và nó đang đo chữ chứ không đo
        quầng chữ. */
  const THO_X = 9, THO_Y = 3;
  /* Nhãn nằm ngoài khung nhìn vẫn được `latLngToContainerPoint` trả về toạ độ (âm
     hoặc lớn hơn khung). Chúng KHÔNG được tranh chỗ với nhãn đang nhìn thấy —
     nếu không, một nhãn ở ngoài mép màn hình có thể hất một nhãn thật ra. Đệm
     `NGOAI_KHUNG` để nhãn vừa trôi vào mép không nhấp nháy. */
  const NGOAI_KHUNG = 80;

  let batNhan = true;
  /* Dồn nhiều yêu cầu tính lại về một khung hình. `dungMap()` gán lại biến này
     bằng bản có `requestAnimationFrame`; trước khi bản đồ dựng xong thì gọi thẳng. */
  let xepNhanSom = () => sapNhan();
  function sapNhan() {
    if (!map) return;
    const z = map.getZoom();
    const ung = [];
    for (const [ten, m] of lopTheoNhom) {
      const S = LOP[ten] || {};
      const bat = batNhan && m.hien && m.nhanDS
                  && typeof S.tier === 'number' && z >= S.tier;
      m.nhanHien = 0;
      if (!m.nhanDS) continue;
      if (!bat) { for (const n of m.nhanDS) n.mk.remove(); continue; }
      for (const n of m.nhanDS) ung.push({ n, m, uu: S.nhan_uu || 0 });
    }
    ung.sort((a, b) => (b.uu - a.uu) || (b.n.r - a.n.r));
    const giu = [];                 // hộp đã giữ
    const chuGiu = new Map();       // chữ đã giữ -> danh sách điểm màn hình
    const co = map.getSize();
    for (const { n, m } of ung) {
      const p = map.latLngToContainerPoint(n.ll);
      if (p.x < -NGOAI_KHUNG || p.y < -NGOAI_KHUNG
          || p.x > co.x + NGOAI_KHUNG || p.y > co.y + NGOAI_KHUNG) {
        n.mk.remove();
        continue;
      }
      let dat = null;
      for (const b of n.bien) {
        const h = hopManHinh(p, n, b);
        const roi = giu.every((g) =>
          h[2] < g[0] || h[0] > g[2] || h[3] < g[1] || h[1] > g[3]);
        if (!roi) continue;
        /* Cùng một chữ hiện hai lần cách nhau vài chục pixel đọc ra là lỗi hiển
           thị, dù hai hộp không hề chồng nhau. `TRUNG_CHU_PX` là bán kính coi hai
           nhãn cùng chữ là "cùng một chỗ". */
        const k = chuanChu(b.chu);
        const gan = (chuGiu.get(k) || []).some(
          (q) => Math.hypot(q.x - p.x, q.y - p.y) < TRUNG_CHU_PX);
        if (gan) continue;
        dat = { h, k, b };
        break;
      }
      if (!dat) { n.mk.remove(); continue; }
      giu.push(dat.h);
      if (!chuGiu.has(dat.k)) chuGiu.set(dat.k, []);
      chuGiu.get(dat.k).push(p);
      /* Đổi icon TRƯỚC khi thêm vào lớp: mỗi biến thể chữ có bề rộng khác nhau nên
         `iconAnchor` khác nhau. Đặt sai thứ tự là nhãn lệch tâm đúng bằng nửa hiệu
         hai bề rộng. `setIcon` dựng lại phần tử, nên `textContent` phải đặt SAU. */
      if (n.mk.options.icon !== dat.b.ic) n.mk.setIcon(dat.b.ic);
      m.lop.addLayer(n.mk);
      const el = n.mk.getElement();
      if (el) el.textContent = dat.b.chu;      // textContent, KHÔNG innerHTML
      m.nhanHien++;
    }
    for (const [, m] of lopTheoNhom) if (m.demNhan) m.demNhan();
  }

  /* Thứ tự vẽ tường minh theo `z` của `lop.json`.

     🔴 KHÔNG dùng `map.createPane()` + renderer riêng cho từng lớp. Hai canvas xếp
        chồng thì canvas TRÊN nhận hết sự kiện chuột và mọi lớp ở canvas DƯỚI mất
        sạch tooltip — hỏng câm. Giữ MỘT renderer, gọi `bringToFront()` theo thứ tự
        `z` tăng dần sau mỗi lần bật/tắt lớp. Leaflet dồn về một lần vẽ lại qua rAF
        nên 91 lời gọi vẫn là một khung. */
  function sapXep() {
    const ds = [...lopTheoNhom.entries()]
      .filter(([, m]) => m.hien && m.lop)
      .sort((a, b) => ((LOP[a[0]] || {}).z || 0) - ((LOP[b[0]] || {}).z || 0));
    for (const [, m] of ds) {
      for (const l of m.lop.getLayers()) if (l.bringToFront) l.bringToFront();
    }
  }

  /* 🔴 Chi muc tim kiem nap tu DU LIEU, KHONG tu cac lop da dung.
     Cac nhom tai nguyen (684 diem) duoc dung LUOI — chi khi nguoi dung bat. Neu
     chi muc nap trong `dungNhom` thi tim "Ash" luc lop "Cay qua" dang tat se ra
     RONG, va nguoi dung ket luan la ban do khong co — trong khi no co. Danh muc
     day du ton 860 ban ghi trong RAM, khong dang so; con mot o tim kiem tra loi
     sai thi khong ai dung lai lan hai. */
  function napChiMucTim(data) {
    for (const [khoa, o] of Object.entries(data.nhom)) {
      for (const [ten, lat, lng] of (o.d || [])) {
        moiDiem.push({ ten: T(ten), lat, lng, nhom: T(o.nhan), khoa });
      }
      for (const [ten, kind, toaDo] of (o.h || [])) {
        if (kind === 2) moiDiem.push({ ten: T(ten), lat: toaDo[0], lng: toaDo[1], nhom: T(o.nhan), khoa });
        else if (toaDo.length >= 2) moiDiem.push({ ten: T(ten), lat: toaDo[0], lng: toaDo[1], nhom: T(o.nhan), khoa });
      }
    }
  }

  /* `?lop=tt,dc` — bật sẵn vài lớp khi mở từ trang khác.
     Lý do tồn tại: `/prime` bảo người chơi "đi 4 vùng Tuần tra", mà lớp Tuần tra
     lại TẮT mặc định (61 hình, bật hết thì rối). Một câu hướng dẫn "nhớ tự bật lớp
     Vùng tuần tra" là một bước người ta sẽ quên, rồi mở bản đồ ra không thấy vùng
     nào và kết luận server không có — đúng kiểu hỏng im lặng.
     Chỉ ĐƯỢC PHÉP BẬT, không được tắt: một link ngoài không nên tắt lớp mà người
     dùng vẫn đang muốn thấy. Mã lạ thì bỏ qua, không báo lỗi. */
  function lopTheoUrl() {
    const raw = new URLSearchParams(location.search).get('lop') || '';
    const ma = new Set(raw.split(',').map((x) => x.trim()).filter(Boolean));
    if (!ma.size) return null;
    const ten = new Set();
    for (const [khoa, S] of Object.entries(LOP)) if (ma.has(S.ma)) ten.add(khoa);
    return ten.size ? ten : null;
  }

  /* Bảng chọn lớp, gom theo MỤC và có một câu giải thích cho mỗi lớp vùng.

     Bản cũ chỉ là `[✓] [chấm] Vùng tuần tra  61` — người chơi không có cách nào
     biết vùng đó dùng để làm gì, và đó chính là phàn nàn "thông tin chưa rõ ràng".
     Nay mỗi lớp vùng nói thẳng nó ứng với điều kiện Prime nào và cần mấy vùng. */
  function hangLop(ten, o, oChon, luon) {
    const S = LOP[ten] || {};
    const n = (o.d || []).length + (o.h || []).length;
    /* Lớp rỗng KHÔNG được hiện — một hàng bật lên không thấy gì là lời hứa suông.
       NGOẠI LỆ `luon`: lớp TRỰC TIẾP dựng hàng sẵn để giữ đúng thứ tự DOM, rồi tự
       ẩn/hiện theo dữ liệu chạy. Nó không phải lời hứa suông vì lúc rỗng nó ẩn hẳn. */
    if (!n && !luon) return null;

    const hang = document.createElement('label');
    hang.className = 'bd__o';
    const ip = document.createElement('input');
    ip.type = 'checkbox';
    ip.checked = !!o.bat;
    const cham = document.createElement('span');
    /* Hai KIỂU ký hiệu, không một: lớp điểm là chấm tròn, lớp vùng là thanh có
       viền mang đúng nét (liền/đứt) của lớp. Nhìn bảng là biết cái nào là một CHỖ
       và cái nào là một MIỀN. */
    cham.className = 'bd__cham bd__cham--' + (S.ma || 'dd')
                   + (S.hinh === 'vung' ? ' bd__cham--mien' : '')
                   + (S.net ? ' bd__cham--dut' : '');
    const chu = document.createElement('span');
    chu.textContent = T(o.nhan);
    const so = document.createElement('span');
    so.className = 'bd__so';
    so.textContent = String(n);
    hang.append(ip, cham, chu, so);
    oChon.appendChild(hang);

    let oMota = null;
    if (S.mota) {
      oMota = document.createElement('p');
      oMota.className = 'bd__mota';
      const t = document.createElement('span');
      t.textContent = T(S.mota);
      oMota.appendChild(t);
      if (S.link) {
        const a = document.createElement('a');
        a.href = S.link;
        a.textContent = T('Chi tiết');
        oMota.append(' ', a);
      }
      oChon.appendChild(oMota);
    }
    return { hang, ip, so, oMota, n };
  }

  function dungBangChon(data) {
    const oChon = $('bando-lop');
    if (!oChon) return;
    const epBat = lopTheoUrl();
    const theoMuc = new Map();
    for (const ten of Object.keys(data.nhom)) {
      const mm = (LOP[ten] || {}).muc || 'diahinh';
      if (!theoMuc.has(mm)) theoMuc.set(mm, []);
      theoMuc.get(mm).push(ten);
    }
    /* Lớp TRỰC TIẾP: hình KHÔNG nằm trong `bando.json` mà lấy từ `nguon_live` lúc chạy.
       `build-pois-latlng.py` bake cả khối `lop` nhưng bỏ nhóm rỗng khỏi `nhom`, nên lớp
       này có style mà không có dữ liệu tĩnh — đúng như thiết kế. */
    for (const ten of Object.keys(LOP)) {
      if (!LOP[ten].nguon_live || data.nhom[ten]) continue;
      const mm = LOP[ten].muc || 'diahinh';
      if (!theoMuc.has(mm)) theoMuc.set(mm, []);
      theoMuc.get(mm).push(ten);
    }

    for (const [maMuc, dsTen] of theoMuc) {
      const M = MUC[maMuc] || {};
      const h = document.createElement('h3');
      h.className = 'bd__muc';
      h.textContent = T(M.nhan || maMuc);
      oChon.appendChild(h);
      if (M.mota) {
        const p = document.createElement('p');
        p.className = 'bd__muc-mota';
        p.textContent = T(M.mota);
        oChon.appendChild(p);
      }

      for (const ten of dsTen) {
        const truc_tiep = !data.nhom[ten];
        const o = data.nhom[ten]
          || { nhan: (LOP[ten] || {}).nhan || ten, bat: !!(LOP[ten] || {}).bat, h: [] };
        const r = hangLop(ten, o, oChon, truc_tiep);
        if (!r) continue;
        if (truc_tiep) {
          /* Chưa có sự kiện nào -> ẩn HẲN hàng. Hiện một hàng "0" là mời người ta bật
             lên rồi không thấy gì. Khi có sự kiện, `capNhatSuKien` sẽ hiện lại. */
          r.hang.hidden = true;
          if (r.oMota) r.oMota.hidden = true;
        }
        const muc = { lop: null, nhanDS: null, hien: false, o: r.ip,
                      nhanHien: 0, demNhan: null };
        /* Số nhãn ĐANG HIỆN, không phải số vùng. Thiếu dòng này người dùng đếm chữ
           trên màn hình rồi kết luận có 42 vùng Tuần tra — trong khi có 61.
           Cùng lý do `_data/vung.js` không cho gõ tay con số vào `/prime`. */
        muc.demNhan = () => {
          r.so.textContent = (muc.hien && muc.nhanDS && muc.nhanDS.length
                              && muc.nhanHien < muc.nhanDS.length)
            ? T('hiện {a}/{b} tên', { a: muc.nhanHien, b: r.n })
            : String(r.n);
        };
        lopTheoNhom.set(ten, muc);
        if (truc_tiep) { muc.trucTiep = true; muc.hangDOM = r; lopTrucTiep.set(ten, muc); }

        const bat = (on) => {
          muc.hien = on;
          if (on) {
            /* Dựng LƯỜI: nhóm tài nguyên có 684 điểm và tắt mặc định. Ai không bao
               giờ bật thì không bao giờ trả giá DOM cho chúng. */
            if (!muc.lop) {
              const d = dungNhom(ten, muc.trucTiep ? (muc.oChay || o) : o);
              muc.lop = d.lop; muc.nhanDS = d.nhanDS;
            }
            muc.lop.addTo(map);
          } else if (muc.lop) { muc.lop.remove(); }
          /* Bật/tắt lớp KHÔNG đổi khung nhìn nên `moveend` không bắn — phải tự gọi.
             Vẫn qua rAF để bật liền mấy lớp chỉ tính lại một lần. */
          xepNhanSom();
          sapXep();
        };
        r.ip.addEventListener('change', () => bat(r.ip.checked));
        if (epBat && epBat.has(ten)) r.ip.checked = true;
        if (r.ip.checked) bat(true); else muc.demNhan();
      }
    }

    /* Lớp ẢNH dựng hàng bằng một hàm riêng, KHÔNG đi đường `nguon_live`.
       Lý do đo được: khai `nguon_live` sẽ đẩy nó vào `lopTrucTiep`, rồi `nhipSuKien`
       gọi `capNhatSuKien` với danh sách RỖNG (endpoint sự kiện không biết lớp này)
       và dòng `hang.hidden = !co` sẽ ẩn hàng VĨNH VIỄN. Đường đó chủ động phá tính
       năng, và nó hỏng im lặng. */
    dungHangDuongDi(oChon);
  }

  function boDau(s) {
    return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  function dungTim() {
    const o = $('bando-tim'), kq = $('bando-tim-kq');
    if (!o || !kq) return;
    o.addEventListener('input', () => {
      const q = boDau(o.value.trim());
      kq.replaceChildren();
      if (q.length < 2) return;
      const ds = moiDiem.filter((d) => boDau(d.ten).includes(q)).slice(0, 12);
      if (!ds.length) {
        const p = document.createElement('p');
        p.className = 'dim nho mb-0';
        p.textContent = T('Không tìm thấy.');
        kq.appendChild(p);
        return;
      }
      for (const d of ds) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bd__kq-o';
        const t = document.createElement('span');
        t.textContent = d.ten;
        const g = document.createElement('span');
        g.className = 'bd__kq-nhom';
        g.textContent = oLuoi(d.lat, d.lng) || d.nhom;
        b.append(t, g);
        b.addEventListener('click', () => {
          /* Nhay toi mot diem thuoc lop DANG TAT thi nguoi dung nhin vao cho
             trong. Bat lop do len truoc — day la thu ho vua noi la ho muon thay. */
          const m = lopTheoNhom.get(d.khoa);
          if (m && !m.hien && m.o) { m.o.checked = true; m.o.dispatchEvent(new Event('change')); }
          map.setView([d.lat, d.lng], 0);
          dongBang();
        });
        kq.appendChild(b);
      }
    });
  }

  /* ───────────────────────────────────────────── trạng thái + loài */
  function veTrangThai(d) {
    const cham = $('bando-tt-cham'), chu = $('bando-tt-so');
    if (!chu) return;
    if (!d) { dat(chu, T('Chưa rõ trạng thái')); return; }
    const tuoi_ok = !!(d && (d.online === true || d.ok === true));
    if (!tuoi_ok) {
      if (cham) cham.className = 'tt__cham';
      dat(chu, T('Chưa rõ trạng thái'));
      return;
    }
    if (d.online !== true && d.ok !== true) {
      if (cham) cham.className = 'tt__cham';
      dat(chu, T('Server đang bảo trì'));
      return;
    }
    if (cham) cham.className = 'tt__cham tt__cham--on';
    const tg = d.updatedAt ? gio(d.updatedAt) : gio(Date.now());
    dat(chu, typeof d.players === 'number'
      ? T('{n}/{max} đang chơi · {gio}', { n: d.players, max: d.maxPlayers || d.max_players || 200, gio: tg })
      : T('Đang chạy · chưa đếm được'));
  }

  function veLoai(d) {
    const o = $('bando-loai');
    if (!o) return;
    const sl = (d && (d.online === true || d.ok === true)) ? (d.speciesLive || d.top_species) : null;
    o.replaceChildren();
    const p = document.createElement('p');
    p.className = 'dim nho mb-0';
    if (!sl || typeof sl !== 'object') { p.textContent = T('Chưa lấy được.'); o.appendChild(p); return; }
    const ds = Array.isArray(sl)
      ? sl.map((item, i) => [item, Math.max(1, 10 - i)])
      : Object.entries(sl).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!ds.length) { p.textContent = T('Chưa có ai trong game.'); o.appendChild(p); return; }
    const box = document.createElement('div');
    box.className = 'bd__loai';
    for (const [loai, n] of ds) {
      const chip = document.createElement('span');
      chip.className = 'bd__loai-o';
      const t = document.createElement('b');
      t.textContent = loai;
      const s = document.createElement('span');
      s.className = 'bd__loai-n';
      s.textContent = String(n);
      chip.append(t, s);
      box.appendChild(chip);
    }
    o.appendChild(box);
  }

  /* ───────────────────────────────────────────── vị trí của chính mình */
  let hen = null;

  function hienKhoi(ten) {
    for (const id of ['bando-toi-dangtai', 'bando-toi-chuadangnhap', 'bando-toi-co']) {
      const el = $(id);
      if (el) el.hidden = (id !== ten);
    }
  }

  function xoaCham() {
    if (chamToi) { chamToi.remove(); chamToi = null; }
    if (vongTam) { vongTam.remove(); vongTam = null; }
    viTriToi = null;
    const o = $('bando-toi-o');
    if (o) o.hidden = true;
  }

  function veToi(d) {
    if (!d || d.ok !== true) {
      xoaCham(); hienKhoi('bando-toi-co');
      dat($('bando-toi-chu'), T('Chưa lấy được vị trí. Bản đồ vẫn dùng bình thường.'));
      return;
    }
    if (d.in_game !== true) {
      xoaCham(); hienKhoi('bando-toi-co');
      dat($('bando-toi-chu'), T('Bạn chưa vào game.'));
      return;
    }
    const tre = Math.round(d.age_s || 0);
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number'
        || d.stale === true || tre * 1000 > QUA_CU) {
      xoaCham(); hienKhoi('bando-toi-co');
      dat($('bando-toi-chu'), T('Dữ liệu vị trí quá cũ, tạm không hiện.'));
      return;
    }
    viTriToi = [d.lat, d.lng];
    if (!chamToi) {
      chamToi = L.marker(viTriToi, {
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,          // luôn nằm trên nhãn địa danh
        icon: L.divIcon({ className: 'ct', html: HTML_CHAM_TOI, iconSize: [0, 0] }),
      }).addTo(map);
    } else {
      chamToi.setLatLng(viTriToi);
    }
    veVongTam();
    hienKhoi('bando-toi-co');
    const oToi = $('bando-toi-o');
    if (oToi) { oToi.textContent = T('Ô {o}', { o: oLuoi(d.lat, d.lng) }); oToi.hidden = false; }
    const phan = [];
    if (d.species) phan.push(d.species);
    if (typeof d.growth === 'number') phan.push(T('{n}% trưởng thành', { n: Math.round(d.growth * 100) }));
    dat($('bando-toi-chu'),
      (phan.length ? phan.join(' · ') + '. ' : '') + T('Đo cách đây ~{n} giây.', { n: tre }));
  }

  /* Vòng tầm 300 m / 1 km quanh chỗ mình đứng.
     Bản đồ không có thước tỉ lệ nên "chấm kia ở đâu đó bên phải" không nói lên
     gì; hai vòng này biến nó thành "cách khoảng 700 m". Lấy từ bản đồ lớn của
     launcher (`gate0.html` `.tam`).

     🔴 Bán kính tính từ CHÍNH tỉ lệ của bản đồ (`px_moi_cm` trong `bando.json`),
        KHÔNG phải một con số gõ tay — đổi độ phân giải ảnh hay hiệu chuẩn lại
        map thì vòng vẫn đúng khoảng cách.

     ⚠️ KHÁC launcher: ở đây vòng là `L.circle` nên bán kính tính bằng đơn vị CRS
        (= pixel ảnh), tức là nó CO GIÃN THEO ZOOM — đúng với một vòng đo khoảng
        cách. Vòng nhấp nháy thì ngược lại, cố định theo pixel MÀN HÌNH vì nó là
        dấu hiệu thu hút mắt, không phải phép đo. */
  const TAM = [[30000, '300 m'], [100000, '1 km']];
  /* Dưới ngưỡng này thì vòng tầm là rác: nó nằm lọt trong vòng nhấp nháy (150px
     cố định theo màn hình) và nhãn đè lên chấm. Launcher có cùng phép chặn
     (`r < 12` -> bỏ) nhưng bản đồ nó KHÔNG zoom được nên chỉ cần một lần; ở đây
     phải tính lại mỗi lần đổi zoom.
     45px: đủ để nhãn tách khỏi chấm, và đúng lúc người dùng đã zoom vào để nhìn
     quanh mình — tức là đúng lúc khoảng cách mới có nghĩa. Ở mức nhìn cả đảo,
     một vòng 300m không nói lên điều gì. */
  const TAM_MIN_PX = 45;

  function veVongTam() {
    if (!map || !PX_MOI_CM || !viTriToi) return;
    if (vongTam) { vongTam.remove(); vongTam = null; }
    const tiLe = Math.pow(2, map.getZoom());     // CRS.Simple: 1 đơn vị = 1 px ở zoom 0
    vongTam = L.layerGroup();
    let ve = 0;
    for (const [cm, nhan] of TAM) {
      const r = cm * PX_MOI_CM;
      if (r * tiLe < TAM_MIN_PX) continue;
      ve++;
      const v = L.circle(viTriToi, {
        radius: r, fill: false, color: '#7CF2A6', weight: 1,
        opacity: 0.30, dashArray: '4 5', interactive: false,
      });
      vongTam.addLayer(v);
      vongTam.addLayer(L.marker([viTriToi[0] + r, viTriToi[1]], {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'ct__tam-nhan', html: nhan, iconSize: [0, 0] }),
      }));
    }
    if (ve) vongTam.addTo(map);
    else { vongTam = null; }
  }

  /* ─────────────────────────────────── lớp TRỰC TIẾP: sự kiện có thời hạn */
  /* Vẽ lại bằng CHÍNH `dungNhom` — không có bản vẽ thứ hai. Nhờ vậy vòng tròn sự kiện
     có đủ hover, tooltip, nhãn tránh chồng và thứ tự z y như ba lớp vùng Prime.

     🔴 Màu đi bằng tuỳ chọn Leaflet chứ KHÔNG bằng class CSS: `preferCanvas: true`
        khiến Leaflet vẽ bằng `ctx.fill()` và không dựng phần tử DOM nào để CSS bám
        vào (§2.39). `dungNhom` đã làm đúng — đây là lý do phải dùng lại nó. */
  function capNhatSuKien(ten, ds) {
    const muc = lopTrucTiep.get(ten);
    if (!muc) return;
    const S = LOP[ten] || {};
    const co = Array.isArray(ds) && ds.length;

    /* Nhãn nhóm mang đồng hồ đếm ngược. Client TỰ trừ dần từ `con_giay` server gửi —
       không nhận mốc tuyệt đối, vì đồng hồ máy người xem có thể lệch hàng phút. */
    let nhan = T(S.nhan || ten);
    if (co) {
      const giay = Math.max(...ds.map((z) => z.con_giay || 0));
      if (giay > 0) nhan += T(' · còn {n} phút', { n: Math.max(1, Math.round(giay / 60)) });
    }
    muc.oChay = {
      nhan: nhan,
      /* `S.ma` chứ KHÔNG phải `'sk'` gán cứng: từ 2026-09-05 có lớp trực tiếp thứ
         hai (`diem_tu`), và mã lớp là thứ chọn class CSS của nhãn
         (`.vung-nhan--<ma>`). Gán cứng thì nhãn Điểm tụ mang màu chữ của AI Zone. */
      h: (ds || []).map((z) => [z.t || '', 2, [z.lat, z.lng, z.r], S.ma || 'sk']),
    };

    const hang = muc.hangDOM;
    if (hang) {
      hang.hang.hidden = !co;
      if (hang.oMota) hang.oMota.hidden = !co;
      hang.n = co ? ds.length : 0;
      hang.so.textContent = String(hang.n);
    }
    if (muc.lop) { muc.lop.remove(); muc.lop = null; muc.nhanDS = null; }
    if (co && muc.o && muc.o.checked) {
      const d = dungNhom(ten, muc.oChay);
      /* 🔴 Nhãn đặt ở MÉP BẮC của vòng, KHÔNG phải tâm.
         Đo trên bản đồ thật 2026-09-01: cả 2/2 nhãn bị `sapNhan` loại, bảng chọn ghi
         "hiện 0/2 tên". Lý do: tâm vùng sự kiện rơi gần đúng chỗ nhãn khu vực
         (`build-zones.py` đặt tên vùng = tên khu vực GẦN NHẤT, nên chuyện này là
         thường xuyên chứ không phải trùng hợp), mà `areas` có `nhan_uu` 100 > 95 nên
         nó giữ chỗ trước. CẢ HAI biến thể chữ cùng neo một điểm ⇒ cùng đụng một ô đã
         giữ ⇒ không biến thể nào lọt.
         Dời lên mép vòng vừa gỡ đụng độ, vừa đúng lối vẽ bản đồ: nhãn của một MIỀN
         rộng 1 km nằm ở tâm thì không nói được nó thuộc về vòng nào. */
      for (const n of d.nhanDS) {
        n.ll = [n.ll[0] + n.r, n.ll[1]];
        n.mk.setLatLng(n.ll);
      }
      muc.lop = d.lop; muc.nhanDS = d.nhanDS;
      muc.lop.addTo(map);
      muc.hien = true;
    } else {
      muc.hien = false;
    }
    if (muc.demNhan) muc.demNhan();
    xepNhanSom();
    sapXep();
  }

  /* ─────────────────────────────────── lớp ẢNH: Đường đi giờ trước */
  /* Vẽ danh sách ĐƯỜNG ĐI thành nét trên một canvas rồi phủ lên bản đồ bằng data URL.

     🔴 KHÔNG dùng `putImageData` + LUT 256 màu như `panel/web/heat.js`. Hai lý do:
        (a) đây là NÉT, không phải ô. Tô ô rồi làm mờ cho ra đốm, không ra tuyến.
        (b) `putImageData` bắt lặp `size × size`. Ở 2048² là 4,2 triệu vòng, trên
            điện thoại tầm trung. `ctx.stroke()` cho vài nghìn nét là việc của tầng
            vẽ 2D, không phải của vòng lặp JS.
     🔴 `toDataURL` chứ KHÔNG `toBlob`/`createObjectURL`: CSP của site là
        `img-src 'self' data:` và KHÔNG có `blob:` — đường blob bị chặn IM LẶNG.
     ⚠️ Canvas này không bị "tainted" vì ta chỉ tự vẽ nét, không vẽ ảnh khác gốc nào
        vào. Ngày nào có ai vẽ ảnh nền vào đây "cho đẹp" thì `toDataURL` sẽ ném
        SecurityError và lớp biến mất im lặng.

     🔴 KHÔNG có bảng mức, KHÔNG có quầng, KHÔNG có đường cong bịa thêm. Server gửi
        đúng những đường người ta đã đi; việc của hàm này là vẽ lại chúng, hết. Mọi
        thứ "làm cho đẹp" thêm vào đây đều là bịa dữ liệu, và bịa trên một lớp mà
        người xem sẽ đọc như sự thật. */
  function veDuongDi(d, rong) {
    const cv = document.createElement('canvas');
    cv.width = DD_RA_PX;
    cv.height = DD_RA_PX;
    const ctx = cv.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    /* 🔴 `lighter` — xem khối lý do ở `DD_MAU`. Độ sáng LÀ lưu lượng: nét chồng nét
       tự cộng lên. Đổi sang `source-over` là mất toàn bộ dải động, mọi lối mòn
       trông giống hệt một chuyến đi lẻ. */
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = DD_MAU;
    ctx.lineWidth = rong;

    const b = DD_RA_PX / d.dpg;
    for (const dd of d.duong) {
      if (!Array.isArray(dd) || dd.length < 4) continue;
      /* Giải mã HIỆU: `[x0, y0, dx1, dy1, ...]`. Cộng dồn trên số nguyên đúng như
         server đã mã hoá, nên không có sai số nào để trôi. */
      let x = dd[0] | 0, y = dd[1] | 0;
      ctx.beginPath();
      ctx.moveTo(x * b, y * b);
      for (let i = 2; i + 1 < dd.length; i += 2) {
        x += dd[i] | 0;
        y += dd[i + 1] | 0;
        ctx.lineTo(x * b, y * b);
      }
      ctx.stroke();
    }
    return cv.toDataURL('image/png');
  }

  /* Bề rộng nét trên canvas để nó ra đúng `DD_NET_MAN_HINH` px trên màn hình. */
  function ddRongNet() {
    if (!map || !KHUNG) return 2.0;
    const z = map.getZoom();
    const a = map.project([0, 0], z);
    const b = map.project([KHUNG.cao, KHUNG.rong], z);
    const manHinh = Math.max(1, Math.abs(b.x - a.x));
    const r = DD_NET_MAN_HINH * DD_RA_PX / manHinh;
    return Math.min(DD_RONG_MAX, Math.max(DD_RONG_MIN, r));
  }

  /* Vẽ lại khi đổi mức phóng. Chỉ vẽ lại khi bề rộng đổi ĐÁNG KỂ — `toDataURL` trên
     canvas 2048² tốn vài trăm ms, và người ta hay bấm zoom liên tiếp. */
  function ddVeLai() {
    if (!DD.lop || !DD.d || !DD.d.co) return;
    const r = ddRongNet();
    if (DD.rongDaVe && Math.abs(r - DD.rongDaVe) / DD.rongDaVe < 0.12) return;
    DD.rongDaVe = r;
    DD.lop.setUrl(veDuongDi(DD.d, r));
  }

  function goDuongDi() {
    if (DD.lop) { DD.lop.remove(); DD.lop = null; }
    DD.veRoi = false;
    DD.rongDaVe = 0;
  }

  /* Ba trạng thái, KHÔNG được gộp — người ta đọc MÀU trước khi đọc chữ:
       (a) có ảnh          → hàng hiện, tick bật được, `.bd__so` là mốc giờ
       (b) giờ vắng        → BÌNH THƯỜNG, không phải lỗi. Tick khoá, chữ nói rõ.
       (c) quá cũ/từ chối  → LỖI. Tick khoá + bỏ tick, XOÁ lớp, chữ màu `--mau`.
     Gộp (b) với (c) là đúng họ lỗi LUẬT 2 (`null` khác `0`) mà repo đã trả giá. */
  function trangThaiDD() {
    const h = DD.hang;
    if (!h) return;
    const d = DD.d;
    const dat2 = (el, s) => { if (el) el.textContent = s; };

    if (!d) {                       // chưa đọc được lần nào — ẩn hẳn, xem `hangLop`
      h.hang.hidden = true;
      if (h.oMota) h.oMota.hidden = true;
      goDuongDi();
      return;
    }
    h.hang.hidden = false;
    if (h.oMota) h.oMota.hidden = false;
    /* 🔴 Người dùng chốt 2026-09-17: bỏ hai câu mô tả, chỉ để lại tiêu đề.
       Nhưng hai câu đó CHÍNH LÀ chỗ phân biệt (b) "giờ vắng" — BÌNH THƯỜNG — với
       (c) "quá cũ / từ chối" — LỖI. Bỏ chữ mà không chuyển tín hiệu đi đâu là gộp
       hai trạng thái làm một, đúng họ lỗi LUẬT 2 (`null` khác `0`).
       Nên tín hiệu chuyển sang chính ô bên phải (`.bd__so`): (b) chữ thường, (c)
       mang class `--loi` (màu `--mau`). Vẫn đọc màu trước khi đọc chữ. */
    h.so.classList.remove('bd__so--loi');

    const tuoi = Date.now() - (d.phat || 0) * 1000;
    const hongKhung = !KHUNG || !d.khung
      || d.khung.cao !== KHUNG.cao || d.khung.rong !== KHUNG.rong;
    /* 🔴 CỔNG PHIÊN BẢN — bịt đúng một khe có thật, không phải phòng xa.
       Web deploy TỨC THÌ, còn tệp JSON chỉ được sinh lại ở phút :14. Giữa hai mốc
       đó, bản `map.js` mới đọc phải tệp `schema: 1` của đời trước (khoá `o`/`luoi`
       thay vì `duong`/`dpg`): `d.dpg` là `undefined` nên phép so trần LỌT (mọi phép
       so với `undefined` đều false), rồi `for (const dd of d.duong)` NÉM và cả trang
       bản đồ chết. Cùng chuyện xảy ra theo chiều ngược khi rollback job mà không
       rollback web. Không đọc được thì theo LUẬT 3: XOÁ lớp, nói "tạm ẩn". */
    const laPhienBanLa = d.schema !== 2
      || (d.co && (!Array.isArray(d.duong) || typeof d.dpg !== 'number'));
    if (tuoi > DD_QUA_CU + LECH || laPhienBanLa || d.dpg > DD_DPG_MAX || hongKhung) {
      /* (c) — LUẬT 3: dữ liệu cũ TỆ HƠN không có. Xoá lớp, không làm mờ.
         `hongKhung` là cổng hiệu chuẩn: ai đó hiệu chuẩn lại bản đồ mà quên chạy
         lại job thì các nét nằm sai chỗ mà không một dòng lỗi nào — cùng lý do
         `panel/app/api_map.py` trả 409 thay vì vẽ đè hai bản đồ lệch nhau. */
      h.ip.checked = false;
      h.ip.disabled = true;
      h.so.classList.add('bd__so--loi');
      dat2(h.so, T('tạm ẩn'));
      goDuongDi();
      return;
    }
    if (!d.co) {
      /* (b) — giờ vắng. Câu chữ PHẢI nói ra rằng đây là bình thường: một dòng cụt
         kiểu "không có dữ liệu" đọc y hệt một lỗi, và người đọc sẽ báo hỏng. */
      h.ip.checked = false;
      h.ip.disabled = true;
      dat2(h.so, T('giờ vắng'));          // chữ thường: đây là trạng thái BÌNH THƯỜNG
      goDuongDi();
      return;
    }
    // (a)
    h.ip.disabled = false;
    dat2(h.so, gio(d.tu) + '–' + gio(d.den));
    if (h.ip.checked && !DD.veRoi) {
      DD.veRoi = true;
      DD.rongDaVe = ddRongNet();
      DD.lop = L.imageOverlay(veDuongDi(d, DD.rongDaVe), BIEN,
        { pane: 'duongdiPane', opacity: DD_MO }).addTo(map);
    } else if (!h.ip.checked) {
      goDuongDi();
    }
  }

  function dungHangDuongDi(oChon) {
    const S = LOP.duong_di;
    if (!S || !oChon) return;
    const M = MUC[S.muc] || {};
    const h3 = document.createElement('h3');
    h3.className = 'bd__muc';
    h3.textContent = T(M.nhan || 'Người chơi');
    oChon.appendChild(h3);
    if (M.mota) {
      const p = document.createElement('p');
      p.className = 'bd__muc-mota';
      p.textContent = T(M.mota);
      oChon.appendChild(p);
    }
    /* `luon = true`: dựng hàng sẵn dù chưa có dữ liệu, rồi tự ẩn/hiện theo trạng
       thái — đúng đường mà lớp trực tiếp đang dùng (`hangLop`). */
    DD.hang = hangLop('duong_di', { nhan: S.nhan, bat: !!S.bat, h: [] }, oChon, true);
    if (!DD.hang) return;
    DD.hang.hang.hidden = true;
    if (DD.hang.oMota) DD.hang.oMota.hidden = true;
    const epBat = lopTheoUrl();
    if (epBat && epBat.has('duong_di')) DD.hang.ip.checked = true;
    DD.hang.ip.addEventListener('change', () => {
      if (!DD.hang.ip.checked) goDuongDi();
      DD.veRoi = false;
      trangThaiDD();
    });
    trangThaiDD();
  }

  async function nhipDuongDi() {
    /* Lỗi mạng KHÔNG xoá bản vẽ đang có: mất mạng 5 giây mà lớp biến mất thì người
       xem tưởng tính năng hỏng. Nó tự già đi và rơi vào trạng thái (c) qua phép
       kiểm tuổi — đó mới là đường xoá đúng. */
    try {
      const d = await nap(API_DD, CHO_DD);
      if (d && typeof d === 'object' && typeof d.phat === 'number') {
        DD.d = d;
        DD.veRoi = false;
      }
    } catch { /* giữ nguyên bản cũ */ }
    trangThaiDD();
    setTimeout(nhipDuongDi, NHIP_DD);
  }

  async function nhipSuKien() {
    /* Lỗi mạng KHÔNG được xoá vùng đang vẽ: mất mạng 5 giây mà bản đồ trống trơn thì
       người chơi tưởng sự kiện đã kết thúc và bỏ đi. Giữ nguyên bản vẽ cũ — nó tự già
       đi theo đồng hồ đếm ngược, và lần poll sau sẽ sửa. */
    try {
      const d = await nap(API_SK);
      const ds = (d && d.ds) || [];
      /* 🔴 LỌC theo `z.lop`. Một endpoint mang CẢ HAI lớp trực tiếp (AI Zone và Điểm
         tụ) vì chúng do cùng một script ghi ra cùng một file. Không lọc thì mỗi lớp vẽ
         hết mọi vùng của cả hai — hai vòng chồng khít nhau, hai màu, và bảng chọn ghi
         số gấp đôi. `lop` do server gán (`telemetry._LOAI_LOP`) nên client không phải
         mang bảng tra thứ hai. */
      for (const ten of lopTrucTiep.keys()) {
        capNhatSuKien(ten, ds.filter((z) => (z.lop || 'su_kien') === ten));
      }
    } catch { /* giữ nguyên bản vẽ cũ */ }
    clearTimeout(henSK);
    henSK = setTimeout(() => { if (!document.hidden) nhipSuKien(); }, NHIP_SK);
  }

  async function nhipToi() {
    let d = null, nhip = 30000;
    try {
      d = await nap(API_TOI);
      if (d && typeof d.tick_s === 'number') nhip = Math.max(5, d.tick_s) * 1000;
      veToi(d);
    } catch (e) {
      if (e && e.ma === 401) {
        xoaCham(); hienKhoi('bando-toi-chuadangnhap');
        return;                          // KHÔNG hẹn lại — tránh vòng lặp 401
      }
      veToi(null);
    }
    clearTimeout(hen);
    hen = setTimeout(() => { if (!document.hidden) nhipToi(); }, nhip);
  }

  async function batDauToi() {
    let me = null;
    try { me = await (window.__dino4vnMe || nap('/api/player/me')); } catch { me = null; }
    if (!me || me.logged_in !== true) { hienKhoi('bando-toi-chuadangnhap'); return; }
    hienKhoi('bando-toi-co');
    dat($('bando-toi-chu'), T('Đang lấy vị trí…'));
    const nut = $('bando-toi-nut');
    if (nut) nut.addEventListener('click', () => { if (viTriToi) map.setView(viTriToi, 0); });
    nhipToi();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) nhipToi(); });
  }


  /* ───────────────────────────────────────────── bảng điều khiển */
  function moBang() {
    document.body.classList.add('bang-mo');
    const n = $('bando-mo');
    if (n) n.setAttribute('aria-expanded', 'true');
  }
  function dongBang() {
    document.body.classList.remove('bang-mo');
    const n = $('bando-mo');
    if (n) n.setAttribute('aria-expanded', 'false');
  }

  function dungZoom() {
    const noi = (id, d) => {
      const n = $(id);
      if (!n) return;
      n.addEventListener('click', () => {
        /* `setView(..., {animate:false})` chứ KHÔNG `setZoom()`.
           `setZoom` đi đường zoom-ĐỘNG của Leaflet, và trên trang này đường đó
           không bao giờ hoàn tất: đo được handler trả về sau 0 ms, không lỗi,
           không có gì đổi — cả nhãn POI lẫn ảnh nền đều đứng im. Ép đặt lại view
           bỏ qua toàn bộ tầng animation đó. */
        map.setView(map.getCenter(), map.getZoom() + d, { animate: false });
        // Nút bị vô hiệu ở hai đầu dải zoom — bấm mãi không thấy gì đổi mà
        // không hiểu vì sao là khó chịu hơn một nút mờ đi.
        capNhatZoom();
      });
    };
    noi('bando-zoom-in', 1);
    noi('bando-zoom-out', -1);
    map.on('zoomend', capNhatZoom);
    capNhatZoom();
  }

  function capNhatZoom() {
    const z = map.getZoom();
    const vao = $('bando-zoom-in'), ra = $('bando-zoom-out');
    if (vao) vao.disabled = z >= map.getMaxZoom();
    if (ra) ra.disabled = z <= map.getMinZoom();
  }

  function dungTuyChon() {
    const nutMo = $('bando-mo'), nutDong = $('bando-dong');
    if (nutMo) nutMo.addEventListener('click', () => {
      document.body.classList.contains('bang-mo') ? dongBang() : moBang();
    });
    if (nutDong) nutDong.addEventListener('click', dongBang);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dongBang(); });

    const oLuoiBat = $('bando-luoi');
    if (oLuoiBat) oLuoiBat.addEventListener('change', () => {
      if (!lopLuoi) return;
      oLuoiBat.checked ? lopLuoi.addTo(map) : lopLuoi.remove();
    });

    const oNhan = $('bando-nhan');
    if (oNhan) oNhan.addEventListener('change', () => {
      batNhan = oNhan.checked;
      sapNhan();
    });

    const truot = $('bando-mo-anh');
    // `setOpacity` là API của Leaflet, KHÔNG phải ghi vào `.style` của ta.
    if (truot) truot.addEventListener('input', () => {
      if (lopAnh) lopAnh.setOpacity(Number(truot.value) / 100);
    });

    const toanMan = $('bando-toanman');
    if (toanMan && document.documentElement.requestFullscreen) {
      toanMan.addEventListener('click', () => {
        const el = document.querySelector('.bd');
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (el && el.requestFullscreen) {
          el.requestFullscreen().then(() => { dongBang(); setTimeout(() => map.invalidateSize(), 120); })
            .catch(() => {});
        }
      });
      document.addEventListener('fullscreenchange', () => setTimeout(() => map.invalidateSize(), 120));
    } else if (toanMan) {
      toanMan.hidden = true;      // Safari iOS: không có API -> ẩn hẳn, đừng hứa suông
    }
  }

  /* ───────────────────────────────────────────── khởi động */
  (async () => {
    /* Hai fetch chạy SONG SONG — và thứ tự hai dòng này LÀ bản vá.
       `chonBoNen()` không bao giờ ném và có hạn riêng 1,5 giây, nhưng gọi nó bằng
       `await` TRƯỚC `bando.json` là cộng thẳng độ trễ của một file cấu hình tí hon
       vào thời gian mở bản đồ. Bắn trước, lấy kết quả sau: `bando.json` (35 KB)
       gần như luôn về sau, nên trong thực tế không tốn thêm giây nào.
       🔴 Bản đồ KHÔNG được phụ thuộc vào fetch này để lên hình. */
    const dangChonNen = chonBoNen();
    let data;
    try {
      data = await nap(DU_LIEU);
    } catch {
      const p = document.createElement('p');
      p.className = 'bd__noscript';
      p.textContent = T('Chưa tải được dữ liệu bản đồ. Thử tải lại trang.');
      hop.replaceChildren(p);
      return;
    }
    /* Gán TRƯỚC `dungMap()` — đó là chỗ `L.imageOverlay` đọc `ANH_XA`. Đặt sau
       là vẽ bằng ảnh lùi rồi mới đổi, tức mỗi lượt xem tải thừa nguyên một ảnh. */
    const boNen = await dangChonNen;
    if (boNen) {
      ANH_XA = boNen.xa;
      ANH_GAN = boNen.gan;
    } else {
      /* TƯỜNG MINH: không đọc được lựa chọn thì nói ra là đang chạy đường lùi.
         Im lặng ở đây nghĩa là ngày panel gõ sai một tên file, triệu chứng duy
         nhất sẽ là "bản đồ trông hơi khác" và không ai nối được nguyên nhân. */
      console.warn('[map] khong doc duoc ' + API_NEN + ' -> dung bo anh nen lui');
    }
    LOP = data.lop || {};
    MUC = data.muc || {};
    dungMap(data.khung, data.px_moi_cm);
    napChiMucTim(data);
    dungBangChon(data);
    dungTim();
    dungZoom();
    dungTuyChon();
    nhipSuKien();
    nhipDuongDi();
    batDauToi();
  })();

  if (window.__dino4vnTT) {
    window.__dino4vnTT.nghe((d) => { veTrangThai(d); veLoai(d); });
  }
})();
