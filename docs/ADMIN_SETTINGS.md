# v6.3 — admin riêng, cài đặt tài khoản và logo CTU

Patch này bao gồm toàn bộ thay đổi UI/mobile/LAN ở `MOBILE_UI_LAN.md` và các yêu cầu bổ sung. Áp dụng sau **v6-account-tournament**, rồi **v6.2-room-frames-ads**. Sao lưu database và source trước khi cập nhật; triển khai frontend/backend cùng lúc.

Không cài dependency/build/test/chạy game trong lúc tạo patch. Có thêm `bcryptjs@^3.0.3` ở server, bạn chạy `npm install` sau khi áp dụng. Không có mật khẩu admin mặc định hay cơ chế đăng ký admin công khai.

## 1. Đăng nhập quản trị riêng

Trang `/admin` tải giao diện quản trị riêng, không khởi tạo noa/game engine. Hoạt động cả Vite dev và bản build do backend phục vụ. Nếu dùng static host/reverse proxy riêng, rewrite `/admin` về `index.html`.

Trên máy của bạn, sau khi cài dependencies:

```bash
npm run admin:hash -w @winterarc/server
```

Nhập mật khẩu trong terminal (không hiện ký tự). Script chỉ xuất dòng bcrypt hash, không đưa plaintext vào argv/history. Mật khẩu ít nhất 12 ký tự, tối đa 72 byte UTF-8; mặc định bcrypt cost 12.

Trong `apps/server/.env`:

```dotenv
ADMIN_USERNAME=your_admin_name
# Dán nguyên dòng hash do script xuất, gồm dấu nháy đơn:
ADMIN_PASSWORD_HASH='$2b$12$PASTE_THE_REAL_GENERATED_HASH_HERE'
```

Chuỗi trên chỉ là placeholder, không phải hash dùng được. Server chấp nhận bcrypt 2a/2b/2y, cost 10–14. Không dùng ADMIN_GOOGLE_SUBS nữa: Google login không tự cấp quyền admin. Khởi động lại backend sau khi thay cấu hình.

- `/admin` đăng nhập bằng username/password riêng. Không cần Google để quản lý người chơi.
- Tìm theo tên/UUID, phân trang 25 tài khoản, chọn tài khoản rồi cấp/thu Premium hoặc Student/Sponsor.
- Giao diện điền sẵn quyền hiện tại. Premium và roles có nút lưu riêng. Các thay đổi ghi `admin_audit`.
- Phiên admin cookie HttpOnly, SameSite=Lax, Secure khi production; chỉ lưu hash của session token trong SQLite. Hạn 8 giờ; logout thu hồi server-side.
- Thay username/hash rồi restart làm các phiên cũ không còn hợp lệ. Quên mật khẩu: chạy script tạo hash mới trên server, không có reset bằng email công khai.
- 5 lần thử/15 phút/IP trước bcrypt, tối đa 2 phép so sánh đồng thời. Limiter trong RAM như backend hiện tại; nếu dùng reverse proxy, bổ sung limiter đúng IP ở proxy. Không tin tùy ý X-Forwarded-For.
- Tài khoản admin cấu hình từ env là một tài khoản vận hành của server, không phải tài khoản game UUID. Không hardcode hash trong frontend.

**Tạo giải/quan sát:** sau khi đăng nhập admin, về game và đăng nhập Google bằng tài khoản chơi của bạn trong cùng trình duyệt. Cookie admin cấp quyền cho vé vào phòng trong phiên đó; Google chỉ cung cấp nhân vật/hồ sơ. Vẫn tạo giải ở mục Tạo phòng, dùng mã phòng/mật khẩu như v6.2. Khi quay lại tab game, quyền được làm mới; có thể bấm Làm mới hồ sơ. Quyền điều hành phòng kiểm tra phiên admin ở server. Logout/hết hạn thu hồi quyền điều hành, ghế observer bị ngắt. Admin login riêng không tạo tài khoản Google giả hay bỏ xác thực game.

## 2. Cài đặt lưu trong DB

Bảng `player_settings(user_id,data,revision)` lưu volume, hiệu ứng, bước chân, độ nhạy chuột/cảm ứng, FOV, render scale, camera bob/shake và showStats. Schema/giới hạn số dùng chung trong `packages/winterarc-profile/src/settings.ts`.

Frontend `SettingsSync.ts`:

- Đăng nhập: tải bản server, áp dụng ngay vào engine qua settings store có sẵn.
- Chưa có bản server: dùng mặc định hoặc cache riêng của chính UUID đó rồi tạo bản đầu tiên. Không lấy cài đặt của tài khoản khác trên cùng máy.
- Thay đổi áp dụng ngay, tự lưu sau 600 ms và gửi tuần tự. LocalStorage chỉ là cache/offline; SQLite giữ dữ liệu theo tài khoản.
- Có chỉ báo Đang tải/Đang lưu/Đã lưu/Lỗi. Chờ **Đã lưu vào tài khoản** trước khi đóng trang hoặc đăng xuất nếu muốn chắc chắn thay đổi cuối đã lên server.
- Mất mạng: giữ bản sửa trong bộ nhớ/cache, nhấn Đồng bộ bản đang dùng để thử lại. Không đảm bảo request cuối hoàn tất nếu đóng tab đột ngột.
- Mỗi lần lưu kiểm tra revision. Tab/thiết bị khác sửa trước thì báo xung đột, không âm thầm ghi đè. Người dùng chọn ghi bản hiện tại bằng nút đồng bộ hoặc reload lấy bản server.
- Mỗi request lưu kèm UUID dự kiến; backend đối chiếu session, ngăn request trễ của tài khoản cũ ghi vào tài khoản vừa đăng nhập.
- Cài đặt tự tải khi đăng nhập/tải lại trang; chưa có realtime push thay đổi giữa thiết bị.

Ô “Tên của bạn” trong Tạo phòng được bỏ; tên lấy từ Google/hồ sơ. Đổi tên vẫn tại Hồ sơ với quy tắc token như trước.

## 3. Logo trường theo email

Server xác minh Google ID token rồi chỉ gắn `school='ctu'` khi:

- `email_verified === true`;
- Email có đúng domain `student.ctu.edu.vn`, không chấp nhận đuôi `student.ctu.edu.vn.evil.example` hay tên hiển thị tự nhập.

Không lưu hoặc phát email đầy đủ vào snapshot/rank. Chỉ cờ `school` công khai để render badge. Người dùng cũ đăng xuất/đăng nhập lại để cập nhật. School badge độc lập role Student do admin cấp; không tự cấp Premium/admin, không phải kiểm tra tình trạng đang học ngoài quyền sở hữu email Google đã xác minh.

`SchoolBadge.tsx` dùng URL logo chính thức trong bộ nhận diện CTU:

https://www.ctu.edu.vn/images/branding/logo/CTU_logo.png

Nguồn: https://www.ctu.edu.vn/gioithieu/branding.html

Logo hiện cạnh tên tại các chỗ dùng ProfileName. Nếu nguồn ảnh không tải được, hiện chữ CTU. Có thể tải asset chính thức bạn được phép dùng về `apps/web/public/schools/ctu.png` và đổi `CTU_LOGO` thành `/schools/ctu.png` để không phụ thuộc kết nối website trường. Patch không vẽ lại logo, không ngụ ý trường tài trợ/xác nhận game. Nếu CSP chặn ảnh ngoài, dùng bản self-host.

## 4. Dữ liệu và API

Migration thêm cột users.school, tickets.admin_hash; bảng admin_sessions và player_settings. Không xóa database cũ. Các API mới:

| Endpoint | Quyền / tác dụng |
| --- | --- |
| POST /api/admin/login | Username/password bcrypt; tạo phiên admin |
| POST /api/admin/logout | Thu hồi phiên admin hiện tại |
| GET /api/admin/me | Đọc phiên admin |
| GET /api/admin/users?q=&page= | Admin, tìm người chơi |
| POST /api/admin/premium | Admin, cập nhật Premium |
| POST /api/admin/roles | Admin, cập nhật danh hiệu |
| GET /api/settings | Google session, lấy cài đặt riêng |
| POST /api/settings | Google session, kiểm tra UUID + revision, lưu cài đặt |

Mọi write vẫn kiểm tra exact Origin và header X-WinterArc. HTTPS production cần thiết cho cả Google và đăng nhập admin. LAN HTTP dành cho dev trong mạng tin cậy; hướng dẫn Android USB ở MOBILE_UI_LAN.md giữ Google login trên localhost.

Các mục Google-sub admin trong tài liệu v6.1/v6.2 là lịch sử; cấu hình ở tài liệu v6.3 này thay thế chúng.
