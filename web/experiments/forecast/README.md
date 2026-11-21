# Next-period forecast experiment

This offline benchmark uses the same `web/src/forecast.ts` adapter as the app.
It calls the MIT-licensed [Dochia v0.1.1 reference](../../vendor/dochia/README.md)
for the next period start only. It needs four unique logged starts (three completed intervals)
and uses up to six intervals, like the app's median. It returns a point and the
dates inside the model's central 80% interval, or abstains on sufficiently
variable history or unusual gaps. This interval is not a guarantee, a fertility
estimate, or a guide to contraception.

## Run in Docker

From the repository root, with the normal Compose development configuration:

```sh
docker compose build web
docker compose run --rm --no-deps -T web npm run --silent forecast:bench
```

The default input is a small synthetic stress suite for behavior checks. Each
test predicts one cycle ahead using only preceding lengths. `medianAll` scores the
original median baseline on every eligible case; compare `medianPaired` with
`dochiaPaired` for accuracy on the **same** cases. `issuedFraction` measures how
often Dochia made a forecast; `rangeCoverage` and `meanRangeDates` describe
only issued ranges. A case scored as “within three” is three days off or less.

To reproduce the real-data comparison for **noncommercial research**, the public
[Creighton cycle-length dataset](https://doi.org/10.7278/rgp0q-5p086) is
attributed to Stanford and Najmabadi, University of Utah's Hive, and licensed
CC BY-NC 3.0. The command streams the raw CSV through a Docker-only converter; the
repo contains no participant data. The converter matches the upstream even-ID
selection, but also splits at nonconsecutive and missing cycles. It excludes
conception cycles and intervals outside 15–120 days. Do not use personal logs
or redistribute the source data with the app.

```bash
set -o pipefail
curl -fsSL 'https://hive.utah.edu/records/3zhb1-48n69/files/CrMcyclelength_share.csv?download=1' \
  | docker run --rm -i -v "$PWD/web/experiments/forecast/creighton_to_json.py:/convert.py:ro" python:3.12-slim python /convert.py \
  | docker compose run --rm --no-deps -T web npm run --silent forecast:bench -- --stdin
```

## Result and decision

| Point forecast | Evaluations | Mean absolute error | Within 3 days |
|---|---:|---:|---:|
| Previous median, all cases | 721 | 2.53 days | 80.3% |
| Previous median, matched cases | 660 | 2.14 days | 83.6% |
| Dochia, matched cases | 660 | 2.13 days | 84.8% |

Dochia abstained on **61 of 721** cases. Its issued ranges contained the outcome
**82.7%** of the time and spanned **7.5 calendar dates** on average. On the small
synthetic shifting-length fixture, coverage was only **4 of 10**.

**Use the model for ranges and abstention, not an accuracy claim.** Point
accuracy was effectively the same on matched cases. These results are for a selected cohort also used in upstream
validation, not an external replication or evidence of clinical performance.
