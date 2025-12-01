# Build Size Optimization Progress

**Branch:** `windows_28`
**Date Started:** 2025-11-28
**Goal:** Reduce dist build size while maintaining portability

---

## Current State Analysis

### Size Contributors (Estimated - Before Optimization)
| Component | Current Size | Notes |
|-----------|-------------|-------|
| Electron base | ~150MB | Fixed, cannot reduce much |
| Python (PyInstaller) | ~150-300MB | Includes boto3, opencv, numpy |
| FFmpeg | ~80-120MB | Full build |
| better-sqlite3 | ~5MB | Native module |
| **Total Estimated** | **~400-500MB** | |

### Key Finding
`opencv-python` and `numpy` were in requirements.txt but **NOT USED** in pipeline.py.
Face enhancement uses FFmpeg filters (`eq=`, `unsharp=`), not OpenCV.

Additionally, `stitch_images.py` used `face_enhancement.py` which DID use OpenCV,
but we rewrote it to use PIL-only to eliminate the dependency entirely.

---

## Optimization Tasks

### Tier 1: Immediate Wins (Est. 150-200MB savings)

- [x] **1.1** Remove `opencv-python` from requirements.txt (~100-150MB)
- [x] **1.2** Remove `numpy` from requirements.txt (~25-50MB)
- [x] **1.3** Add `compression: "maximum"` to electron-builder
- [x] **1.4** Update PyInstaller spec to exclude unused modules
- [x] **1.5** Rewrite `face_enhancement.py` to use PIL-only (critical fix)

### Tier 2: Moderate Effort (Est. 50-100MB more)

- [x] **2.1** Create FFmpeg essentials download script
- [x] **2.2** Implement Python embedded distribution setup script
- [x] **2.3** Optimize electron-builder file exclusions
- [x] **2.4** Update `build_stitcher.spec` to remove opencv hidden imports

### Tier 3: Advanced (Optional, for maximum reduction)

- [x] **3.1** Add lazy FFmpeg download on first run (Electron utility)
- [ ] **3.2** Consider Node.js rewrite of pipeline (eliminates Python) - FUTURE

---

## Progress Log

### 2025-11-28 - All Tier 1 & 2 Completed!

#### Task 1.1 & 1.2: Remove unused Python dependencies
- **Status:** COMPLETED
- **File:** `scripts/python/requirements.txt`
- **Changes:** Removed opencv-python and numpy
- **Savings:** ~150-200MB

#### Task 1.3: Add compression to electron-builder
- **Status:** COMPLETED
- **File:** `package.json` (build section)
- **Changes:** Added `compression: "maximum"` to win target

#### Task 1.4: Update PyInstaller specs
- **Status:** COMPLETED
- **Files:**
  - `scripts/python/build_pipeline.spec`
  - `scripts/python/build_stitcher.spec`
- **Changes:** Added extensive `excludes` list for unused modules

#### Task 1.5: Rewrite face_enhancement.py
- **Status:** COMPLETED
- **File:** `python/face_enhancement.py`
- **Changes:** Replaced OpenCV bilateral filter with PIL MedianFilter + SMOOTH
- **Reason:** `stitch_images.py` imported `face_enhancement.py` which used OpenCV

#### Task 2.1: FFmpeg setup script
- **Status:** COMPLETED
- **File:** `scripts/setup-ffmpeg.ps1`
- **Features:**
  - Downloads FFmpeg essentials build (~40-50MB vs ~120MB full)
  - Extracts only ffmpeg.exe and ffprobe.exe
  - Run with: `npm run setup:ffmpeg`

#### Task 2.2: Python embedded distribution setup
- **Status:** COMPLETED
- **File:** `scripts/setup-python-embedded.ps1`
- **Features:**
  - Downloads Python 3.11 embedded (~15MB)
  - Installs pip and required packages
  - Alternative to PyInstaller (much smaller)
  - Run with: `npm run setup:python-embedded`

#### Task 2.3: Electron-builder file exclusions
- **Status:** COMPLETED
- **File:** `package.json`
- **Changes:**
  - Exclude source maps (*.map)
  - Exclude README, CHANGELOG, docs from node_modules
  - Exclude test directories
  - Exclude TypeScript definitions (.d.ts)
  - Filter Python __pycache__ and .pyc files
  - Filter FFmpeg to only ffmpeg.exe and ffprobe.exe

#### Task 3.1: Lazy FFmpeg download
- **Status:** COMPLETED
- **Files:**
  - `electron/utils/dependency-manager.ts`
  - `electron/utils/index.ts`
- **Features:**
  - Check bundled location first
  - Check system PATH second
  - Download FFmpeg on first run if needed
  - Progress tracking with callbacks

---

## New NPM Scripts Added

```bash
# Setup FFmpeg essentials (~40MB)
npm run setup:ffmpeg

# Setup Python embedded (~15MB + packages)
npm run setup:python-embedded

# Build portable version
npm run dist:portable

# Build minimal (unpacked directory)
npm run dist:minimal
```

---

## Build Size Tracking

| Build | Date | Installer Size | Installed Size | Notes |
|-------|------|----------------|----------------|-------|
| Baseline | TBD | TBD | TBD | Before optimizations |
| After Tier 1 | TBD | TBD | TBD | After immediate wins |
| After Tier 2 | TBD | TBD | TBD | After moderate effort |

**TODO:** Run builds to measure actual sizes

---

## Files Changed

### Modified Files
1. `scripts/python/requirements.txt` - Removed opencv-python and numpy
2. `scripts/python/build_pipeline.spec` - Added module excludes
3. `scripts/python/build_stitcher.spec` - Removed opencv imports, added excludes
4. `python/face_enhancement.py` - Rewrote to use PIL-only
5. `package.json` - Added scripts, compression, file exclusions

### New Files
1. `scripts/setup-ffmpeg.ps1` - FFmpeg essentials download script
2. `scripts/setup-python-embedded.ps1` - Python embedded setup script
3. `electron/utils/dependency-manager.ts` - Lazy FFmpeg download utility
4. `electron/utils/index.ts` - Utils index
5. `BUILD_SIZE_OPTIMIZATION.md` - This progress document

---

## Estimated Size After Optimizations

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| Python (PyInstaller) | ~200MB | ~50-80MB | ~120-150MB |
| FFmpeg | ~120MB | ~40-50MB | ~70-80MB |
| Electron + node_modules | ~150MB | ~130MB | ~20MB |
| **Total** | **~470MB** | **~220-260MB** | **~200-250MB** |

*With Python Embedded instead of PyInstaller:*
| Python (Embedded) | ~200MB | ~30-40MB | ~160-170MB |
| **Total** | **~470MB** | **~200-230MB** | **~240-270MB** |

---

## Next Steps (Optional Future Work)

1. **Test builds** - Run `npm run dist` and measure actual sizes
2. **Python embedded integration** - Update Electron to use embedded Python instead of PyInstaller
3. **Node.js pipeline rewrite** - Eliminate Python entirely (biggest possible savings)
4. **Delta updates** - Use electron-updater with differential updates
5. **NSIS compression tuning** - Experiment with different compression levels

---

## Notes

- The app is a kiosk photo booth application
- Must remain portable (work without installation)
- FFmpeg is required for video processing (4K composition)
- S3 upload and QR code generation are essential features
- Face enhancement now uses PIL MedianFilter instead of OpenCV bilateral filter
