# v6.3 — giao diện gọn và thử trên điện thoại

Áp dụng `winterarc-v6.3-mobile-admin-settings.patch` sau hai patch v6-account-tournament và v6.2-room-frames-ads, từ thư mục gốc có package.json. Có thêm dependency bcryptjs cho đăng nhập admin; xem ADMIN_SETTINGS.md. Bản vá chưa được cài/build/chạy test theo yêu cầu.

## Giao diện

- Trong countdown/playing, header chỉ hiện nút Cài đặt và FPS/ping trên cả PC lẫn mobile. FPS lấy từ renderFps của engine, ping từ WebSocket; khi kết nối lại hiện `— ms`.
- Logo, hồ sơ, ngôn ngữ, trợ giúp, tác giả và nút menu cũ chỉ bị ẩn; hiện lại ở sảnh/kết quả. Nhấn Cài đặt rồi đóng để trở lại menu Tiếp tục/Rời trận. Escape trên desktop vẫn hoạt động.
- Giữ HUD cần cho gameplay: thời gian, người còn lại, màu sàn, boss HP, tiến độ, joystick và nút hành động. Header không chồng lên HUD mobile ngang.
- FPS/ping luôn hiện trong trận; checkbox showStats được ẩn trong cài đặt khi đang thi đấu. Ngoài trận checkbox vẫn điều khiển bảng thống kê tùy chọn.
- Tên tài khoản được xuống dòng cả khi tên không có khoảng trắng, bỏ truncate ở header/sảnh/kết quả. Avatar cố định kích thước; danh hiệu xuống hàng riêng. Header bỏ danh hiệu để gọn, mở hồ sơ vẫn thấy đầy đủ.

## 1. Truy cập IP LAN

Ví dụ PC chạy game có IP `192.168.1.10` (thay bằng IP thật từ `hostname -I`). Điện thoại và PC cần truy cập được nhau, không bật Wi-Fi client isolation.

Trong `apps/server/.env`:

```dotenv
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:2567,http://192.168.1.10:5173
```

Origin là **scheme + host + port của frontend trên thanh địa chỉ**, không có dấu `/` cuối hoặc path. Không thêm IP điện thoại, không dùng `*` cho API có cookie. Khởi động lại backend sau khi đổi .env.

Trong `apps/web/.env.local`, bỏ VITE_SERVER_URL nếu đang trỏ localhost. Mặc định khi chạy dev frontend tự lấy hostname hiện tại và cổng backend 2567. Hoặc cấu hình rõ:

```dotenv
VITE_SERVER_URL=ws://192.168.1.10:2567
```

Khởi động lại Vite sau khi sửa env. `npm run dev` như trước; dự án đã có Vite `--host`, backend lắng nghe `0.0.0.0`. Điện thoại mở `http://192.168.1.10:5173`. Nếu Vite tự chuyển sang cổng khác vì 5173 bận, dùng đúng cổng đó trong URL và ALLOWED_ORIGINS.

Nếu không truy cập được, cho phép TCP 5173 và 2567 từ mạng LAN trong firewall; không cần mở port router ra Internet. Nếu chạy Docker/VM cần publish/forward hai cổng tương ứng.

**LAN HTTP chỉ giúp thử UI/kết nối, không giải quyết Google login.** Google không cho raw IP LAN làm Authorized JavaScript origin và yêu cầu HTTPS ngoại trừ localhost. Game hiện yêu cầu đăng nhập để vào phòng; đăng nhập trên PC không chia sẻ cookie sang điện thoại. Patch không thêm bypass auth. Dùng cách 2 hoặc 3 để thử cả game.

## 2. Android qua USB, giữ đăng nhập Google bình thường

Cài Android SDK Platform-Tools trên PC. Bật USB debugging, cắm điện thoại và chấp nhận khóa máy tính. Chạy trên PC:

```bash
adb devices
adb reverse tcp:5173 tcp:5173
adb reverse tcp:2567 tcp:2567
```

Trong Google Cloud → OAuth client loại Web → Authorized JavaScript origins, thêm:

```text
http://localhost
http://localhost:5173
```

Giữ ALLOWED_ORIGINS có `http://localhost:5173`, NODE_ENV=development. Bỏ VITE_SERVER_URL cố định IP LAN hoặc đổi thành `ws://localhost:2567`, khởi động lại Vite. Mở Chrome điện thoại tại `http://localhost:5173`. Nhờ reverse, cả frontend và backend localhost trên điện thoại trỏ về PC; Google login vẫn xác minh token như thường.

Hai cổng reverse cần đặt lại nếu thiết bị/kết nối bị reset. Đây là cách thử Android; iPhone dùng domain HTTPS. Có thể dùng Chrome DevTools port forwarding thay cho lệnh ADB.

## 3. Domain HTTPS cho điện thoại qua mạng

Dùng domain của bạn, ví dụ `https://game.example.com`, có HTTPS hợp lệ. Reverse proxy frontend và backend cùng domain: `/api`, `/matchmake` và WebSocket room tới backend; các đường dẫn khác tới frontend. Dùng WebSocket upgrade trong proxy.

```dotenv
# Server
NODE_ENV=production
ALLOWED_ORIGINS=https://game.example.com

# Frontend, nếu vẫn chạy Vite dev qua proxy
VITE_SERVER_URL=wss://game.example.com
```

Thêm `https://game.example.com` vào Authorized JavaScript origins của Google. Nếu proxy tới Vite dev, cho phép chính hostname đó trong server.allowedHosts của Vite; không mở allowedHosts cho mọi domain. Khi dùng bản build phục vụ cùng domain, có thể bỏ VITE_SERVER_URL vì mặc định production dùng origin hiện tại.

Không mở trang HTTPS rồi kết nối backend `ws://` hoặc HTTP vì mixed content. Origin frontend cần khớp cả ALLOWED_ORIGINS và cấu hình Google; đây là hai danh sách khác nhau.

Tài liệu chính thức:

- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#origin-validation
- https://developer.android.com/develop/ui/views/layout/webapps/access-local-server
- https://developer.chrome.com/docs/devtools/remote-debugging/local-server
