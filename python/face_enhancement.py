"""
Face Enhancement Module for MUT App
Provides face and image enhancement using OpenCV and PIL

This module enhances photos before they're stitched into video.
Uses proven image processing techniques for skin smoothing, color correction, and detail enhancement.
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import os


class FaceEnhancer:
    """
    Enhances faces in images using image processing techniques.
    """

    def __init__(self, enhancement_level='medium'):
        """
        Initialize face enhancer.

        Args:
            enhancement_level: 'light', 'medium', or 'strong'
        """
        self.enhancement_level = enhancement_level

        # Enhancement parameters based on level
        self.params = {
            'light': {
                'brightness': 1.05,
                'contrast': 1.1,
                'saturation': 1.05,
                'sharpness': 1.1,
                'smoothing': 1
            },
            'medium': {
                'brightness': 1.08,
                'contrast': 1.15,
                'saturation': 1.1,
                'sharpness': 1.2,
                'smoothing': 2
            },
            'strong': {
                'brightness': 1.12,
                'contrast': 1.2,
                'saturation': 1.15,
                'sharpness': 1.3,
                'smoothing': 3
            }
        }

        self.current_params = self.params.get(enhancement_level, self.params['medium'])

    def enhance_image(self, image_path, output_path=None):
        """
        Enhance a single image.

        Args:
            image_path: Path to input image
            output_path: Path to save enhanced image (optional, overwrites if None)

        Returns:
            Path to enhanced image
        """
        print(f"\n✨ Enhancing image: {os.path.basename(image_path)}")

        # Load image with PIL
        img = Image.open(image_path)

        # Step 1: Brightness enhancement
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(self.current_params['brightness'])

        # Step 2: Contrast enhancement
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(self.current_params['contrast'])

        # Step 3: Color/Saturation enhancement
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(self.current_params['saturation'])

        # Step 4: Skin smoothing using bilateral filter (OpenCV)
        # Convert PIL to OpenCV format
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        # Apply bilateral filter for skin smoothing (preserves edges)
        smoothing_iterations = self.current_params['smoothing']
        for _ in range(smoothing_iterations):
            img_cv = cv2.bilateralFilter(img_cv, 9, 75, 75)

        # Convert back to PIL
        img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))

        # Step 5: Subtle sharpening (after smoothing)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(self.current_params['sharpness'])

        # Save enhanced image
        if output_path is None:
            output_path = image_path

        img.save(output_path, quality=95)

        print(f"   ✓ Enhanced: {os.path.basename(output_path)}")
        return output_path

    def enhance_batch(self, image_paths, output_dir=None):
        """
        Enhance multiple images.

        Args:
            image_paths: List of image paths
            output_dir: Directory to save enhanced images (optional)

        Returns:
            List of enhanced image paths
        """
        print(f"\n{'='*70}")
        print(f"✨ FACE ENHANCEMENT - Batch Processing")
        print(f"{'='*70}")
        print(f"   Images: {len(image_paths)}")
        print(f"   Level: {self.enhancement_level}")

        enhanced_paths = []

        for i, img_path in enumerate(image_paths, 1):
            print(f"\n[{i}/{len(image_paths)}]", end=" ")

            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                basename = os.path.basename(img_path)
                name, ext = os.path.splitext(basename)
                output_path = os.path.join(output_dir, f"{name}_enhanced{ext}")
            else:
                output_path = None

            enhanced_path = self.enhance_image(img_path, output_path)
            enhanced_paths.append(enhanced_path)

        print(f"\n✅ Batch enhancement complete!")
        print(f"{'='*70}\n")

        return enhanced_paths


def enhance_video_with_ffmpeg(input_video, output_video, enhancement_level='medium'):
    """
    Enhance video using FFmpeg filters.
    This is applied to the video BEFORE frame overlay.

    Args:
        input_video: Path to input video
        output_video: Path to output enhanced video
        enhancement_level: 'light', 'medium', or 'strong'

    Returns:
        Path to enhanced video
    """
    print(f"\n{'='*70}")
    print(f"✨ VIDEO FACE ENHANCEMENT")
    print(f"{'='*70}")
    print(f"   Input: {os.path.basename(input_video)}")
    print(f"   Level: {enhancement_level}")

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

    import subprocess
    import time

    start_time = time.time()

    # Build FFmpeg command
    cmd = [
        'ffmpeg', '-y',
        '-i', input_video,
        '-vf', filter_chain,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        output_video
    ]

    print(f"\n🎬 Applying enhancement filters...")

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        duration = time.time() - start_time
        file_size = os.path.getsize(output_video) / (1024 * 1024)

        print(f"\n✅ Video enhancement complete!")
        print(f"   Output: {os.path.basename(output_video)}")
        print(f"   Size: {file_size:.2f} MB")
        print(f"   Time: {duration:.2f}s")
        print(f"{'='*70}\n")

        return output_video

    except subprocess.CalledProcessError as e:
        print(f"\n❌ FFmpeg enhancement failed: {e.stderr.decode() if e.stderr else 'Unknown error'}")
        print(f"   Returning original video")
        print(f"{'='*70}\n")
        return input_video


if __name__ == "__main__":
    # Test the enhancer
    import sys

    if len(sys.argv) < 2:
        print("Usage: python face_enhancement.py <image_path> [enhancement_level]")
        print("Enhancement levels: light, medium (default), strong")
        sys.exit(1)

    image_path = sys.argv[1]
    level = sys.argv[2] if len(sys.argv) > 2 else 'medium'

    enhancer = FaceEnhancer(enhancement_level=level)

    # Create output path
    name, ext = os.path.splitext(image_path)
    output_path = f"{name}_enhanced{ext}"

    enhancer.enhance_image(image_path, output_path)
    print(f"\n✅ Enhanced image saved to: {output_path}")
