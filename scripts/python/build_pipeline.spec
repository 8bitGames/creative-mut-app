# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for MUT Pipeline

import os
import sys

# Get paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(SPEC))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MUT_DISTRIBUTION = os.path.join(PROJECT_ROOT, 'MUT-distribution')

block_cipher = None

# Prepare datas - only include .env if it exists
datas_list = []
env_file = os.path.join(MUT_DISTRIBUTION, '.env')
if os.path.exists(env_file):
    datas_list.append((env_file, '.'))

# Pipeline executable
pipeline_a = Analysis(
    [os.path.join(MUT_DISTRIBUTION, 'pipeline.py')],
    pathex=[MUT_DISTRIBUTION],
    binaries=[],
    datas=datas_list,
    hiddenimports=[
        'boto3',
        'botocore',
        'qrcode',
        'qrcode.image.pil',
        'dotenv',
        'PIL',
        'PIL.Image',
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

pipeline_pyz = PYZ(pipeline_a.pure, pipeline_a.zipped_data, cipher=block_cipher)

pipeline_exe = EXE(
    pipeline_pyz,
    pipeline_a.scripts,
    pipeline_a.binaries,
    pipeline_a.zipfiles,
    pipeline_a.datas,
    [],
    name='pipeline',
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
