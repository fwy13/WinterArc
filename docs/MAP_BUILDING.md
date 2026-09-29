# Xây map bằng Winter Arc Editor (v6.8)

Bản vá áp dụng **sau v6.7**, dựa trên `repomix-output(6).xml` + patch tab/credits.
Không thêm dependency, không cần migration tài khoản. Chưa build/chạy/test theo yêu cầu.

## Mở editor

- Chạy `npm run dev:editor` tại gốc repository; mở http://localhost:5174.
- Đây là ứng dụng Vite–React riêng ở `apps/editor`, không cần chạy server/game.
- Nút trong Cài đặt game dùng `VITE_EDITOR_URL`; production cần cấu hình URL editor.
- `/editor` trên game chỉ còn trang xuất bản nháp cũ, không còn viewport xây map.
- Hướng dẫn deploy riêng, asset dùng chung và chuyển IndexedDB: [EDITOR_APP.md](EDITOR_APP.md).
- Ưu tiên chuột/bàn phím. Mobile vẫn có thể quan sát/chỉnh tọa độ, chưa có joystick editor.

## Luồng xây map

1. Chọn mode ở bên trái, nhấn **Map nền** để tạo từ map procedural gốc, hoặc **Map trống** cho Hunt/Gift Race.
2. Chọn vật liệu và công cụ Đặt block / Phá block / Chọn vùng / Đặt điểm.
3. Trong Quan sát: kéo chuột để xoay; cuộn zoom; Ctrl+kéo pan; click dùng công cụ, chuột phải phá block. Di chuyển chuột quá 5 pixel được coi là kéo camera, không chỉnh map.
4. Trong Bay/xây: click vào cảnh để giữ chuột, WASD di chuyển, Space/E lên, Q xuống, Shift tăng tốc. Esc thả chuột để dùng panel.
5. Chọn vùng bằng hai lần click ở công cụ Chọn vùng, hoặc nhập góc A/B. Fill, xóa, thay vật liệu, copy/paste chỉ chạy khi bấm nút. Khung vàng cho biết vùng chọn.
6. **Tọa độ đích** là góc nhỏ nhất của vùng dán/di chuyển. Xoay bản sao 0/90/180/270° quanh trục Y, đã chuẩn hóa lại tọa độ. Không dán air mặc định; bật khi muốn xóa các ô tại vùng đích. Di chuyển vùng luôn mang cả air để kết quả tương ứng vùng nguồn.
7. Undo/redo bằng nút hoặc Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y. Lịch sử giữ tối đa 60 thao tác hoặc 300.000 ô thay đổi. Mỗi thao tác tối đa 65.536 hàng cập nhật; di chuyển vùng cần cả xóa nguồn và ghi đích.

Map giới hạn X/Z từ -80 đến 79, Y từ 0 đến 47. Không tạo mesh riêng cho mỗi block: renderer gộp mặt lộ ra theo chunk 16×16 và material. Khi sửa block chỉ dựng lại chunk liên quan/giáp biên, phân bổ qua nhiều frame. Đây là meshing loại mặt kín, chưa phải greedy meshing.

## Điểm gameplay và vật thể

Chọn loại trong panel bên phải rồi click mặt block bằng công cụ Đặt điểm, hoặc nhập tọa độ đích và bấm Thêm. Click một dòng trong danh sách để nhìn tới/đưa vị trí vào ô tọa độ; xóa rồi thêm lại khi muốn chỉnh vị trí. Với cây, thao tác xóa cây mới đặt cũng gỡ collider thân cây tương ứng.

- **Spawn:** vị trí chân người chơi. Đặt trên sàn và chừa hai ô air.
- **Người tuyết:** các vị trí ứng viên. Hunt cần ít nhất 6 điểm; vòng chơi chọn theo logic hiện tại.
- **Checkpoint:** thứ tự trong danh sách là thứ tự cần đi qua. Muốn đổi thứ tự, xóa/thêm lại. Bán kính 0,5–12.
- **Đích:** một điểm đích cho Gift Race.
- **Cây thông:** dùng `/models/christmas-pine.glb` hiện có. Scale 0,25–4; kèm collider thân cây khi thêm.
- **Đèn:** mesh đèn sáng dùng cùng vị trí như runtime; không thêm point light GPU cho mỗi đèn.
- **Vùng va chạm:** cylinder logic có bán kính cấu hình, cao 2 block khi thêm. Preview vẽ khung hộp bao để dễ nhìn. Không phải model trang trí.
- `loseY`: độ cao bị loại, không phải chiều cao mặt sàn.

Cây/đèn/collider từ bản đồ nền được giữ khi xuất map replacement. Một số cây nền có collider được thiết kế riêng: kiểm tra và xóa collider trong danh sách nếu bạn xóa cây nền. Không tự tải GLB tùy ý; registry model hiện chỉ hỗ trợ cây thông của game.

## Mode và vùng khóa

- Hunt và Gift Race: thay toàn bộ map (`replace`). Editor tạo từ map procedural gốc, không tự sửa bản map đang cài trong registry. Muốn sửa bản custom đã cài, mở lại file JSON đã xuất.
- Crab: chỉ overlay, vùng bán kính 32 ở tâm bị khóa.
- Ice Break: chỉ overlay, vùng bán kính 21 bị khóa.
- Color Fall: chỉ overlay, vùng X/Z [-19,19] bị khóa.
- Vùng đỏ không cho sửa block hoặc đặt vật thể xuyên vào, marker gameplay của các mode overlay giữ theo map nền. Xuất overlay chỉ lưu các ô khác map procedural và vật thể bổ sung.

Không tự nhận dạng thay đổi đấu trường boss/spleef/colorfall thành luật chơi mới.

## Chơi thử

Bấm Chơi thử rồi click vào cảnh: WASD, Space nhảy, Shift chạy. Dùng `movePlayer`, `collides` và timestep 30 Hz của game trên bản sao dữ liệu. Rơi dưới `loseY` đưa về spawn. Esc thả chuột; bấm Quan sát để quay lại chỉnh map.

Chế độ này kiểm tra đường đi/va chạm, không chạy server, boss, nhặt người tuyết, thắng/thua hay đồng bộ mạng. Marker/collider/vùng khóa bị ẩn, cây và đèn vẫn hiện. Cần thử một phòng thật để kiểm tra toàn bộ gameplay.

## Lưu nháp, import, export

- Sau thay đổi, tự lưu sau 1,8 giây không chỉnh sửa vào IndexedDB. Nút Lưu nháp lưu ngay, Mở nháp khôi phục thủ công. Hiển thị lỗi nếu trình duyệt từ chối lưu.
- Mỗi browser/origin có một slot nháp. Không dùng nhiều tab editor cùng lúc vì chúng cùng ghi slot này. Không tự mở/ghi đè nháp cũ lúc mới vào editor.
- Lưu nháp cho phép thiếu marker bắt buộc; vẫn kiểm tra bounds/kiểu dữ liệu. Nháp không thay thế bản export/backup, có thể bị mất khi xóa dữ liệu trình duyệt.
- Mở JSON nhận map v1/v2 tối đa 32 MB; không thực thi JS/TS từ file.
- Kiểm tra map/Xuất JSON/Xuất TS yêu cầu marker hợp lệ và đủ điều kiện mode. Công cụ không chứng minh parkour thực sự đi được.
- `.map.json` là định dạng làm việc chính. `.ts` là module `export default ... satisfies MapDocument` để tích hợp thủ công.
- Map v2 thêm `trees`, `lamps`, `obstacles`. Map v1 tiếp tục được đọc. Server/web đều áp dụng dữ liệu qua cùng `applyMapDocument`.

## Đưa map vào game

Tại thư mục gốc repository:

```bash
npm run map:install -- ./village.map.json
# Thay bản đã có cho mode đó:
npm run map:install -- ./village.map.json --force
```

Script kiểm tra dữ liệu rồi ghi `packages/winterarc-world/src/maps/<mode>.json` và cập nhật `generated.ts`. Mỗi mode hiện có một map custom; cài map không tạo mode mới. Map procedural vẫn là fallback.

Sau đó **build và triển khai cả frontend lẫn backend cùng phiên bản**. Frontend trên Vercel cần redeploy; VPS cần cập nhật backend và restart. Không chỉ upload JSON lên thư mục public vì server phải dùng cùng dữ liệu va chạm.

Giữ `MapKit` để viết procedural map bằng code khi cần. Luồng Minecraft cũ đã được gỡ: không còn `map:import`, parser NBT, bảng chuyển block hay hỗ trợ `.nbt`/`.schem`. Các JSON đã chuyển đổi trước đây vẫn có thể mở nếu phù hợp schema v1.

## Module để phát triển tiếp

- `apps/editor/src/editor/EditorDocument.ts`: dữ liệu voxel, thao tác, undo/redo, import/export.
- `apps/editor/src/editor/EditorViewport.ts`: Babylon preview, mesh theo chunk, picking, camera, đi thử.
- `apps/editor/src/editor/EditorPage.tsx`: giao diện React/Tailwind.
- `apps/editor/src/editor/drafts.ts`: IndexedDB và tải file.
- `apps/editor/src/editor/messages.ts`: tiếng Việt/Anh riêng cho editor.
- `packages/winterarc-world/src/MapDocument.ts`: schema v1/v2, validation, loader dùng chung.
- `scripts/install-editor-map.ts`: cài JSON vào source registry.

Các công cụ này không sửa dữ liệu tài khoản, không cần thêm quyền backend. Muốn thêm publish trực tiếp sau này cần API admin, storage và đồng bộ version map riêng.

## Block không đầy (v6.9)

Xem [BLOCK_SHAPES.md](BLOCK_SHAPES.md) để dùng slab, bậc thang và đuốc (ID 22–32),
xoay block và đặt marker ở cao độ nửa block. Hình học/collision dùng chung giữa
editor, game và server.
