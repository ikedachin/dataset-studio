from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--records", type=int, default=100_000)
    parser.add_argument("--output", type=Path, default=Path("synthetic-100k.jsonl"))
    args = parser.parse_args()
    with args.output.open("w", encoding="utf-8") as handle:
        for index in range(args.records):
            record = {
                "id": f"synthetic-{index:06d}",
                "question": f"Synthetic question {index}",
                "answer": f"合成データの回答 {index}",
                "metadata": {"index": index, "even": index % 2 == 0},
                "messages": [
                    {"role": "user", "content": f"Question {index}"},
                    {"role": "assistant", "content": f"Answer {index}"},
                ],
            }
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {args.records:,} records to {args.output}")


if __name__ == "__main__":
    main()
