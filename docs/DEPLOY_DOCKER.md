# Production: Vercel frontend + VPS backend

Áp dụng patch này sau `winterarc-itclub-brand.patch`.

## Kiến trúc

- `game.example.com`: Vercel phục vụ React/Vite và asset game từ CDN.
- `api.example.com`: Nginx TLS trên VPS → service `server:2567` trong Docker.
- HTTP API, Colyseus matchmaking và WebSocket đi trực tiếp từ browser tới backend.
- SQLite nằm trong volume `winterarc_accounts`. Giữ một replica backend vì room
  ở RAM và SQLite dùng chung trên máy này. Không scale nhiều process tùy ý.
- Không chuyển WebSocket qua Vercel, không build frontend/editor trong image VPS.

Giữ thư mục `apps/*` và `packages/*` vì client/server cần dùng chung protocol,
map và gameplay. Cấu hình vận hành tập trung trong `deploy/`; hai file compose
ở root để đường dẫn và volume cũ được giữ ổn định.

## 1. DNS và môi trường

Cần Docker Engine + Compose v2 (có BuildKit), một tên miền và quyền quản lý DNS.
Trỏ A `api.example.com` tới IP VPS. Chỉ thêm AAAA khi IPv6 thực sự hoạt động.
Mở TCP 80/443 ở firewall VPS; không publish cổng 2567.

```bash
cp .env.example .env
```

Sửa `.env` trên VPS:

```dotenv
API_DOMAIN=api.example.com
ALLOWED_ORIGINS=https://game.example.com
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
COOKIE_SAME_SITE=lax
ADMIN_USERNAME=your-admin
ADMIN_PASSWORD_HASH='$2b$...'
```

Hash admin lấy bằng lệnh `npm run admin:hash -w @winterarc/server` trên máy dev.
Giữ dấu nháy đơn quanh bcrypt hash để `$` không bị Compose nội suy. Không commit
`.env`, DB, backup hoặc private key. Biến server không được đặt trong biến `VITE_*`.

Nếu cổng 80/443 đã do Nginx/Docker khác dùng, không chạy stack mới đè cổng: dùng
reverse proxy hiện có hoặc dành IP/cổng phù hợp. Hướng dẫn này giả định 80/443 trống.

## 2. Khởi động backend và cấp HTTPS lần đầu

Thay tên miền/email trong lệnh certbot bên dưới bằng thông tin của bạn:

```bash
docker compose config --quiet
docker compose up -d --build server nginx
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  --cert-name api.example.com -d api.example.com \
  --email admin@example.com --agree-tos --no-eff-email
docker compose -f compose.yml -f compose.https.yml up -d nginx
curl --fail https://api.example.com/health
```

Bước bootstrap chỉ mở ACME challenge và chuyển hướng HTTP → HTTPS. API bắt đầu
hoạt động công khai sau bước bật `compose.https.yml`. Chứng chỉ được lưu trong
volume `winterarc_certificates`, không cần chép PEM thủ công.

Gia hạn: thêm vào crontab trên VPS (đổi đường dẫn tuyệt đối):

```cron
17 3,15 * * * /bin/sh /opt/winterarc/deploy/scripts/renew-cert.sh >> /var/log/winterarc-cert.log 2>&1
```

Thử cơ chế challenge trước:

```bash
docker compose run --rm certbot renew --dry-run
```

Script kiểm tra Nginx rồi reload sau khi renew thành công; reload giữ kết nối
đang hoạt động. Cron không tự được cài khi áp dụng patch.

## 3. Deploy frontend Vercel

Import repository Git vào Vercel, cấu hình:

| Mục | Giá trị |
| --- | --- |
| Root Directory | `apps/web` |
| Include source files outside Root Directory | Bật (cần `packages/*`) |
| Framework | Vite |
| Node.js | 22.x |
| Install/Build/Output | Dùng `apps/web/vercel.json` |
| Production env | `VITE_SERVER_URL=https://api.example.com` |

Không đặt Root Directory ở root repo với cấu hình này. Install chỉ chọn workspace
`web`; Build chạy `tsc -b && vite build`; Output là `dist`. Thêm custom domain
`game.example.com` trong Vercel rồi đặt bản ghi DNS theo hướng dẫn của Vercel.
Sau khi đổi `VITE_SERVER_URL`, phải redeploy vì Vite nhúng biến lúc build.

Trong Google Cloud OAuth Web Client: Authorized JavaScript origins thêm
`https://game.example.com` và `http://localhost:5173` nếu phát triển local.
GOOGLE_CLIENT_ID phải giống ID backend trả qua `/api/config`.

Dùng hai subdomain HTTPS **cùng tên miền gốc** để cookie HttpOnly/Secure với
SameSite=Lax hoạt động trong bố trí này. Không cần cookie Domain dùng chung:
cookie vẫn thuộc riêng host API, request frontend đã có `credentials: include`.

Nếu dùng `project.vercel.app` với `api.example.com`, phải đặt COOKIE_SAME_SITE=none;
trình duyệt vẫn có thể chặn cookie bên thứ ba. Vì thế không chọn bố trí này cho
production. Preview Vercel nên dùng backend staging và origin được cho phép cụ thể,
không wildcard toàn bộ `*.vercel.app`. Không kết nối preview vào production mặc định.

## 4. Cập nhật và dữ liệu

```bash
sh deploy/scripts/backup-db.sh
docker compose build server
docker compose -f compose.yml -f compose.https.yml up -d --no-deps server
docker compose -f compose.yml -f compose.https.yml ps
docker compose logs --tail=100 server nginx
```

Nginx dùng DNS Docker động `server:2567`, nên khi container server đổi IP không
cần restart Nginx. Restart backend vẫn ngắt trận đang chạy (room nằm trong RAM);
hãy cập nhật lúc không có người chơi. Thay protocol/map chung cần phối hợp deploy
client/server cùng phiên bản, vì frontend cũ có thể còn nằm trong tab người chơi.

`backup-db.sh` dùng SQLite online backup, gồm dữ liệu đã commit trong WAL. Không
chép riêng accounts.sqlite khi server đang ghi. File nằm trong `backups/`; đưa bản
sao ra ngoài VPS. Script không tự xóa backup cũ.

Khôi phục: dừng server, giữ một bản backup mới nhất, dùng container công cụ mount
volume accounts để thay DB bằng bản snapshot và bỏ WAL/SHM cũ, đặt chủ sở hữu
1000:1000 rồi khởi động lại. Không chạy `docker compose down -v` vì sẽ xóa volume.
Volume accounts giữ tên như compose cũ; nếu trước đây đổi project name bằng `-p`,
phải tiếp tục dùng đúng tên đó cho mọi lệnh để không vô tình tạo DB rỗng.

Nếu cấu hình cũ dùng PEM ở `deploy/certs`, chuyển qua volume certbot theo bước 2.
Quay về bootstrap sẽ cần restart Nginx; lên lịch thời gian bảo trì trước khi chuyển.

## 5. Build cache và giới hạn kiểm chứng

Docker chỉ cài dependency backend một lần, cache npm qua BuildKit, rồi prune dev
trước khi copy sang runtime. Source thay đổi không làm mất cache install nếu
package.json chưa đổi. Runtime chạy user node, filesystem read-only ngoài /data
và /tmp; không chứa compiler. Log giới hạn 3 × 10 MB mỗi service.

Repomix không cung cấp package-lock.json. Docker dùng manifest backend tách biệt
và npm install; đây **chưa phải build tái lập bằng lockfile**. Khi chốt release,
khóa image tag/digest và bổ sung lockfile cho manifest deploy nếu cần tái lập
chính xác. Không đổi sang npm ci khi chưa có lockfile phù hợp.

Đã kiểm tra cú pháp TS/TSX, YAML/JSON và khả năng áp dụng patch. Chưa build image,
chưa cấp certificate và chưa deploy Vercel/VPS trong môi trường này.

Tham khảo chính thức:
- https://nginx.org/en/docs/http/websocket.html
- https://vercel.com/docs/monorepos/monorepo-faq
- https://eff-certbot.readthedocs.io/en/stable/using.html
