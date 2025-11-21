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
                ['ffmpeg', '-hide_banner', '-encoders'],
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


def _process_video_segment(args):
    """Process a single video segment - must be top-level function for multiprocessing"""
    segment_id, start_time, seg_duration, enhanced_video, chroma_video, encoder_settings = args

    output_segment = f"segment_{segment_id:03d}.mp4"

    # Optimized filter for segment
    filter_complex = (
        '[0:v]scale=1920:1080:flags=fast_bilinear,setsar=1[base];'
        '[1:v]scale=1920:1080:flags=fast_bilinear,'
        'colorkey=0x00FF00:0.3:0.2,despill=green:0.3[chroma];'
        '[base][chroma]overlay=0:0:format=auto[final]'
    )

    cmd = [
        'ffmpeg', '-y',
        '-ss', str(start_time), '-t', str(seg_duration),
        '-hwaccel', 'auto',
        '-i', enhanced_video,
        '-ss', str(start_time), '-t', str(seg_duration),
        '-i', chroma_video,
        '-filter_complex', filter_complex,
        '-map', '[final]',
        '-c:v', encoder_settings['codec']
    ]
    cmd.extend(encoder_settings['extra_args'])
    cmd.extend(['-pix_fmt', 'yuv420p', output_segment])

    subprocess.run(cmd, check=True, capture_output=True)
    return segment_id, output_segment


def composite_video(enhanced_video, chroma_video, output_video,
                    subtitle_text='', encoder_type=EncoderType.AUTO,
                    use_parallel=True, num_segments=4):
    """
    Composite videos with GPU acceleration and parallel processing.

    Args:
        enhanced_video: Path to main input video
        chroma_video: Path to green screen chroma video
        output_video: Path for output video file
        subtitle_text: Text to display as subtitle (optional)
        encoder_type: Encoder to use (AUTO, GPU_*, CPU_*)
        use_parallel: Use parallel segment processing for multi-core speedup
        num_segments: Number of parallel segments (default: 4)

    Returns:
        tuple: (output_path, processing_time_seconds)
    """
    start_time = time.time()

    print("\n" + "="*70)
    if use_parallel:
        print(f"VIDEO COMPOSITOR - PARALLEL ({num_segments} segments)")
    else:
        print("VIDEO COMPOSITOR - OPTIMIZED")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Auto-detect best encoder
    if encoder_type == EncoderType.AUTO:
        encoder_type = detect_best_encoder()

    encoder_settings = get_encoder_settings(encoder_type)
    print(f"Encoder: {encoder_type.value} ({encoder_settings['codec']})")

    if use_parallel:
        # Use parallel segment processing
        import multiprocessing
        from concurrent.futures import ProcessPoolExecutor, as_completed

        # Get video duration
        probe_cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            enhanced_video
        ]

        result = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        duration = float(result.stdout.strip())
        segment_duration = duration / num_segments

        print(f"Video duration: {duration:.2f}s")
        print(f"Segment duration: {segment_duration:.2f}s")

        # Prepare segment tasks
        tasks = []
        for i in range(num_segments):
            seg_start = i * segment_duration
            tasks.append((i, seg_start, segment_duration, enhanced_video, chroma_video, encoder_settings))

        # Process segments in parallel
        segment_files = []
        max_workers = min(num_segments, multiprocessing.cpu_count())

        print(f"\nProcessing {num_segments} segments with {max_workers} workers...")

        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(_process_video_segment, task) for task in tasks]

            for future in as_completed(futures):
                segment_id, segment_path = future.result()
                segment_files.append((segment_id, segment_path))
                print(f"  ✅ Segment {segment_id} completed")

        # Sort segments by ID
        segment_files.sort(key=lambda x: x[0])

        # Concatenate segments
        print("\nConcatenating segments...")

        concat_file = 'concat_list.txt'
        with open(concat_file, 'w') as f:
            for _, segment_path in segment_files:
                f.write(f"file '{segment_path}'\n")

        concat_cmd = [
            'ffmpeg', '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', concat_file,
            '-c', 'copy',
            output_video
        ]

        subprocess.run(concat_cmd, check=True, capture_output=True)

        # Cleanup
        for _, segment in segment_files:
            os.remove(segment)
        os.remove(concat_file)

    else:
        # Single-process composition
        # Build optimized FFmpeg filter chain
        filter_parts = [
            '[0:v]scale=1920:1080:flags=fast_bilinear,setsar=1[base];',
            '[1:v]scale=1920:1080:flags=fast_bilinear,'
            'colorkey=0x00FF00:0.3:0.2,'
            'despill=green:0.3[chroma];',
            '[base][chroma]overlay=0:0:format=auto[composite];'
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
            'ffmpeg', '-y',
            '-hwaccel', 'auto',
            '-i', enhanced_video,
            '-i', chroma_video,
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

        print(f"\nCompositing: {Path(enhanced_video).name} + {Path(chroma_video).name}")
        print(f"Output: {Path(output_video).name}")

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

        # Set content type
        ext = Path(file_path).suffix.lower()
        content_types = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
        }
        extra_args = {}
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

    def process(self, input_video, chroma_video, subtitle_text='', s3_folder='videos'):
        """
        Run complete pipeline: Composite → Upload → QR Code

        Args:
            input_video: Path to input video
            chroma_video: Path to chroma key video
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

            # Step 1: Composite video
            print("\n🎬 Step 1/3: Video Composition")
            print("-" * 70)
            final_video, comp_time = composite_video(
                enhanced_video=input_video,
                chroma_video=chroma_video,
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
    parser.add_argument('--chroma', default=DEFAULT_CHROMA_VIDEO, help='Chroma video path')
    parser.add_argument('--subtitle', default=DEFAULT_SUBTITLE, help='Subtitle text')
    parser.add_argument('--s3-folder', default='videos', help='S3 folder prefix')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')

    args = parser.parse_args()

    # Check for .env file
    if not os.path.exists('.env'):
        print("⚠️  Warning: .env file not found", file=sys.stderr)
        print("   Create .env file with AWS credentials (see .env.example)", file=sys.stderr)

    # Check required input files
    required_files = [args.input, args.chroma]
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
            chroma_video=args.chroma,
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
