# Wall Duel

Patch nối tiếp `winterarc-results-screen.patch` (không cần patch lobby 3D).

## Luật chơi

- Chính xác 2 người, thể thức solo. Vai đầu tiên chọn từ seed ngẫu nhiên của trận.
- Mỗi lượt: 3 giây tìm chỗ nấp, sau đó 20 giây hunter dùng tối đa 3 viên.
- Laser khóa hướng 0,45 giây trước khi viên đạn được xử lý. Người nấp vẫn di chuyển/đổi tư thế trong thời gian này.
- Trúng bất kỳ phần cơ thể nào là kết thúc trận. Hết 3 viên hoặc hết giờ mà không trúng thì đổi vai, nạp lại 3 viên.
- Không có giới hạn tổng thời gian trận; tiếp tục đến khi trúng hoặc một người rời trận.
- Ba tư thế: đứng, ngồi, nằm. Tư thế thấp di chuyển chậm hơn. Mỗi tư thế dùng cùng các khối hình học cho hiển thị và hitbox trên server.
- Map cố định, không nhận override từ editor để giữ đúng vị trí bức tường và vùng bắn.

## Điều khiển

| Vai | Máy tính | Mobile |
|---|---|---|
| Hunter | Chuột ngắm; chuột trái hoặc F bắn; nhả rồi bấm cho phát kế tiếp | Vuốt nửa phải để ngắm; chạm nút Bắn |
| Người nấp | A/D di chuyển ngang; 1/2/3 chọn tư thế | Joystick ngang; nút Đứng/Ngồi/Nằm |

Người nấp dùng camera thứ ba cố định nhìn vào vùng nấp. Hunter đứng cố định với góc nhìn thứ nhất, có súng, laser và dấu đạn trên tường. Các bước di chuyển theo chiều sâu, nhảy và chạy nhanh được tắt trong mode này.

## Tích hợp

- ID: `wallduel`. Có trong menu và cấu hình bật/tắt game của admin.
- Chọn ngẫu nhiên chỉ chọn Wall Duel khi có đúng 2 người. Nếu chỉ bật mỗi Wall Duel thì phòng phải đủ đúng 2 người mới bắt đầu.
- Phòng chọn riêng Wall Duel giới hạn 2 người chơi; ghế quan sát admin vẫn riêng như trước. Giải đấu chọn riêng Wall Duel cũng giới hạn 2 người.
- Vị trí và tư thế nấp nằm trong controller server, không ghi vào PlayerState dùng chung. Message `duelPrivate` chỉ gửi cho người nấp; được kiểm tra round/turn ở client. Người quan sát không nhận vị trí bí mật.
- Server kiểm tra lượt, vai, đạn, nhịp bắn và hitbox; client không gửi kết quả trúng.
- Không thêm package hoặc migration DB. Map, súng, hình nhân và laser được tạo bằng code; âm bắn có bản tổng hợp dự phòng.

## Triển khai và kiểm tra

Cập nhật backend VPS và frontend Vercel cùng đợt vì protocol có thêm state mới; tải lại các client sau khi triển khai.

```bash
npm run build
npx tsx --test apps/server/src/rounds/WallDuelRound.test.ts
```

Kiểm tra thực tế bằng 2 tài khoản trên 2 thiết bị/trình duyệt: đứng/ngồi/nằm, di chuyển khi laser khóa, 3 phát trượt, đổi vai, bắn trúng, rời trận, chơi lại và thao tác mobile.

Đã chạy 6 test luật chơi, kiểm tra cấu trúc tường và render HUD hai vai desktop/mobile trong môi trường đóng gói. Chưa chạy build đầy đủ với toàn bộ dependencies hoặc kiểm thử WebGL/mạng hai người trên thiết bị thật.
