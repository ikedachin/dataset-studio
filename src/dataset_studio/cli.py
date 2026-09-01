from __future__ import annotations

import argparse
import threading
import webbrowser
from pathlib import Path

import uvicorn

from dataset_studio.config import ConfigError, Settings
from dataset_studio.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="dataset-studio", description="Edit JSONL datasets safely in your browser"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--config", type=Path, help="Path to a YAML configuration file")
    args = parser.parse_args()
    try:
        settings = Settings.load(data_dir=args.data_dir, config_path=args.config)
    except ConfigError as exc:
        parser.error(str(exc))
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(f"http://{args.host}:{args.port}")).start()
    uvicorn.run(create_app(settings), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
