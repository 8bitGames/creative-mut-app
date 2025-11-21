#!/usr/bin/env python3
"""
Test S3 upload script
Verifies that files can be uploaded to S3 and are publicly accessible
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError
import requests

# Load environment variables
load_dotenv()

def test_upload():
    """Test uploading a file to S3 and verify it's publicly accessible"""

    # Configuration
    bucket_name = os.getenv('AWS_S3_BUCKET', 'mut-demo-2025')
    region = os.getenv('AWS_REGION', 'ap-northeast-2')
    test_key = 'test/test_upload.txt'

    print("=" * 70)
    print("S3 UPLOAD TEST")
    print("=" * 70)
    print(f"Bucket: {bucket_name}")
    print(f"Region: {region}")
    print(f"Test key: {test_key}")

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

    # Create a test file
    test_content = f"Test upload at {Path(__file__).name}\n"
    test_file = '/tmp/test_upload.txt'

    try:
        with open(test_file, 'w') as f:
            f.write(test_content)
        print(f"✅ Created test file: {test_file}")
    except Exception as e:
        print(f"❌ Failed to create test file: {e}")
        return False

    # Upload to S3 (with public-read ACL)
    try:
        print(f"\n📤 Uploading to S3: s3://{bucket_name}/{test_key}")
        s3_client.upload_file(
            test_file,
            bucket_name,
            test_key,
            ExtraArgs={
                'ContentType': 'text/plain',
                'ACL': 'public-read'
            }
        )
        print("✅ Upload successful with public-read ACL!")
    except ClientError as e:
        print(f"❌ Upload failed: {e}")
        return False

    # Construct URL
    s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{test_key}"
    print(f"\n🔗 URL: {s3_url}")

    # Test public access
    print("\n🌐 Testing public access...")
    try:
        response = requests.get(s3_url, timeout=10)
        if response.status_code == 200:
            print("✅ File is publicly accessible!")
            print(f"   Status: {response.status_code}")
            print(f"   Content: {response.text.strip()}")

            # Cleanup
            print(f"\n🧹 Cleaning up test file from S3...")
            s3_client.delete_object(Bucket=bucket_name, Key=test_key)
            print("✅ Test file deleted from S3")

            os.remove(test_file)
            print("✅ Local test file deleted")

            print("\n" + "=" * 70)
            print("✅ S3 UPLOAD TEST PASSED")
            print("=" * 70)
            return True
        else:
            print(f"❌ File not accessible!")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Failed to access URL: {e}")
        return False

if __name__ == '__main__':
    success = test_upload()
    sys.exit(0 if success else 1)
