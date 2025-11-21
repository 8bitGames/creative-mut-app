# MUT Quick Start Guide

## Installation (One-Time Setup)

```bash
# 1. Install FFmpeg
brew install ffmpeg  # macOS

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Configure AWS credentials
cp .env.example .env
# Edit .env and add your AWS credentials
```

## Usage (Every Time)

```bash
# Run the pipeline
python3 pipeline.py
```

That's it! The pipeline will:
1. Composite your videos (13.84s with 4-segment parallel processing)
2. Upload to S3 (~2s)
3. Generate QR code (~0.1s)

**Total time: ~16 seconds**

## What You Get

```
output/
└── 20251115_153058/
    ├── final_20251115_153058.mp4    # Your processed video (14MB)
    └── qr_codes/
        └── qr_20251115_153058.png    # QR code to share
```

## Customization

Edit these values in `pipeline.py`:

```python
DEFAULT_INPUT_VIDEO = "video/IMG_0523.MOV"      # Your video
DEFAULT_CHROMA_VIDEO = "chroma/croma2.mp4"      # Green screen
DEFAULT_SUBTITLE = "MUT Video"                  # Subtitle text
```

## Performance Modes

**4-Segment Parallel (Default - Best for longer videos):**
- Uses all CPU cores
- ~13-14s processing time
- Set in line ~380: `use_parallel=True, num_segments=4`

**Single Process (Best for short videos):**
- Uses single core with GPU
- ~11.9s processing time
- Set in line ~380: `use_parallel=False`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ffmpeg not found` | Install FFmpeg: `brew install ffmpeg` |
| `AWS credentials error` | Check `.env` file has correct AWS keys |
| Slow processing | Ensure GPU encoder detected (check output) |
| Upload fails | Verify S3 bucket exists and you have write permission |

## Essential Files

- `pipeline.py` - Main script (run this)
- `.env` - AWS credentials (keep private)
- `requirements.txt` - Python dependencies
- `video/` - Put your main video here
- `chroma/` - Put your green screen video here
- `output/` - Your processed videos appear here

## Performance Benchmarks

| Configuration | Time | Notes |
|---------------|------|-------|
| GPU + 4 Segments | 13.84s | Best for long videos (>30s) |
| GPU + Single | 11.90s | Best for short videos (<30s) |
| CPU + 4 Segments | ~20s | No GPU available |
| CPU + Single | 32.67s | Baseline (slowest) |

---

**Need help?** Read the full README.md for advanced usage and configuration options.
