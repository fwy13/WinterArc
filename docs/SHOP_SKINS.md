# v6.5 — đăng nhập trước, shop, 10 frame và skin nhân vật

Áp dụng `winterarc-v6.5-shop-skins.patch` sau **v6.4-remove-ads**, trên chuỗi v6.1 → v6.2 → v6.3 → v6.4. Không thêm dependency npm. Frontend/server phải cập nhật cùng lúc vì protocol có `skinId`. Không cài dependency, build, chạy game hoặc test khi tạo patch này.

## Đăng nhập trước khi vào sảnh

`GameGate.tsx` kiểm tra session và hiện trang đăng nhập Google. Khi chưa đăng nhập, không hiện menu game, danh sách phòng, cửa hàng hoặc canvas. App/engine được lazy-load sau khi có tài khoản. Đăng xuất hoặc API báo phiên hết hạn sẽ quay về trang đăng nhập, unmount engine và đóng kết nối game.

Trang `/admin` vẫn độc lập và dùng bcrypt như v6.3; không bị buộc qua Google login. Google origin/HTTPS trên điện thoại vẫn theo MOBILE_UI_LAN.md.

## Cửa hàng

Mở **Cửa hàng** ở header khi ở sảnh/kết quả hoặc từ Hồ sơ. Khi đang chơi, header tiếp tục chỉ hiện Cài đặt/FPS/ping.

- Khung avatar: preview trực tiếp với ảnh Google, giá và trạng thái sở hữu/trang bị.
- Trang phục: 6 mẫu voxel với preview hình khối dùng cùng dữ liệu của nhân vật trong game.
- Nền hồ sơ: chuyển từ Hồ sơ vào shop.
- Vòng quay: bánh xe mới có viền đèn, màu từng ô, thông báo thưởng, ví token và bảng tỷ lệ.

Mua và Trang bị là hai thao tác riêng. Mua có bước xác nhận giá; bấm mua lại món đã sở hữu không trừ tiền lần nữa. Trang bị miễn phí nhưng phải rời phòng trước. Có thể mua vào kho trong phòng; không thay ngoại hình giữa trận.

Shop tiêu token kiếm được từ thắng game/vòng quay. Bản này không tích hợp nạp token bằng tiền thật hoặc cổng thanh toán. Việc đổi tên có phí vẫn tại Hồ sơ như trước. Không khôi phục Google Ad Manager.

Khi thiếu token, nút dẫn sang vòng quay. Vòng quay miễn phí mỗi 6 giờ, tỷ lệ 40/30/20/9/1% cho 5/10/20/50/100 token; diện tích các ô bằng nhau không biểu thị xác suất. Server quyết định kết quả và ghi thưởng, frontend chỉ công bố số dư sau animation. Lượt bonus cũ vẫn tiêu được.

## 10 frame SVG bổ sung

Tất cả có canvas 100×100, tâm trong suốt, không tải ảnh ngoài, nằm ở `apps/web/public/frames/`. SVG tạo mới cho dự án, không phải frame tải từ bên thứ ba. Giữ 3 frame cũ.

| ID | Tên | Token |
| --- | --- | ---: |
| candy | Kẹo gậy | 100 |
| aurora | Cực quang | 180 |
| gingerbread | Bánh gừng | 110 |
| starlight | Ánh sao | 200 |
| mistletoe | Tầm gửi | 150 |
| royal | Vương miện | 300 |
| lantern | Đèn mùa đông | 170 |
| icecrystal | Tinh thể băng | 190 |
| peppermint | Kẹo bạc hà | 130 |
| midnight | Đêm Giáng sinh | 240 |

Sửa giá/path/inset tại `AVATAR_FRAMES` trong `packages/winterarc-profile/src/account.ts`. Không đổi ID của frame đang bán nếu muốn giữ quyền sở hữu cũ. Các frame mới dùng inset 16%; thay đổi nếu bộ asset riêng của bạn có lỗ ảnh khác.

## Nhân vật và skin

| ID | Ngoại hình | Token |
| --- | --- | ---: |
| explorer | Áo khoác, kính trên mũ, pom-pom, balô | 0 |
| elf | Mũ lệch, tai yêu tinh, áo xanh, giày đỏ | 180 |
| santa | Áo đỏ viền kem, mũ và râu Santa | 250 |
| reindeer | Bộ nâu, sừng và mũi đỏ | 220 |
| frost | Bộ xanh băng, vương miện tinh thể | 320 |
| ginger | Bánh gừng, tóc kem và cúc kẹo | 200 |

Dáng mới có giày/chân riêng, găng tay, mắt/má/miệng, khăn, thắt lưng và phụ kiện. Các khớp vai/hông/đầu độc lập: tay chân vung ngược nhau khi chạy, nhún nhẹ theo bước và tạo dáng khi nhảy. Gốc nhân vật không bị nhún nên không ảnh hưởng đồng bộ vị trí hay nameplate.

Đây là skin trang trí, không thay hitbox, tốc độ, khả năng nhảy hoặc sức mạnh. Ở góc nhìn thứ nhất bạn không thấy toàn thân mình; người chơi khác và camera quan sát thấy skin đang trang bị, bạn xem ngoại hình trong shop. Màu áo trong Hồ sơ chỉ áp dụng skin Explorer; các bộ khác có palette riêng.

### Module hình khối

- `packages/winterarc-profile/src/skins.ts`: catalog giá, danh sách hộp và pivot từng nhóm thân thể.
- `apps/web/src/engine/CharacterModel.ts`: tạo mesh bằng MeshFactory và animate khớp.
- `apps/web/src/engine/PlayerManager.ts`: đồng bộ skinId, tạo lại avatar khi đổi skin/màu, nội suy vị trí và bước chân như cũ.
- `apps/web/src/shop/SkinPreview.tsx`: SVG isometric dùng `avatarParts()` chung với model; không thêm WebGL context. Preview tĩnh, không có ánh sáng Babylon.

Thêm skin: khai báo PLAYER_SKINS, thêm nhánh phụ kiện trong avatarParts, thêm tên vi/en tại i18n/shop.ts. Không cần đổi code API hoặc shop cho mỗi skin. Giữ số hộp/phụ kiện gọn để hạn chế draw call ở phòng đông; bản này chưa dùng instancing/mesh batching cho cả người chơi.

## Server và lưu dữ liệu

Migration thêm `users.skin_id`, mặc định `explorer`, giữ nguyên token/kho cũ. Quyền sở hữu dùng bảng cosmetics với khóa `skin:<id>` giống `frame:<id>` và `theme:<id>`. Có ledger khi mua. Server không nhận giá hay số token từ client.

`POST /api/shop/item` nhận `{ kind, itemId, action }` với kind frame/skin/theme, action buy/equip. Server xác minh session, allowlist item, số dư, quyền sở hữu, và yêu cầu rời phòng nếu trang bị. Purchase + debit + ownership nằm trong cùng SQLite transaction. Đây là API chính của shop; endpoint profile/style cũ vẫn giữ tương thích cho màu áo và mỹ phẩm cũ.

skinId được server lấy từ database, truyền qua Colyseus schema/snapshot. Việc sửa localStorage hoặc JSON lựa chọn của client không cho phép trang bị skin chưa mua. Tiền/thưởng không phụ thuộc animation frontend.
