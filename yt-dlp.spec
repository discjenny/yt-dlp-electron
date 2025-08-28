# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = ['yt_dlp.extractor.youtube', 'yt_dlp.extractor.generic', 'yt_dlp.extractor.soundcloud']
hiddenimports += collect_submodules('yt_dlp')


a = Analysis(
    ['C:\\Users\\jonjo\\Desktop\\yt-dlp-electron\\yt-dlp\\yt_dlp\\__main__.py'],
    pathex=['C:\\Users\\jonjo\\Desktop\\yt-dlp-electron\\yt-dlp'],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='yt-dlp',
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
)
