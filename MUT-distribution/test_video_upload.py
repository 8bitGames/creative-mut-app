#!/usr/bin/env python3
"""
Test uploading a specific video file to S3
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

# Load environment variables
load_dotenv()

def upload_video(video_path):
    """Upload a specific video file to S3 with public access"""

    # Configuration
    bucket_name = os.getenv('AWS_S3_BUCKET', 'mut-demo-2025')
    region = os.getenv('AWS_REGION', 'ap-northeast-2')

    # Generate S3 key
    video_filename = Path(video_path).name
    s3_key = f'test/{video_filename}'

    print("=" * 70)
    print("VIDEO UPLOAD TEST")
    print("=" * 70)
    print(f"Bucket: {bucket_name}")
    print(f"Region: {region}")
    print(f"Video: {video_path}")
    print(f"S3 Key: {s3_key}")

    # Check if file exists
    if not os.path.exists(video_path):
        print(f"\n❌ File not found: {video_path}")
        return False

    file_size = os.path.getsize(video_path) / 1_000_000
    print(f"File size: {file_size:.1f} MB")

    # Create S3 client
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=region
        )
        print("\n✅ S3 client created successfully")
    except Exception as e:
        print(f"\n❌ Failed to create S3 client: {e}")
        return False

    # Upload to S3 with public-read ACL
    try:
        print(f"\n📤 Uploading to S3: s3://{bucket_name}/{s3_key}")
        print("   (This may take a moment for large files...)")

        s3_client.upload_file(
            video_path,
            bucket_name,
            s3_key,
            ExtraArgs={
                'ContentType': 'video/mp4',
                'ACL': 'public-read'
            }
        )
        print("✅ Upload successful with public-read ACL!")
    except ClientError as e:
        print(f"❌ Upload failed: {e}")
        return False

    # Construct URL
    s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
    print(f"\n🔗 Public URL:")
    print(f"   {s3_url}")

    print("\n" + "=" * 70)
    print("✅ VIDEO UPLOAD SUCCESSFUL")
    print("=" * 70)
    print("\n💡 You can:")
    print(f"   1. Open this URL in a browser to play the video")
    print(f"   2. Generate a QR code for this URL")
    print(f"   3. Share this URL publicly")

    return True

if __name__ == '__main__':
    video_path = '/Users/paksungho/MUTUI/MUT-distribution/output/20251121_042642/final_20251121_042642.mp4'
    success = upload_video(video_path)
    sys.exit(0 if success else 1)
