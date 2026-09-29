# Thêm WAV/MP3 riêng

Mọi cue có âm tổng hợp cache sẵn sau thao tác thật của người dùng. File ngoài tải nền một lần: thử WAV rồi MP3; không có hoặc decode lỗi thì giữ fallback.

Đặt trong `apps/web/public/audio`:

| Cue | File WAV (hoặc đổi đuôi MP3) |
| --- | --- |
| step | `player/step.wav` |
| found | `events/found.wav` |
| throw | `events/snowball.wav` |
| hit | `events/hit.wav` |
| break | `events/break.wav` |
| place | `events/place.wav` |
| deliver | `events/checkpoint.wav` |
| impact | `events/crab-slam.wav` |

Sửa đường dẫn/volume/maxDistance trong `src/engine/SoundRegistry.ts`. Nếu chỉ dùng fallback, đặt `sources: []` để không request file. File vắng có thể hiện 404 ở Network nhưng không làm game ngừng.

Ưu tiên clip mono ngắn, bỏ khoảng lặng đầu file. Bước chân của mình phát trực tiếp, người khác dùng HRTF 3D. Giới hạn 32 tiếng, bỏ tiếng quá xa, dừng bước chân khi tab ẩn hoặc mở menu. Kiểm tra cả master/effects/footsteps trong Settings nếu âm quá nhỏ. Bấm Thử âm thanh sau khi trang mở để cấp user gesture.

Thay file cùng đường dẫn thì reload trang. Chỉ dùng âm thanh bạn có quyền phân phối. ZIP không kèm MP3/WAV thương mại.
