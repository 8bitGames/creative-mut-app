# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for MUT Image Stitcher

import os
import sys

# Get paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(SPEC))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
PYTHON_DIR = os.path.join(PROJECT_ROOT, 'python')

block_cipher = None

# Stitcher executable
stitcher_a = Analysis(
    [os.path.join(PYTHON_DIR, 'stitch_images.py')],
    pathex=[PYTHON_DIR],
    binaries=[],
    datas=[],
    hiddenimports=[
        'cv2',
        'numpy',
        'PIL',
        'PIL.Image',
        'PIL.ImageEnhance',
        'PIL.ImageFilter',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

stitcher_pyz = PYZ(stitcher_a.pure, stitcher_a.zipped_data, cipher=block_cipher)

stitcher_exe = EXE(
    stitcher_pyz,
    stitcher_a.scripts,
    stitcher_a.binaries,
    stitcher_a.zipfiles,
    stitcher_a.datas,
    [],
    name='stitch_images',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
