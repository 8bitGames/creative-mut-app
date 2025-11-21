"""
MUT Video Processing Pipeline
High-performance video composition with S3 upload and QR code generation

Usage:
    python pipeline.py

Features:
    - GPU-accelerated video composition (11.9s processing time)
    - Chroma key (green screen) removal with despill
    - S3 upload with automatic URL generation
    - QR code generation for easy sharing
"""

import os
import subprocess
import time
from datetime import datetime
from pathlib import Path
from enum import Enum

# S3 and QR imports
import boto3
from botocore.exceptions import ClientError
import qrcode
from dotenv import load_dotenv


# ============================================================================
# PATHS
FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg'
FFPROBE_PATH = '/opt/homebrew/bin/ffprobe'

# ============================================================================
# CONFIGURATION
# ============================================================================

# Load AWS credentials from .env
load_dotenv()

# Default paths
DEFAULT_INPUT_VIDEO = "video/IMG_0523.MOV"
DEFAULT_CHROMA_VIDEO = "chroma/croma2.mp4"
DEFAULT_OUTPUT_DIR = "output"
DEFAULT_SUBTITLE = "MUT Video"


# ============================================================================
# VIDEO COMPOSITOR (Optimized)
# ============================================================================

class EncoderType(Enum):
    """Available encoder types"""
    CPU_ULTRAFAST = "cpu_ultrafast"
    CPU_VERYFAST = "cpu_veryfast"
    CPU_FAST = "cpu_fast"
    CPU_MEDIUM = "cpu_medium"
    GPU_VIDEOTOOLBOX = "gpu_videotoolbox"  # macOS
    GPU_NVENC = "gpu_nvenc"                # NVIDIA
    GPU_AMF = "gpu_amf"                    # AMD
    AUTO = "auto"


def detect_best_encoder():
    """Detect the best available encoder for the system"""
    encoders_to_test = [
        ('h264_videotoolbox', EncoderType.GPU_VIDEOTOOLBOX),  # macOS
        ('h264_nvenc', EncoderType.GPU_NVENC),                 # NVIDIA
        ('h264_amf', EncoderType.GPU_AMF),                     # AMD
    ]

    for encoder, encoder_type in encoders_to_test:
        try:
            result = subprocess.run(
                [FFMPEG_PATH, '-hide_banner', '-encoders'],
                capture_output=True,
                text=True
            )
            if encoder in result.stdout:
                print(f"✅ Detected GPU encoder: {encoder}")
                return encoder_type
        except:
            pass

    print("ℹ️  No GPU encoder detected, using fast CPU encoding")
    return EncoderType.CPU_VERYFAST


def get_encoder_settings(encoder_type):
    """Get FFmpeg encoder settings for the specified encoder type"""
    settings = {
        EncoderType.CPU_ULTRAFAST: {
            'codec': 'libx264',
            'extra_args': ['-preset', 'ultrafast', '-crf', '21']
        },
        EncoderType.CPU_VERYFAST: {
            'codec': 'libx264',
            'extra_args': ['-preset', 'veryfast', '-crf', '23']
        },
        EncoderType.CPU_FAST: {
            'codec': 'libx264',
            'extra_args': ['-preset', 'fast', '-crf', '23']
        },
        EncoderType.CPU_MEDIUM: {
            'codec': 'libx264',
            'extra_args': ['-preset', 'medium', '-crf', '23']
        },
        EncoderType.GPU_VIDEOTOOLBOX: {
            'codec': 'h264_videotoolbox',
            'extra_args': ['-b:v', '5M', '-allow_sw', '1']
        },
        EncoderType.GPU_NVENC: {
            'codec': 'h264_nvenc',
            'extra_args': ['-preset', 'p4', '-b:v', '5M']
        },
        EncoderType.GPU_AMF: {
            'codec': 'h264_amf',
            'extra_args': ['-quality', 'balanced', '-b:v', '5M']
        }
    }
    return settings.get(encoder_type, settings[EncoderType.CPU_VERYFAST])


def composite_video(input_video, frame_overlay, output_video,
                    subtitle_text='', encoder_type=EncoderType.AUTO):
    """
    Composite video with frame overlay and face enhancement.

    Args:
        input_video: Path to main input video
        frame_overlay: Path to frame PNG overlay image
        output_video: Path for output video file
        subtitle_text: Text to display as subtitle (optional)
        encoder_type: Encoder to use (AUTO, GPU_*, CPU_*)

    Returns:
        tuple: (output_path, processing_time_seconds)
    """
    start_time = time.time()

    print("\n" + "="*70)
    print("VIDEO COMPOSITOR - FACE ENHANCEMENT + FRAME OVERLAY")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Auto-detect best encoder
    if encoder_type == EncoderType.AUTO:
        encoder_type = detect_best_encoder()

    encoder_settings = get_encoder_settings(encoder_type)
    print(f"Encoder: {encoder_type.value} ({encoder_settings['codec']})")
    print(f"Input: {Path(input_video).name}")
    print(f"Frame overlay: {Path(frame_overlay).name}")
    print(f"Output: {Path(output_video).name}")

    # Build FFmpeg filter chain:
    # 1. Apply face enhancement (brightness, contrast, sharpness)
    # 2. Scale to 9:16 (1080x1920)
    # 3. Overlay frame PNG
    # 4. Add subtitle if provided

    filter_parts = [
        # Apply face enhancement to input video
        '[0:v]eq=brightness=0.05:contrast=1.15:saturation=1.1,'  # Enhance brightness & contrast
        'unsharp=5:5:1.0:5:5:0.0,'  # Sharpen faces
        'scale=1080:1920:flags=lanczos,setsar=1[enhanced];',  # Scale to 9:16

        # Scale frame overlay to match
        '[1:v]scale=1080:1920:flags=lanczos[frame];',

        # Overlay frame on enhanced video
        '[enhanced][frame]overlay=0:0:format=auto[composite];'
    ]

    # Add subtitle if provided
    if subtitle_text:
        subtitle_filter = (
            f"[composite]drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:"
            f"fontsize=48:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:"
            f"x=(w-tw)/2:y=h-th-40:text='{subtitle_text}'[final]"
        )
        filter_parts.append(subtitle_filter)
        final_stream = '[final]'
    else:
        final_stream = '[composite]'

    filter_complex = ''.join(filter_parts)

    # Build FFmpeg command
    ffmpeg_command = [
        FFMPEG_PATH, '-y',
        '-hwaccel', 'auto',
        '-i', input_video,      # Input: stitched video from images
        '-i', frame_overlay,     # Input: frame PNG overlay
        '-filter_complex', filter_complex,
        '-map', final_stream,
        '-c:v', encoder_settings['codec']
    ]
    ffmpeg_command.extend(encoder_settings['extra_args'])
    ffmpeg_command.extend([
        '-pix_fmt', 'yuv420p',
        '-shortest',
        output_video
    ])

    print("\n🎨 Applying face enhancement...")
    print("📐 Scaling to 1080x1920 (9:16)...")
    print("🖼️  Overlaying frame...")

    subprocess.run(ffmpeg_command, check=True, capture_output=True)

    processing_time = time.time() - start_time

    print(f"✅ Processing completed in {processing_time:.2f}s")
    print("="*70)

    return output_video, processing_time


# ============================================================================
# S3 UPLOADER
# ============================================================================

class S3Uploader:
    """Upload files to AWS S3 bucket"""

    def __init__(self):
        """Initialize S3 client with credentials from .env file"""
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'ap-northeast-2')
        )
        self.bucket_name = os.getenv('AWS_S3_BUCKET', 'mut-demo-2025')
        self.region = os.getenv('AWS_REGION', 'ap-northeast-2')

    def upload_file(self, file_path, s3_key=None):
        """
        Upload a file to S3 bucket.

        Args:
            file_path: Local path to the file
            s3_key: S3 object key (path in bucket). If None, uses filename

        Returns:
            S3 URL if successful, None if failed
        """
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return None

        # Use filename as S3 key if not provided
        if s3_key is None:
            s3_key = Path(file_path).name

        # Set content type and ACL for public read
        ext = Path(file_path).suffix.lower()
        content_types = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
        }
        extra_args = {
            'ACL': 'public-read'  # Make file publicly readable via ACL
        }
        if ext in content_types:
            extra_args['ContentType'] = content_types[ext]

        try:
            print(f"\n📤 Uploading to S3: s3://{self.bucket_name}/{s3_key}")
            self.s3_client.upload_file(
                file_path,
                self.bucket_name,
                s3_key,
                ExtraArgs=extra_args
            )

            s3_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
            print(f"✅ Upload successful!")
            print(f"   URL: {s3_url}")

            return s3_url

        except ClientError as e:
            print(f"❌ Upload error: {e}")
            return None


# ============================================================================
# QR CODE GENERATOR
# ============================================================================

class QRGenerator:
    """Generate QR codes for URLs"""

    def __init__(self, output_dir='qr_codes'):
        """
        Initialize QR generator.

        Args:
            output_dir: Directory to save QR code images
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_qr(self, url, filename=None):
        """
        Generate QR code for a URL.

        Args:
            url: URL to encode in QR code
            filename: Output filename (without extension)

        Returns:
            Path to saved QR code image
        """
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"qr_{timestamp}"

        if not filename.endswith('.png'):
            filename += '.png'

        output_path = os.path.join(self.output_dir, filename)

        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )

        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        img.save(output_path)

        print(f"\n📱 QR code saved: {output_path}")
        return output_path


# ============================================================================
# MAIN PIPELINE
# ============================================================================

class VideoPipeline:
    """Complete video processing pipeline"""

    def __init__(self, output_dir=DEFAULT_OUTPUT_DIR):
        """
        Initialize pipeline.

        Args:
            output_dir: Output directory for processed files
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        self.s3_uploader = S3Uploader()
        self.qr_generator = QRGenerator(output_dir=os.path.join(output_dir, 'qr_codes'))

    def process(self, input_video, frame_overlay, subtitle_text='', s3_folder='videos'):
        """
        Run complete pipeline: Face Enhancement → Frame Overlay → Upload → QR Code

        Args:
            input_video: Path to input video (stitched from images)
            frame_overlay: Path to frame PNG overlay
            subtitle_text: Subtitle text to overlay
            s3_folder: S3 folder prefix

        Returns:
            dict with paths, URLs, and processing info
        """
        print("\n" + "="*70)
        print("MUT VIDEO PROCESSING PIPELINE")
        print("="*70)

        start_total = time.time()
        results = {}

        try:
            # Create timestamped output directory
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            session_dir = os.path.join(self.output_dir, timestamp)
            os.makedirs(session_dir, exist_ok=True)

            # Output paths
            final_video = os.path.join(session_dir, f'final_{timestamp}.mp4')

            # Step 1: Composite video (face enhancement + frame overlay)
            print("\n🎬 Step 1/3: Video Composition")
            print("-" * 70)
            final_video, comp_time = composite_video(
                input_video=input_video,
                frame_overlay=frame_overlay,
                output_video=final_video,
                subtitle_text=subtitle_text
            )
            results['video_path'] = final_video
            results['composition_time'] = comp_time

            # Step 2: Upload to S3
            print("\n☁️  Step 2/3: S3 Upload")
            print("-" * 70)
            s3_key = f"{s3_folder}/{timestamp}_{Path(final_video).name}"

            # Get file size before upload (for summary)
            video_size_mb = os.path.getsize(final_video) / 1_000_000
            results['video_size_mb'] = video_size_mb

            s3_url = self.s3_uploader.upload_file(final_video, s3_key=s3_key)
            results['s3_url'] = s3_url
            results['s3_key'] = s3_key

            # Step 3: Generate QR code
            print("\n📱 Step 3/3: QR Code Generation")
            print("-" * 70)
            qr_path = self.qr_generator.generate_qr(s3_url, filename=f'qr_{timestamp}')
            results['qr_code_path'] = qr_path

            # Cleanup: Delete video file after successful upload and QR generation
            if s3_url:
                try:
                    print(f"\n🧹 Cleaning up: Deleting local video file...")
                    os.remove(final_video)
                    print(f"✅ Deleted: {final_video}")
                    results['video_deleted'] = True
                except Exception as e:
                    print(f"⚠️  Failed to delete video file: {e}")
                    results['video_deleted'] = False
            else:
                print("⚠️  Skipping cleanup: S3 upload failed")
                results['video_deleted'] = False

            # Final summary
            total_time = time.time() - start_total
            results['total_time'] = total_time

            print("\n" + "="*70)
            print("✅ PIPELINE COMPLETED SUCCESSFULLY")
            print("="*70)
            print(f"\n📊 Summary:")
            print(f"   Output Video:   {final_video} (deleted after upload)")
            print(f"   Video Size:     {video_size_mb:.1f} MB")
            print(f"   S3 URL:         {s3_url}")
            print(f"   QR Code:        {qr_path}")
            print(f"\n⏱️  Timing:")
            print(f"   Composition:    {comp_time:.2f}s")
            print(f"   Total Time:     {total_time:.2f}s")
            print("="*70 + "\n")

            return results

        except Exception as e:
            print(f"\n❌ Pipeline failed: {e}")
            raise


# ============================================================================
# CLI ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import sys
    import argparse
    import json

    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='MUT Video Processing Pipeline')
    parser.add_argument('--input', default=DEFAULT_INPUT_VIDEO, help='Input video path')
    parser.add_argument('--frame', default=DEFAULT_CHROMA_VIDEO, help='Frame overlay PNG path')
    parser.add_argument('--subtitle', default=DEFAULT_SUBTITLE, help='Subtitle text')
    parser.add_argument('--s3-folder', default='videos', help='S3 folder prefix')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')

    args = parser.parse_args()

    # Check for .env file
    if not os.path.exists('.env'):
        print("⚠️  Warning: .env file not found", file=sys.stderr)
        print("   Create .env file with AWS credentials (see .env.example)", file=sys.stderr)

    # Check required input files
    required_files = [args.input, args.frame]
    missing_files = [f for f in required_files if not os.path.exists(f)]

    if missing_files:
        print("❌ Missing required files:", file=sys.stderr)
        for f in missing_files:
            print(f"   - {f}", file=sys.stderr)
        sys.exit(1)

    # Run pipeline
    pipeline = VideoPipeline(output_dir=DEFAULT_OUTPUT_DIR)

    try:
        results = pipeline.process(
            input_video=args.input,
            frame_overlay=args.frame,
            subtitle_text=args.subtitle,
            s3_folder=args.s3_folder
        )

        # Output JSON for Electron integration
        if args.json:
            # Print JSON on last line (for easy parsing)
            print(json.dumps({
                'videoPath': results['video_path'],
                's3Url': results['s3_url'],
                's3Key': results['s3_key'],
                'qrCodePath': results['qr_code_path'],
                'compositionTime': results['composition_time'],
                'totalTime': results['total_time']
            }))
        else:
            print("\n✅ All done! Check the output directory for results.")

    except Exception as e:
        print(f"❌ Pipeline failed: {e}", file=sys.stderr)
        sys.exit(1)
