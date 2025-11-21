# MUT-MASTER - Complete Package Setup Guide

## 📦 Package Contents

This is a complete, ready-to-share package of the MUT (MakeYourThought) photo booth application.

### Included Files:
- ✅ Full source code (src/, electron/, python/)
- ✅ All configuration files
- ✅ Environment files with AWS credentials (.env)
- ✅ Python processing pipelines
- ✅ Frame templates and assets
- ✅ Documentation

### Not Included (can be regenerated):
- ❌ node_modules (install via `npm install`)
- ❌ dist/ dist-electron/ (build outputs)
- ❌ output/ (generated videos)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- FFmpeg (for video processing)
- macOS (for development) or Windows/Linux (with adjustments)

### 1. Install Node Dependencies
```bash
cd MUT-MASTER
npm install
```

### 2. Install Python Dependencies
```bash
# For MUT-distribution pipeline
cd MUT-distribution
pip3 install -r requirements.txt

# For Python utilities
cd ../python
pip3 install -r requirements.txt
cd ..
```

### 3. Verify Environment Files
The package includes pre-configured .env files:
- `/.env` - Main application config
- `/MUT-distribution/.env` - AWS credentials for pipeline
- `/python/.env` - Python utilities config

**⚠️ IMPORTANT**: These files contain sensitive AWS credentials. Do not commit to public repositories!

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

---

## 📋 Recent Updates & Fixes

### ✅ Countdown Timer Fix
- Fixed countdown synchronization bug where second and third photos showed inconsistent timing
- All photos now display countdown for exactly 1 second per number (5→4→3→2→1)

### ✅ Photo Counter Fix
- Fixed bug where photo counter displayed "1/3" twice
- Now correctly shows: 1/3 → 2/3 → 3/3

### ✅ Camera Flash Effect
- Added bright white flash animation when photo is captured
- 300ms smooth fade in/out effect
- Works with both countdown and spacebar skip

### ✅ AWS Upload Cleanup
- Videos automatically deleted after successful S3 upload
- Saves disk space while keeping QR codes for reference
- Cleanup includes:
  - Final processed video (after S3 upload)
  - Stitched video (after pipeline completes)
  - Temporary captured images (after processing)

---

## 🔧 Configuration

### AWS S3 Setup
The .env files contain AWS credentials for video upload:
```
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=mut-demo-2025
```

### FFmpeg Path
If FFmpeg is not in your PATH, update the path in:
- `MUT-distribution/pipeline.py` (line 31)

---

## 📁 Project Structure

```
MUT-MASTER/
├── src/                    # React frontend source
│   ├── screens/           # UI screens (01-10)
│   ├── components/        # Reusable components
│   ├── store/            # Zustand state management
│   └── types/            # TypeScript types
├── electron/              # Electron main process
│   ├── main.ts           # Main process entry
│   ├── preload.ts        # Preload scripts
│   ├── hardware/         # Hardware integrations
│   └── python/           # Python bridge
├── python/               # Python utilities
│   ├── pipeline.py       # Video processing pipeline
│   └── stitch_images.py  # Image stitching
├── MUT-distribution/     # Production pipeline
│   └── pipeline.py       # Main processing pipeline
├── public/               # Static assets
├── frames/               # Frame templates
├── .env                  # Main config
└── package.json          # Node dependencies
```

---

## 🎯 Key Features

1. **Photo Capture**: 3-photo session with 5-second countdown
2. **Frame Selection**: Choose from multiple frame templates
3. **Video Processing**: GPU-accelerated video composition
4. **AWS Upload**: Automatic S3 upload with cleanup
5. **QR Code**: Generate shareable QR codes
6. **Payment Integration**: NicePay payment system
7. **Dual Monitor**: Main UI + Hologram display

---

## 🐛 Troubleshooting

### "Python process exited with code 1"
- Ensure Python dependencies are installed: `pip3 install -r requirements.txt`
- Check FFmpeg is installed: `ffmpeg -version`
- Verify .env files have correct AWS credentials

### "Failed to access camera"
- Grant camera permissions in System Preferences
- Ensure no other app is using the camera

### "S3 upload failed"
- Verify AWS credentials in .env files
- Check S3 bucket permissions
- Ensure bucket is in ap-northeast-2 region

---

## 📝 Development Commands

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Preview production build
npm run preview
```

---

## 🔒 Security Notes

**⚠️ CRITICAL**: This package contains sensitive information:
- AWS credentials in .env files
- S3 bucket configuration
- API keys

**Before sharing publicly:**
1. Remove or redact all .env files
2. Replace AWS credentials with placeholders
3. Add .env to .gitignore if committing to git

---

## 📄 License

Proprietary - All rights reserved

---

## 👥 Support

For issues or questions, contact the development team.

---

**Version**: 1.0.0
**Last Updated**: November 21, 2025
**Status**: Production Ready ✅
