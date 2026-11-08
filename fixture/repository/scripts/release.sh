#!/usr/bin/env bash
# Synthetic release helper for the ledgerlite fixture. Does nothing beyond printing the version.
set -euo pipefail
node -e 'console.log(require("./package.json").version)'
