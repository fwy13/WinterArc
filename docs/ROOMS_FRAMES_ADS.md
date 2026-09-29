> Cập nhật v6.3: quyền admin dùng đăng nhập bcrypt riêng tại `/admin`, không còn ADMIN_GOOGLE_SUBS. Xem [ADMIN_SETTINGS.md](ADMIN_SETTINGS.md) và [MOBILE_UI_LAN.md](MOBILE_UI_LAN.md) trước khi cấu hình.

# Phòng giải đấu, ảnh Google, frame, role và quảng cáo — v6.2

## Bản nền và cập nhật

Patch `winterarc-v6.2-room-frames-ads.patch` là patch nối tiếp, áp dụng lên bản v6 **đã có** `winterarc-v6-account-tournament.patch`. Không áp dụng trực tiếp lên zip v6 gốc hoặc lên bản FPS cũ. Hãy sao lưu code và SQLite, dừng server, áp dụng patch rồi triển khai frontend/backend cùng lúc. Không cài thư viện, build, test hoặc chạy game khi tạo bản vá này.

Không thêm dependency npm. SQLite tự thêm `users.avatar_url`, `frame_id`, `bonus_spins`, `revision`, các bảng `user_roles`, `ad_attempts` và trigger phiên bản hồ sơ. Không xóa tài khoản, token, lịch sử mua hay bảng điểm cũ. Khi restart, giải cũ được đánh dấu kết thúc vì phòng trong RAM không còn. Không thể tiếp tục phòng cũ sau restart.

## Giải đấu ngay tại Tạo phòng

- Chỉ admin thấy checkbox **Phòng giải đấu**; backend xác minh admin từ vé đăng nhập trước khi tạo.
- Chọn tên, mode, 1–20 lượt, 2–32 suất thi đấu, mật khẩu như phòng riêng bình thường.
- Admin tạo phòng vào ghế quan sát. Chia sẻ mã phòng + mật khẩu, người chơi vào qua mục Vào phòng.
- Không có bước đăng ký hay màn hình quản lý giải riêng. API đăng ký/mở giải kiểu cũ được bỏ.
- Ít nhất 2 người chơi sẵn sàng; admin bắt đầu. Giải tính điểm cá nhân, thắng lượt +3, không thắng +0. Bằng điểm đồng hạng.
- Bảng điểm nằm trong sảnh/kết quả của phòng. Người vào giữa các lượt chỉ nhận điểm từ lượt mình tham gia.
- Mode/format cố định cho tới khi hết giải. Muốn đổi, tạo phòng mới. Ghế quan sát không nhận thưởng trận.
- Phòng hết người bị hủy như phòng thường; bảng điểm đã ghi vẫn được giữ. Không mở lại phòng giải cũ.

Admin → Quan sát vẫn có ô mã phòng và mật khẩu, cho phép tối đa 4 admin quan sát. Các phòng công khai thường vẫn hiển thị như trước, phòng giải có mật khẩu không được công khai trong room browser.

## Avatar Google và khung 100×100

Server chỉ nhận `picture` từ Google ID token đã xác minh, giới hạn URL HTTPS `googleusercontent.com`. Không nhận URL avatar tự gửi từ client. Người dùng cũ đăng xuất/đăng nhập lại một lần để lấy ảnh; ảnh thiếu/lỗi dùng chữ cái đầu. Ảnh và frame được hiển thị tại các vị trí dùng `ProfileName`: hồ sơ, sảnh, kết quả, bảng xếp hạng. Bảng tên 3D hiển thị tên/danh hiệu, không tải ảnh Google thành texture 3D.

**Chưa có bộ frame bạn nhắc tới trong file đính kèm.** Patch cung cấp 3 SVG mẫu tự tạo, nền trong suốt 100×100 để dùng trước, không phải asset của bạn. Đặt ảnh thật vào:

```text
apps/web/public/frames/my-frame.png
```

Sửa danh mục ở `packages/winterarc-profile/src/account.ts`:

```ts
{ id: 'my-frame', cost: 120, src: '/frames/my-frame.png', inset: 14, rounded: true }
```

- `inset: 14`: ảnh Google nằm từ tọa độ 14 tới 86 trên canvas 100×100, bên dưới khung. Điều chỉnh theo vùng rỗng của asset.
- `rounded`: cắt ảnh tròn hay bo nhẹ; không ảnh hưởng hình khung.
- Thêm `social.frame.my-frame` trong cả vi/en ở `apps/web/src/i18n/social.ts`.
- Giữ `id` ổn định khi đổi asset/giá để không làm mất trạng thái đã sở hữu.
- Dùng PNG/WebP/SVG nền trong suốt và chỉ dùng asset bạn có quyền sử dụng.

Mẫu mặc định: snow 80, holly 120, gold 200 token. Chọn rồi Lưu/mua để trừ token. Server tính giá và kiểm tra sở hữu trong transaction; chọn lại frame đã mua không mất phí. `none` miễn phí. Lịch sử mua emoji của bản cũ còn trong database nhưng UI chuyển sang ảnh Google, không tự hoàn token.

## Student và Sponsorship

`PROFILE_ROLES` gồm `student`, `sponsor_bronze`, `sponsor_silver`, `sponsor_gold`. Một tài khoản có Student và tối đa một hạng tài trợ. Đây là lựa chọn mặc định cho yêu cầu sponsorship; có thể đổi tên hiển thị qua i18n.

Admin → Quản trị → nhập UUID tài khoản → chọn danh hiệu → Lưu. Lưu thay thế toàn bộ danh hiệu đang có. Bỏ Student và chọn Không có nhà tài trợ để xóa danh hiệu. Server chỉ chấp nhận allowlist và ghi `admin_audit`.

Danh hiệu hiển thị cạnh tên ở UI và trên bảng tên nhân vật. Premium vẫn riêng biệt, vẫn tô vàng tên; danh hiệu không cho quyền quản trị, không tăng token/thưởng. Chưa tích hợp thanh toán tài trợ hoặc xác minh sinh viên. Cấp thủ công bởi admin. Người nhận làm mới hồ sơ; trong trận, bảng tên cập nhật ở lượt tiếp theo hoặc khi vào lại phòng.

## Quảng cáo đã được gỡ ở v6.4

Không còn SDK, nút xem quảng cáo, API cấp lượt hoặc biến môi trường Google Ad Manager. Vòng quay miễn phí vẫn hoạt động. Lượt thưởng đã nhận trước đây vẫn dùng được; không còn cơ chế quảng cáo cấp lượt mới.

## Không lộ số token trước khi quay dừng

`WalletWheel` gọi `holdRewardPresentation()` trước request. `presentProfile()` xếp hàng mọi cập nhật hồ sơ cùng tài khoản (kể cả refresh từ thông báo kết quả trận). UI giữ số token/lượt cũ trong lúc quay. Khi animation xong, công bố kết quả rồi giải phóng hồ sơ mới. `revision` trong SQLite tránh response cũ ghi đè số dư mới hơn.

Server vẫn ghi thưởng ngay để không mất thưởng nếu đóng trang giữa animation. Đây là sửa thời điểm hiển thị UI, không che kết quả khỏi Network/DevTools hoặc tab khác. Không cho client quyết định kết quả hay gửi số token muốn nhận. Chế độ reduced-motion bỏ animation dài nhưng vẫn trì hoãn công bố ngắn.

## Các module mới

| File | Trách nhiệm |
| --- | --- |
| `account/AvatarPhoto.tsx` | Ảnh Google + overlay frame |
| `account/ProfileEditor.tsx` | Đổi tên, chọn/mua khung và giao diện |
| `account/WalletWheel.tsx` | Animation và thời điểm công bố thưởng |
| `account/AdminTools.tsx` | Premium, danh hiệu, vào ghế quan sát |
| `components/TournamentBoard.tsx` | Bảng điểm ngay trong phòng |
| `i18n/social.ts` | Tiếng Việt/Anh của các tính năng mới |

Đường dẫn frontend tính từ `apps/web/src`. Server kiểm tra quyền, giá, quota và lưu dữ liệu trong `apps/server/src/account`; shared catalog nằm tại `packages/winterarc-profile/src/account.ts`.
