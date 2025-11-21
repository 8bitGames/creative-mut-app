# MUT Hologram Studio - UI/UX Screen Flow

## Overview

**Application Type**: PyQt6 Desktop Kiosk Application
**Navigation System**: QStackedWidget (state machine)
**Display**: Dual-monitor (User controls + Hologram display)

---

## Screen Index

| Index | Screen Name | Purpose |
|-------|-------------|---------|
| 0 | Idle | Entry point - "CLICK HERE" |
| 1 | Start | Introduction - "START" button |
| 2 | Frame Select | Choose visual frame (2 options) |
| 3 | Recording Guide | 10-second countdown |
| 4 | Recording | Capture 3 shots (5s intervals) |
| 5 | Processing | Video composition progress |
| 6 | Result | QR code display + print option |
| 7 | Image Select | Choose 1 of 3 shots to print |
| 8 | Payment | Payment terminal interface |

---

## Complete Navigation Flow

```
┌─────────────────┐
│  Screen 0       │
│  IDLE           │
│  "CLICK HERE"   │
└────────┬────────┘
         │ click
         ▼
┌─────────────────┐
│  Screen 1       │
│  START          │
│  "START" button │
└────────┬────────┘
         │ click
         ▼
┌─────────────────┐
│  Screen 2       │
│  FRAME SELECT   │
│  Frame 1 / 2    │
└────────┬────────┘
         │ select frame → init camera + create session
         ▼
┌─────────────────┐
│  Screen 3       │
│  RECORDING GUIDE│
│  10s countdown  │
└────────┬────────┘
         │ countdown complete
         ▼
┌─────────────────┐
│  Screen 4       │
│  RECORDING      │
│  3 shots × 5s   │
└────────┬────────┘
         │ capture complete (3 images)
         ▼
┌─────────────────┐
│  Screen 5       │
│  PROCESSING     │
│  Progress bar   │
└────────┬────────┘
         │ video composed + S3 upload + QR generated
         ▼
┌─────────────────┐
│  Screen 6       │
│  RESULT         │◄──────────────────────┐
│  60s timer      │                       │
└────────┬────────┘                       │
         │                                │
    ┌────┴────┐                          │
    │         │                          │
    ▼         ▼                          │
[Print]   [Timeout 60s]                  │
    │         │                          │
    ▼         └──────────────────────────┤
┌─────────────────┐                      │
│  Screen 7       │                      │
│  IMAGE SELECT   │                      │
│  Choose 1 of 3  │                      │
└────────┬────────┘                      │
         │                               │
    ┌────┴────┐                          │
    │         │                          │
    ▼         ▼                          │
[Confirm] [Cancel]                       │
    │         │                          │
    ▼         └──────────────────────────┤
┌─────────────────┐                      │
│  Screen 8       │                      │
│  PAYMENT        │                      │
│  30s timeout    │                      │
└────────┬────────┘                      │
         │                               │
    ┌────┴────┐                          │
    │         │                          │
    ▼         ▼                          │
[Success] [Cancel/Timeout]               │
    │         │                          │
    └─────────┴──────────────────────────┘
                    ↓
            Return to Screen 0
```

---

## Detailed Screen Specifications

### Screen 0: Idle Screen
**Component**: `IdleScreen`
**Location**: [main_app.py:156-189](src/main_app.py#L156-L189)

**UI Elements**:
- Large "MUT" logo
- Subtitle: "MUT 홀로그램 스튜디오"
- "CLICK HERE" button (Primary)

**Signals**:
- `clicked` → Navigate to Screen 1

---

### Screen 1: Start Screen
**Component**: `StartScreen`
**Location**: [main_app.py:191-230](src/main_app.py#L191-L230)

**UI Elements**:
- Instructions: "홀로그램 촬영을 시작하시려면 아래 START 버튼을 눌러주세요"
- "START" button (Primary)
- "MUT" logo

**Signals**:
- `start_clicked` → Navigate to Screen 2

---

### Screen 2: Frame Select Screen
**Component**: `FrameSelectScreen`
**Location**: [main_app.py:232-277](src/main_app.py#L232-L277)

**UI Elements**:
- Title: "터치하여 프레임을 선택하세요"
- Info: "촬영 영상은 QR코드를 통해 무료 다운로드가 가능합니다"
- Frame buttons: "프레임 1" | "프레임 2"

**Actions on Selection**:
1. Create session directory: `output/{timestamp}/`
2. Initialize camera
3. Navigate to Screen 3

**Signals**:
- `frame_selected(int)` → Screen 3

---

### Screen 3: Recording Guide Screen
**Component**: `RecordingGuideScreen`
**Location**: [main_app.py:279-328](src/main_app.py#L279-L328)

**UI Elements**:
- Instructions: "홀로그램 촬영을 시작합니다. 바닥의 발자국 위치로 이동하여 전신이 화면 안에 들어오도록 서주세요"
- Person silhouette (👤)
- Countdown display: 10 → 1

**Behavior**:
- Auto-starts 10-second countdown
- Sound on each second

**Signals**:
- `countdown_finished` → Navigate to Screen 4

---

### Screen 4: Recording Screen
**Component**: `RecordingScreen`
**Location**: [main_app.py:330-476](src/main_app.py#L330-L476)

**UI Elements**:
- Instructions: "5초에 한 번, 원하시는 포즈로 촬영을 진행해주세요!"
- Live camera preview (320×240 min)
- Countdown: 5 → 0
- Shot indicator: "촬영 1/3", "촬영 2/3", "촬영 3/3"

**Capture Sequence**:
```
Shot 1: 5s countdown → capture → flash + sound
  ↓ (1s delay)
Shot 2: 5s countdown → capture → flash + sound
  ↓ (1s delay)
Shot 3: 5s countdown → capture → flash + sound
  ↓
Complete
```

**Output Files**:
- `output/{timestamp}/capture_1_{ts}.jpg`
- `output/{timestamp}/capture_2_{ts}.jpg`
- `output/{timestamp}/capture_3_{ts}.jpg`

**Signals**:
- `recording_finished(list)` → Navigate to Screen 5

---

### Screen 5: Processing Screen
**Component**: `ProcessingScreen`
**Location**: [main_app.py:478-530](src/main_app.py#L478-L530)

**UI Elements**:
- "MUT" logo
- Status: "홀로그램 제작 중"
- Progress bar: 0% → 100%

**Processing Pipeline**:
1. **Video Composition** (~12s GPU / ~32s CPU)
   - FFmpeg chroma key + overlay
   - Output: `final_{timestamp}.mp4`
2. **S3 Upload** (~2-5s)
   - Upload to AWS S3
   - Generate public URL
3. **QR Generation** (~0.1s)
   - Create QR code for download URL

**Signals**:
- `processing_finished` → Navigate to Screen 6

---

### Screen 6: Result Screen
**Component**: `ResultScreen`
**Location**: [main_app.py:532-591](src/main_app.py#L532-L591)

**UI Elements**:
- Message: "홀로그램 촬영이 종료되었습니다! 우측 기기에서 결과물을 확인하고, QR 코드로 영상을 다운로드 하세요"
- 60-second countdown timer
- Print info: "포토 인쇄(1매)를 희망하시면 아래 버튼을 눌러주세요. *유료 서비스"
- Print button: "🖨️ 5,000(1매)"

**Parallel Display**:
- HologramWindow (Monitor 2) shows QR code + video

**User Paths**:

| Action | Result |
|--------|--------|
| Click print button | → Screen 7 |
| Wait 60 seconds | → Screen 0 |

**Signals**:
- `print_requested` → Navigate to Screen 7
- `timeout_reached` → Reset to Screen 0

---

### Screen 7: Image Select Screen
**Component**: `ImageSelectScreen`
**Location**: [main_app.py:593-667](src/main_app.py#L593-L667)

**UI Elements**:
- Title: "아래 촬영컷 중 출력을 희망하는 이미지 1컷을 선택해 주세요"
- 3 image buttons: "📷 촬영 1" | "📷 촬영 2" | "📷 촬영 3"
- "선택 완료" button (Confirm)
- "취소" button (Cancel)

**Selection Feedback**:
- Selected: Red border (3px solid red)

**User Paths**:

| Action | Result |
|--------|--------|
| Select image + Confirm | → Screen 8 |
| Click Cancel | → Screen 0 |

**Signals**:
- `image_selected(int)` → Navigate to Screen 8
- `cancelled` → Reset to Screen 0

---

### Screen 8: Payment Screen
**Component**: `PaymentScreen`
**Location**: [main_app.py:669-729](src/main_app.py#L669-L729)

**UI Elements**:
- Status: "결제 대기 중입니다" → "결제가 완료되었습니다"
- Loading indicator: "⏳"
- "취소" button

**Behavior**:
- 30-second timeout for payment device
- On success: Show confirmation for 3s

**User Paths**:

| Action | Result |
|--------|--------|
| Payment success | → Screen 0 (after 3s) |
| Cancel or Timeout | → Screen 0 |

**Signals**:
- `payment_completed` → Reset to Screen 0
- `payment_cancelled` → Reset to Screen 0

---

## Secondary Display: Hologram Window

**Component**: `HologramWindow`
**Location**: [main_app.py:918-999](src/main_app.py#L918-L999)

**Purpose**: Display on Monitor 2 for customer viewing

**States**:

| State | Content | When Shown |
|-------|---------|------------|
| Logo | "MUT" text (red) | Idle, reset |
| Result | QR code + video area | Screen 6 active |

**Signals Received**:
- `show_hologram(qr_path)` → Display QR + video
- `show_logo()` → Return to logo state

---

## Signal Connection Summary

| Source | Signal | Target Action |
|--------|--------|---------------|
| IdleScreen | `clicked` | → Screen 1 |
| StartScreen | `start_clicked` | → Screen 2 |
| FrameSelectScreen | `frame_selected` | Init + → Screen 3 |
| RecordingGuideScreen | `countdown_finished` | → Screen 4 |
| RecordingScreen | `recording_finished` | → Screen 5 |
| ProcessingScreen | `processing_finished` | → Screen 6 + Hologram |
| ResultScreen | `print_requested` | → Screen 7 |
| ResultScreen | `timeout_reached` | → Screen 0 |
| ImageSelectScreen | `image_selected` | → Screen 8 |
| ImageSelectScreen | `cancelled` | → Screen 0 |
| PaymentScreen | `payment_completed` | → Screen 0 |
| PaymentScreen | `payment_cancelled` | → Screen 0 |

---

## Timing Summary

| Screen | Duration | Type |
|--------|----------|------|
| 3 (Guide) | 10 seconds | Countdown |
| 4 (Recording) | ~18 seconds | 3 × (5s + capture) |
| 5 (Processing) | 12-35 seconds | Variable (GPU/CPU) |
| 6 (Result) | 60 seconds | Timeout |
| 8 (Payment) | 30 seconds | Timeout |

**Total Flow Time**: ~2-3 minutes (without print option)

---

## File Structure

```
output/
└── {timestamp}/
    ├── capture_1_{ts}.jpg
    ├── capture_2_{ts}.jpg
    ├── capture_3_{ts}.jpg
    ├── final_{ts}.mp4
    └── qr_{ts}.png
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Camera init failure | Continues with placeholder |
| Video processing error | `processing_error` signal |
| S3 upload failure | QR shows placeholder text |
| Payment device timeout | Returns to idle |

---

## Key Source Files

| File | Purpose |
|------|---------|
| [main_app.py](src/main_app.py) | All UI screens, MainWindow, HologramWindow |
| [pipeline.py](src/pipeline.py) | Video composition, S3 upload, QR generation |

