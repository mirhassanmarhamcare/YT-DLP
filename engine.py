import subprocess
import sys
import os
import json

# Setup Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BIN_PATH = os.path.join(BASE_DIR, 'resources', 'bin')
YT_DLP_EXE = os.path.join(BIN_PATH, 'yt-dlp.exe')

def get_info(url):
    """Fetches metadata (Title, Thumbnail, Formats) without downloading."""
    command = [
        YT_DLP_EXE,
        "--dump-json",
        "--no-playlist",
        url
    ]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    return result.stdout

def download_universal(url, resolution="1080", target_dir=None, speed_limit=None, mode="video", items=None):
    """Downloads from any of the 1700+ supported sites."""
    
    # Use -P (Path) flag instead of joining manually to avoid character issues
    download_path = target_dir if target_dir else BASE_DIR

    command = [
        YT_DLP_EXE,
        url,
        "-P", download_path,
        "-o", "%(title)s.%(ext)s",
        "--ffmpeg-location", BIN_PATH,
        # Robustness flags
        "--no-check-certificate",
        "--restrict-filenames", # Replaces invalid characters like |
        "--windows-filenames",  # Further ensures Windows compatibility
        "--newline", 
        "--progress-template", "PROGRESS:%(progress._percent_str)s | SPEED:%(progress._speed_str)s | ETA:%(progress._eta_str)s",
        "--no-mtime",
        # A/V Sync & Robustness Fixes
        "--fixup", "force",
        "--abort-on-unavailable-fragments"
    ]

    # Detect if it's a direct file link (not a media stream site)
    is_direct_file = False
    direct_exts = ['.7z', '.aac', '.ace', '.aif', '.apk', '.arj', '.bin', '.bz2', '.exe', '.gz', '.gzip', '.img', '.iso', '.lzh', '.msi', '.msu', '.pdf', '.plj', '.pps', '.ppt', '.rar', '.sea', '.sit', '.sitx', '.tar', '.tif', '.tiff', '.z', '.zip']
    url_low = url.lower()
    if any(url_low.endswith(ext) for ext in direct_exts) or any(f'.{ext}?' in url_low for ext in direct_exts):
        is_direct_file = True

    if mode == "audio" and not is_direct_file:
        command.extend([
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0", # Best quality
            "-f", "bestaudio/best"
        ])
    elif not is_direct_file:
        # Prefer pre-muxed "best" if possible (better A/V sync for Instagram/TikTok), 
        # otherwise go for bestvideo+bestaudio
        fmt = f"best[height<={resolution}]/bestvideo[height<={resolution}]+bestaudio/best"
        command.extend(["-f", fmt])
        command.extend(["--merge-output-format", "mp4"])
    else:
        # Direct file download - don't specify format or merge
        # yt-dlp will just grab the file as-is
        pass

    if items:
        command.extend(["--playlist-items", items])
    elif not is_direct_file:
        command.append("--no-playlist")

    if speed_limit and speed_limit != "0":
        command.extend(["--ratelimit", speed_limit])
    
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8')
    
    if process.stdout:
        for line in process.stdout:
            # This sends clean progress to your Electron UI (e.g., PROGRESS:10%)
            print(line.strip(), flush=True)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        mode = sys.argv[1] # 'info' or 'download'
        link = sys.argv[2]
        
        if mode == "info":
            print(get_info(link))
        elif mode == "download":
            res = sys.argv[3] if len(sys.argv) > 3 else "1080"
            target = sys.argv[4] if len(sys.argv) > 4 else None
            speed = sys.argv[5] if len(sys.argv) > 5 else None
            dl_mode = sys.argv[6] if len(sys.argv) > 6 else "video"
            dl_items = sys.argv[7] if len(sys.argv) > 7 else None
            download_universal(link, res, target, speed, dl_mode, dl_items)