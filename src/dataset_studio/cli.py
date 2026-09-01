from __future__ import annotations

import argparse
import threading
import webbrowser
from pathlib import Path

import uvicorn

from dataset_studio.config import Settings
from dataset_studio.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="dataset-studio", description="Edit JSONL datasets safely in your browser"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--data-dir", type=Path)
    args = parser.parse_args()
    settings = (
        Settings(args.data_dir.expanduser().resolve()) if args.data_dir else Settings.default()
    )
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(f"http://{args.host}:{args.port}")).start()
    uvicorn.run(create_app(settings), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
