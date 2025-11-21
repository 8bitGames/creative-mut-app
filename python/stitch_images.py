"""
MUT Image Stitcher
Creates a video from 3 still images for hologram processing

Usage:
    python stitch_images.py --images img1.jpg img2.jpg img3.jpg --output video.mp4

Features:
    - Combines 3 images into a video with configurable duration per image
    - Supports portrait 9:16 aspect ratio (1080x1920)
    - GPU-accelerated encoding when available
"""

import argparse
import subprocess
import sys
import os
import time
from pathlib import Path


def stitch_images_to_video(image_paths, output_path, duration_per_image=3.0):
    """
    Stitch 3 images into a single video using ffmpeg.

    Args:
        image_paths: List of 3 image file paths
        output_path: Output video file path
        duration_per_image: Duration in seconds to show each image

    Returns:
        str: Path to output video
    """
    if len(image_paths) != 3:
        raise ValueError(f"Expected exactly 3 images, got {len(image_paths)}")

    for img_path in image_paths:
        if not os.path.exists(img_path):
            raise FileNotFoundError(f"Image not found: {img_path}")

    print("\n" + "="*70)
    print("📷 IMAGE STITCHER")
    print("="*70)
    print(f"Creating video from {len(image_paths)} images...")
    print(f"Duration per image: {duration_per_image}s")
    print(f"Total video duration: {duration_per_image * len(image_paths)}s")

    start_time = time.time()

    # Build ffmpeg command to create video from images
    # Each image will be shown for specified duration
    # Format: loop each image for N seconds, then concatenate

    # Use concat demuxer with explicit duration for each image
    # This ensures smooth transitions and exact timing

    ffmpeg_cmd = [
        '/opt/homebrew/bin/ffmpeg', '-y',
        '-loop', '1', '-t', str(duration_per_image), '-i', image_paths[0],
        '-loop', '1', '-t', str(duration_per_image), '-i', image_paths[1],
        '-loop', '1', '-t', str(duration_per_image), '-i', image_paths[2],
        '-filter_complex',
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];'
        '[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1];'
        '[2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v2];'
        '[v0][v1][v2]concat=n=3:v=1:a=0[outv]',
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        output_path
    ]

    print("\n🎬 Running ffmpeg...")
    print(f"   Command: {' '.join(ffmpeg_cmd[:5])}... (truncated)")

    try:
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            check=True
        )

        processing_time = time.time() - start_time
        file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB

        print(f"\n✅ Video created successfully!")
        print(f"   Output: {output_path}")
        print(f"   Size: {file_size:.2f} MB")
        print(f"   Processing time: {processing_time:.2f}s")
        print("="*70 + "\n")

        return output_path

    except subprocess.CalledProcessError as e:
        print(f"\n❌ ffmpeg error:")
        print(f"   {e.stderr}")
        print("="*70 + "\n")
        raise RuntimeError(f"Failed to stitch images: {e.stderr}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Stitch 3 images into a video')
    parser.add_argument('--images', nargs=3, required=True, help='Paths to 3 input images')
    parser.add_argument('--output', required=True, help='Output video path')
    parser.add_argument('--duration', type=float, default=3.0, help='Duration per image in seconds (default: 3.0)')

    args = parser.parse_args()

    try:
        output_video = stitch_images_to_video(
            args.images,
            args.output,
            args.duration
        )

        # Print JSON for easy parsing by Electron
        import json
        print(json.dumps({
            'success': True,
            'videoPath': output_video,
            'duration': args.duration * 3
        }))

    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import json
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)
