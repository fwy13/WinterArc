# v6.9 — slab, bậc thang và đuốc

Áp dụng sau v6.8 Map Editor. Không cần thêm dependency hay đổi schema JSON.
Chưa build/chạy/test theo yêu cầu. Sau áp dụng, build/deploy cả web và server
cùng phiên bản vì collision/movement/raycast dùng chung đã thay đổi.

```bash
git apply winterarc-v6.9-block-shapes.patch
```

## ID mới

| ID | Block |
| --- | --- |
| 22 | Slab gỗ nửa dưới (cao 0,5) |
| 23 | Slab gỗ nửa trên (y=0,5–1) |
| 24 | Bậc thang gỗ, phía cao hướng +Z |
| 25 | Bậc thang gỗ, phía cao hướng -X |
| 26 | Bậc thang gỗ, phía cao hướng -Z |
| 27 | Bậc thang gỗ, phía cao hướng +X |
| 28 | Đuốc đứng |
| 29 | Đuốc gắn tường +Z |
| 30 | Đuốc gắn tường -X |
| 31 | Đuốc gắn tường -Z |
| 32 | Đuốc gắn tường +X |

Hướng tường chỉ mặt ô có tường đỡ, không phải hướng người nhìn.
Đuốc tường dùng thân đứng và giá đỡ ngắn, tất cả hình học nằm trong ô.
Đuốc không cản người chơi/đạn, vẫn chọn được trong editor.
Ngọn lửa là khối màu emissive tĩnh, không phải particle hay nguồn sáng point-light;
không chiếu sáng tường, không đổ bóng động, không mô phỏng lan ánh sáng.

## Editor

- Các ID mới xuất hiện trong palette.
- Chọn một hướng hoặc bấm **Xoay block 90°**. Slab/đuốc đứng giữ nguyên ID.
- Copy/paste có xoay sẽ xoay cả vị trí và ID hướng; block đối xứng không đổi.
- Click chọn theo hình dạng thật bằng DDA + ray/AABB, không chọn nhầm phần rỗng.
- Ô tọa độ vẫn là ô voxel; chọn một mặt bên trong slab/stair để đặt sẽ đặt sang ô
  liền kề theo pháp tuyến. Không tự ghép hai slab thành một cube hoặc chồng block
  vào cùng ô. Để tạo một khối đầy, chọn WOOD (ID 3).
- Marker trên slab dưới cần Y = y của ô + 0,5. Ví dụ slab ở [0,2,0], spawn tại
  [0.5,2.5,0.5]. Nhập marker bằng tọa độ; công cụ click marker mặc định vẫn dùng
  vị trí ô liền kề, không tự suy ra độ cao mặt slab.
- Đuốc gắn tường không tự dò hướng theo mặt click. Chọn ID/hướng trước khi đặt.
- Không có cơ chế tự rơi đuốc khi phá block đỡ; editor cho phép tự do bố trí.

## Render và hiệu suất

- Cube giữ renderer terrain của noa.
- Block không đầy được đăng ký `solid:false, opaque:false`, không có material cube.
  `PartialBlockRenderer` vẽ riêng theo chunk 16×16 và material, không tạo mesh cho
  từng cây đuốc/bậc thang. Player hiện đã tắt physics mặc định noa và dùng movement
  chia sẻ, nên `solid:false` ở registry không khiến player đi xuyên bậc thang.
- Registry shape xác định collision box, selection box và các phần model.
- `ShapeGeometry` dựng bề mặt ngoài của các hộp, cắt các mặt nội bộ và cache theo ID.
- Editor và preview menu dùng cùng hình học. Cube bên cạnh không bỏ mặt khi hàng
  xóm chỉ là slab, stair hoặc torch.
- Đổi mode tái tạo nhóm mesh; cập nhật block chỉ dựng lại nhóm chunk liên quan.
- Không giới hạn point light vì bản này không tạo point light.
- Map vẫn dùng Uint8Array, ID 0–255. Các ID 22–32 phải được giữ ổn định để map cũ
  không bị đổi nghĩa. JSON v1/v2 giữ `[x,y,z,id]`.

## Di chuyển và raycast

`collides()` kiểm tra AABB nhân vật với từng hộp collision của block, thay vì coi
mọi ô có ID là một khối đầy. `STEP_HEIGHT = 0.5` chỉ hoạt động khi có điểm tựa và
nhân vật không đi lên do nhảy. Có kiểm tra đường nâng phía trên để không bước
xuyên trần; không cho tự bước qua tường cao một block. Dùng cùng logic cho server,
client prediction và preview đi thử.

Đường ngắm tìm người tuyết, ném cầu tuyết và Ice Break dùng tia giao hình dạng;
các khoảng trống trong stair/slab không còn bị coi là tường. Ray gameplay dùng
collision; ray chọn trong editor dùng selection để vẫn chọn được đuốc.

`clearSupportedFeet()` cho phép marker ở cao độ nửa block và yêu cầu chỗ đứng
không bị block che. Như trước, validator không chứng minh mọi đường parkour đi được.

## Thêm loại khác

1. Đăng ký ID trong `VoxelWorld.ts` (BLOCK và PALETTE).
2. Thêm entry trong `SPECIAL_BLOCK_SHAPES` ở `BlockShapes.ts`.
3. `parts` là các hộp `[minX,minY,minZ,maxX,maxY,maxZ]` và material ID.
4. `collision` chỉ chứa phần chắn người chơi; `selection` chứa phần có thể chọn.
5. `rotateTo` trỏ ID hướng tiếp theo. Các hộp phải nằm trong 0..1.

Các block chưa có special shape vẫn là cube. Hình cong/mesh GLB không được suy ra
collision tự động. Slab/stair hiện chỉ có gỗ, chưa có stair upside-down/góc trong/
góc ngoài tự nối như Minecraft. Luồng import Minecraft cũ vẫn đã bị loại bỏ.
