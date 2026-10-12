# Admin và Knockout

Patch này áp dụng sau `winterarc-deploy-vps-vercel.patch`.

## Quản trị

Mở `/admin`, đăng nhập tài khoản admin hiện có.

- Chọn người chơi để sửa **token** và **lượt quay thưởng**. Nhập lý do trước khi lưu. Giao dịch cập nhật ledger và nhật ký admin cùng lúc.
- Nếu người chơi vừa mua đồ, quay thưởng hoặc nhận thưởng, bản chỉnh sửa cũ bị từ chối. Bấm **Tải lại số dư**, nhập lại thay đổi rồi lưu.
- **Thành viên CLB**: dán email, mỗi dòng một email; cũng nhận dấu phẩy hoặc chấm phẩy. Tối đa 100 email/lần, 1.000 email trong danh sách. Xóa email để thu hồi badge.
- Badge dùng logo CLB tại `apps/web/public/brand/itclub-mark-white.svg`, hiển thị cạnh tên trong UI và trên đầu nhân vật.
- **Minigame đang mở**: bật/tắt từng game. Luôn giữ ít nhất một game mở. Game bị tắt không được tạo phòng, vào phòng bằng mã hoặc bắt đầu trận mới. Chế độ ngẫu nhiên chỉ chọn game đang mở. Trận đã bắt đầu được chơi hết.

Email chỉ lấy từ Google ID token đã xác minh. Tài khoản đã đăng nhập từ bản cũ cần đăng xuất/đăng nhập lại một lần để lưu email. Email thành viên và email người chơi chỉ xuất hiện trong API quản trị, không gửi trong snapshot phòng hay hồ sơ công khai.

Thay đổi số dư/badge được cập nhật cho người đang ở phòng trong khoảng 2 giây. Các màn hình chọn game cập nhật khi mở, khi quay lại tab hoặc trong khoảng 15 giây; server kiểm tra lại ngay khi người chơi thao tác.

## Knockout — lượt ngắm và lao đi

Bản `winterarc-knockout-turns.patch` áp dụng sau `winterarc-admin-knockout.patch`.

- Góc nhìn thứ ba phía sau người tuyết, xoay camera bằng chuột hoặc vuốt vùng nhìn trên điện thoại.
- Mỗi lượt: **10 giây chọn hướng/lực → 1 giây công bố mũi tên → 4 giây trượt và va chạm**.
- Mũi tên xanh là hướng của bạn. Xoay góc nhìn để ngắm; Q/E hoặc thanh lực và nút −/+ chọn lực 1–10. Mũi tên dài hơn tương ứng lực lớn hơn.
- Khi ngắm, hướng và lực đối thủ nằm riêng trên server. Khi hết đếm ngược, server khóa lựa chọn, công bố các mũi tên màu vàng rồi cho tất cả lao đi cùng tick.
- Nhân vật không đi bộ/nhảy hoặc dùng F để đẩy nữa. Va chạm giữa người tuyết truyền lực; bắn trượt có thể khiến chính bạn rơi khỏi sân.
- Sân giảm bán kính 1,5 khối sau mỗi lượt. Người cuối cùng còn trên sân thắng. Một người vẫn vào tập được; sân tập dừng thu hẹp ở bán kính 6.
- Khi hết thời gian toàn trận, dùng quy tắc xếp hạng hiện có để xử lý hòa.
- Mất kết nối không dừng bộ đếm. Mỗi lượt có hướng mặc định vào tâm và lực 5 nếu không nhận lựa chọn mới. Lựa chọn đã nhận trong lượt vẫn giữ tới khi công bố.
- Giữ nguyên trang phục đã mua trong tài khoản và quy tắc thưởng chống farm.

Map có thể chọn trong editor; khu vực đấu ở giữa được bảo vệ khỏi overlay chỉnh sửa như Ice Break.

## Triển khai

Không có dependency mới. SQLite tự thêm cột `verified_email` và các bảng `club_emails`, `game_availability` khi backend khởi động. Dữ liệu hiện tại được giữ lại.

Triển khai backend VPS và frontend Vercel cùng đợt: giao thức thêm trạng thái lượt Knockout, thời gian còn lại, số lượt và lực công bố của mỗi nhân vật. Cho các trận hiện tại kết thúc trước khi restart backend, sau đó yêu cầu tải lại trang để lấy client mới. Sao lưu SQLite bằng quy trình đang dùng trước khi cập nhật.

Kiểm tra trước deploy trên máy có đầy đủ dependency:

```sh
npm run check --workspace=apps/server
npm run check --workspace=apps/web
npm run build
```

## Phạm vi kiểm tra bản patch

Đã kiểm tra cú pháp TS/TSX; kiểm tra kiểu cho HUD và trang admin; render HTML từ React cho 6 mode ở desktop/mobile. Đã chạy logic AccountStore với SQLite qua adapter driver để kiểm tra token, xung đột revision, ledger, phân quyền gọi các hàm mới, email xác minh, thu hồi badge và chặn tắt game cuối cùng. Đã chạy logic Knockout cho 32 vị trí spawn, đòn đẩy, hồi chiêu, rơi khỏi sân, thu hẹp và người thắng.

Chưa chạy toàn bộ production build hoặc trận multiplayer trong trình duyệt với Colyseus/Babylon và driver better-sqlite3 thật trong môi trường này.


Kiểm tra bổ sung cho bản theo lượt: đã chạy logic đếm ngược, giữ kín hướng, công bố/khởi hành đồng thời, khóa lựa chọn, từ chối gói tin lượt cũ và lực không hợp lệ, va chạm đối đầu, reset lượt, thu hẹp và loại người chơi. Camera 3D và thao tác cảm ứng chưa được chạy thử trong trình duyệt thực tế.
