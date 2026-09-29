# v6.7 — tab game và danh sách tác giả

Áp dụng patch tại thư mục gốc của đúng bản `repomix-output(6).xml` đã gửi:

```sh
git apply winterarc-v6.7-tabs-credits.patch
```

Không thêm dependency. Không cần migration database. Bản vá chưa được build/chạy/test.

## Hành vi

- Tab game đầu tiên giữ Web Lock trước khi tải đăng nhập và engine. Tab thứ hai chỉ hiển thị thông báo và nút Thử lại; không lấy quyền của tab đang chơi. `/admin` được mở riêng.
- Khóa áp dụng trong cùng origin và browser profile. Đây không phải khóa nhiều thiết bị/tên miền. Server vẫn chịu trách nhiệm kiểm tra tài khoản đang ở phòng.
- Web Locks yêu cầu HTTPS hoặc localhost. HTTP qua IP LAN không được hỗ trợ: dùng HTTPS khi test điện thoại. Nếu không có API, hiển thị hướng dẫn thay vì cho chạy hai phiên không được bảo vệ.
- Khi đang vào phòng/ở phòng/kết nối lại, reload, đóng tab hoặc điều hướng ra ngoài dùng hộp xác nhận native của trình duyệt. Không gắn cảnh báo khi chỉ ở menu.
- Trình duyệt tự quyết định nội dung hộp thoại; thường cần người dùng đã tương tác. Mobile hoặc việc buộc tắt ứng dụng không đảm bảo có cảnh báo.
- Chuyển tab không thể bị chặn: tạm dừng input tại client, khi quay lại hiện nhắc nhở. Trận đấu trên server vẫn chạy.
- Reconnection token được lưu trong sessionStorage theo tab, kèm backend và account ID. Reload tự thử khôi phục trước khi cho thao tác tạo/join phòng mới, rồi lưu token mới sau khi thành công. Không lưu mật khẩu phòng.
- Server hiện chỉ giữ chỗ 20 giây sau ngắt kết nối. Nếu tải trang/đăng nhập quá lâu, server restart, hoặc trình duyệt từ chối sessionStorage thì không đảm bảo khôi phục. Hết thời gian retry sẽ về menu; server giải phóng ghế khi hết grace period.
- Nút Rời phòng xóa token và rời tự nguyện. Hủy khôi phục có thể cần chờ grace period của server kết thúc trước khi vào phòng khác. Không dùng unload để gửi leave vì nó sẽ phá khôi phục reload.

## Thêm tác giả

Sửa `apps/web/src/config/maintainers.ts`, thêm phần tử vào `maintainers`:

```ts
{
  name: 'Tên cộng tác viên',
  handle: 'github-handle', // duy nhất trong danh sách
  profile: 'https://github.com/github-handle',
  initials: 'TV',
  kind: 'human',
  avatarUrl: '/authors/avatar.webp', // tùy chọn
  description: {
    vi: 'Thiết kế bản đồ và nhân vật',
    en: 'Map and character design',
  },
},
```

Danh sách hiện gồm Huỳnh Quý và ChatGPT (ghi rõ là trợ lý AI hỗ trợ, không phải người vận hành). Chưa có danh tính cộng tác viên khác nên không tự tạo tên người. Ảnh tác giả hiện tại và thông tin ủng hộ được giữ nguyên.
