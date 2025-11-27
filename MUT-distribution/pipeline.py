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

# 1. SETUP ABSOLUTE PATHS BASED ON SCRIPT/EXE LOCATION
# For PyInstaller onefile builds, __file__ points to temp extraction directory
# which gets deleted after process exits. Use sys.executable instead.
if getattr(sys, 'frozen', False):
    # Running as compiled exe - use exe directory for persistent output
    SCRIPT_DIR = os.path.dirname(sys.executable)
else:
    # Running as script - use script directory
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")

# For .env file, check multiple locations (exe directory and bundled location)
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")
if not os.path.exists(ENV_PATH) and getattr(sys, 'frozen', False):
    # Fallback to PyInstaller extraction directory for bundled .env
    bundled_env = os.path.join(getattr(sys, '_MEIPASS', SCRIPT_DIR), ".env")
    if os.path.exists(bundled_env):
        ENV_PATH = bundled_env

# Load AWS credentials
load_dotenv(ENV_PATH)

# FFmpeg path - check environment variable first, then bundled location, then common locations
def get_ffmpeg_path():
    """Get the path to ffmpeg executable, checking env var, bundled and common locations"""
    # 1. Check environment variable (set by Electron in production)
    env_ffmpeg = os.environ.get('FFMPEG_PATH')
    if env_ffmpeg and os.path.exists(env_ffmpeg):
        print(f"   Using FFmpeg from env: {env_ffmpeg}")
        return env_ffmpeg

    # 2. Check if running as PyInstaller bundle - look for bundled FFmpeg
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        bundled_ffmpeg = os.path.join(exe_dir, '..', 'ffmpeg', 'ffmpeg.exe')
        if os.path.exists(bundled_ffmpeg):
            bundled_ffmpeg = os.path.abspath(bundled_ffmpeg)
            print(f"   Using bundled FFmpeg: {bundled_ffmpeg}")
            return bundled_ffmpeg

    # 3. Check relative to script location (for embedded Python)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    embedded_ffmpeg = os.path.join(script_dir, '..', '..', 'ffmpeg', 'ffmpeg.exe')
    if os.path.exists(embedded_ffmpeg):
        embedded_ffmpeg = os.path.abspath(embedded_ffmpeg)
        print(f"   Using embedded FFmpeg: {embedded_ffmpeg}")
        return embedded_ffmpeg

    if sys.platform == 'win32':
        # Check common Windows FFmpeg locations
        ffmpeg_locations = [
            r'C:\ffmpeg\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe',
            r'C:\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe',
        ]
        for path in ffmpeg_locations:
            if os.path.exists(path):
                print(f"   Found FFmpeg at: {path}")
                return path
    elif sys.platform == 'darwin':
        # Check common macOS FFmpeg locations (homebrew)
        macos_locations = [
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
        ]
        for path in macos_locations:
            if os.path.exists(path):
                print(f"   Found FFmpeg at: {path}")
                return path
    # Fallback to system PATH
    return 'ffmpeg'

FFMPEG_PATH = get_ffmpeg_path()

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
        print(f"   [OK] Input is already MP4, skipping normalization")
        return input_video

    print(f"   [CONVERTING] Normalizing {os.path.basename(input_video)} to MP4...")

    # Create normalized MP4 in same directory
    normalized_path = input_video.rsplit('.', 1)[0] + '_normalized.mp4'

    cmd = [
        FFMPEG_PATH, '-y',
        '-i', input_video,
        '-c:v', 'libx264',       # Re-encode to H.264
        '-preset', 'fast',       # Better quality than ultrafast (4K needs this)
        '-crf', '18',            # High quality
        '-pix_fmt', 'yuv420p',
        normalized_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=30)
        file_size = os.path.getsize(normalized_path) / (1024 * 1024)
        print(f"   [OK] Normalized to MP4: {file_size:.1f} MB")
        return normalized_path
    except subprocess.CalledProcessError as e:
        print(f"   [WARN] Normalization failed, using original: {e.stderr.decode() if e.stderr else 'Unknown error'}")
        return input_video

def enhance_video(input_video, enhancement_level='medium'):
    """
    Apply face enhancement to video before frame overlay.
    Uses FFmpeg filters for brightness, contrast, saturation, and sharpening.

    Args:
        input_video: Path to input video
        enhancement_level: 'light', 'medium', or 'strong'

    Returns:
        Path to enhanced video
    """
    print(f"\n[ENHANCE] Applying face enhancement to video...")
    print(f"   Level: {enhancement_level}")

    # Create enhanced video path
    enhanced_path = input_video.rsplit('.', 1)[0] + '_enhanced.mp4'

    # Enhancement parameters
    params = {
        'light': {
            'brightness': 0.03,
            'contrast': 1.08,
            'saturation': 1.05,
            'unsharp': '5:5:0.8:5:5:0.0'
        },
        'medium': {
            'brightness': 0.05,
            'contrast': 1.12,
            'saturation': 1.1,
            'unsharp': '5:5:1.0:5:5:0.0'
        },
        'strong': {
            'brightness': 0.08,
            'contrast': 1.18,
            'saturation': 1.15,
            'unsharp': '5:5:1.2:5:5:0.0'
        }
    }

    current_params = params.get(enhancement_level, params['medium'])

    # Build FFmpeg filter chain for face/skin enhancement
    filter_chain = (
        f"eq=brightness={current_params['brightness']}:"
        f"contrast={current_params['contrast']}:"
        f"saturation={current_params['saturation']},"
        f"unsharp={current_params['unsharp']}"
    )

    cmd = [
        FFMPEG_PATH, '-y',
        '-i', input_video,
        '-vf', filter_chain,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        enhanced_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        file_size = os.path.getsize(enhanced_path) / (1024 * 1024)
        print(f"   [OK] Video enhanced: {file_size:.1f} MB")
        return enhanced_path
    except subprocess.CalledProcessError as e:
        print(f"   [WARN] Enhancement failed, using original: {e.stderr.decode() if e.stderr else 'Unknown error'}")
        return input_video

def composite_video(input_video, frame_image, output_path, enhance_faces=True):
    """
    Composites video + frame overlay only.

    Args:
        input_video: Path to input video
        frame_image: Path to frame overlay image
        output_path: Path to output composed video
        enhance_faces: Whether to apply face enhancement before frame overlay

    Returns:
        Duration of composition in seconds
    """
    start_time = time.time()

    # Ensure all paths are absolute strings
    input_video = os.path.abspath(input_video)
    frame_image = os.path.abspath(frame_image)
    output_path = os.path.abspath(output_path)

    print(f"\n[VIDEO] Starting Composition")
    print(f"   Input:  {input_video}")
    print(f"   Frame:  {frame_image}")
    print(f"   Output: {output_path}")

    # CRITICAL: Normalize input to MP4 first (fixes WebM issues)
    input_video = normalize_to_mp4(input_video)

    # === FACE ENHANCEMENT STEP (BEFORE frame overlay) ===
    if enhance_faces:
        input_video = enhance_video(input_video, enhancement_level='medium')

    # Determine Encoder
    encoder = get_best_encoder()
    print(f"   Encoder: {encoder.value}")

    # --- FFmpeg Filter Chain ---
    # 1. Scale Input Video to 4K Portrait (2160x3840)
    # 2. Mirror (flip horizontally) the video
    # 3. Scale Frame to 4K Portrait (2160x3840)
    # 4. Overlay Frame on Video

    filter_chain = (
        '[0:v]scale=2160:3840:flags=lanczos,hflip,setsar=1[video];'
        '[1:v]scale=2160:3840:flags=lanczos[frame];'
        '[video][frame]overlay=0:0:format=auto[final]'
    )

    # Build Command
    cmd = [
        FFMPEG_PATH,                # Use FFmpeg
        '-y',                       # Overwrite output
        '-i', input_video,          # Input 0
        '-i', frame_image,          # Input 1
        '-filter_complex', filter_chain,
        '-map', '[final]',
        '-c:v', encoder.value,      # Codec
        '-b:v', '40M',              # 40 Mbps bitrate for 4K quality
        '-pix_fmt', 'yuv420p',      # Pixel format
    ]

    # Add macOS-specific options
    if sys.platform == 'darwin':
        cmd.extend(['-allow_sw', '1'])  # Allow software fallback if GPU fails (macOS only)

    cmd.extend([
        '-shortest',                # Stop when shortest input ends
        output_path
    ])

    try:
        # Run FFmpeg
        subprocess.run(cmd, check=True, capture_output=True)
        duration = time.time() - start_time
        print(f"[OK] Composition finished in {duration:.2f}s")
        return duration
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] FFmpeg Failed with exit code {e.returncode}")
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
            print(f"[WARN] AWS Client Init Failed: {e}")
            self.client = None

    def upload(self, file_path, folder='videos'):
        if not self.client: return None
        
        filename = os.path.basename(file_path)
        key = f"{folder}/{filename}"
        
        try:
            print(f"[S3] Uploading to S3: {key}")
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
            print(f"[OK] Upload successful! Public URL: {url}")
            return url, key
        except Exception as e:
            print(f"[ERROR] Upload Failed: {e}")
            return None, None

def generate_qr(data, output_path):
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)
    return output_path

def get_video_duration(video_path):
    """Get video duration in seconds using ffprobe."""
    try:
        cmd = [
            FFMPEG_PATH.replace('ffmpeg', 'ffprobe'),
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        duration = float(result.stdout.strip())
        return duration
    except Exception as e:
        print(f"[WARN] Could not get video duration: {e}")
        return None


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
    print(f"\n[FRAMES] Extracting frames at {timestamps}s...")

    # Check video duration first
    duration = get_video_duration(video_path)
    if duration:
        print(f"   Video duration: {duration:.1f}s")
        max_timestamp = max(timestamps)
        if duration < max_timestamp:
            print(f"[WARN] WARNING: Video duration ({duration:.1f}s) is less than max timestamp ({max_timestamp}s)")
            print(f"   This may cause frame extraction to fail!")

    os.makedirs(output_dir, exist_ok=True)
    frame_paths = []
    failed_extractions = []

    for i, timestamp in enumerate(timestamps):
        frame_path = os.path.join(output_dir, f"frame_{timestamp}s.jpg")

        # Two extraction methods: fast (input seeking) and accurate (output seeking)
        # Fast method: -ss before -i (seeks in input, may be inaccurate but fast)
        cmd_fast = [
            FFMPEG_PATH,
            '-ss', str(timestamp),  # Seek to timestamp (input seeking - fast)
            '-i', video_path,       # Input video
            '-frames:v', '1',       # Extract 1 frame
            '-q:v', '2',            # High quality (1-31, lower is better)
            '-y',                   # Overwrite
            frame_path
        ]

        # Accurate method: -ss after -i (decodes all frames up to timestamp - slower but accurate)
        cmd_accurate = [
            FFMPEG_PATH,
            '-i', video_path,       # Input video
            '-ss', str(timestamp),  # Seek to timestamp (output seeking - accurate)
            '-frames:v', '1',       # Extract 1 frame
            '-q:v', '2',            # High quality
            '-y',                   # Overwrite
            frame_path
        ]

        # Try extraction with retry logic
        max_attempts = 3
        success = False

        for attempt in range(max_attempts):
            # Use fast method first, then accurate method on retry
            cmd = cmd_fast if attempt == 0 else cmd_accurate
            method = "fast" if attempt == 0 else "accurate"

            try:
                result = subprocess.run(cmd, check=True, capture_output=True, timeout=30)

                # Verify file was actually created and has content
                if os.path.exists(frame_path) and os.path.getsize(frame_path) > 0:
                    frame_paths.append(frame_path)
                    print(f"   [OK] Frame {i+1}/{len(timestamps)} extracted at {timestamp}s ({method} method)")
                    success = True
                    break
                else:
                    print(f"   [WARN] Attempt {attempt+1} ({method}): Frame file empty or missing")

            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.decode() if e.stderr else str(e)
                # Only print first 200 chars of error to avoid log spam
                error_msg = error_msg[:200] if len(error_msg) > 200 else error_msg
                print(f"   [WARN] Attempt {attempt+1} ({method}): Failed at {timestamp}s: {error_msg}")
            except subprocess.TimeoutExpired:
                print(f"   [WARN] Attempt {attempt+1} ({method}): Timeout at {timestamp}s")

            # Wait before retry
            if attempt < max_attempts - 1:
                time.sleep(0.3)

        if not success:
            failed_extractions.append(timestamp)
            print(f"   [FAIL] Failed to extract frame at {timestamp}s after {max_attempts} attempts")

    print(f"[SUMMARY] Extraction Summary: {len(frame_paths)}/{len(timestamps)} frames extracted")

    # CRITICAL: Ensure we got exactly the expected number of frames
    if len(frame_paths) != len(timestamps):
        error_msg = f"Frame extraction failed: Expected {len(timestamps)} frames, got {len(frame_paths)}"
        if failed_extractions:
            error_msg += f". Failed at timestamps: {failed_extractions}s"
        print(f"[ERROR] {error_msg}")
        raise Exception(error_msg)

    print(f"[OK] All {len(frame_paths)} frames extracted successfully")
    return frame_paths

# ============================================================================
# CLEANUP UTILS
# ============================================================================

def is_session_in_use(session_dir):
    """
    Check if a session directory is currently being used by another pipeline process.
    We check for a .lock file or if any files were modified in the last 60 seconds.
    """
    lock_file = os.path.join(session_dir, '.processing')
    if os.path.exists(lock_file):
        # Check if lock file is stale (older than 5 minutes)
        try:
            lock_age = time.time() - os.path.getmtime(lock_file)
            if lock_age < 300:  # 5 minutes
                return True
        except:
            pass
    return False


def create_session_lock(session_dir):
    """Create a lock file to indicate this session is being processed."""
    lock_file = os.path.join(session_dir, '.processing')
    try:
        with open(lock_file, 'w') as f:
            f.write(str(os.getpid()))
    except:
        pass


def remove_session_lock(session_dir):
    """Remove the lock file when processing is complete."""
    lock_file = os.path.join(session_dir, '.processing')
    try:
        if os.path.exists(lock_file):
            os.remove(lock_file)
    except:
        pass


def cleanup_output_directory(current_session_timestamp, output_dir=None):
    """
    Clean up previous outputs to prevent disk space accumulation.
    Called at the start of each new pipeline run.
    Only removes directories that are older than the current session and not in use.

    Args:
        current_session_timestamp: The timestamp of the current session to preserve
        output_dir: The output directory to clean (uses DEFAULT_OUTPUT_DIR if not specified)
    """
    import shutil

    target_dir = output_dir if output_dir else DEFAULT_OUTPUT_DIR

    if os.path.exists(target_dir):
        print(f"\n🧹 Cleaning up previous outputs in: {target_dir}")
        try:
            # Remove all subdirectories EXCEPT the current session and any in-use sessions
            for item in os.listdir(target_dir):
                item_path = os.path.join(target_dir, item)

                # Skip current session directory
                if item == current_session_timestamp:
                    print(f"   → Skipping current session: {item}")
                    continue

                # Skip if it's a file (not a session directory)
                if not os.path.isdir(item_path):
                    continue

                # Skip if session is currently in use (has lock file)
                if is_session_in_use(item_path):
                    print(f"   → Skipping in-use session: {item}")
                    continue

                try:
                    shutil.rmtree(item_path)
                    print(f"   [OK] Removed: {item}")
                except Exception as e:
                    print(f"   [WARN] Could not remove {item}: {e}")

            print(f"[OK] Output directory cleaned")
        except Exception as e:
            print(f"[WARN] Cleanup warning: {e}")
    else:
        print(f"[INFO] Output directory does not exist yet, skipping cleanup")

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def main():
    print("\n" + "=" * 80)
    print("🎬 MUT HOLOGRAM PIPELINE - STARTING")
    print("=" * 80)

    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--frame', required=True)
    parser.add_argument('--chroma', help="Alias for --frame", required=False)
    parser.add_argument('--subtitle', default="", help="Kept for compatibility, not used")
    parser.add_argument('--s3-folder', default='mut-hologram')
    parser.add_argument('--output-dir', help="Output directory (uses default if not specified)")
    parser.add_argument('--log-file', help="Log file path for debug output")
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()

    # Map chroma to frame if frame is missing
    frame_path = args.frame if args.frame else args.chroma

    # Use provided output directory or fall back to default
    output_dir = args.output_dir if args.output_dir else DEFAULT_OUTPUT_DIR

    print("\n[CONFIG] Pipeline Configuration:")
    print(f"   Input video:    {args.input}")
    print(f"   Frame overlay:  {frame_path}")
    print(f"   S3 folder:      {args.s3_folder}")
    print(f"   Output dir:     {output_dir}")
    print(f"   JSON output:    {args.json}")

    # Verify input files exist
    print("\n[VERIFY] Checking input files...")
    if os.path.exists(args.input):
        input_size = os.path.getsize(args.input) / (1024 * 1024)
        print(f"   ✅ Input video exists: {input_size:.2f} MB")
    else:
        print(f"   ❌ Input video NOT FOUND: {args.input}")

    if os.path.exists(frame_path):
        frame_size = os.path.getsize(frame_path) / 1024
        print(f"   ✅ Frame overlay exists: {frame_size:.2f} KB")
    else:
        print(f"   ❌ Frame overlay NOT FOUND: {frame_path}")

    start_total = time.time()

    # 1. Prepare Paths FIRST (before cleanup to avoid race condition)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    session_dir = os.path.join(output_dir, timestamp)

    print(f"\n[SESSION] Creating session: {timestamp}")
    print(f"   Session directory: {session_dir}")

    os.makedirs(session_dir, exist_ok=True)
    print(f"   ✅ Session directory created")

    # 2. Create lock file to prevent other processes from cleaning up this session
    create_session_lock(session_dir)
    print(f"   ✅ Session lock created")

    # 3. Clean up previous outputs (but preserve current session and any in-use sessions)
    print(f"\n[CLEANUP] Cleaning previous sessions...")
    cleanup_output_directory(timestamp, output_dir)

    output_video_path = os.path.join(session_dir, f"final_{timestamp}.mp4")
    qr_path = os.path.join(session_dir, f"qr_{timestamp}.png")

    print(f"\n[OUTPUTS] Output paths:")
    print(f"   Video:    {output_video_path}")
    print(f"   QR Code:  {qr_path}")

    results = {
        "success": False,
        "videoPath": output_video_path,
        "s3Url": None,
        "qrCodePath": None,
        "framePaths": [],
        "totalTime": 0
    }

    try:
        # ================================================================
        # STEP 1: VIDEO COMPOSITION
        # ================================================================
        print("\n" + "=" * 80)
        print("📹 STEP 1/4: VIDEO COMPOSITION")
        print("=" * 80)
        print(f"   Input:  {args.input}")
        print(f"   Frame:  {frame_path}")
        print(f"   Output: {output_video_path}")

        step1_start = time.time()
        comp_time = composite_video(
            input_video=args.input,
            frame_image=frame_path,
            output_path=output_video_path
        )
        step1_time = time.time() - step1_start
        results['compositionTime'] = comp_time

        # Verify output
        if os.path.exists(output_video_path):
            output_size = os.path.getsize(output_video_path) / (1024 * 1024)
            print(f"   ✅ STEP 1 COMPLETE in {step1_time:.1f}s")
            print(f"   Output video size: {output_size:.2f} MB")
        else:
            print(f"   ❌ STEP 1 FAILED - Output video not created!")

        # ================================================================
        # STEP 2: FRAME EXTRACTION
        # ================================================================
        print("\n" + "=" * 80)
        print("🖼️  STEP 2/4: FRAME EXTRACTION")
        print("=" * 80)

        step2_start = time.time()

        # Get video duration and adjust timestamps accordingly
        video_duration = get_video_duration(output_video_path)
        print(f"   Video duration: {video_duration:.2f}s" if video_duration else "   Video duration: UNKNOWN")

        # ALWAYS adjust timestamps based on actual video duration to avoid extraction failures
        # Default timestamps we'd like to use
        desired_timestamps = [5, 10, 15]
        margin = 0.5  # Safety margin from video end

        if video_duration:
            max_safe_timestamp = video_duration - margin

            if max_safe_timestamp < desired_timestamps[-1]:
                # Video is too short for default timestamps - need to adjust
                print(f"   ⚠️  Video ({video_duration:.1f}s) too short for default timestamps {desired_timestamps}s")

                if max_safe_timestamp >= 10:
                    # Can use first two, adjust last one
                    frame_timestamps = [5, 10, round(max_safe_timestamp, 1)]
                    print(f"   Adjusted last timestamp to {frame_timestamps[-1]}s (video ends at {video_duration:.1f}s)")
                elif max_safe_timestamp >= 5:
                    # Distribute evenly in available duration
                    usable_duration = max_safe_timestamp - margin
                    interval = usable_duration / 3
                    frame_timestamps = [
                        round(margin + interval, 1),
                        round(margin + interval * 2, 1),
                        round(max_safe_timestamp, 1)
                    ]
                    print(f"   Using evenly spaced timestamps for short video")
                else:
                    # Very short video - use what we can
                    interval = max_safe_timestamp / 4
                    frame_timestamps = [
                        round(interval, 1),
                        round(interval * 2, 1),
                        round(interval * 3, 1)
                    ]
                    print(f"   Video very short - using minimal spacing")

                print(f"   Final timestamps: {frame_timestamps}s")
            else:
                frame_timestamps = desired_timestamps
                print(f"   Using default timestamps: {frame_timestamps}s")
        else:
            # No duration info - use safe defaults
            frame_timestamps = [3, 7, 12]
            print(f"   ⚠️  Could not get video duration, using safe timestamps: {frame_timestamps}s")

        frame_paths = extract_frames(output_video_path, frame_timestamps, session_dir)
        step2_time = time.time() - step2_start
        results['framePaths'] = frame_paths

        print(f"   ✅ STEP 2 COMPLETE in {step2_time:.1f}s")
        print(f"   Extracted {len(frame_paths)} frames:")
        for i, fp in enumerate(frame_paths):
            if os.path.exists(fp):
                fsize = os.path.getsize(fp) / 1024
                print(f"      Frame {i+1}: {os.path.basename(fp)} ({fsize:.1f} KB)")
            else:
                print(f"      Frame {i+1}: {os.path.basename(fp)} (NOT FOUND!)")

        # ================================================================
        # STEP 3: S3 UPLOAD
        # ================================================================
        print("\n" + "=" * 80)
        print("☁️  STEP 3/4: S3 UPLOAD")
        print("=" * 80)
        print(f"   File: {output_video_path}")
        print(f"   Folder: {args.s3_folder}")

        step3_start = time.time()
        uploader = S3Uploader()
        s3_url, s3_key = uploader.upload(output_video_path, args.s3_folder)
        step3_time = time.time() - step3_start

        if s3_url:
            results['s3Url'] = s3_url
            results['s3Key'] = s3_key
            print(f"   ✅ STEP 3 COMPLETE in {step3_time:.1f}s")
            print(f"   S3 URL: {s3_url}")
            print(f"   S3 Key: {s3_key}")

            # ================================================================
            # STEP 4: QR CODE GENERATION
            # ================================================================
            print("\n" + "=" * 80)
            print("📱 STEP 4/4: QR CODE GENERATION")
            print("=" * 80)
            print(f"   URL to encode: {s3_url}")
            print(f"   Output path: {qr_path}")

            step4_start = time.time()
            generate_qr(s3_url, qr_path)
            step4_time = time.time() - step4_start
            results['qrCodePath'] = qr_path

            if os.path.exists(qr_path):
                qr_size = os.path.getsize(qr_path) / 1024
                print(f"   ✅ STEP 4 COMPLETE in {step4_time:.1f}s")
                print(f"   QR Code size: {qr_size:.1f} KB")
            else:
                print(f"   ❌ STEP 4 FAILED - QR code not created!")

            # Keep local video file for playback (don't delete)
            print(f"\n[OK] Local video preserved: {output_video_path}")
            results['videoDeleted'] = False
        else:
            print(f"   ❌ STEP 3 FAILED - S3 upload failed!")

        results['success'] = True

    except Exception as e:
        import traceback
        results['error'] = str(e)
        print(f"\n{'=' * 80}")
        print(f"❌ PIPELINE ERROR")
        print(f"{'=' * 80}")
        print(f"   Error: {e}")
        print(f"   Traceback:")
        traceback.print_exc()
        if not args.json:
            sys.exit(1)
    finally:
        # Always remove the session lock when done (success or failure)
        remove_session_lock(session_dir)
        print(f"\n   🔓 Session lock removed")

    results['totalTime'] = time.time() - start_total

    # ================================================================
    # FINAL SUMMARY
    # ================================================================
    print("\n" + "=" * 80)
    print("🏁 PIPELINE COMPLETE" if results['success'] else "❌ PIPELINE FAILED")
    print("=" * 80)
    print(f"   Success:     {results['success']}")
    print(f"   Total time:  {results['totalTime']:.2f}s")
    print(f"   Video:       {results['videoPath']}")
    print(f"   S3 URL:      {results['s3Url']}")
    print(f"   QR Code:     {results['qrCodePath']}")
    print(f"   Frames:      {len(results['framePaths'])} extracted")
    if 'error' in results:
        print(f"   Error:       {results['error']}")
    print("=" * 80 + "\n")

    # Output for Electron
    if args.json:
        print(json.dumps(results))

if __name__ == "__main__":
    main()