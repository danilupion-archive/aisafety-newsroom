#!/usr/bin/env bash
# Rotates the API token (R-API-2): generates a new one, seals it for the cluster into a gitops checkout (replacing the
# old), and stores it in the macOS Keychain for tools/newsroom.py in aisafety-media (R-MED-1). Nothing secret is
# printed or written unencrypted: the token lives in a shell variable and reaches kubectl through /dev/fd and the
# Keychain through `security`'s prompt mode, never argv. The cluster and the gitops layout come from scripts/ops.env.
#
# Usage: scripts/seal-api-token.sh <path-to-gitops>
# Then commit and push it in gitops, and restart the API so it reads the new secret (docs/runbooks/api-token.md).
set -euo pipefail

GITOPS="${1:?usage: $0 <path-to-gitops>}"
# shellcheck source-path=SCRIPTDIR source=lib/ops-env.sh
. "$(dirname "$0")/lib/ops-env.sh"
ops_env_require GITOPS_APP_SECRETS_DIR
ops_env_kubeseal_args
KEYCHAIN_SERVICE=aisafety-newsroom
KEYCHAIN_ACCOUNT=api-token

DIR="$GITOPS/$GITOPS_APP_SECRETS_DIR"
OUT="$DIR/aisafety-newsroom-api-token.yaml"
[ -d "$DIR" ] || { echo "Not a gitops checkout with aisafety-newsroom: $DIR is missing" >&2; exit 1; }
if [ "${KEYCHAIN:-}" != skip ] && ! command -v security >/dev/null; then
  echo "No macOS Keychain here: run with KEYCHAIN=skip, and read the token from the cluster later" >&2
  exit 1
fi

# 256 bits (R-API-2): 64 hex characters, over the API's minimum of 43.
api_token="$(openssl rand -hex 32)"

tmp="$OUT.tmp"
if ! {
  printf '# yamllint disable rule:line-length\n'
  printf '# SealedSecret encryptedData contains long base64 strings that cannot be wrapped.\n'
  printf '# API_TOKEN: the bearer token for /api/v1 (R-API-2; openssl rand -hex 32). aisafety-media keeps it in the Keychain.\n'
  kubectl create secret generic aisafety-newsroom-api-token -n aisafety-newsroom \
    --from-file=API_TOKEN=<(printf %s "$api_token") --dry-run=client -o yaml \
    | kubeseal "${KUBESEAL_ARGS[@]}" --format yaml \
    | kubectl annotate --local -f - "argocd.argoproj.io/sync-wave=-2" -o yaml
} >"$tmp"; then
  rm -f "$tmp"
  echo "Failed to seal $OUT" >&2
  exit 1
fi
mv "$tmp" "$OUT"
echo "sealed $OUT"

if [ "${KEYCHAIN:-}" != skip ]; then
  printf 'add-generic-password -U -s %s -a %s -l "aisafety-newsroom API token" -w %s\n' \
    "$KEYCHAIN_SERVICE" "$KEYCHAIN_ACCOUNT" "$api_token" | security -i >/dev/null
  echo "stored the new token in the Keychain (service $KEYCHAIN_SERVICE, account $KEYCHAIN_ACCOUNT)"
fi
unset api_token
echo "Done. Commit and push it in gitops, then restart the API (docs/runbooks/api-token.md)."
