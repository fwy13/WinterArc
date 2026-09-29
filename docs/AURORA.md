# Aurora sky

AuroraSky thuộc winterarc-rendering, dùng cho GameEngine, MenuPreviewEngine và
EditorViewport. Một sphere và một ShaderMaterial vẽ nền trời, sao và dải cực quang.
Không tải ảnh bầu trời, không thêm point light, hậu kỳ, collider hoặc message mạng.

| Chế độ | Hành vi |
| --- | --- |
| Auto | Thiết bị pointer coarse hoặc reduced-motion dùng Low; còn lại dùng High |
| Off | Tắt mesh trời, giữ màu nền scene |
| Low | Một dải cực quang tĩnh, không cập nhật thời gian shader |
| High | Ba dải cực quang chuyển động chậm; reduced-motion vẫn đóng băng chuyển động |

Low là shader tĩnh, không phải ảnh prebake: GPU vẫn phải tô các pixel trời mỗi frame.
Một draw call không có nghĩa là miễn phí; chi phí phụ thuộc độ phân giải và GPU.
Chưa benchmark hoặc chạy thử trên thiết bị trong bản vá này.

Game: Cài đặt → Bầu trời cực quang. Trường skyQuality được chuẩn hóa và lưu qua
luồng đồng bộ settings tài khoản hiện có; dữ liệu cũ tự nhận giá trị auto.
Editor: chọn Cực quang ở header; lưu local trên origin editor.

Sky loại bỏ camera translation trong vertex shader để không có parallax; đẩy depth
về nền và không ghi depth. Terrain vẫn che bầu trời. Không đưa mesh này vào collision
hoặc ray picking. Màu sương và directional light game chuyển sang sắc trời đêm;
ánh sáng nền giữ đủ sáng để thấy block.

Instance đăng ký onBeforeRenderObservable của scene. Thời gian chỉ tăng khi scene
render, dt được chặn khi quay lại tab. dispose() gỡ observer và giải phóng mesh/material.
Không tạo lại sky mỗi lần đổi mode/map. Có thể đổi palette/tốc độ trong AuroraSky.ts.

ShaderMaterial tham khảo API chính thức:
https://doc.babylonjs.com/features/featuresDeepDive/materials/shaders/shaderMaterial/
