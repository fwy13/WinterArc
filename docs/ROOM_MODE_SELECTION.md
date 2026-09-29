# Chọn mode cho phòng

Áp dụng sau winterarc-v6.10-aurora-packages-editor.patch.

- Tạo phòng: Ngẫu nhiên mỗi trận được bật mặc định; tắt để chọn mode thủ công.
- Phòng thường: chủ phòng đổi lựa chọn ở sảnh hoặc màn kết quả; đổi lựa chọn
  đặt lại trạng thái sẵn sàng của mọi người như trước.
- Server chọn ngẫu nhiên sau khi kiểm tra quyền, trạng thái phòng và sẵn sàng,
  trước khi đếm ngược. Một trận chỉ có một mode, không có chuỗi loại 32→16→8.
- Không lặp mode của trận vừa bắt đầu trong cùng phòng. Không đảm bảo chơi hết
  mọi mode trước khi lặp lại, và không giữ lịch sử khi phòng bị hủy.
- Giải đấu: admin chọn chế độ random/thủ công khi tạo. Lựa chọn được khóa trong
  giải đấu như quy tắc cũ; random vẫn chọn lại cho mỗi lượt, giữ bảng điểm chung.
- modeSelection là chính sách phòng; mode là mode thực tế. resultMode vẫn giữ
  mode của kết quả trước, không bị ghi đè khi đổi lựa chọn cho trận tiếp theo.
- Danh sách phòng hiện Ngẫu nhiên ở sảnh; khi đang chơi hiện tên mode thực tế.

Bỏ liên kết editor khỏi menu cài đặt và bỏ mục ChatGPT trong danh sách tác giả.
Editor riêng và trang lấy bản nháp /editor vẫn giữ nguyên, truy cập bằng URL.

Schema có thêm modeSelection: deploy frontend/backend cùng phiên bản và khởi động
lại server khi không có trận đang chơi. Không cần migration database.
Chưa cài dependency, build hoặc test khi tạo patch.
