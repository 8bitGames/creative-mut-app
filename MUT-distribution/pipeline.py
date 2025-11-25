"""
MUT Video Processing Pipeline (Clean Overlay Version)
Target: macOS / Electron Integration
"""

import os
import sys
import subprocess
import time
from datetime import datetime
from pathlib import Path
from enum import Enum
import json
import argparse

# S3 and QR imports
import boto3
from botocore.exceptions import ClientError
import qrcode
from dotenv import load_dotenv

# ============================================================================
# CONFIGURATION & PATH SETUP
# ============================================================================

# 1. SETUP ABSOLUTE PATHS BASED ON SCRIPT LOCATION
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")

# Load AWS credentials
load_dotenv(ENV_PATH)

# ============================================================================
# VIDEO COMPOSITOR
# ============================================================================

class EncoderType(Enum):
    CPU = "libx264"
    MACOS = "h264_videotoolbox"

def get_best_encoder():
    """Detect if we are on macOS and have hardware acceleration"""
    if sys.platform == 'darwin':
        return EncoderType.MACOS
    return EncoderType.CPU

def normalize_to_mp4(input_video):
    """
    Convert any input video to a clean MP4 format.
    This fixes WebM header issues and ensures consistent input.
    """
    # If already MP4, return as-is
    if input_video.endswith('.mp4'):
        print(f"   ✓ Input is already MP4, skipping normalization")
        return input_video

    print(f"   🔄 Normalizing {os.path.basename(input_video)} to MP4...")

    # Create normalized MP4 in same directory
    normalized_path = input_video.rsplit('.', 1)[0] + '_normalized.mp4'

    cmd = [
        'ffmpeg', '-y',
        '-i', input_video,
        '-c:v', 'libx264',       # Re-encode to H.264
        '-preset', 'ultrafast',  # Fast encoding
        '-crf', '18',            # High quality
        '-pix_fmt', 'yuv420p',
        normalized_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=30)
        file_size = os.path.getsize(normalized_path) / (1024 * 1024)
        print(f"   ✓ Normalized to MP4: {file_size:.1f} MB")
        return normalized_path
    except subprocess.CalledProcessError as e:
        print(f"   ⚠️  Normalization failed, using original: {e.stderr.decode() if e.stderr else 'Unknown error'}")
        return input_video

def composite_video(input_video, frame_image, output_path):
    """
    Composites video + frame overlay only.
    """
    start_time = time.time()

    # Ensure all paths are absolute strings
    input_video = os.path.abspath(input_video)
    frame_image = os.path.abspath(frame_image)
    output_path = os.path.abspath(output_path)

    print(f"\n🎬 Starting Composition")
    print(f"   Input:  {input_video}")
    print(f"   Frame:  {frame_image}")
    print(f"   Output: {output_path}")

    # CRITICAL: Normalize input to MP4 first (fixes WebM issues)
    input_video = normalize_to_mp4(input_video)

    # Determine Encoder
    encoder = get_best_encoder()
    print(f"   Encoder: {encoder.value}")

    # --- FFmpeg Filter Chain ---
    # 1. Scale Input Video to 1080x1920 (Vertical)
    # 2. Mirror (flip horizontally) the video
    # 3. Scale Frame to 1080x1920
    # 4. Overlay Frame on Video

    filter_chain = (
        '[0:v]scale=1080:1920:flags=lanczos,hflip,setsar=1[video];'
        '[1:v]scale=1080:1920:flags=lanczos[frame];'
        '[video][frame]overlay=0:0:format=auto[final]'
    )

    # Build Command
    cmd = [
        'ffmpeg',                   # Use system ffmpeg
        '-y',                       # Overwrite output
        '-i', input_video,          # Input 0
        '-i', frame_image,          # Input 1
        '-filter_complex', filter_chain,
        '-map', '[final]',
        '-c:v', encoder.value,      # Codec
        '-b:v', '5M',               # Bitrate
        '-pix_fmt', 'yuv420p',      # Pixel format
        '-shortest',                # Stop when shortest input ends
        output_path
    ]

    try:
        # Run FFmpeg
        subprocess.run(cmd, check=True, capture_output=True)
        duration = time.time() - start_time
        print(f"✅ Composition finished in {duration:.2f}s")
        return duration
    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg Failed with exit code {e.returncode}")
        print(f"   Error Log: {e.stderr.decode('utf-8') if e.stderr else 'No stderr'}")
        raise

# ============================================================================
# S3 & QR UTILS
# ============================================================================

class S3Uploader:
    def __init__(self):
        self.bucket = os.getenv('AWS_S3_BUCKET', 'mut-demo-2025')
        self.region = os.getenv('AWS_REGION', 'ap-northeast-2')
        try:
            self.client = boto3.client(
                's3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=self.region
            )
        except Exception as e:
            print(f"⚠️ AWS Client Init Failed: {e}")
            self.client = None

    def upload(self, file_path, folder='videos'):
        if not self.client: return None
        
        filename = os.path.basename(file_path)
        key = f"{folder}/{filename}"
        
        try:
            print(f"☁️ Uploading to S3: {key}")
            self.client.upload_file(
                file_path,
                self.bucket,
                key,
                ExtraArgs={
                    'ContentType': 'video/mp4',
                    'ACL': 'public-read'  # Make file publicly accessible
                }
            )
            url = f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"
            print(f"✅ Upload successful! Public URL: {url}")
            return url, key
        except Exception as e:
            print(f"❌ Upload Failed: {e}")
            return None, None

def generate_qr(data, output_path):
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)
    return output_path

def extract_frames(video_path, timestamps, output_dir):
    """
    Extract frames from video at specific timestamps.

    Args:
        video_path: Path to input video
        timestamps: List of timestamps in seconds [5, 10, 15]
        output_dir: Directory to save extracted frames

    Returns:
        List of paths to extracted frame images

    Raises:
        Exception: If not all frames could be extracted
    """
    print(f"\n📸 Extracting frames at {timestamps}s...")

    os.makedirs(output_dir, exist_ok=True)
    frame_paths = []
    failed_extractions = []

    for i, timestamp in enumerate(timestamps):
        frame_path = os.path.join(output_dir, f"frame_{timestamp}s.jpg")

        cmd = [
            'ffmpeg',
            '-ss', str(timestamp),  # Seek to timestamp
            '-i', video_path,       # Input video
            '-frames:v', '1',       # Extract 1 frame
            '-q:v', '2',            # High quality (1-31, lower is better)
            '-y',                   # Overwrite
            frame_path
        ]

        # Try extraction with retry logic (up to 3 attempts)
        max_attempts = 3
        success = False

        for attempt in range(max_attempts):
            try:
                subprocess.run(cmd, check=True, capture_output=True, timeout=10)

                # Verify file was actually created and has content
                if os.path.exists(frame_path) and os.path.getsize(frame_path) > 0:
                    frame_paths.append(frame_path)
                    print(f"   ✓ Frame {i+1}/{len(timestamps)} extracted at {timestamp}s")
                    success = True
                    break
                else:
                    print(f"   ⚠️  Attempt {attempt+1}: Frame file empty or missing")

            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.decode() if e.stderr else str(e)
                print(f"   ⚠️  Attempt {attempt+1}: Failed to extract frame at {timestamp}s: {error_msg}")
            except subprocess.TimeoutExpired:
                print(f"   ⚠️  Attempt {attempt+1}: Timeout extracting frame at {timestamp}s")

            # Wait before retry
            if attempt < max_attempts - 1:
                time.sleep(0.5)

        if not success:
            failed_extractions.append(timestamp)
            print(f"   ✗ Failed to extract frame at {timestamp}s after {max_attempts} attempts")

    print(f"📊 Extraction Summary: {len(frame_paths)}/{len(timestamps)} frames extracted")

    # CRITICAL: Ensure we got exactly the expected number of frames
    if len(frame_paths) != len(timestamps):
        error_msg = f"Frame extraction failed: Expected {len(timestamps)} frames, got {len(frame_paths)}"
        if failed_extractions:
            error_msg += f". Failed at timestamps: {failed_extractions}s"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)

    print(f"✅ All {len(frame_paths)} frames extracted successfully")
    return frame_paths

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--frame', required=True) 
    parser.add_argument('--chroma', help="Alias for --frame", required=False) 
    parser.add_argument('--subtitle', default="", help="Kept for compatibility, not used")
    parser.add_argument('--s3-folder', default='mut-hologram')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()

    # Map chroma to frame if frame is missing
    frame_path = args.frame if args.frame else args.chroma

    start_total = time.time()

    # 1. Prepare Paths
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    session_dir = os.path.join(DEFAULT_OUTPUT_DIR, timestamp)
    os.makedirs(session_dir, exist_ok=True)
    
    output_video_path = os.path.join(session_dir, f"final_{timestamp}.mp4")
    qr_path = os.path.join(session_dir, f"qr_{timestamp}.png")

    results = {
        "success": False,
        "videoPath": output_video_path,
        "s3Url": None,
        "qrCodePath": None,
        "framePaths": [],
        "totalTime": 0
    }

    try:
        # 2. Process Video
        comp_time = composite_video(
            input_video=args.input,
            frame_image=frame_path,
            output_path=output_video_path
        )
        results['compositionTime'] = comp_time

        # 3. Extract frames at 5s, 10s, 15s for photo printing
        frame_timestamps = [5, 10, 15]
        frame_paths = extract_frames(output_video_path, frame_timestamps, session_dir)
        results['framePaths'] = frame_paths

        # 4. Upload S3
        uploader = S3Uploader()
        s3_url, s3_key = uploader.upload(output_video_path, args.s3_folder)

        if s3_url:
            results['s3Url'] = s3_url
            results['s3Key'] = s3_key

            # 5. Generate QR
            generate_qr(s3_url, qr_path)
            results['qrCodePath'] = qr_path

            # 6. Keep local video file for playback (don't delete)
            # The hologram display will use the S3 URL for playback
            print(f"✅ Local video preserved: {output_video_path}")
            results['videoDeleted'] = False

        results['success'] = True

    except Exception as e:
        results['error'] = str(e)
        if not args.json:
            print(f"❌ Critical Failure: {e}")
            sys.exit(1)

    results['totalTime'] = time.time() - start_total

    # Output for Electron
    if args.json:
        print(json.dumps(results))
    else:
        print("\n✅ Done!")
        print(f"Video: {results['videoPath']}")
        print(f"URL: {results['s3Url']}")

if __name__ == "__main__":
    main()