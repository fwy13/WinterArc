# Backend Docker + Nginx

Bản vá áp dụng sau v6.10.1. Frontend vẫn deploy riêng trên Vercel; image không chứa
web hoặc editor. Một process Colyseus giữ phòng trong RAM, SQLite nằm trên volume.
Không scale nhiều replica server với cấu hình này.

## 1. Chạy backend bằng IP

Máy chủ cần Docker Engine và Docker Compose v2. Tại gốc repository:

```bash
cp deploy/.env.example .env
```

Nếu đã có `.env`, hãy gộp các biến thay vì ghi đè. Sửa ALLOWED_ORIGINS thành origin
frontend thực tế, ví dụ `https://winterarc-demo.vercel.app`. Đây KHÔNG phải URL backend.
Không thêm dấu `/` cuối, path, wildcard hay dấu nháy quanh từng origin.

```bash
docker compose up -d --build
docker compose logs -f server nginx
curl http://IP_VPS/health
```

HTTP mặc định ở cổng 80; đổi HTTP_PORT nếu cổng đang được dùng. Backend 2567 chỉ có
trong mạng Docker, không publish ra Internet. Mở cổng 80 ở firewall VPS/router.
`/` có thể trả 404 vì image chỉ chứa backend; dùng `/health` để kiểm tra.

**HTTP bằng IP chỉ giúp kiểm tra API/proxy, chưa phải cấu hình đăng nhập/chơi hoàn
chỉnh cho frontend HTTPS ở Vercel.** Cookie production vẫn giữ Secure. Không đổi
NODE_ENV sang development để gửi cookie đăng nhập không mã hóa qua Internet.

Nếu VPS RAM thấp, build image trên máy khác cùng kiến trúc rồi chuyển image lên VPS.
Compiler/native dependency build có thể cần nhiều RAM hơn lúc chạy game.

## 2. Google login và IP

Google Identity Services yêu cầu Authorized JavaScript origin là hostname HTTPS;
IP công cộng không hợp lệ, localhost/loopback là ngoại lệ phát triển. Do đó:

- Người chơi mở `http://IP_VPS`: không dùng origin đó để đăng nhập Google web.
- Người chơi mở `https://TEN.vercel.app`: có thể đăng ký origin chính xác đó với Google.
- Backend không phải origin hiển thị nút Google. Backend vẫn có thể chạy trên VPS,
  nhưng trình duyệt cần kết nối HTTPS/WSS tin cậy tới nó để dùng với frontend HTTPS.
- HTTPS frontend gọi HTTP/WS backend bị vấn đề mixed content. Thêm ALLOWED_ORIGINS
  chỉ xử lý CORS, không sửa mixed content hoặc chính sách cookie.
- Nếu backend dùng HTTPS cho IP với chứng chỉ IP hợp lệ, hạn chế Google origin vẫn
  áp dụng cho frontend. Backend IP không tự động giải quyết cookie cross-site.

Luồng hiện tại nhận ID token từ nút Google bằng callback JavaScript rồi gửi tới
`/api/auth/google`; không phải OAuth redirect callback tới backend. Đặt cùng
GOOGLE_CLIENT_ID trong backend với client Web application đã tạo. Authorized
JavaScript origins chứa URL frontend (không wildcard), ví dụ:

```text
https://TEN.vercel.app
http://localhost:5173
```

Không cần thêm `/api/auth/google` làm redirect URI cho luồng callback JS hiện tại.

## 3. HTTPS khi có hostname và certificate

Cấu hình phù hợp nhất với cookie hiện tại:

- `https://play.example.com`: frontend Vercel.
- `https://api.example.com`: DNS trỏ VPS, Nginx cấp HTTPS/WSS.
- ALLOWED_ORIGINS=https://play.example.com
- COOKIE_SAME_SITE=lax
- VITE_SERVER_URL=wss://api.example.com trên Vercel, sau đó redeploy frontend.

Có thể dùng hostname được cấp miễn phí thay vì mua domain; vẫn cần cấu hình DNS,
origin được Google chấp nhận và certificate tin cậy. Hai hostname không cùng site
thì áp dụng mục cookie cross-site bên dưới.

Đặt chứng chỉ và private key do bạn cấp vào:

```text
deploy/certs/fullchain.pem
deploy/certs/privkey.pem
```

Patch không tự xin chứng chỉ, không có chứng chỉ tự ký và không chứa private key.
Mở firewall cổng 443; dùng cổng HTTPS chuẩn 443 với redirect mẫu.

```bash
docker compose -f compose.yml -f compose.https.yml up -d --build
```

Khi gia hạn chứng chỉ, thay file trong thư mục trên rồi reload Nginx:

```bash
docker compose -f compose.yml -f compose.https.yml exec nginx nginx -s reload
```

Dùng cùng hai `-f` cho các lệnh cập nhật deployment HTTPS. Nginx chuyển tiếp cả
HTTP matchmaking Colyseus, `/api`, `/health` và WebSocket. Docker DNS được resolve
lại để upstream theo được IP container mới sau recreate.

## 4. Frontend Vercel và backend khác site

Nếu giữ `TEN.vercel.app` và API ở domain khác, cookie mặc định SameSite=Lax không
được gửi trong fetch cross-site. Patch thêm tùy chọn:

```dotenv
COOKIE_SAME_SITE=none
```

Chỉ dùng với HTTPS; cookie vẫn có Secure, HttpOnly. Exact-Origin và X-WinterArc
vẫn được kiểm tra trên các API ghi. Tuy nhiên trình duyệt có thể chặn cookie bên
thứ ba: `SameSite=None` không đảm bảo đăng nhập hoạt động ở mọi trình duyệt.
Cùng site qua hai subdomain của domain bạn kiểm soát tránh được phụ thuộc này.
Không tắt bảo vệ trình duyệt hoặc CORS để xử lý lỗi đăng nhập.

## 5. Admin và dữ liệu

Điền ADMIN_USERNAME và bcrypt hash vào `.env`. Có thể tạo hash bằng lệnh cũ trên
máy phát triển: `npm run admin:hash --workspace=apps/server`. Lưu hash trong nháy đơn
ở `.env`, ví dụ `ADMIN_PASSWORD_HASH='$2b$12$...'`, để dollar sign không bị nội suy.
Không đặt mật khẩu/hash vào Dockerfile, biến VITE_* hoặc commit `.env`.

SQLite dùng `/data/accounts.sqlite` trong named volume `winterarc_accounts`.
Restart/rebuild không xóa tài khoản. Không chạy `docker compose down -v` trừ khi
chủ động muốn xóa dữ liệu. TRUST_PROXY=1 chỉ tin một hop Nginx, và cổng server
không publish ra ngoài; Nginx ghi đè X-Forwarded-For bằng IP của peer.

Để backup nhất quán cả DB/WAL, dừng server rồi sao lưu volume:

```bash
docker compose stop server
mkdir -p backups
docker compose run --rm --no-deps --user root --entrypoint tar server \
  -C /data -czf - . > backups/accounts.tar.gz
docker compose start server
```

Với deployment HTTPS, thêm hai `-f` như mục 3. Lưu bản backup ngoài VPS. Restart
server làm mất các phòng đang nằm trong RAM, nên cập nhật khi không còn trận chơi.

## 6. Cập nhật

```bash
docker compose up -d --build server
docker compose restart nginx
```

Dùng cả hai file compose nếu đang chạy HTTPS. Frontend và backend cần cùng phiên
bản protocol, nhất là sau patch modeSelection.

Dockerfile tạo manifest backend riêng và cài dependencies từ version range đang
có trong apps/server/package.json. Nó chưa sử dụng lockfile gốc vì source repomix
không cung cấp lockfile; build giữa các thời điểm có thể lấy dependency khác nhau.
Khi cần build tái lập tuyệt đối, bổ sung lockfile phù hợp và pin image digest.

Không chạy Docker build, cài npm hoặc test trong quá trình tạo bản vá này.

Nguồn tham khảo:
- Google origin rules: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#origin-validation
- GIS setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Nginx WebSocket: https://nginx.org/en/docs/http/websocket.html
- Cookie: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- Mixed content: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content
