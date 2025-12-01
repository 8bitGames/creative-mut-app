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

# Shadow effect imports (optional - lazy loaded)
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    print("[WARN] OpenCV not available - shadow effect disabled")

# MediaPipe will be lazy-loaded when needed to avoid startup overhead
MEDIAPIPE_SEGMENTER = None

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
    NVENC = "h264_nvenc"  # NVIDIA GPU encoder

def check_nvenc_available():
    """Check if NVIDIA NVENC encoder is available and functional.

    This actually tests encoding a single frame because FFmpeg may list
    NVENC as available even when the driver version is too old.
    """
    try:
        # First check if NVENC is listed
        result = subprocess.run(
            [FFMPEG_PATH, '-hide_banner', '-encoders'],
            capture_output=True, text=True, timeout=10
        )
        if 'h264_nvenc' not in result.stdout:
            return False

        # Actually test NVENC by encoding a single frame
        # This catches driver version mismatches
        test_result = subprocess.run(
            [FFMPEG_PATH, '-hide_banner', '-y',
             '-f', 'lavfi', '-i', 'color=black:size=64x64:duration=0.1:rate=30',
             '-c:v', 'h264_nvenc', '-frames:v', '1',
             '-f', 'null', '-'],
            capture_output=True, text=True, timeout=10
        )
        if test_result.returncode != 0:
            # Check for driver version error
            if 'Driver does not support' in test_result.stderr or 'minimum required Nvidia driver' in test_result.stderr:
                print(f"   [WARN] NVENC listed but driver too old - falling back to CPU")
            return False
        return True
    except Exception as e:
        print(f"   [WARN] NVENC check failed: {e}")
        return False

def get_best_encoder():
    """Detect the best available encoder (prefer GPU acceleration)"""
    if sys.platform == 'darwin':
        return EncoderType.MACOS
    # Check for NVIDIA GPU encoder on Windows/Linux
    if check_nvenc_available():
        print(f"   [GPU] NVIDIA NVENC encoder available - using hardware acceleration")
        return EncoderType.NVENC
    return EncoderType.CPU

def verify_video_integrity(video_path, description="Video"):
    """
    Verify that a video file is valid and can be decoded.

    Args:
        video_path: Path to video file
        description: Description for logging

    Returns:
        dict with keys: valid, duration, width, height, codec, bitrate, error
    """
    print(f"\n[VERIFY] Checking {description} integrity...")
    print(f"   Path: {video_path}")

    result = {
        'valid': False,
        'duration': None,
        'width': None,
        'height': None,
        'codec': None,
        'bitrate': None,
        'frame_count': None,
        'error': None
    }

    # Check file exists and has content
    if not os.path.exists(video_path):
        result['error'] = "File does not exist"
        print(f"   [FAIL] {result['error']}")
        return result

    file_size = os.path.getsize(video_path)
    file_size_mb = file_size / (1024 * 1024)
    print(f"   File size: {file_size_mb:.2f} MB")

    if file_size == 0:
        result['error'] = "File is empty (0 bytes)"
        print(f"   [FAIL] {result['error']}")
        return result

    # Use ffprobe to get detailed video info
    # Handle both 'ffmpeg' and 'ffmpeg.exe' paths
    if FFMPEG_PATH.endswith('.exe'):
        ffprobe_path = FFMPEG_PATH.replace('ffmpeg.exe', 'ffprobe.exe')
    else:
        ffprobe_path = FFMPEG_PATH + '.exe'.replace('ffmpeg.exe', 'ffprobe.exe') if sys.platform == 'win32' else FFMPEG_PATH.replace('ffmpeg', 'ffprobe')

    # Actually, let's just derive it from the directory
    ffmpeg_dir = os.path.dirname(FFMPEG_PATH)
    if ffmpeg_dir:
        ffprobe_path = os.path.join(ffmpeg_dir, 'ffprobe.exe' if sys.platform == 'win32' else 'ffprobe')
    else:
        ffprobe_path = 'ffprobe'

    cmd = [
        ffprobe_path,
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,codec_name,bit_rate,nb_frames,duration',
        '-show_entries', 'format=duration,bit_rate',
        '-of', 'json',
        video_path
    ]

    try:
        import json  # Import here to ensure it's available in exception handlers

        probe_result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if probe_result.returncode != 0:
            result['error'] = f"ffprobe failed: {probe_result.stderr[:200] if probe_result.stderr else 'Unknown error'}"
            print(f"   [FAIL] {result['error']}")
            return result

        probe_data = json.loads(probe_result.stdout)

        # Extract stream info
        if 'streams' in probe_data and len(probe_data['streams']) > 0:
            stream = probe_data['streams'][0]
            result['width'] = stream.get('width')
            result['height'] = stream.get('height')
            result['codec'] = stream.get('codec_name')
            result['frame_count'] = int(stream.get('nb_frames', 0)) if stream.get('nb_frames') else None
            if stream.get('duration'):
                result['duration'] = float(stream['duration'])

        # Extract format info
        if 'format' in probe_data:
            fmt = probe_data['format']
            if not result['duration'] and fmt.get('duration'):
                result['duration'] = float(fmt['duration'])
            if fmt.get('bit_rate'):
                result['bitrate'] = int(fmt['bit_rate']) / 1000000  # Convert to Mbps

        print(f"   Resolution: {result['width']}x{result['height']}")
        print(f"   Codec: {result['codec']}")
        print(f"   Duration: {result['duration']:.2f}s" if result['duration'] else "   Duration: Unknown")
        print(f"   Bitrate: {result['bitrate']:.1f} Mbps" if result['bitrate'] else "   Bitrate: Unknown")
        print(f"   Frames: {result['frame_count']}" if result['frame_count'] else "   Frames: Unknown")

    except subprocess.TimeoutExpired:
        result['error'] = "ffprobe timed out"
        print(f"   [FAIL] {result['error']}")
        return result
    except json.JSONDecodeError as e:
        result['error'] = f"Failed to parse ffprobe output: {e}"
        print(f"   [FAIL] {result['error']}")
        return result
    except Exception as e:
        result['error'] = f"ffprobe error: {str(e)}"
        print(f"   [FAIL] {result['error']}")
        return result

    # Try to decode a few frames to verify video stream integrity
    print(f"   [TEST] Attempting to decode frames...")

    test_cmd = [
        FFMPEG_PATH,
        '-v', 'error',
        '-i', video_path,
        '-vframes', '10',  # Try to decode 10 frames
        '-f', 'null',
        '-'
    ]

    try:
        decode_result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=60)

        if decode_result.returncode != 0 or decode_result.stderr:
            # Check if there are actual errors (not just warnings)
            stderr = decode_result.stderr or ""
            error_lines = [l for l in stderr.split('\n') if l.strip() and 'error' in l.lower()]

            if error_lines or decode_result.returncode != 0:
                result['error'] = f"Decode test failed: {stderr[:500] if stderr else 'Unknown error'}"
                print(f"   [FAIL] Video stream is CORRUPTED!")
                print(f"   Error details: {result['error'][:200]}")
                return result

        result['valid'] = True
        print(f"   [OK] Video stream is valid and decodable")

    except subprocess.TimeoutExpired:
        result['error'] = "Decode test timed out"
        print(f"   [FAIL] {result['error']}")
        return result
    except Exception as e:
        result['error'] = f"Decode test error: {str(e)}"
        print(f"   [FAIL] {result['error']}")
        return result

    return result

def normalize_to_mp4(input_video):
    """
    Convert any input video to a clean MP4 format.
    This fixes WebM header issues and ensures consistent input.
    """
    print(f"\n{'─' * 60}")
    print(f"📹 [NORMALIZE] WebM → MP4 Conversion")
    print(f"{'─' * 60}")

    # Check input file
    if not os.path.exists(input_video):
        print(f"   [ERROR] Input file does not exist: {input_video}")
        raise FileNotFoundError(f"Input video not found: {input_video}")

    input_size = os.path.getsize(input_video) / (1024 * 1024)
    print(f"   Input: {os.path.basename(input_video)}")
    print(f"   Size:  {input_size:.2f} MB")

    # If already MP4, verify and return
    if input_video.endswith('.mp4'):
        print(f"   [SKIP] Input is already MP4, verifying...")
        verify_result = verify_video_integrity(input_video, "Input MP4")
        if verify_result['valid']:
            return input_video
        else:
            print(f"   [WARN] Input MP4 may have issues: {verify_result['error']}")
            # Continue anyway

    # Create normalized MP4 in same directory
    normalized_path = input_video.rsplit('.', 1)[0] + '_normalized.mp4'
    print(f"   Output: {os.path.basename(normalized_path)}")

    cmd = [
        FFMPEG_PATH, '-y',
        '-i', input_video,
        '-c:v', 'libx264',       # Re-encode to H.264
        '-preset', 'medium',     # Balanced speed/quality for intermediate file
        '-crf', '14',            # Excellent quality (sweet spot for quality/size)
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',  # CRITICAL: Proper MP4 structure
        normalized_path
    ]

    print(f"   [RUN] FFmpeg command: {' '.join(cmd[:6])}...")

    try:
        start_time = time.time()
        result = subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        duration = time.time() - start_time

        file_size = os.path.getsize(normalized_path) / (1024 * 1024)
        print(f"   [OK] Normalized in {duration:.1f}s")
        print(f"   Output size: {file_size:.2f} MB")

        # Verify output
        verify_result = verify_video_integrity(normalized_path, "Normalized MP4")
        if not verify_result['valid']:
            print(f"   [ERROR] Normalization produced invalid video!")
            print(f"   Error: {verify_result['error']}")
            raise Exception(f"Normalized video is invalid: {verify_result['error']}")

        print(f"{'─' * 60}\n")
        return normalized_path

    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode() if e.stderr else 'No error output'
        print(f"   [ERROR] FFmpeg normalization failed!")
        print(f"   Exit code: {e.returncode}")
        print(f"   Stderr: {stderr[:500]}")
        print(f"{'─' * 60}\n")
        raise Exception(f"Video normalization failed: {stderr[:200]}")

    except subprocess.TimeoutExpired:
        print(f"   [ERROR] FFmpeg normalization timed out after 120s!")
        print(f"{'─' * 60}\n")
        raise Exception("Video normalization timed out")

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
    print(f"\n{'─' * 60}")
    print(f"✨ [ENHANCE] Face Enhancement Filter")
    print(f"{'─' * 60}")

    # Check input
    if not os.path.exists(input_video):
        print(f"   [ERROR] Input file does not exist: {input_video}")
        raise FileNotFoundError(f"Input video not found: {input_video}")

    input_size = os.path.getsize(input_video) / (1024 * 1024)
    print(f"   Input: {os.path.basename(input_video)}")
    print(f"   Size:  {input_size:.2f} MB")
    print(f"   Level: {enhancement_level}")

    # Create enhanced video path
    enhanced_path = input_video.rsplit('.', 1)[0] + '_enhanced.mp4'
    print(f"   Output: {os.path.basename(enhanced_path)}")

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
    print(f"\n   Enhancement Parameters:")
    print(f"   ├─ Brightness: +{current_params['brightness']*100:.0f}%")
    print(f"   ├─ Contrast:   {current_params['contrast']:.2f}x")
    print(f"   ├─ Saturation: {current_params['saturation']:.2f}x")
    print(f"   └─ Sharpening: {current_params['unsharp']}")

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
        '-preset', 'medium',     # Balanced speed/quality for intermediate file
        '-crf', '14',            # Excellent quality (sweet spot for quality/size)
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',  # CRITICAL: Proper MP4 structure
        enhanced_path
    ]

    print(f"\n   [RUN] Applying enhancement filters...")

    try:
        start_time = time.time()
        result = subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        duration = time.time() - start_time

        file_size = os.path.getsize(enhanced_path) / (1024 * 1024)
        print(f"   [OK] Enhanced in {duration:.1f}s")
        print(f"   Output size: {file_size:.2f} MB")

        # Verify output
        verify_result = verify_video_integrity(enhanced_path, "Enhanced Video")
        if not verify_result['valid']:
            print(f"   [ERROR] Enhancement produced invalid video!")
            print(f"   Error: {verify_result['error']}")
            raise Exception(f"Enhanced video is invalid: {verify_result['error']}")

        print(f"{'─' * 60}\n")
        return enhanced_path

    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode() if e.stderr else 'No error output'
        print(f"   [ERROR] FFmpeg enhancement failed!")
        print(f"   Exit code: {e.returncode}")
        print(f"   Stderr: {stderr[:500]}")
        print(f"   [FALLBACK] Using original video without enhancement")
        print(f"{'─' * 60}\n")
        return input_video

    except subprocess.TimeoutExpired:
        print(f"   [ERROR] FFmpeg enhancement timed out after 120s!")
        print(f"   [FALLBACK] Using original video without enhancement")
        print(f"{'─' * 60}\n")
        return input_video


# ============================================================================
# SHADOW EFFECT PROCESSING
# ============================================================================

# Default shadow configuration (matches ShadowEffectScreen.tsx)
DEFAULT_SHADOW_CONFIG = {
    'enabled': False,
    'offsetX': 30,        # Shadow X offset in pixels (scaled to video resolution)
    'offsetY': 60,        # Shadow Y offset in pixels
    'blur': 50,           # Blur radius in pixels (increased for softer shadow)
    'opacity': 0.75,      # Shadow opacity (0-1) - increased for more visible shadow
    'spread': 15,         # Shadow spread/expansion percentage
}


def get_mediapipe_segmenter():
    """
    Lazy-load and cache MediaPipe Selfie Segmentation model.
    This avoids loading the model if shadow effect is not used.
    """
    global MEDIAPIPE_SEGMENTER

    if MEDIAPIPE_SEGMENTER is not None:
        return MEDIAPIPE_SEGMENTER

    try:
        import mediapipe as mp

        # Initialize MediaPipe Selfie Segmentation
        # model_selection=0: General model (faster, good for real-time)
        # model_selection=1: Landscape model (better quality, slower)
        # Using 0 for speed since we're processing video offline
        mp_selfie_seg = mp.solutions.selfie_segmentation
        segmenter = mp_selfie_seg.SelfieSegmentation(model_selection=0)  # 0 = general model (faster)

        MEDIAPIPE_SEGMENTER = segmenter
        print(f"   [OK] MediaPipe Selfie Segmentation model loaded (fast mode)")
        return segmenter

    except ImportError:
        print(f"   [ERROR] MediaPipe not installed. Run: pip install mediapipe")
        return None
    except Exception as e:
        print(f"   [ERROR] Failed to load MediaPipe: {e}")
        return None


def apply_shadow_to_frame(frame, mask, shadow_config):
    """
    Apply shadow effect to a single frame using the segmentation mask.

    Algorithm (matching ShadowEffectScreen.tsx):
    1. Create shadow from inverted mask with offset and blur
    2. Layer order: video -> shadow -> person on top

    Args:
        frame: BGR image (numpy array)
        mask: Segmentation mask (0-1 float, 1=person)
        shadow_config: Shadow configuration dict

    Returns:
        Frame with shadow effect applied (BGR numpy array)
    """
    h, w = frame.shape[:2]

    # Extract shadow parameters
    # Scale offsets based on video resolution (base resolution: 1280x720)
    scale_x = w / 1280
    scale_y = h / 720

    offset_x = int(shadow_config['offsetX'] * scale_x)
    offset_y = int(shadow_config['offsetY'] * scale_y)
    blur_radius = max(1, int(shadow_config['blur'] * min(scale_x, scale_y)))
    opacity = shadow_config['opacity']
    spread = shadow_config['spread'] / 100.0  # Convert percentage to fraction

    # Ensure blur radius is odd (required by cv2.GaussianBlur)
    if blur_radius % 2 == 0:
        blur_radius += 1

    # Convert mask to uint8 (0-255)
    mask_uint8 = (mask * 255).astype(np.uint8)

    # STEP 1: Create shadow mask with spread (enlarge the silhouette)
    if spread > 0:
        # Dilate the mask to expand the shadow
        kernel_size = max(3, int(min(w, h) * spread / 10))
        if kernel_size % 2 == 0:
            kernel_size += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        shadow_mask = cv2.dilate(mask_uint8, kernel)
    else:
        shadow_mask = mask_uint8.copy()

    # STEP 2: Create offset shadow
    # Create a larger canvas to handle offset without clipping
    pad = max(abs(offset_x), abs(offset_y)) + blur_radius
    padded_h, padded_w = h + 2 * pad, w + 2 * pad

    shadow_padded = np.zeros((padded_h, padded_w), dtype=np.uint8)

    # Place shadow mask with offset
    src_y1, src_y2 = 0, h
    src_x1, src_x2 = 0, w
    dst_y1 = pad + offset_y
    dst_x1 = pad + offset_x

    # Handle negative offsets
    if dst_y1 < 0:
        src_y1 = -dst_y1
        dst_y1 = 0
    if dst_x1 < 0:
        src_x1 = -dst_x1
        dst_x1 = 0

    dst_y2 = dst_y1 + (src_y2 - src_y1)
    dst_x2 = dst_x1 + (src_x2 - src_x1)

    # Clip to bounds
    if dst_y2 > padded_h:
        src_y2 -= (dst_y2 - padded_h)
        dst_y2 = padded_h
    if dst_x2 > padded_w:
        src_x2 -= (dst_x2 - padded_w)
        dst_x2 = padded_w

    if src_y2 > src_y1 and src_x2 > src_x1:
        shadow_padded[dst_y1:dst_y2, dst_x1:dst_x2] = shadow_mask[src_y1:src_y2, src_x1:src_x2]

    # STEP 3: Apply Gaussian blur to shadow
    shadow_blurred = cv2.GaussianBlur(shadow_padded, (blur_radius, blur_radius), 0)

    # Crop back to original size
    shadow_final = shadow_blurred[pad:pad+h, pad:pad+w]

    # STEP 4: Composite - video -> shadow -> person
    # Create output starting with original frame
    output = frame.copy().astype(np.float32)

    # Create shadow layer (black with alpha)
    shadow_alpha = (shadow_final.astype(np.float32) / 255.0) * opacity

    # Remove shadow where person is (person should be on top of shadow)
    person_mask_float = mask.astype(np.float32)
    shadow_alpha = shadow_alpha * (1.0 - person_mask_float)

    # Apply shadow (darken the video)
    shadow_alpha_3ch = np.stack([shadow_alpha] * 3, axis=-1)
    output = output * (1.0 - shadow_alpha_3ch)  # Darken where shadow is

    # Clip and convert back to uint8
    output = np.clip(output, 0, 255).astype(np.uint8)

    return output


def apply_shadow_effect(input_video, output_video, shadow_config=None):
    """
    Apply shadow effect to video using MediaPipe person segmentation.

    OPTIMIZED VERSION:
    - Processes segmentation at lower resolution (720p max) for speed
    - Pipes frames directly to FFmpeg (single encoding pass)
    - Pre-allocates buffers to reduce memory allocation overhead

    Args:
        input_video: Path to input video
        output_video: Path to output video with shadow
        shadow_config: Shadow configuration dict (uses defaults if None)

    Returns:
        Path to output video, or input_video if shadow processing fails
    """
    print(f"\n{'─' * 60}")
    print(f"🌑 [SHADOW] Person Shadow Effect Processing (Optimized)")
    print(f"{'─' * 60}")

    # Check dependencies
    if not CV2_AVAILABLE:
        print(f"   [SKIP] OpenCV not available, skipping shadow effect")
        return input_video

    # Use default config if not provided
    if shadow_config is None:
        shadow_config = DEFAULT_SHADOW_CONFIG.copy()

    if not shadow_config.get('enabled', False):
        print(f"   [SKIP] Shadow effect disabled")
        return input_video

    # Check input
    if not os.path.exists(input_video):
        print(f"   [ERROR] Input file does not exist: {input_video}")
        return input_video

    print(f"   Input: {os.path.basename(input_video)}")
    print(f"   Output: {os.path.basename(output_video)}")
    print(f"\n   Shadow Configuration:")
    print(f"   ├─ Offset X: {shadow_config['offsetX']}px")
    print(f"   ├─ Offset Y: {shadow_config['offsetY']}px")
    print(f"   ├─ Blur:     {shadow_config['blur']}px")
    print(f"   ├─ Opacity:  {shadow_config['opacity']*100:.0f}%")
    print(f"   └─ Spread:   {shadow_config['spread']}%")

    # Load MediaPipe segmenter
    segmenter = get_mediapipe_segmenter()
    if segmenter is None:
        print(f"   [FALLBACK] Shadow processing unavailable, using original video")
        return input_video

    try:
        start_time = time.time()

        # Open input video
        cap = cv2.VideoCapture(input_video)
        if not cap.isOpened():
            print(f"   [ERROR] Failed to open video: {input_video}")
            return input_video

        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # OPTIMIZATION: Calculate processing resolution for segmentation
        # MediaPipe works well at 720p, no need for full 4K processing
        MAX_PROC_HEIGHT = 720
        if height > MAX_PROC_HEIGHT:
            proc_scale = MAX_PROC_HEIGHT / height
            proc_width = int(width * proc_scale)
            proc_height = MAX_PROC_HEIGHT
        else:
            proc_scale = 1.0
            proc_width = width
            proc_height = height

        print(f"\n   Video Info:")
        print(f"   ├─ Resolution: {width}x{height}")
        print(f"   ├─ FPS: {fps:.2f}")
        print(f"   ├─ Frames: {total_frames}")
        print(f"   └─ Segmentation at: {proc_width}x{proc_height} ({proc_scale:.2f}x)")

        # OPTIMIZATION: Start FFmpeg subprocess for direct piping
        # This avoids intermediate file and double-encoding
        # Check for NVENC GPU encoder
        encoder = get_best_encoder()

        ffmpeg_cmd = [
            FFMPEG_PATH, '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{width}x{height}',
            '-pix_fmt', 'bgr24',
            '-r', str(fps),
            '-i', '-',  # Read from stdin
            '-c:v', encoder.value,
        ]

        # Add encoder-specific options
        if encoder == EncoderType.NVENC:
            ffmpeg_cmd.extend([
                '-preset', 'p4',        # Medium quality/speed
                '-rc', 'vbr',
                '-cq', '19',
                '-b:v', '0',
            ])
            print(f"   [GPU] Using NVENC for shadow output encoding")
        else:
            ffmpeg_cmd.extend([
                '-preset', 'medium',
                '-crf', '14',
            ])

        ffmpeg_cmd.extend([
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',  # CRITICAL: Proper MP4 structure
            output_video
        ])

        # Use DEVNULL for stdout/stderr to prevent pipe buffer blocking
        ffmpeg_proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        print(f"\n   [PROCESSING] Applying shadow effect to {total_frames} frames...")
        print(f"   [OPTIMIZATION] Direct FFmpeg pipe (single encode pass)")

        frame_count = 0
        progress_interval = max(1, total_frames // 10)  # Log every 10%
        segmentation_time = 0
        shadow_time = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # OPTIMIZATION: Resize for segmentation if needed
            if proc_scale < 1.0:
                small_frame = cv2.resize(frame, (proc_width, proc_height), interpolation=cv2.INTER_LINEAR)
                small_frame_rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            else:
                small_frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Process with MediaPipe
            seg_start = time.time()
            results = segmenter.process(small_frame_rgb)
            segmentation_time += time.time() - seg_start

            if results.segmentation_mask is not None:
                # OPTIMIZATION: Resize mask back to full resolution
                mask = results.segmentation_mask
                if proc_scale < 1.0:
                    mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_LINEAR)

                # Apply shadow effect
                shadow_start = time.time()
                frame_with_shadow = apply_shadow_to_frame(frame, mask, shadow_config)
                shadow_time += time.time() - shadow_start

                # Write directly to FFmpeg pipe
                ffmpeg_proc.stdin.write(frame_with_shadow.tobytes())
            else:
                # No segmentation, write original frame
                ffmpeg_proc.stdin.write(frame.tobytes())

            # Progress logging
            if frame_count % progress_interval == 0:
                progress = (frame_count / total_frames) * 100
                elapsed = time.time() - start_time
                fps_actual = frame_count / elapsed if elapsed > 0 else 0
                print(f"   Progress: {progress:.0f}% ({frame_count}/{total_frames}) - {fps_actual:.1f} fps")

        # Cleanup
        cap.release()
        ffmpeg_proc.stdin.close()
        ffmpeg_proc.wait()

        duration = time.time() - start_time

        # Check for FFmpeg errors
        if ffmpeg_proc.returncode != 0:
            print(f"   [ERROR] FFmpeg encoding failed (exit code: {ffmpeg_proc.returncode})")
            return input_video

        # Verify output
        if os.path.exists(output_video) and os.path.getsize(output_video) > 0:
            output_size = os.path.getsize(output_video) / (1024 * 1024)
            avg_seg_ms = (segmentation_time / frame_count * 1000) if frame_count > 0 else 0
            avg_shadow_ms = (shadow_time / frame_count * 1000) if frame_count > 0 else 0

            print(f"\n   [OK] Shadow effect applied in {duration:.1f}s")
            print(f"   ├─ Processing speed: {frame_count/duration:.1f} fps")
            print(f"   ├─ Avg segmentation: {avg_seg_ms:.1f}ms/frame")
            print(f"   ├─ Avg shadow apply: {avg_shadow_ms:.1f}ms/frame")
            print(f"   └─ Output size: {output_size:.2f} MB")
            print(f"{'─' * 60}\n")

            return output_video
        else:
            print(f"   [ERROR] Output file not created or empty")
            print(f"{'─' * 60}\n")
            return input_video

    except Exception as e:
        print(f"   [ERROR] Shadow processing failed: {e}")
        import traceback
        traceback.print_exc()
        print(f"   [FALLBACK] Using original video")
        print(f"{'─' * 60}\n")
        return input_video


def composite_video(input_video, frame_image, output_path, enhance_faces=True, shadow_config=None):
    """
    Composites video + frame overlay with optional shadow effect.

    OPTIMIZED VERSION: Combines normalize + enhance + compose into SINGLE FFmpeg pass
    for 2-3x faster processing (eliminates multiple re-encoding passes).

    Args:
        input_video: Path to input video
        frame_image: Path to frame overlay image
        output_path: Path to output composed video
        enhance_faces: Whether to apply face enhancement before frame overlay
        shadow_config: Shadow effect configuration dict (None = disabled)

    Returns:
        dict with timing breakdown: {total, normalize, enhance, shadow, compose}
    """
    print(f"\n{'═' * 70}")
    print(f"🎬 [COMPOSITE] Video + Frame Overlay Composition (OPTIMIZED)")
    print(f"{'═' * 70}")

    start_time = time.time()
    timing = {
        'normalize': 0,
        'enhance': 0,
        'shadow': 0,
        'compose': 0,
        'total': 0
    }

    # Ensure all paths are absolute strings
    input_video = os.path.abspath(input_video)
    frame_image = os.path.abspath(frame_image)
    output_path = os.path.abspath(output_path)

    print(f"\n   Input Video: {os.path.basename(input_video)}")
    print(f"   Frame Image: {os.path.basename(frame_image)}")
    print(f"   Output Path: {os.path.basename(output_path)}")

    # Verify input video exists
    if not os.path.exists(input_video):
        print(f"   [ERROR] Input video not found: {input_video}")
        raise FileNotFoundError(f"Input video not found: {input_video}")

    input_size = os.path.getsize(input_video) / (1024 * 1024)
    print(f"   Input size: {input_size:.2f} MB")

    # Verify frame image exists
    if not os.path.exists(frame_image):
        print(f"   [ERROR] Frame image not found: {frame_image}")
        raise FileNotFoundError(f"Frame image not found: {frame_image}")

    frame_size = os.path.getsize(frame_image) / 1024
    print(f"   Frame size: {frame_size:.1f} KB")

    # === WEBM NORMALIZATION (required for browser-recorded videos) ===
    # WebM files from browsers often have header issues that cause FFmpeg problems
    # We need to normalize WebM to MP4 first for reliable processing
    is_webm = input_video.lower().endswith('.webm')
    if is_webm:
        print(f"\n   [INFO] WebM input detected - normalizing for reliable processing")
        t_normalize_start = time.time()
        input_video = normalize_to_mp4(input_video)
        timing['normalize'] = time.time() - t_normalize_start
        print(f"   ⏱️  WebM Normalize: {timing['normalize']:.1f}s")

    # === SHADOW EFFECT STEP (requires separate processing due to MediaPipe) ===
    # Shadow must be processed first if enabled, as it uses OpenCV/MediaPipe
    if shadow_config and shadow_config.get('enabled', False):
        print(f"\n   [INFO] Shadow effect enabled - requires pre-processing")
        t_shadow_start = time.time()

        # If not already normalized (non-WebM), normalize now for shadow processing
        if not is_webm:
            input_video = normalize_to_mp4(input_video)
            timing['normalize'] = time.time() - t_shadow_start

        # Apply shadow effect
        shadow_output = input_video.rsplit('.', 1)[0] + '_shadow.mp4'
        input_video = apply_shadow_effect(input_video, shadow_output, shadow_config)
        timing['shadow'] = time.time() - t_shadow_start - (timing['normalize'] if not is_webm else 0)
        print(f"   ⏱️  Shadow: {timing['shadow']:.1f}s")

    # Determine Encoder
    encoder = get_best_encoder()

    print(f"\n{'─' * 60}")
    print(f"🔧 [COMPOSE] Single-Pass Processing (Optimized)")
    print(f"{'─' * 60}")
    print(f"   Input: {os.path.basename(input_video)}")
    print(f"   Encoder: {encoder.value}")
    print(f"   Target: 4K Portrait (2160x3840)")
    print(f"   Mode: SINGLE-PASS (normalize + enhance + compose combined)")
    if encoder == EncoderType.CPU:
        print(f"   Quality: CRF 14 (excellent quality)")
        print(f"   Preset: fast (optimized for speed)")
    elif encoder == EncoderType.NVENC:
        print(f"   Quality: CQ 19 (NVENC constant quality)")
        print(f"   Preset: p4 (GPU accelerated)")
    else:
        print(f"   Bitrate: 150 Mbps (near-lossless for hardware encoder)")

    # --- OPTIMIZED FFmpeg Filter Chain ---
    # Combines ALL processing into SINGLE filter chain:
    # 1. Face Enhancement (brightness, contrast, saturation, sharpening)
    # 2. Scale to 4K Portrait (2160x3840)
    # 3. Mirror (flip horizontally)
    # 4. Frame overlay
    #
    # This eliminates 2-3 separate encoding passes!

    # Enhancement parameters (medium level)
    enhancement_filters = ""
    if enhance_faces:
        enhancement_filters = (
            "eq=brightness=0.05:contrast=1.12:saturation=1.1,"
            "unsharp=5:5:1.0:5:5:0.0,"
        )
        print(f"   Enhancement: brightness +5%, contrast 1.12x, saturation 1.1x, sharpening")

    filter_chain = (
        f'[0:v]{enhancement_filters}scale=2160:3840:flags=lanczos,hflip,setsar=1,format=yuv420p[video];'
        '[1:v]scale=2160:3840:flags=lanczos,format=rgba[frame];'
        '[video][frame]overlay=0:0:format=auto[final]'
    )

    # Build Command with retry support
    # IMPORTANT: On retry, fall back to CPU encoder if GPU produced corruption
    max_retries = 2
    retry_count = 0
    t_compose_start = time.time()
    current_encoder = encoder  # Track current encoder (may change on retry)

    while retry_count <= max_retries:
        # On retry after corruption, fall back to CPU encoder for reliability
        if retry_count > 0 and current_encoder != EncoderType.CPU:
            print(f"\n   [FALLBACK] Switching from {current_encoder.value} to libx264 (CPU) for reliability")
            current_encoder = EncoderType.CPU

        cmd = [
            FFMPEG_PATH,                # Use FFmpeg
            '-y',                       # Overwrite output
            '-i', input_video,          # Input 0
            '-i', frame_image,          # Input 1
            '-filter_complex', filter_chain,
            '-map', '[final]',
            '-c:v', current_encoder.value,  # Codec (may be CPU fallback on retry)
        ]

        # QUALITY SETTINGS: High quality encoding for 4K output
        if current_encoder == EncoderType.CPU:
            # libx264: Use CRF-based quality (no bitrate cap)
            # OPTIMIZED: Using 'fast' preset (2x faster than 'medium' with minimal quality loss)
            cmd.extend([
                '-preset', 'fast',      # Fast = optimized for speed while maintaining quality
                '-crf', '14',           # Excellent quality (sweet spot for quality/size)
            ])
        elif current_encoder == EncoderType.NVENC:
            # NVIDIA NVENC: Hardware accelerated encoding (much faster!)
            cmd.extend([
                '-preset', 'p4',        # p4 = medium quality/speed (p1=fastest, p7=best quality)
                '-rc', 'vbr',           # Variable bitrate for better quality
                '-cq', '19',            # Constant quality mode (similar to CRF 14-15)
                '-b:v', '0',            # Let CQ mode determine bitrate
                '-maxrate', '150M',     # Max bitrate cap
                '-bufsize', '300M',     # Buffer size
            ])
        else:
            # Hardware encoders (h264_videotoolbox, etc): Use very high bitrate
            # Hardware encoders don't support CRF, so use 150 Mbps for 4K near-lossless
            cmd.extend([
                '-b:v', '150M',         # 150 Mbps for near-lossless 4K (was 40M)
            ])

        cmd.extend([
            '-pix_fmt', 'yuv420p',      # Pixel format
            '-movflags', '+faststart',  # CRITICAL: Move moov atom to start for proper MP4 structure
        ])

        # Add macOS-specific options
        if sys.platform == 'darwin':
            cmd.extend(['-allow_sw', '1'])  # Allow software fallback if GPU fails (macOS only)

        cmd.extend([
            '-shortest',                # Stop when shortest input ends
            output_path
        ])

        if retry_count > 0:
            print(f"\n   [RETRY {retry_count}/{max_retries}] Using {current_encoder.value} encoder...")

        print(f"\n   [RUN] Compositing video with {current_encoder.value}...")

        try:
            # Run FFmpeg
            result = subprocess.run(cmd, check=True, capture_output=True, timeout=300)
            compose_duration = time.time() - start_time

            # Check output exists - RETRY if missing
            if not os.path.exists(output_path):
                print(f"   [ERROR] Output file was not created!")
                if retry_count < max_retries:
                    print(f"   Will retry composition ({retry_count + 1}/{max_retries})...")
                    retry_count += 1
                    time.sleep(1)
                    continue  # Retry the while loop
                else:
                    raise Exception("FFmpeg completed but output file not found after all retries")

            output_size = os.path.getsize(output_path) / (1024 * 1024)
            print(f"   [OK] Composition finished in {compose_duration:.1f}s")
            print(f"   Output size: {output_size:.2f} MB")

            # CRITICAL: Verify the output video is valid
            print(f"\n   [VERIFY] Checking final video integrity...")
            verify_result = verify_video_integrity(output_path, "Final Composite Video")

            if not verify_result['valid']:
                print(f"\n   {'!' * 60}")
                print(f"   ⚠️  VIDEO CORRUPTION DETECTED!")
                print(f"   {'!' * 60}")
                print(f"   Error: {verify_result['error']}")

                # Check if we can retry
                if retry_count < max_retries:
                    print(f"   Will retry composition ({retry_count + 1}/{max_retries})...")
                    # Delete corrupted file before retry
                    try:
                        os.remove(output_path)
                    except:
                        pass
                    retry_count += 1
                    time.sleep(1)  # Brief pause before retry
                    continue  # Retry the while loop
                else:
                    print(f"   {'!' * 60}")
                    print(f"   ❌ CRITICAL: ALL RETRIES EXHAUSTED - VIDEO STILL CORRUPTED!")
                    print(f"   {'!' * 60}")
                    print(f"   The video file exists but cannot be decoded properly.")
                    print(f"   This may be caused by:")
                    print(f"   - FFmpeg process being interrupted")
                    print(f"   - Disk I/O issues")
                    print(f"   - Memory issues during encoding")
                    print(f"   - Incompatible input video format")
                    print(f"   {'!' * 60}\n")
                    raise Exception(f"Output video is corrupted after {max_retries} retries: {verify_result['error']}")

            # Calculate timing
            timing['compose'] = time.time() - t_compose_start
            timing['total'] = time.time() - start_time

            print(f"\n{'═' * 70}")
            print(f"✅ COMPOSITION COMPLETE")
            print(f"{'═' * 70}")
            print(f"   Duration: {verify_result['duration']:.2f}s")
            print(f"   Resolution: {verify_result['width']}x{verify_result['height']}")
            print(f"   Size: {output_size:.2f} MB")
            print(f"   Bitrate: {verify_result['bitrate']:.1f} Mbps" if verify_result['bitrate'] else "")
            if retry_count > 0:
                print(f"   Note: Succeeded after {retry_count} retry(s)")
            print(f"\n   ⏱️  TIMING BREAKDOWN (OPTIMIZED):")
            if timing['normalize'] > 0:
                print(f"   ├─ WebM Normalize:     {timing['normalize']:.1f}s")
            if timing['shadow'] > 0:
                print(f"   ├─ Shadow Effect:      {timing['shadow']:.1f}s")
            print(f"   ├─ Single-Pass Encode: {timing['compose']:.1f}s")
            print(f"   │  (enhance + scale + compose combined)")
            print(f"   └─ TOTAL:              {timing['total']:.1f}s")
            print(f"{'═' * 70}\n")

            return timing

        except subprocess.CalledProcessError as e:
            stderr = e.stderr.decode('utf-8') if e.stderr else 'No error output'
            print(f"\n   {'!' * 60}")
            print(f"   ❌ FFMPEG COMPOSITION FAILED!")
            print(f"   {'!' * 60}")
            print(f"   Exit code: {e.returncode}")
            print(f"   Error output:")
            # Print error in chunks for readability
            for line in stderr.split('\n')[:20]:
                if line.strip():
                    print(f"   > {line}")
            if len(stderr.split('\n')) > 20:
                print(f"   ... ({len(stderr.split(chr(10))) - 20} more lines)")

            # Check if we can retry
            if retry_count < max_retries:
                print(f"   Will retry ({retry_count + 1}/{max_retries})...")
                retry_count += 1
                time.sleep(1)
                continue
            print(f"   {'!' * 60}\n")
            raise Exception(f"FFmpeg composition failed: {stderr[:300]}")

        except subprocess.TimeoutExpired:
            print(f"\n   {'!' * 60}")
            print(f"   ❌ FFMPEG TIMED OUT!")
            print(f"   {'!' * 60}")
            print(f"   The composition process took longer than 5 minutes.")

            # Check if we can retry
            if retry_count < max_retries:
                print(f"   Will retry ({retry_count + 1}/{max_retries})...")
                retry_count += 1
                time.sleep(1)
                continue
            print(f"   {'!' * 60}\n")
            raise Exception("FFmpeg composition timed out after 5 minutes")

    # Should never reach here, but just in case
    raise Exception("Composition failed unexpectedly")

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
    """
    Generate QR code and save to file.
    
    Args:
        data: URL or data to encode in QR code
        output_path: Full path where QR code should be saved
        
    Returns:
        output_path if successful, None if failed
        
    Raises:
        Exception if QR code generation fails
    """
    try:
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"   Created directory: {output_dir}")
        
        # Generate QR code
        qr = qrcode.QRCode(box_size=10, border=4)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save to file
        img.save(output_path)
        
        # Verify file was created and is readable
        if not os.path.exists(output_path):
            raise Exception(f"QR code file was not created at {output_path}")
        
        file_size = os.path.getsize(output_path)
        if file_size == 0:
            raise Exception(f"QR code file is empty at {output_path}")
        
        print(f"   ✅ QR code saved: {output_path} ({file_size} bytes)")
        return output_path
        
    except Exception as e:
        print(f"   ❌ QR code generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise

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

    # Shadow effect arguments
    parser.add_argument('--shadow', action='store_true', help="Enable person shadow effect")
    parser.add_argument('--shadow-offset-x', type=int, default=30, help="Shadow X offset (default: 30)")
    parser.add_argument('--shadow-offset-y', type=int, default=60, help="Shadow Y offset (default: 60)")
    parser.add_argument('--shadow-blur', type=int, default=50, help="Shadow blur radius (default: 50)")
    parser.add_argument('--shadow-opacity', type=float, default=0.75, help="Shadow opacity 0-1 (default: 0.75)")
    parser.add_argument('--shadow-spread', type=int, default=15, help="Shadow spread percentage (default: 15)")

    args = parser.parse_args()

    # Map chroma to frame if frame is missing
    frame_path = args.frame if args.frame else args.chroma

    # Use provided output directory or fall back to default
    output_dir = args.output_dir if args.output_dir else DEFAULT_OUTPUT_DIR

    # Build shadow configuration from arguments
    shadow_config = {
        'enabled': args.shadow,
        'offsetX': args.shadow_offset_x,
        'offsetY': args.shadow_offset_y,
        'blur': args.shadow_blur,
        'opacity': args.shadow_opacity,
        'spread': args.shadow_spread,
    }

    print("\n[CONFIG] Pipeline Configuration:")
    print(f"   Input video:    {args.input}")
    print(f"   Frame overlay:  {frame_path}")
    print(f"   S3 folder:      {args.s3_folder}")
    print(f"   Output dir:     {output_dir}")
    print(f"   JSON output:    {args.json}")
    print(f"   Shadow effect:  {'Enabled' if args.shadow else 'Disabled'}")
    if args.shadow:
        print(f"      Offset: ({args.shadow_offset_x}, {args.shadow_offset_y})")
        print(f"      Blur: {args.shadow_blur}px, Opacity: {args.shadow_opacity*100:.0f}%")
        print(f"      Spread: {args.shadow_spread}%")

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
        "totalTime": 0,
        "shadowEnabled": shadow_config.get('enabled', False)
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
        comp_timing = composite_video(
            input_video=args.input,
            frame_image=frame_path,
            output_path=output_video_path,
            shadow_config=shadow_config
        )
        step1_time = time.time() - step1_start
        results['compositionTime'] = comp_timing['total'] if isinstance(comp_timing, dict) else comp_timing
        results['timingBreakdown'] = comp_timing if isinstance(comp_timing, dict) else {}

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
        results['step2Time'] = step2_time

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
        results['step3Time'] = step3_time

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
            print(f"   Absolute path: {os.path.abspath(qr_path)}")

            step4_start = time.time()
            try:
                # Generate QR code - function will raise exception if it fails
                generated_path = generate_qr(s3_url, qr_path)
                step4_time = time.time() - step4_start
                
                # CRITICAL: Only set qrCodePath if file actually exists
                if generated_path and os.path.exists(generated_path):
                    # Verify file is readable and not empty
                    qr_size = os.path.getsize(generated_path)
                    if qr_size > 0:
                        results['qrCodePath'] = os.path.abspath(generated_path)  # Use absolute path
                        results['step4Time'] = step4_time
                        print(f"   ✅ STEP 4 COMPLETE in {step4_time:.1f}s")
                        print(f"   QR Code size: {qr_size / 1024:.1f} KB")
                        print(f"   Verified file exists: {os.path.exists(generated_path)}")
                    else:
                        print(f"   ❌ STEP 4 FAILED - QR code file is empty!")
                        results['qrCodePath'] = None
                else:
                    print(f"   ❌ STEP 4 FAILED - QR code file was not created!")
                    print(f"   Expected path: {qr_path}")
                    print(f"   Absolute path: {os.path.abspath(qr_path)}")
                    results['qrCodePath'] = None
            except Exception as qr_error:
                step4_time = time.time() - step4_start
                print(f"   ❌ STEP 4 FAILED with exception: {qr_error}")
                import traceback
                traceback.print_exc()
                results['qrCodePath'] = None
                results['step4Time'] = step4_time
                results['qrError'] = str(qr_error)

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
    # FINAL SUMMARY WITH TIMING
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

    # Comprehensive timing summary
    print("\n" + "─" * 80)
    print("⏱️  TIMING SUMMARY")
    print("─" * 80)

    timing_data = results.get('timingBreakdown', {})
    step2_t = results.get('step2Time', 0)
    step3_t = results.get('step3Time', 0)
    step4_t = results.get('step4Time', 0)

    if timing_data:
        # Sub-steps of video composition (OPTIMIZED - single pass)
        print(f"   STEP 1: VIDEO COMPOSITION ({timing_data.get('total', 0):.1f}s) [OPTIMIZED]")
        normalize_time = timing_data.get('normalize', 0)
        shadow_time = timing_data.get('shadow', 0)
        if normalize_time > 0:
            print(f"      ├─ WebM Normalize:      {normalize_time:.1f}s")
        if shadow_time > 0:
            print(f"      ├─ Shadow Effect:       {shadow_time:.1f}s")
        print(f"      └─ Single-Pass Encode:  {timing_data.get('compose', 0):.1f}s")
        print(f"         (enhance + scale + compose combined)")

    print(f"   STEP 2: FRAME EXTRACTION:  {step2_t:.1f}s")
    print(f"   STEP 3: S3 UPLOAD:         {step3_t:.1f}s")
    print(f"   STEP 4: QR GENERATION:     {step4_t:.1f}s")
    print(f"\n   ═══ PIPELINE TOTAL: {results['totalTime']:.1f}s ═══")

    # Identify bottleneck across ALL steps
    all_steps = []
    if timing_data:
        normalize_time = timing_data.get('normalize', 0)
        shadow_time = timing_data.get('shadow', 0)
        if normalize_time > 0:
            all_steps.append(('WebM Normalize', normalize_time))
        if shadow_time > 0:
            all_steps.append(('Shadow Effect', shadow_time))
        all_steps.append(('Single-Pass Encode', timing_data.get('compose', 0)))
    all_steps.extend([
        ('Frame Extraction', step2_t),
        ('S3 Upload', step3_t),
        ('QR Generation', step4_t),
    ])

    if all_steps:
        bottleneck = max(all_steps, key=lambda x: x[1])
        if bottleneck[1] > 0:
            pct = (bottleneck[1] / results['totalTime']) * 100
            print(f"\n   🔍 BOTTLENECK: {bottleneck[0]} ({bottleneck[1]:.1f}s = {pct:.0f}% of total)")

    print("=" * 80 + "\n")

    # Output for Electron
    if args.json:
        print(json.dumps(results))

if __name__ == "__main__":
    main()