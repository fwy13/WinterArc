> Cập nhật v6.3: quyền admin dùng đăng nhập bcrypt riêng tại `/admin`, không còn ADMIN_GOOGLE_SUBS. Xem [ADMIN_SETTINGS.md](ADMIN_SETTINGS.md) và [MOBILE_UI_LAN.md](MOBILE_UI_LAN.md) trước khi cấu hình.

# WinterArc v6.2 — tài khoản, phòng giải đấu, avatar và token

Bản này cập nhật tiếp trên `winterarc-christmas-v6.zip` đã áp dụng `winterarc-v6-account-tournament.patch`. Frontend và server phải cập nhật cùng lúc. Không cài dependency, build, test hay chạy game trong quá trình tạo patch.

## Áp dụng

Lưu thay đổi và sao lưu database trước khi cập nhật. Tại thư mục có `package.json` gốc, sau khi đã áp dụng patch tài khoản cũ:

```bash
git apply --check /duong-dan/winterarc-v6.2-room-frames-ads.patch
git apply /duong-dan/winterarc-v6.2-room-frames-ads.patch
```

Các lệnh trên dành cho người triển khai, chưa được chạy thử với dự án của bạn. Nếu bản nền đã sửa khác, đối chiếu các đoạn báo conflict thay vì ép áp dụng một phần. Patch này không thêm dependency npm; vẫn cần các dependency của patch tài khoản trước đó. Hướng dẫn phần mới: [ROOMS_FRAMES_ADS.md](ROOMS_FRAMES_ADS.md).

Yêu cầu Node.js >= 22.16. SQLite dùng `better-sqlite3`; nếu máy không có binary phù hợp, npm có thể cần Python 3, make và trình biên dịch C++. Patch không kèm node_modules hay lockfile mới. Commit lockfile do `npm install` của bạn tạo ra.

## Google Sign-In

Sử dụng Google Identity Services (OpenID Connect), xác minh ID token bằng `google-auth-library` tại server. Không cần Google Client Secret ở frontend.

1. Trong Google Cloud Console, tạo project và cấu hình Google Auth Platform/consent screen.
2. Tạo OAuth Client ID loại **Web application**.
3. Thêm Authorized JavaScript origins đúng địa chỉ frontend, ví dụ `http://localhost:5173` khi phát triển và `https://game.example.com` khi triển khai. Không thêm path vào origin.
4. Nếu ứng dụng đang ở chế độ testing, thêm tài khoản thử vào danh sách test users của Google.
5. Sao chép `apps/server/.env.example` thành `apps/server/.env`, điền `GOOGLE_CLIENT_ID`.
6. Điền chính xác frontend origin vào `ALLOWED_ORIGINS`. Dùng dấu phẩy nếu có nhiều origin.
7. Khởi động lại backend. Frontend đọc Client ID công khai từ `/api/config`.

Luồng dùng popup/callback JavaScript, không cần tự tạo trang redirect callback. Google script cần truy cập `https://accounts.google.com/gsi/client`. Nếu tự cấu hình CSP, cho phép các tài nguyên Google theo tài liệu chính thức.

```dotenv
PORT=2567
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:2567
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
ADMIN_GOOGLE_SUBS=
ACCOUNT_DB_PATH=./data/accounts.sqlite
```

Production: dùng HTTPS và `NODE_ENV=production`. Nên reverse proxy frontend, `/api`, `/matchmake` và WebSocket trên cùng domain. Session cookie là HttpOnly, Secure trong production, SameSite=Lax. Các host khác site hoàn toàn không được hỗ trợ bởi cấu hình cookie này; không đổi sang cookie cross-site nếu chưa bổ sung thiết kế CSRF tương ứng.

Trên điện thoại, `localhost` chỉ chính điện thoại. Dùng domain HTTPS truy cập được từ điện thoại, khai báo domain đó trong Google và `ALLOWED_ORIGINS`. Google không chấp nhận mọi origin LAN HTTP như cách localhost được miễn trừ.

Session tồn tại 7 ngày. Không lưu Google token hoặc session vào localStorage. Server dùng Google `sub` làm định danh bên ngoài và UUID nội bộ cho tài khoản. Google email/sub không phát tới phòng; sub chỉ trả lại chủ tài khoản ngay sau đăng nhập để thiết lập admin.

Trước khi vào phòng, client lấy vé một lần, hạn 60 giây. Colyseus xác thực vé, lấy tên/avatar/Premium từ database và kiểm tra quyền observer. Tên truyền qua options không thay thế được tên tài khoản.

## Cấp admin và Premium

1. Đăng nhập Google, mở Hồ sơ → “Thông tin thiết lập admin”.
2. Sao chép Google sub của **chính tài khoản quản trị** vào `ADMIN_GOOGLE_SUBS`.
3. Khởi động lại server, bấm Làm mới trong Hồ sơ hoặc tải lại trang.
4. Tab Quản trị xuất hiện. Nhiều admin: phân cách Google sub bằng dấu phẩy.

Quyền admin được kiểm tra lại ở backend. Đổi localStorage hoặc sửa React không cấp quyền.

Premium được cấp/thu hồi trong tab Quản trị bằng **ID UUID của tài khoản**, lấy ở Hồ sơ người đó. Đây là quyền trang trí, chưa tích hợp thanh toán, thuê bao hay hóa đơn. Premium không tăng chỉ số hoặc token nhận được.

Tên Premium có màu vàng trong hồ sơ, sảnh, kết quả, rank và bảng tên phía trên nhân vật. Bảng tên 3D vẫn kiểm tra chiều sâu, không hiện xuyên tường. Quyền thay đổi trong lúc người đó đang thi đấu được cập nhật vào mô hình ở lượt tiếp theo hoặc khi vào lại phòng.

## Token, vòng quay và hồ sơ

Mọi giá trị mặc định ở `packages/winterarc-profile/src/account.ts`, server là bên thực thi:

| Tính năng | Quy tắc |
| --- | --- |
| Token ban đầu | 0 |
| Đổi tên lần đầu | Miễn phí; tên Google ban đầu không tính là lần đổi |
| Đổi tên từ lần thứ hai | 100 token mỗi lần |
| Nhấn lưu tên không đổi | Không trừ token, không tăng bộ đếm |
| Vòng quay | Miễn phí mỗi 6 giờ tính từ lần quay trước; không cộng dồn |
| Phần thưởng quay | 5/10/20/50/100 token, xác suất 40/30/20/9/1% |
| Thắng trận đủ điều kiện | 20 token + 100 điểm rank |
| Điều kiện thưởng/rank trận | Ít nhất 2 tài khoản khác nhau và thời gian chơi >= 20 giây |
| Giới hạn thưởng thắng | 10 lần mỗi tài khoản/ngày UTC; sau đó vẫn ghi số trận/thắng |
| Khung avatar | Bông tuyết 80, Giáng sinh 120, Ánh vàng 200 token |
| Avatar | Ảnh Google đã xác minh; không tính phí |
| Nền hồ sơ có phí | Thông, quả đỏ, băng: 60 token mỗi nền |
| Màu áo | Miễn phí, 6 lựa chọn |

Avatar lấy từ ảnh Google, có khung 100×100 trong giao diện; không thay mesh nhân vật. Màu áo áp dụng lên nhân vật 3D; nền chỉ áp dụng thẻ hồ sơ. Mỹ phẩm mua một lần được lưu vào kho, đổi lại không mất thêm token. Nút Lưu/mua hiển thị tổng giá trước khi gửi yêu cầu.

Rời phòng trước khi đổi hồ sơ/đăng xuất để tránh tên thay đổi giữa trận. Một tài khoản chỉ vào một phòng tại một thời điểm, kể cả thời gian chờ kết nối lại.

Server dùng transaction SQLite cho trừ/cộng token, mua mỹ phẩm, đổi tên và quay thưởng. Vòng quay lấy kết quả ngẫu nhiên phía server trước khi frontend chạy animation. Ví token giữ số cũ trên UI cho tới khi animation kết thúc, kể cả khi nhận refresh từ phòng. Đóng trang giữa animation không hủy phần thưởng. Animation có các ô bằng nhau nhưng xác suất thực tế theo bảng công bố, không theo diện tích ô.

Server lưu ledger cộng/trừ và kết quả trận theo UUID duy nhất. Gửi lại thao tác kết thúc trận không cộng lần nữa. Nếu ghi kết quả gặp lỗi, phòng chặn lượt mới và thử lại sau 5 giây; xem log nếu lỗi kéo dài. Không có đảm bảo lưu trận đang chạy khi tiến trình bị tắt hoặc ổ đĩa bị lỗi; các kết quả đã commit vẫn được giữ.

Giới hạn trên giảm farm đơn giản, không phải hệ thống chống nhiều tài khoản hoặc thông đồng hoàn chỉnh. Thưởng hiện tính cho cả phòng có mật khẩu nếu đủ điều kiện.

## Rank toàn server

Top 100 theo điểm, sau đó số thắng; UUID làm thứ tự ổn định khi các chỉ số bằng nhau. Đây là điểm tích lũy có hạn mức thưởng ngày, không phải Elo/MMR. Trận solo luyện tập không tăng rank hoặc thưởng token.

Không có API client tự gửi “tôi thắng”, tăng điểm hay cộng token. Kết quả lấy từ `TournamentRoom.finishMatch()` sau khi round controller của server xác định kết quả.

## Tổ chức giải đấu

Thể thức hiện tại: **nhiều lượt cùng một mode, thi đấu cá nhân, cộng điểm**. Không phải bracket loại trực tiếp. Hỗ trợ 2–32 người, 1–20 lượt. Mỗi lượt thắng +3 điểm giải, còn lại 0; bằng điểm đồng hạng. Điểm giải độc lập với điểm rank toàn server.

1. Admin mở **Tạo phòng**, bật **Phòng giải đấu**.
2. Chọn mode, tên giải, số lượt, số người và mật khẩu phòng. Admin tạo phòng sẽ vào ghế quan sát.
3. Chia sẻ mã phòng và mật khẩu. Người chơi đăng nhập Google, vào bằng mục Vào phòng thông thường; không đăng ký giải.
4. Ít nhất 2 người bật Sẵn sàng. Admin bắt đầu lượt. Mode và thể thức cá nhân được khóa trong suốt giải.
5. Kết thúc lượt, xem bảng điểm ngay trong phòng rồi sẵn sàng cho lượt tiếp theo.
6. Đủ số lượt thì giải kết thúc. Tạo phòng mới nếu muốn mở giải mới.

Người chơi có thể vào khi đang ở sảnh hoặc giữa các lượt; chỉ người có mặt khi bắt đầu lượt mới được tính tham gia lượt đó. Vào muộn không nhận điểm các lượt trước. Backend tự lưu danh sách tham gia, không có API đăng ký.

Admin khác có thể dùng mã phòng/mật khẩu vào ghế quan sát và điều hành. Người chơi thường không thể bắt đầu giải. Có tối đa 4 ghế quan sát ngoài số suất thi đấu đã chọn. Phòng giải riêng không xuất hiện trong danh sách phòng công khai.

Phòng rỗng sẽ được hủy theo vòng đời Colyseus. Hủy phòng hoặc khởi động lại server kết thúc giải gắn với phòng đó, giữ bảng điểm đã commit; không tự mở lại giải cũ. Dùng một server process cho SQLite và các phòng như bản trước.

## Camera quan sát

- Người bị loại/đã hoàn thành: chọn người còn sống và chỉnh khoảng cách camera.
- Admin: Quản trị → Mã phòng cần quan sát → Vào ghế quan sát. Phòng riêng vẫn cần mật khẩu nhập ngay trong mục quan sát.
- Ghế quan sát có thêm góc xoay và góc cao của camera; có thể vào giữa trận.
- Quan sát viên không có avatar thi đấu, không nhận input di chuyển/tấn công, không tính vào ready, thứ hạng hoặc phần thưởng.
- Mục tiêu rời phòng/bị loại: tự chọn người còn sống kế tiếp; không còn ai thì chuyển góc nhìn toàn cảnh.

Đây là camera bám mục tiêu có orbit/zoom, chưa phải free-fly, ghi hình hay stream phát sóng. Camera chưa tránh va chạm địa hình; ở khoảng cách lớn có thể đi vào block. Quyền không tham gia trận được server thực thi; không thể ngăn một client bị sửa tự chỉnh camera vì game vẫn gửi snapshot vị trí người chơi.

## Mobile

Menu/sảnh/hồ sơ có thể dùng ở chiều dọc. Khi đếm ngược hoặc thi đấu, điện thoại chiều dọc hiện màn hình yêu cầu xoay ngang và vô hiệu input cục bộ. Trận trên server vẫn tiếp tục.

Nút Toàn màn hình/Xoay ngang thử Fullscreen API và Screen Orientation API sau thao tác của người dùng. Safari/iOS hoặc browser không hỗ trợ khóa hướng sẽ giữ hướng dẫn xoay thủ công. Không thể bắt mọi trình duyệt xoay màn hình bằng JavaScript.

Chiều ngang có chiều cao nhỏ: header và padding được thu gọn, menu và bảng kết quả chia hai cột từ 640px, HUD giữ thông tin chính. Các nút và joystick vẫn giữ kích thước chạm, không scale nhỏ toàn bộ UI.

## Dữ liệu và vận hành

Database: `ACCOUNT_DB_PATH`. Nếu để tương đối, đường dẫn tính từ working directory backend. Production nên dùng đường dẫn tuyệt đối và volume bền vững.

Sao lưu khi backend đã dừng, hoặc dùng SQLite online backup. Không chỉ copy file `.sqlite` trong khi WAL đang ghi. Không commit database/session vào Git.

Các bảng: users, sessions, tickets, cosmetics, ledger, matches, events, entries, admin_audit, user_roles. Không có chuyển token giữa người chơi, nạp/rút tiền hoặc token blockchain.

Rate limit account API mặc định theo địa chỉ socket. Khi dùng reverse proxy, nhiều người có thể chung bucket; điều chỉnh ở proxy và middleware theo hạ tầng thực tế. Không tin tùy ý header X-Forwarded-For.

API và UI mới có tiếng Việt/English trong `apps/web/src/i18n/account.ts` và `social.ts`. Các file theo module:

- `apps/server/src/account/AccountStore.ts`: lưu trữ, transaction, phần thưởng, rank và giải.
- `apps/server/src/account/routes.ts`: Google login, cookie, Origin, rate limit và HTTP API.
- `packages/winterarc-profile/src/account.ts`: kiểu dữ liệu và catalog công khai.
- `apps/web/src/account/`: API client, Google button, UI hồ sơ/rank/admin, khung avatar.
- `apps/web/src/engine/SpectatorCamera.ts`: camera.
- `apps/web/src/components/LandscapeGate.tsx`: mobile orientation.

Sau khi cài dependency, có thể dùng script `npm run format` sẵn có nếu muốn format toàn dự án. Patch không chạy formatter toàn bộ mã cũ để tránh tạo thay đổi ngoài phạm vi.

Tài liệu tham khảo:

- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/gsi/web/reference/js-reference
- https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock

## Bản nền chính xác

SHA-256 của `winterarc-christmas-v6.zip`:

```text
e667b15f27d4a25b2c23fc7c9788c9c634a30af70460b8f8aeb402a411be8978
```
