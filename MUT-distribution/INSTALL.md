# MUT Installation Guide

## Prerequisites

### 1. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
1. Download from https://ffmpeg.org/download.html
2. Extract and add to PATH
3. Verify: `ffmpeg -version`

### 2. Install Python 3.9+

**Check your Python version:**
```bash
python3 --version
```

If you need to install Python:
- macOS: `brew install python3`
- Ubuntu: `sudo apt-get install python3 python3-pip`
- Windows: Download from https://python.org

## Installation Steps

### Step 1: Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

This installs:
- boto3 (AWS S3 upload)
- python-dotenv (environment variables)
- qrcode (QR code generation)
- Pillow (image processing)

### Step 2: Configure AWS Credentials

1. **Copy the example file:**
```bash
cp .env.example .env
```

2. **Edit `.env` and add your AWS credentials:**
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=your-bucket-name
```

**How to get AWS credentials:**
1. Log into AWS Console
2. Go to IAM → Users → Your User → Security Credentials
3. Create Access Key
4. Copy the Access Key ID and Secret Access Key

**Required S3 Permissions:**
- `s3:PutObject` (upload files)
- `s3:GetObject` (read files)
- `s3:ListBucket` (list bucket contents)

### Step 3: Add Your Videos

1. Place your main video in `video/` directory
2. Place your green screen video in `chroma/` directory

Example:
```
MUT/
├── video/
│   └── my_video.mp4
└── chroma/
    └── green_screen.mp4
```

### Step 4: Update Configuration

Edit `pipeline.py` (lines 30-33):

```python
DEFAULT_INPUT_VIDEO = "video/my_video.mp4"      # Your main video
DEFAULT_CHROMA_VIDEO = "chroma/green_screen.mp4" # Your green screen
DEFAULT_OUTPUT_DIR = "output"                    # Output directory
DEFAULT_SUBTITLE = "My Video Title"              # Subtitle text
```

### Step 5: Run the Pipeline

```bash
python3 pipeline.py
```

## Verify Installation

### Test FFmpeg:
```bash
ffmpeg -version
```
Should show FFmpeg version and build info.

### Test Python Dependencies:
```bash
python3 -c "import boto3, qrcode, dotenv; print('✅ All dependencies installed')"
```

### Test AWS Credentials:
```bash
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print('✅ AWS configured' if os.getenv('AWS_ACCESS_KEY_ID') else '❌ AWS not configured')"
```

## Troubleshooting

### FFmpeg not found
```
Error: ffmpeg: command not found
```
**Solution:** Install FFmpeg (see Prerequisites above)

### Python module not found
```
ModuleNotFoundError: No module named 'boto3'
```
**Solution:** Run `pip3 install -r requirements.txt`

### AWS credentials error
```
Error: Unable to locate credentials
```
**Solution:**
1. Check `.env` file exists
2. Verify AWS credentials are correct
3. Test with: `python3 -c "import boto3; boto3.client('s3')"`

### Permission denied on S3
```
Error: Access Denied
```
**Solution:**
1. Verify AWS credentials have S3 permissions
2. Check bucket name is correct
3. Ensure bucket exists in the specified region

### GPU encoder not detected
```
ℹ️ No GPU encoder detected, using fast CPU encoding
```
**Solution:** This is normal if you don't have a compatible GPU. CPU encoding still works, just slower.

## System Requirements

**Minimum:**
- Python 3.9+
- 2 GB RAM
- 500 MB disk space
- Internet connection (for S3 upload)

**Recommended:**
- Python 3.10+
- 8 GB RAM
- GPU with hardware encoding support
- Fast internet connection (for quick uploads)

## Performance Tips

1. **Use GPU encoding** - Automatically detected on macOS (VideoToolbox), NVIDIA (NVENC), or AMD (AMF)
2. **Parallel processing** - Enabled by default, uses all CPU cores
3. **Fast storage** - SSD recommended for video processing
4. **Network speed** - Fast internet for S3 uploads

## Next Steps

Once installed:
1. Read `QUICKSTART.md` for quick usage
2. Read `README.md` for full documentation
3. Run `python3 pipeline.py` to process your first video

## Support

For issues:
1. Check the Troubleshooting section above
2. Verify all prerequisites are installed
3. Check the full README.md for detailed information

---

**Estimated installation time:** 5-10 minutes
