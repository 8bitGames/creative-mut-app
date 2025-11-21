# MUT (Media Upload Tool) - 전체 플로우 분석

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    MUT Application                          │
├─────────────────────────┬───────────────────────────────────┤
│   Frontend (main_app.py)│   Backend (pipeline.py)           │
│   ┌─────────────────┐  │   ┌─────────────────────────────┐ │
│   │ MainWindow      │  │   │ VideoPipeline               │ │
│   │ (모니터 1)       │  │   │ ├─ composite_video()       │ │
│   ├─────────────────┤  │   │ ├─ S3Uploader              │ │
│   │ HologramWindow  │  │   │ └─ QRGenerator             │ │
│   │ (모니터 2)       │  │   └─────────────────────────────┘ │
│   ├─────────────────┤  │                                   │
│   │ CameraManager   │  │   External Services:              │
│   │ SoundManager    │  │   • AWS S3 (클라우드 스토리지)      │
│   └─────────────────┘  │   • FFmpeg (비디오 처리)            │
└─────────────────────────┴───────────────────────────────────┘
```

---

## UI 화면 플로우 (State Machine)

```
┌─────────────┐
│ 0. Idle     │ ← 앱 시작점
│ "CLICK HERE"│
└──────┬──────┘
       │ 클릭
       ▼
┌─────────────┐
│ 1. Start    │
│ "사용 시작"  │
└──────┬──────┘
       │ START 버튼
       ▼
┌─────────────┐
│ 2. Frame    │
│ Select      │
│ (프레임 선택)│
└──────┬──────┘
       │ 프레임 선택
       │ → 카메라 초기화
       │ → 출력 디렉토리 생성
       ▼
┌─────────────┐
│ 3. Recording│
│ Guide       │
│ (10초 카운트)│
└──────┬──────┘
       │ 카운트다운 완료
       ▼
┌─────────────┐
│ 4. Recording│  5초 x 3회 촬영
│ Screen      │  → 카메라 캡처
│ (촬영)      │  → 사운드 효과
└──────┬──────┘  → 플래시 효과
       │ 촬영 완료
       ▼
┌─────────────┐
│ 5. Process  │  VideoPipeline.process()
│ ing         │  → FFmpeg 합성
│ (제작 중)    │  → S3 업로드
└──────┬──────┘  → QR 생성
       │ 완료
       ▼
┌─────────────┐
│ 6. Result   │  60초 타임아웃
│ Screen      │  HologramWindow에 QR 표시
└──────┬──────┘
       │
       ├─────────────────┐
       │ 결제 선택        │ 타임아웃
       ▼                 ▼
┌─────────────┐    ┌─────────────┐
│ 7. Image    │    │ 0. Idle     │
│ Select      │    │ (대기 화면)  │
└──────┬──────┘    └─────────────┘
       │ 선택
       ▼
┌─────────────┐
│ 8. Payment  │
│ (결제 화면)  │
└──────┬──────┘
       │ 완료/취소
       ▼
┌─────────────┐
│ 0. Idle     │
└─────────────┘
```

---

## 비디오 처리 파이프라인

```
Input Files:
├─ video/main_video.mov (메인 영상)
└─ chroma/green_screen.mp4 (크로마키 영상)
        │
        ▼
┌───────────────────────────────┐
│ 1. Parallel Segment Processing│
│    (4개 세그먼트 병렬 처리)      │
│                               │
│  ┌─────────────────────────┐  │
│  │ FFmpeg Filter Chain:    │  │
│  │ • Scale → 1920x1080     │  │
│  │ • Colorkey (0x00FF00)   │  │
│  │ • Despill (green)       │  │
│  │ • Overlay               │  │
│  │ • Encode (GPU/CPU)      │  │
│  └─────────────────────────┘  │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 2. Concatenation              │
│    세그먼트 병합 (copy codec)   │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 3. S3 Upload                  │
│    • Content-Type: video/mp4  │
│    • Public URL 생성           │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 4. QR Code Generation         │
│    • S3 URL → PNG             │
└───────────┬───────────────────┘
            │
            ▼
Output:
├─ output/{timestamp}/final_{ts}.mp4
└─ output/{timestamp}/qr_codes/qr_{ts}.png
```

---

## 핵심 클래스/함수 매핑

| 파일 | 클래스/함수 | 역할 |
|------|------------|------|
| pipeline.py | `composite_video()` | FFmpeg 기반 비디오 합성 |
| pipeline.py | `S3Uploader` | AWS S3 업로드 |
| pipeline.py | `QRGenerator` | QR 코드 생성 |
| pipeline.py | `VideoPipeline` | 전체 파이프라인 오케스트레이션 |
| main_app.py | `CameraManager` | 웹캠 캡처 관리 |
| main_app.py | `SoundManager` | 사운드 효과 재생 |
| main_app.py | `VideoProcessorThread` | 백그라운드 비디오 처리 |
| main_app.py | `MainWindow` | 메인 UI 및 화면 전환 |
| main_app.py | `HologramWindow` | 홀로그램 디스플레이 |

---

## 데이터 플로우 다이어그램

```
[User Interaction]
       │
       ▼
┌─────────────────┐     ┌─────────────────┐
│ CameraManager   │────▶│ JPG Files       │
│ .capture_image()│     │ output/{ts}/    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌─────────────────┐
│ VideoProcessor  │────▶│ pipeline.py     │
│ Thread (QThread)│     │ .process()      │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ composite_video │     │ S3Uploader      │     │ QRGenerator     │
│ FFmpeg Process  │     │ boto3 Upload    │     │ qrcode Library  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ final_{ts}.mp4  │     │ S3 Public URL   │     │ qr_{ts}.png     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────┐
                                              │ HologramWindow  │
                                              │ QR Display      │
                                              └─────────────────┘
```

---

## 환경 설정

### .env 파일
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=mut-demo-2025
```

### 디렉토리 구조
```
creative-mut-app/
├── main_app.py          # GUI 앱 (1,076줄)
├── pipeline.py          # 백엔드 (573줄)
├── requirements.txt     # Python 의존성
├── video/               # 입력 비디오
├── chroma/              # 크로마키 비디오
├── output/              # 출력 (자동 생성)
│   └── {timestamp}/
│       ├── final_{ts}.mp4
│       └── qr_codes/qr_{ts}.png
└── .env                 # AWS 자격 증명
```

---

## 성능 특성

| 작업 | 소요 시간 |
|------|----------|
| GPU 단일 인코딩 | 11.9초 |
| 4세그먼트 병렬 GPU | 8-10초 |
| S3 업로드 | 2-5초 |
| QR 생성 | 0.1초 |
| **전체 파이프라인** | **15-16초** |

---

## 실행 방법

```bash
# GUI 애플리케이션 (키오스크 모드)
python main_app.py

# 파이프라인만 실행 (CLI)
python pipeline.py
```

---

## 인코더 타입

| 타입 | 설명 | 플랫폼 |
|------|------|--------|
| CPU_ULTRAFAST | libx264 ultrafast | 모든 플랫폼 |
| CPU_VERYFAST | libx264 veryfast | 모든 플랫폼 |
| CPU_FAST | libx264 fast | 모든 플랫폼 |
| CPU_MEDIUM | libx264 medium | 모든 플랫폼 |
| GPU_VIDEOTOOLBOX | h264_videotoolbox | macOS |
| GPU_NVENC | h264_nvenc | NVIDIA GPU |
| GPU_AMF | h264_amf | AMD GPU |
| AUTO | 자동 감지 | 모든 플랫폼 |

---

## 시그널 연결 (Qt Signals)

### MainWindow 시그널 플로우
```
IdleScreen.clicked → show StartScreen
StartScreen.start_clicked → show FrameSelectScreen
FrameSelectScreen.frame_selected → on_frame_selected()
RecordingGuideScreen.countdown_finished → start_recording()
RecordingScreen.recording_finished → on_recording_finished()
ProcessingScreen.processing_finished → show_result()
ResultScreen.print_requested → start_payment()
ResultScreen.timeout_reached → reset_to_idle()
ImageSelectScreen.image_selected → on_image_selected()
PaymentScreen.payment_completed → reset_to_idle()
```

### HologramWindow 시그널
```
MainWindow.show_hologram(qr_path) → HologramWindow.show_result()
MainWindow.show_logo() → HologramWindow.show_logo()
```
