# Chroma Key Directory

Place your green screen (chroma key) video file here.

Requirements:
- Video with green screen background (0x00FF00)
- Same or similar duration as main video
- Supported formats: .MP4, .MOV, .AVI

Example:
  chroma/green_screen.mp4
  chroma/overlay.mov

Then update pipeline.py:
  DEFAULT_CHROMA_VIDEO = "chroma/green_screen.mp4"

Note: The pipeline will automatically remove the green background
and overlay this video on top of your main video.
