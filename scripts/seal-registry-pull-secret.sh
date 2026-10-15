#!/usr/bin/env bash
# Seals the the registry pull secret alone, for when the robot's secret changes (refreshed in the registry) or was mistyped, without
# regenerating the database passwords and the API token that scripts/seal-gitops-secrets.sh seals with it. Nothing
# secret is printed or written unencrypted.
#
# Usage: scripts/seal-registry-pull-secret.sh <path-to-gitops>
# Run it in a terminal: it asks for the robot's secret (input hidden). Replaces the existing pull secret.
set -euo pipefail

GITOPS="${1:?usage: $0 <path-to-gitops>}"
REGISTRY_ROBOT="${REGISTRY_ROBOT:-robot\$aisafety-newsroom+aisafety-newsroom-pull}"
read -r -a KUBESEAL_ARGS <<<"${KUBESEAL_ARGS:---context "$KUBE_CONTEXT" --controller-namespace sealed-secrets --controller-name sealed-secrets}"

DIR="$GITOPS/clusters/example/resources/apps/aisafety-newsroom/secrets"
OUT="$DIR/aisafety-newsroom-registry-pull.yaml"
[ -d "$DIR" ] || { echo "Not a gitops checkout with aisafety-newsroom: $DIR is missing" >&2; exit 1; }

printf 'the registry secret for %s: ' "$REGISTRY_ROBOT"
IFS= read -rs REGISTRY_SECRET
echo
[ -n "$REGISTRY_SECRET" ] || { echo "Empty the registry secret" >&2; exit 1; }

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
