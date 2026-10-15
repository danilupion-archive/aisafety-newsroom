#!/usr/bin/env bash
# Seals the the registry pull secret alone, for when the robot's secret changes (refreshed in the registry) or was mistyped, without
# regenerating the database passwords and the API token that scripts/seal-gitops-secrets.sh seals with it. Before
# sealing, it asks the registry for a pull token as the cluster will, so a wrong secret, or a robot without pull rights, is
# caught here rather than as a 401 in the cluster. Nothing secret is printed or written unencrypted: the secret reaches
# curl through stdin and kubectl through /dev/fd, never argv.
#
# Usage: scripts/seal-registry-pull-secret.sh <path-to-gitops>
# Run it in a terminal, on the private network (the registry is on the private gateway): it asks for the robot's secret (input
# hidden). Replaces the existing pull secret. CHECK_ONLY=1 checks the secret and seals nothing.
set -euo pipefail

GITOPS="${1:?usage: $0 <path-to-gitops>}"
REGISTRY_ROBOT="${REGISTRY_ROBOT:-robot\$aisafety-newsroom+aisafety-newsroom-pull}"
REGISTRY_URL="${REGISTRY_URL:-https://registry.example.test}"
REGISTRY_REPOSITORY="${REGISTRY_REPOSITORY:-aisafety-newsroom/migrations}"
read -r -a KUBESEAL_ARGS <<<"${KUBESEAL_ARGS:---context "$KUBE_CONTEXT" --controller-namespace sealed-secrets --controller-name sealed-secrets}"

DIR="$GITOPS/clusters/example/resources/apps/aisafety-newsroom/secrets"
OUT="$DIR/aisafety-newsroom-registry-pull.yaml"
[ -d "$DIR" ] || { echo "Not a gitops checkout with aisafety-newsroom: $DIR is missing" >&2; exit 1; }

printf 'the registry secret for %s: ' "$REGISTRY_ROBOT"
IFS= read -rs REGISTRY_SECRET
echo
[ -n "$REGISTRY_SECRET" ] || { echo "Empty the registry secret" >&2; exit 1; }

# the registry's token service answers a wrong secret with 401, and a robot without pull rights with a token that grants
# nothing: the registry then answers 401 too, which is all the cluster shows. Telling the two apart here.
answer="$(printf 'user = "%s:%s"\n' "$REGISTRY_ROBOT" "$REGISTRY_SECRET" |
  curl -sS --max-time 15 -K - -w '\n%{http_code}' \
    "$REGISTRY_URL/service/token?service=registry&scope=repository:$REGISTRY_REPOSITORY:pull" || true)"
status="${answer##*$'\n'}"
case "$status" in
  200)
    granted="$(printf '%s' "${answer%$'\n'*}" | python3 -c '
import base64, json, sys
token = json.load(sys.stdin)["token"]
payload = token.split(".")[1]
claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
print(",".join(a for entry in claims.get("access") or [] for a in entry.get("actions", [])))' 2>/dev/null || true)"
    if [[ ",$granted," != *",pull,"* ]]; then
      echo "the registry accepts the secret, but the robot can't pull $REGISTRY_REPOSITORY: give it Repository: Pull on" >&2
      echo "the project, then run this again" >&2
      exit 1
    fi
    echo "the registry accepts the secret, and the robot can pull $REGISTRY_REPOSITORY"
    ;;
  401)
    echo "the registry refuses this robot and secret: refresh the robot's secret in the registry and paste the new one" >&2
    exit 1
    ;;
  *)
    echo "Couldn't check with the registry (answer: ${status:-none}); are you on the private network?" >&2
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
  printf '# Pull secret for registry.example.test/aisafety-newsroom (%s, pull only), on the default SA.\n' "$REGISTRY_ROBOT"
  kubectl create secret generic aisafety-newsroom-registry-pull -n aisafety-newsroom \
    --type=kubernetes.io/dockerconfigjson \
    --from-file=.dockerconfigjson=<(REGISTRY_ROBOT="$REGISTRY_ROBOT" REGISTRY_SECRET="$REGISTRY_SECRET" jq -cn '
      {auths: {"registry.example.test": {username: env.REGISTRY_ROBOT, password: env.REGISTRY_SECRET,
        auth: ("\(env.REGISTRY_ROBOT):\(env.REGISTRY_SECRET)" | @base64)}}}') \
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
