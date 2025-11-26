# MUT Python Build Scripts

이 디렉토리에는 Python 스크립트를 독립 실행 파일(exe)로 빌드하기 위한 PyInstaller 설정이 포함되어 있습니다.

## 필요 조건

- Python 3.8 이상
- pip (Python 패키지 매니저)

## 빌드 방법

### 방법 1: npm 스크립트 사용 (권장)
```bash
npm run build:python
```

### 방법 2: 직접 실행
```bash
cd scripts
build-python.bat
```

## 빌드 결과물

빌드가 완료되면 다음 파일들이 `resources/python/` 디렉토리에 생성됩니다:

- `pipeline.exe` - 비디오 처리 파이프라인 (프레임 합성, S3 업로드, QR 생성)
- `stitch_images.exe` - 이미지 스티칭 (3장의 사진을 비디오로 변환)

## 전체 빌드 프로세스

Python exe를 포함한 전체 앱을 빌드하려면:

```bash
npm run dist:full
```

이 명령은 다음을 순서대로 실행합니다:
1. Python 스크립트를 exe로 빌드 (`npm run build:python`)
2. Vite로 프론트엔드 빌드 (`npm run build`)
3. Electron Builder로 앱 패키징 (`electron-builder --win`)

## 주의사항

- 빌드된 exe 파일은 Python 설치 없이 독립적으로 실행됩니다
- FFmpeg는 별도로 시스템에 설치되어 있어야 합니다 (또는 함께 번들링 필요)
- `.env` 파일에 AWS 자격 증명이 필요합니다

## 파일 구조

```
scripts/python/
├── requirements.txt     # Python 의존성 목록
├── build_pipeline.spec  # Pipeline exe PyInstaller 설정
├── build_stitcher.spec  # Stitcher exe PyInstaller 설정
└── README.md           # 이 파일

resources/python/        # 빌드 결과물 (git ignored)
├── pipeline.exe
├── stitch_images.exe
├── output/             # 런타임 출력 디렉토리
└── .env                # AWS 자격 증명 (빌드 시 복사됨)
```
