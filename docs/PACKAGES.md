# Package boundaries

Các package là npm workspaces trong cùng repository. Web, editor và server dùng chung
source TypeScript; không phải các dịch vụ chạy độc lập.

| Package | Chứa gì | Phụ thuộc nội bộ |
| --- | --- | --- |
| winterarc-core | GameId, vị trí, hướng/input, phase, vùng nguy hiểm, SkyQuality | Không |
| winterarc-protocol | Snapshot, RoomState, PublicRoom, ConnectOptions, ClientMessages, ServerMessages, kiểm tra input mạng | core |
| winterarc-world | VoxelWorld, block/shape, raycast hình học, MapKit, builder, MapDocument | core |
| winterarc-gameplay | Di chuyển/prediction, tìm mục tiêu, ngắm snowball, Ice Break, cấu hình mode | core, world |
| winterarc-profile | Hồ sơ công khai, role, danh mục skin/frame, settings và cấu hình token | core |
| winterarc-rendering | ShapeGeometry, bảng texture, TreeModels, AuroraSky | core, world; Babylon |

`winterarc-logic` đã được gỡ. Import từ package sở hữu symbol, không tạo một barrel
mới re-export tất cả vì sẽ làm mờ lại ranh giới.

Ví dụ:

```ts
import type { GameId, Motion } from 'winterarc-core';
import type { Snapshot, InputCommand, PublicRoom } from 'winterarc-protocol';
import { validInput } from 'winterarc-protocol';
import { movePlayer, GAME_DEFINITIONS } from 'winterarc-gameplay';
import { WorldFactory } from 'winterarc-world';
import { normalizeGameSettings } from 'winterarc-profile';
import { AuroraSky } from 'winterarc-rendering';
```

## Hướng phụ thuộc

- World không import gameplay. Protocol không import world, gameplay hoặc rendering.
- Gameplay không import protocol: dữ liệu đầu vào là kiểu miền như Controls/Motion.
- `validInput` thuộc protocol vì kiểm tra seq/round và payload nhận từ mạng.
- Rendering không import React, noa, Colyseus, account service hoặc source của app.
- Web/editor không import source server. NetworkService dùng RoomState của protocol;
  WinterState ở server implements hợp đồng đó. Schema và trường nội bộ admin/xếp hạng
  vẫn được giữ trên server, không bổ sung vào dữ liệu truyền đi.
- ClientMessages quy định payload khi gọi NetworkService.send(). Đây là kiểm tra
  TypeScript; server vẫn kiểm tra dữ liệu, quyền, nhịp gửi và luật chơi tại runtime.
- Account DB, Google OAuth, bcrypt, quyền admin và giao dịch token nằm trong apps/server.
  Danh mục/giá công khai trong profile không cấp quyền cho client tự cộng token.
- Registry minigame phía client/server vẫn thuộc app tương ứng; gameplay chỉ chứa
  thuật toán thuần dùng chung. Không đưa React component hoặc Room vào package đó.

## Thêm tính năng

1. Kiểu miền dùng chung → core.
2. Message/response mới → protocol; cập nhật handler và runtime validation server.
3. Luật/tính toán có thể chạy ở cả hai phía → gameplay.
4. Block, shape, map → world; hình ảnh tương ứng → rendering.
5. Hiển thị React, local input, sound và session → apps/web.
6. Công cụ authoring → apps/editor; xuất MapDocument rồi dùng map:install.

Các package export `.ts` như cấu hình workspace hiện tại. Vite/tsx và esbuild server
xử lý source này. Không chạy trực tiếp package TS bằng Node đời cũ.
