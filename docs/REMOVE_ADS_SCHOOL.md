# v6.4 — gỡ Google Ad Manager, hiển thị logo trường

Áp dụng winterarc-v6.4-remove-ads.patch sau winterarc-v6.3-mobile-admin-settings.patch. Không cần thêm dependency. Frontend và backend cần cập nhật cùng lúc. Chưa cài/build/test theo yêu cầu.

## Gỡ quảng cáo

Đã xóa GPT adapter, nút quảng cáo, feature flag, cấu hình server, kiểu dữ liệu và bản dịch quảng cáo. Các endpoint /api/ads/status, /attempt, /grant, /cancel không còn đăng ký. Client cũ không thể nhận thêm lượt từ các API này sau khi cập nhật backend.

Xóa REWARDED_ADS_ENABLED và GOOGLE_REWARDED_AD_UNIT trong .env riêng nếu còn (code không đọc chúng nữa). Không ảnh hưởng Google login hoặc ảnh avatar Google.

Giữ vòng quay miễn phí mỗi 6 giờ, phần thưởng thắng game, token và lịch sử đã có. Bonus spin đã được cấp trước đây vẫn dùng được; khi bằng 0, ẩn nút và số lượt bonus. Bảng ad_attempts cũ nếu tồn tại được giữ nguyên để tránh xóa lịch sử; code mới không tạo hoặc truy cập bảng này. Không còn tính năng quảng cáo hoạt động.

## Logo CTU xuất hiện khi nào?

Server chỉ gắn school=ctu khi Google ID token đã xác minh có email_verified=true và email đúng dạng ten@student.ctu.edu.vn. Đăng xuất/đăng nhập lại bằng email trường để cập nhật tài khoản cũ. Email Gmail thường, tên có chữ CTU hoặc role Student do admin cấp không làm xuất hiện logo.

Logo hiển thị cạnh tên tại hồ sơ, sảnh, kết quả, rank và trang admin; không phải logo 3D trên đầu nhân vật. Khi đang chơi, header hồ sơ bị ẩn theo thiết kế gọn nên logo ở header cũng ẩn.

SchoolBadge.tsx hiện tải logo chính thức:
https://www.ctu.edu.vn/images/branding/logo/CTU_logo.png

Nguồn bộ nhận diện: https://www.ctu.edu.vn/gioithieu/branding.html

Nếu ảnh không tải được thì hiện chữ CTU. Để tự lưu ảnh trong dự án:

1. Tải logo PNG chính thức từ bộ nhận diện trường.
2. Tạo thư mục apps/web/public/schools và đặt ảnh tên ctu.png.
3. Trong apps/web/src/account/SchoolBadge.tsx đổi:

```ts
const CTU_LOGO = '/schools/ctu.png';
```

4. Triển khai lại frontend hoặc reload Vite dev. Mở /schools/ctu.png trên chính website để kiểm tra đường dẫn ảnh.

Không đặt đường dẫn /public/schools/ctu.png trong src ảnh; Vite phục vụ public ở gốc website. Chỉ dùng asset bạn có quyền sử dụng. Badge chứng minh email trường được Google xác minh, không ngụ ý trường tài trợ game hay xác nhận tình trạng đang học hiện tại.
