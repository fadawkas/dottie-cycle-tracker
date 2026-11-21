"""Research only: convert the public Creighton CSV on stdin, without writing raw data."""
import csv
import io
import json
import sys

reader = csv.DictReader(io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8-sig", newline=""))
if not {"new_id", "cycle_number", "cycle_length", "conception_cycle"}.issubset(reader.fieldnames or []):
    sys.exit("Expected the Creighton cycle-length CSV.")

users = {}
for row in reader:
    user = int(row["new_id"])
    if user % 2:
        continue  # Match the upstream report's held-out cohort.
    cycle = int(row["cycle_number"])
    raw = row["cycle_length"].strip()
    length = float(raw) if raw else 0
    if row["conception_cycle"].strip().lower() == "yes" or not (15 <= length <= 120 and length.is_integer()):
        length = 0
    users.setdefault(user, []).append((cycle, int(length)))

sequences = []
for rows in users.values():
    previous = None
    segment = []
    for cycle, length in sorted(rows):
        if not length or previous is None or cycle != previous + 1:
            if len(segment) >= 4:
                sequences.append(segment)
            segment = []
        if length:
            segment.append(length)
        previous = cycle
    if len(segment) >= 4:
        sequences.append(segment)

json.dump(sequences, sys.stdout)
