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

def download_universal(url, resolution="1080", target_dir=None, speed_limit=None):
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
        # The 'bestvideo+bestaudio' logic is universal across all sites
        "-f", f"bestvideo[height<={resolution}]+bestaudio/best",
        "--merge-output-format", "mp4",
        "--newline", 
        "--progress-template", "PROGRESS:%(progress._percent_str)s | SPEED:%(progress._speed_str)s | ETA:%(progress._eta_str)s",
        "--no-mtime"
    ]

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
            download_universal(link, res, target, speed)