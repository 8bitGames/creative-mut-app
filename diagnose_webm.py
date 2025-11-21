#!/usr/bin/env python3
"""
Diagnose WebM file corruption issues
"""
import os
import sys
import glob

def diagnose_file(filepath):
    """Analyze a WebM file for header issues"""
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return

    size = os.path.getsize(filepath)
    print(f"\n{'='*70}")
    print(f"File: {os.path.basename(filepath)}")
    print(f"Size: {size:,} bytes ({size/1024:.2f} KB)")
    print(f"{'='*70}")

    with open(filepath, 'rb') as f:
        # Read first 64 bytes
        header = f.read(64)

        print(f"\nFirst 64 bytes (hex):")
        for i in range(0, min(64, len(header)), 16):
            chunk = header[i:i+16]
            hex_str = ' '.join(f'{b:02X}' for b in chunk)
            ascii_str = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            print(f"  {i:04X}: {hex_str:<48} {ascii_str}")

        # Check for EBML header
        if len(header) >= 4:
            header_id = header[:4].hex().upper()
            print(f"\nHeader Analysis:")
            print(f"  First 4 bytes: {header_id}")

            if header_id == '1A45DFA3':
                print(f"  ✅ Valid EBML header (WebM/Matroska)")
            elif header_id.startswith('1A45'):
                print(f"  ⚠️  Partial EBML header")
            else:
                print(f"  ❌ Invalid header (expected 1A45DFA3)")

                # Check for common WebM element IDs
                if header_id[:4] in ['1549', '1654', '5664', '59D0']:
                    print(f"  ℹ️  Found Matroska element ID but missing EBML header")
                    print(f"  ℹ️  This suggests the initialization segment is missing")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Diagnose specific files
        for filepath in sys.argv[1:]:
            diagnose_file(filepath)
    else:
        # Find and diagnose all WebM files in temp directory
        temp_dir = "/var/folders/t4/qlds1kb57kb9vmk9y6xc5rcw0000gn/T/mut-captures"

        if os.path.exists(temp_dir):
            webm_files = sorted(glob.glob(f"{temp_dir}/*.webm"), key=os.path.getmtime, reverse=True)

            if webm_files:
                print(f"Found {len(webm_files)} WebM files in {temp_dir}")
                print(f"\nAnalyzing most recent 3 files:")

                for filepath in webm_files[:3]:
                    diagnose_file(filepath)
            else:
                print(f"No WebM files found in {temp_dir}")
        else:
            print(f"Temp directory not found: {temp_dir}")
            print("\nUsage: python3 diagnose_webm.py [file1.webm] [file2.webm] ...")
