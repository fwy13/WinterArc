# Winter Arc — Christmas Arcade v6

React + TypeScript + Tailwind v4 · noa/Babylon.js · Colyseus 0.16.

Mỗi phòng chơi **một mode mỗi ván**, tối đa 32 người. Giữ phòng công khai, phòng riêng có mật khẩu, joystick mobile, tên trên đầu nhân vật và giao diện giấy Giáng sinh. Đã bỏ Battle FPS, shop súng và dữ liệu chiến đấu hai đội.

## Những thay đổi

- Giữ và cải thiện 5 game: tìm người tuyết, cua tuyết, Ice Break, Color Fall, chạy giao quà.
- `MapKit`: hàm dựng block, vùng đặc/rỗng, đĩa, cầu thang, quà, gậy kẹo, đèn và cây thông.
- Editor độc lập tại `apps/editor` (`npm run dev:editor`, cổng 5174): xây block, marker, undo/redo, chơi thử và xuất JSON/TypeScript. Dữ liệu dùng chung ở client/server.
- Màn kết quả hai cột: top 3/danh sách điểm và sảnh ván kế tiếp, chọn mode, sẵn sàng hoặc rời.
- Cài đặt âm lượng tổng/hiệu ứng/bước chân, độ nhạy chuột/cảm ứng, FOV, render scale, nhún/rung camera, FPS/ping. Lưu trên thiết bị.

**Theo yêu cầu, không cài dependency, chạy game, build, typecheck hoặc test bản sửa.** Các lệnh sau dành cho bạn thực hiện tại máy mình. ZIP chứa toàn bộ source và asset mặc định, không kèm `node_modules` hoặc bản build.

Nguồn code là `repomix-output(5).xml`. Repomix không chứa binary; PNG/GLB trong ZIP được khôi phục từ bản Winter Arc trước trong dự án. Nếu bạn đã thay asset riêng sau đó, copy lại chúng vào cùng đường dẫn `apps/web/public`. Âm thanh có fallback tổng hợp nên không bắt buộc file MP3/WAV.

## Chạy tại máy bạn

Cần Node.js 22.18 trở lên và npm. Tại thư mục gốc:

```bash
npm install
npm run dev
```

Web: `http://localhost:5173`; server: `http://localhost:2567`. Chạy riêng bằng `npm run dev:client` / `npm run dev:server`.

```bash
npm run format
npm run build
npm start
```

`format` dùng Prettier; `build` tạo server và web; backend production phục vụ web đã build. Chưa có lockfile được resolve trong lần bàn giao này vì không cài dependency; hãy commit lockfile sau khi cài ở máy bạn.

## Chơi và chơi tiếp

`lobby → countdown 5 giây → playing → finished → countdown …`

1. Chọn game, nhập tên và tạo phòng hoặc vào phòng đang có.
2. Ở sảnh đầu, người tham gia bấm Sẵn sàng; chủ phòng bấm Bắt đầu.
3. Trong ván phòng khóa người mới, người bị loại được xem.
4. Kết thúc, phòng mở lại: kết quả ván cũ bên trái, sảnh ván tiếp theo bên phải.
5. Chủ phòng được đổi mode/kiểu thắng. Đổi sẽ reset sẵn sàng của tất cả.
6. **Chơi lại cần mọi người đang kết nối, kể cả chủ phòng, bấm Sẵn sàng**, sau đó chủ phòng bắt đầu. Không muốn chơi tiếp thì rời trận.

Người mới vào sảnh sau trận cũng phải ready. Chủ phòng rời thì quyền chuyển cho người còn kết nối. Reconnect có thời gian chờ 20 giây; nhân vật mất kết nối vẫn chịu luật loại trong ván. Kết quả chỉ nằm trong RAM của phòng, chưa có ranking bền vững/tài khoản.

## Luật và cải thiện game

| Game | Thay đổi | Thắng |
| --- | --- | --- |
| Hunt | Trang trí MapKit, hồi sinh khi ngã, gợi ý khoảng cách sau 45s, mục tiêu lấy từ map | Tìm đủ 6 trước ở cá nhân; người hoàn tất cùng thắng ở nhóm |
| Crab | HP theo số người, quay về người gần nhất, gợi ý né/vượt sóng, hồi 6 HP khi boss bắt đầu hồi sức | Phải hạ boss; cá nhân là người sống có điểm cao nhất, nhóm là người còn sống |
| Ice Break | Viền cảnh báo, đếm ngược thu hẹp; vùng tối thiểu cho co-op/luyện tập | Cá nhân nhiều người sống cuối cùng; nhóm sống đến hết giờ |
| Color Fall | Không lặp màu liên tiếp; thời gian cảnh báo giảm dần, tối thiểu 3,2s | Đứng đúng màu trước khi sàn khác biến mất |
| Gift Run | Checkpoint theo dữ liệu map, làm nổi điểm tiếp theo, hồi sinh tại checkpoint | Qua checkpoint theo thứ tự, đến Santa và tương tác giao quà |

Hết giờ: cá nhân Hunt/Gift Run xếp theo điểm/tiến độ dù chưa hoàn tất; co-op chỉ công nhận người hoàn tất. Crab chưa hạ boss thì không ai thắng. Nếu tất cả bị loại, không ai thắng. Một người vẫn mở ván luyện tập được. Ice Break/Color Fall không tự kết thúc ngay lúc vào một mình.

## Xây map bằng editor

Chạy `npm run dev:editor` rồi mở `http://localhost:5174`. Cài đặt → Xưởng xây map mở URL `VITE_EDITOR_URL`. Hướng dẫn chạy/deploy/chuyển bản nháp: **[docs/EDITOR_APP.md](docs/EDITOR_APP.md)**. Xem **[docs/MAP_BUILDING.md](docs/MAP_BUILDING.md)** để biết điều khiển, vùng khóa, lưu nháp và định dạng map v2.

Xuất `.map.json`, sau đó cài tại thư mục gốc:

```bash
npm run map:install -- ./village.map.json
# Thay map đã có:
npm run map:install -- ./village.map.json --force
```

Cài xong phải rebuild/redeploy **cả web và server**. Không chỉ copy JSON vào `public`. Hunt/Gift Race hỗ trợ thay toàn bộ map; ba arena còn lại hỗ trợ overlay trang trí ngoài vùng bảo vệ. Luồng chuyển đổi Minecraft cũ đã được gỡ.

## Settings và audio

Mở ⚙ tại menu/sảnh hoặc Menu trong ván → Cài đặt. Các thanh volume từ 0 đến 1. Render scale 0,75 giảm độ phân giải 3D, UI không đổi độ nét. FPS là tốc độ render, không phải tick server. Nhún/rung vẫn tôn trọng `prefers-reduced-motion` của thiết bị.

AudioContext chỉ khởi tạo sau thao tác người dùng. Bấm Thử âm thanh để mở tiếng; âm tổng hợp được cache, file riêng tải nền, tối đa 32 tiếng đồng thời. Bước chân người khác có vị trí 3D. Xem **[audio/README](apps/web/public/audio/README.md)** để thay WAV/MP3.

## Cấu trúc

| Vị trí | Vai trò |
| --- | --- |
| `apps/web/src/components` | UI React, settings, HUD, lobby/results |
| `apps/web/src/engine` | noa, camera, player prediction, avatar, model/audio |
| `apps/web/src/games` | Renderer/tương tác riêng từng mode |
| `apps/server/src/rooms` | Phòng, password, sẵn sàng và lifecycle |
| `apps/server/src/rounds` | Luật game do server quyết định |
| `packages/winterarc-core` | Kiểu miền nền tảng |
| `packages/winterarc-protocol` | Snapshot, room contracts, message payload, validation |
| `packages/winterarc-gameplay` | Movement, prediction, luật và cấu hình gameplay |
| `packages/winterarc-profile` | Hồ sơ, settings, skin/frame, cấu hình token |
| `packages/winterarc-rendering` | Geometry, texture catalog, cây thông, cực quang |
| `packages/winterarc-world` | MapKit, builder, collision, dữ liệu import |
| `apps/editor/src/editor` | Editor offline, chunk preview, undo/redo và bản nháp |
| `scripts/install-editor-map.ts` | Kiểm tra và cài JSON vào registry map |

Hướng dẫn phát triển: **[CONTRIBUTING.md](CONTRIBUTING.md)**. Tên `TournamentRoom` và `winter_tournament` giữ để không thay endpoint; không có chuỗi nhiều mode/loại 32→16.

## Deploy

- Frontend dùng `VITE_SERVER_URL`; server dùng `PORT`, `ALLOWED_ORIGINS` (phân cách dấu phẩy). Xem các `.env.example` và thiết lập biến trong môi trường chạy.
- Deploy web/server/packages cùng phiên bản vì Schema đã đổi; không dùng frontend cũ với backend mới.
- Dùng HTTPS/WSS khi public. Proxy chuyển cả HTTP matchmaking, `/api/rooms` và WebSocket.
- Phòng riêng không hiện trong danh sách; mật khẩu 6–64 ký tự chỉ được hash/salt scrypt trong RAM server. Link mời không chứa mật khẩu.
- `GET /api/rooms` trả tối đa 100 phòng công khai, kể cả sảnh sau trận. Restart server mất các phòng trong RAM.
- Chưa có database ranking, di trú trận đang chạy hoặc benchmark 32 client.

Người duy trì cấu hình tại `apps/web/src/config/maintainers.ts`. Giữ các key VI/EN trong `src/i18n`; key English cũ chưa dịch đầy đủ có fallback tiếng Việt.

## Kiến trúc và bầu trời mới

- [Ranh giới package và quy tắc import](docs/PACKAGES.md)
- [Editor Vite–React riêng](docs/EDITOR_APP.md)
- [Cực quang và mức chất lượng](docs/AURORA.md)

## Backend Docker + Nginx

Xem [docs/DEPLOY_DOCKER.md](docs/DEPLOY_DOCKER.md) để chạy bằng IP, cấu hình HTTPS/WebSocket, Google login, cookie và lưu SQLite.
