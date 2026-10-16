#!/usr/bin/env bash
# Seals the registry pull secret alone, for when the pull robot's secret changes (refreshed in the registry) or was
# mistyped, without regenerating the database passwords and the API token that scripts/seal-gitops-secrets.sh seals
# with it. Before sealing, it asks the registry for a pull token as the cluster will, so a wrong secret, or a robot
# without pull rights, is caught here rather than as a 401 in the cluster. Nothing secret is printed or written
# unencrypted: the secret reaches curl through stdin and kubectl through /dev/fd, never argv. The cluster, the gitops
# layout and the registry come from scripts/ops.env.
#
# Usage: scripts/seal-registry-pull-secret.sh <path-to-gitops>
# Run it in a terminal, from a machine that reaches the registry: it asks for the robot's secret (input hidden).
# Replaces the existing pull secret. CHECK_ONLY=1 checks the secret and seals nothing; REGISTRY_URL overrides where
# the check goes (https://$REGISTRY), for a dry run against a stand-in.
set -euo pipefail

GITOPS="${1:?usage: $0 <path-to-gitops>}"
# shellcheck source-path=SCRIPTDIR source=lib/ops-env.sh
. "$(dirname "$0")/lib/ops-env.sh"
ops_env_require GITOPS_APP_SECRETS_DIR REGISTRY REGISTRY_PULL_ROBOT REGISTRY_PULL_SECRET REGISTRY_PROBE_REPOSITORY
ops_env_kubeseal_args
REGISTRY_URL="${REGISTRY_URL:-https://$REGISTRY}"

DIR="$GITOPS/$GITOPS_APP_SECRETS_DIR"
OUT="$DIR/$REGISTRY_PULL_SECRET.yaml"
[ -d "$DIR" ] || { echo "Not a gitops checkout with aisafety-newsroom: $DIR is missing" >&2; exit 1; }

printf 'Registry secret for %s: ' "$REGISTRY_PULL_ROBOT"
IFS= read -rs REGISTRY_SECRET
echo
[ -n "$REGISTRY_SECRET" ] || { echo "Empty registry secret" >&2; exit 1; }

# The registry's token service, found as the cluster finds it: /v2/ answers 401 with a Bearer challenge naming the
# realm (where tokens come from) and the service.
challenge="$(curl -sS --max-time 15 -o /dev/null -D - "$REGISTRY_URL/v2/" 2>/dev/null | tr -d '\r' |
  sed -n 's/^[Ww][Ww][Ww]-[Aa]uthenticate: *[Bb]earer //p' | head -n 1 || true)"
realm="$(printf '%s' "$challenge" | sed -n 's/.*realm="\([^"]*\)".*/\1/p')"
service="$(printf '%s' "$challenge" | sed -n 's/.*service="\([^"]*\)".*/\1/p')"
if [ -z "$realm" ]; then
  echo "Couldn't reach the registry's token service: is this machine on the network the registry is served on?" >&2
  exit 1
fi

# The token service answers a wrong secret with 401, and a robot without pull rights with a token that grants
# nothing: the registry then answers 401 too, which is all the cluster shows. Telling the two apart here.
answer="$(printf 'user = "%s:%s"\n' "$REGISTRY_PULL_ROBOT" "$REGISTRY_SECRET" |
  curl -sS --max-time 15 -K - -G -w '\n%{http_code}' --data-urlencode "service=$service" \
    --data-urlencode "scope=repository:$REGISTRY_PROBE_REPOSITORY:pull" "$realm" || true)"
status="${answer##*$'\n'}"
case "$status" in
  200)
    granted="$(printf '%s' "${answer%$'\n'*}" | python3 -c '
import base64, json, sys
body = json.load(sys.stdin)
token = body.get("token") or body.get("access_token")
payload = token.split(".")[1]
claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
print(",".join(a for entry in claims.get("access") or [] for a in entry.get("actions", [])))' 2>/dev/null || true)"
    if [[ ",$granted," != *",pull,"* ]]; then
      echo "The registry accepts the secret, but the robot can't pull $REGISTRY_PROBE_REPOSITORY: give it pull rights" >&2
      echo "on the project, then run this again" >&2
      exit 1
    fi
    echo "The registry accepts the secret, and the robot can pull $REGISTRY_PROBE_REPOSITORY"
    ;;
  401)
    echo "The registry refuses this robot and secret: refresh the robot's secret there and paste the new one" >&2
    exit 1
    ;;
  *)
    echo "Couldn't check with the registry (answer: ${status:-none})" >&2
    exit 1
    ;;
esac
if [ -n "${CHECK_ONLY:-}" ]; then
  echo "CHECK_ONLY: nothing sealed"
  exit 0
fi

tmp="$OUT.tmp"
if ! {
  printf '# yamllint disable rule:line-length\n'
  printf '# SealedSecret encryptedData contains long base64 strings that cannot be wrapped.\n'
  printf '# Pull secret for %s/aisafety-newsroom (%s, pull only), on the default SA.\n' "$REGISTRY" "$REGISTRY_PULL_ROBOT"
  kubectl create secret generic "$REGISTRY_PULL_SECRET" -n aisafety-newsroom \
    --type=kubernetes.io/dockerconfigjson \
    --from-file=.dockerconfigjson=<(REGISTRY="$REGISTRY" REGISTRY_PULL_ROBOT="$REGISTRY_PULL_ROBOT" \
      REGISTRY_SECRET="$REGISTRY_SECRET" jq -cn '
      {auths: {(env.REGISTRY): {username: env.REGISTRY_PULL_ROBOT, password: env.REGISTRY_SECRET,
        auth: ("\(env.REGISTRY_PULL_ROBOT):\(env.REGISTRY_SECRET)" | @base64)}}}') \
    --dry-run=client -o yaml \
    | kubeseal "${KUBESEAL_ARGS[@]}" --format yaml \
    | kubectl annotate --local -f - "argocd.argoproj.io/sync-wave=-2" -o yaml
} >"$tmp"; then
  rm -f "$tmp"
  echo "Failed to seal $OUT" >&2
  exit 1
fi
mv "$tmp" "$OUT"
unset REGISTRY_SECRET
echo "sealed $OUT"
echo "Done. Commit and push it in gitops; Argo CD retries the sync on its own once it changes."
