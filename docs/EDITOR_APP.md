# Editor Vite–React riêng

## Áp dụng và chạy

Patch dựa trên repomix-output(7).xml. Sau khi áp dụng, chạy tại gốc repository:

```bash
npm install
npm run dev:editor
```

`npm install` cần thiết trên máy bạn để npm liên kết các workspace mới và cập nhật
package-lock hiện có. Bản source gửi lên không chứa lockfile, nên patch không tạo
lockfile bằng phỏng đoán. Commit lockfile sau khi cập nhật.

- Editor: http://localhost:5174 (strictPort, không tự đổi cổng).
- Game: `npm run dev:client`, thường ở http://localhost:5173.
- Server: `npm run dev:server`.
- `npm run dev` vẫn chỉ chạy game + server; editor không bắt buộc để chơi.
- `npm run build:editor` → apps/editor/dist.
- `npm run preview:editor` → http://localhost:4174.
- `npm run build:all` build server, web và editor.

Editor không đăng nhập, không mở socket và không tạo instance noa. Babylon viewport
chỉ phục vụ xây map và thử di chuyển; Colyseus/backend không cần chạy để sử dụng.
Editor vẫn dùng chung packages, nên đây là app độc lập trong monorepo, không phải
thư mục có thể sao chép một mình mà không mang theo packages.

## URL giữa hai ứng dụng

Thêm vào **apps/web/.env.local**:

```dotenv
VITE_EDITOR_URL=http://localhost:5174
```

Thêm vào **apps/editor/.env.local**:

```dotenv
VITE_GAME_URL=http://localhost:5173
```

Ở môi trường dev, nếu không cấu hình, nút dùng hostname hiện tại và cổng 5174/5173,
phù hợp khi truy cập bằng IP từ điện thoại. Nếu cấu hình localhost, điện thoại sẽ
trỏ tới chính nó; hãy dùng IP LAN hoặc bỏ biến để dùng mặc định dev.

Production: dùng URL HTTPS thật của hai ứng dụng và build lại. Game ẩn liên kết
editor nếu chưa đặt VITE_EDITOR_URL. Editor nên có VITE_GAME_URL để nút Về game
đi đúng địa chỉ (mặc định `/` sẽ về chính editor khi chưa cấu hình).

## Deploy riêng

Tạo một project Vercel thứ hai cùng repository, Root Directory = apps/editor,
Output Directory = dist; cho phép truy cập source ngoài root trong monorepo.
Build Command `npm run build`, Install Command dùng npm workspaces từ repository.
Hoặc chạy build:editor tại gốc rồi host apps/editor/dist bằng static hosting.

Không đưa server secret, Google secret hoặc admin password vào biến VITE_*.
Editor không cần tài khoản để tạo JSON. Việc cài map vào game vẫn do người có quyền
source/deploy thực hiện bằng `npm run map:install -- ./map.map.json`.

## Asset

Vite editor dùng `publicDir: ../web/public` để game và editor nhìn cùng bộ PNG/GLB
hiện có. Binary không nằm trong repomix nên patch giữ nguyên đường dẫn asset.
Vite copy public vào dist khi build: editor đã build có thể deploy độc lập, không
fetch texture qua domain game. Cách này cũng copy các public asset khác; nếu muốn
thu nhỏ gói deploy sau này có thể tách bộ asset authoring riêng.

## Chuyển bản nháp

IndexedDB phụ thuộc origin, bao gồm scheme, hostname và port. Bản nháp ở cổng 5173
không tự xuất hiện ở 5174. Dữ liệu cũ không bị xóa.

1. Truy cập `/editor` trên **đúng origin game cũ** và cùng hồ sơ trình duyệt.
2. Trang này nay chỉ là trang chuyển tiếp nhẹ. Chọn **Xuất bản nháp cũ**.
3. Mở editor mới, chọn **Nhập JSON**, sau đó lưu bản nháp.

Trang chuyển tiếp đọc dữ liệu ở chế độ readonly và cho phép xuất bản nháp chưa đủ
marker. Không cần cài lại editor cũ. Local settings/ngôn ngữ của editor mới độc lập
với settings tài khoản game. Bản đồ định dạng v1/v2 và ID block xoay vẫn được giữ.
