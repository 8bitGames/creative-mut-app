# MUT - Media Upload Tool

High-performance video processing pipeline with GPU acceleration, S3 upload, and QR code generation.

## Features

- ⚡ **GPU-Accelerated Video Composition** - 11.9s processing time (2.76x faster than baseline)
- 🎬 **Chroma Key (Green Screen) Removal** - Professional video compositing with despill
- 📦 **Parallel Processing** - 4-segment parallel encoding for multi-core speedup
- ☁️  **S3 Upload** - Automatic cloud upload with URL generation
- 📱 **QR Code Generation** - Instant shareable QR codes for videos
- 🖥️ **Hardware Detection** - Auto-detects best encoder (VideoToolbox/NVENC/AMF/CPU)

## Performance

| Method | Time | Speedup |
|--------|------|---------|
| GPU (4 segments) | **~8-10s** | 4x faster |
| GPU (single) | **11.9s** | 2.76x faster |
| CPU (baseline) | 32.67s | 1x |

## Quick Start

### 1. Prerequisites

**Install FFmpeg:**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

**Install Python Dependencies:**
```bash
pip install -r requirements.txt
```

### 2. AWS Configuration

Create a `.env` file with your AWS credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=your-bucket-name
```

### 3. Add Your Videos

Place your videos in the following directories:

- `video/` - Your main input video
- `chroma/` - Your green screen chroma key video

### 4. Run the Pipeline

```bash
python pipeline.py
```

## Output

The pipeline creates a timestamped output directory:

```
output/
└── 20251115_152430/
    ├── final_20251115_152430.mp4    # Processed video
    └── qr_codes/
        └── qr_20251115_152430.png    # QR code for S3 URL
```

## Configuration

### Video Settings

Edit `pipeline.py` to customize settings:

```python
# Configuration
DEFAULT_INPUT_VIDEO = "video/IMG_0523.MOV"
DEFAULT_CHROMA_VIDEO = "chroma/croma2.mp4"
DEFAULT_OUTPUT_DIR = "output"
DEFAULT_SUBTITLE = "MUT Video"
```

### Processing Modes

**Parallel Processing (Fastest - Default):**
```python
results = pipeline.process(
    input_video='video/input.mov',
    chroma_video='chroma/green.mp4',
    subtitle_text='My Video'
)
# Uses 4-segment parallel processing automatically
```

**Single Process Mode:**
```python
# Edit pipeline.py, line ~380:
final_video, comp_time = composite_video(
    enhanced_video=input_video,
    chroma_video=chroma_video,
    output_video=final_video,
    subtitle_text=subtitle_text,
    use_parallel=False  # Change to False
)
```

### Encoder Selection

The pipeline auto-detects the best encoder. Force a specific encoder:

```python
from pipeline import EncoderType

composite_video(
    enhanced_video='video/input.mov',
    chroma_video='chroma/green.mp4',
    output_video='output.mp4',
    encoder_type=EncoderType.GPU_NVENC  # Force NVIDIA GPU
)
```

Available encoders:
- `EncoderType.AUTO` - Auto-detect best encoder (default)
- `EncoderType.GPU_VIDEOTOOLBOX` - macOS GPU
- `EncoderType.GPU_NVENC` - NVIDIA GPU
- `EncoderType.GPU_AMF` - AMD GPU
- `EncoderType.CPU_VERYFAST` - Fast CPU encoding
- `EncoderType.CPU_FAST` - Balanced CPU encoding
- `EncoderType.CPU_MEDIUM` - Quality CPU encoding

## Project Structure

```
MUT/
├── pipeline.py              # Main integrated pipeline script
├── requirements.txt         # Python dependencies
├── .env.example            # AWS credentials template
├── .env                    # Your AWS credentials (git-ignored)
├── .gitignore             # Git ignore rules
├── video/                 # Input video directory
├── chroma/                # Chroma key video directory
├── output/                # Output directory (created automatically)
└── FaceEnhancementAndMakeup/  # Optional face enhancement module
```

## How It Works

### Pipeline Stages

1. **Video Composition** (11.9s with GPU)
   - Load main video and chroma video
   - Apply chroma key filter (green screen removal)
   - Apply despill filter (remove green fringe)
   - Scale both videos to 1920x1080
   - Overlay chroma on main video
   - Add subtitle overlay (optional)
   - GPU-accelerated encoding

2. **S3 Upload** (~2-5s depending on file size)
   - Upload to configured S3 bucket
   - Generate public URL
   - Set proper content-type headers

3. **QR Code Generation** (~0.1s)
   - Create QR code from S3 URL
   - Save as PNG image
   - 10x10 pixel boxes, 4-box border

### Technical Details

**Video Composition:**
- Resolution: 1920x1080 (horizontal)
- Codec: H.264 (GPU or CPU)
- Pixel Format: YUV420P
- Bitrate: 5 Mbps (GPU) / Variable (CPU)
- Chroma Key: 0x00FF00 (green), similarity 0.3, blend 0.2

**FFmpeg Filter Chain:**
```
[0:v]scale=1920:1080:flags=fast_bilinear,setsar=1[base]
[1:v]scale=1920:1080:flags=fast_bilinear,colorkey=0x00FF00:0.3:0.2,despill=green:0.3[chroma]
[base][chroma]overlay=0:0:format=auto[composite]
[composite]drawtext=...[final]
```

**Parallel Processing:**
- Splits video into N segments (default: 4)
- Processes each segment independently
- Concatenates segments with copy codec
- Uses all available CPU cores

## Troubleshooting

### FFmpeg Not Found
```
Error: ffmpeg: command not found
```
**Solution:** Install FFmpeg (see Prerequisites)

### AWS Credentials Error
```
Error: Unable to locate credentials
```
**Solution:** Check your `.env` file has correct AWS credentials

### GPU Encoder Not Detected
```
ℹ️ No GPU encoder detected, using fast CPU encoding
```
**Solution:** This is normal if you don't have a GPU. CPU encoding still works.

### S3 Upload Permission Denied
```
Error: Access Denied
```
**Solution:** Check your AWS credentials have S3 write permissions

### Video Not Found
```
Error: File not found: video/input.mov
```
**Solution:** Place your videos in the `video/` and `chroma/` directories

## Advanced Usage

### Custom Processing Function

```python
from pipeline import composite_video, EncoderType

# Process with custom settings
output, time_taken = composite_video(
    enhanced_video='my_video.mp4',
    chroma_video='my_green_screen.mp4',
    output_video='result.mp4',
    subtitle_text='Custom Subtitle',
    encoder_type=EncoderType.GPU_NVENC,
    use_parallel=True,
    num_segments=8  # Use 8 segments for longer videos
)

print(f"Processed in {time_taken:.2f}s")
```

### S3 Upload Only

```python
from pipeline import S3Uploader

uploader = S3Uploader()
url = uploader.upload_file('my_video.mp4', s3_key='videos/my_video.mp4')
print(f"Uploaded to: {url}")
```

### QR Code Only

```python
from pipeline import QRGenerator

generator = QRGenerator(output_dir='qr_codes')
qr_path = generator.generate_qr('https://example.com/video.mp4')
print(f"QR code saved to: {qr_path}")
```

## Performance Optimization Tips

1. **Use GPU Encoding** - Automatically detected, 2-4x faster
2. **Parallel Processing** - Enabled by default, uses all CPU cores
3. **Fast Filters** - Uses `fast_bilinear` scaling for speed
4. **Hardware Acceleration** - Auto-enabled for video decoding
5. **Segment Count** - Increase for longer videos (4-8 segments)

## Face Enhancement (✨ ACTIVE)

**Face enhancement is now automatically enabled!** The pipeline enhances both photos and videos before frame overlay.

### What Gets Enhanced
- ✅ **Photos**: 3 captured images are enhanced before stitching (brightness, contrast, skin smoothing)
- ✅ **Video**: Enhanced after stitching, before frame overlay (FFmpeg filters)

### Enhancement Features
- Brightness & contrast adjustment
- Color saturation boost
- Skin smoothing (bilateral filter)
- Detail sharpening
- Configurable levels: light, medium (default), strong

### Configuration

**Current level**: `medium` (recommended)

To change the enhancement level, edit:
- **Photos**: `python/stitch_images.py` line 55
- **Video**: `MUT-distribution/pipeline.py` line 182

Available levels: `'light'`, `'medium'`, `'strong'`

To disable enhancement:
- Set `enhance_faces=False` in both stitch_images.py and pipeline.py

### Performance
- Adds ~5-8 seconds to total processing time
- No GPU required (uses CPU/FFmpeg filters)
- Graceful fallback if enhancement fails

### Advanced: CodeFormer Integration

The `FaceEnhancementAndMakeup/` directory contains the full CodeFormer integration for advanced makeup application and face restoration. This requires additional setup:

1. Install CodeFormer dependencies
2. Download model weights (large file)
3. See `FaceEnhancementAndMakeup/README.md` for details

**Note**: The current built-in enhancement provides excellent results without requiring large model downloads.

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with:** FFmpeg, Python, boto3, qrcode
