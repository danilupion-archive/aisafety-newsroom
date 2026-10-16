#!/usr/bin/env bash
# Seals the registry pull secret alone, for when the pull robot's secret changes (refreshed in the registry) or was
# mistyped, without regenerating the database passwords and the API token that scripts/seal-gitops-secrets.sh seals
# with it. Before sealing, it asks the registry's token service for a token as the cluster will, so a wrong secret, or
# a robot without pull rights, is caught here rather than as a 401 in the cluster. Nothing secret is printed or written
# unencrypted: the secret reaches curl and jq through stdin and kubectl through /dev/fd, never argv or the environment.
# The cluster, the gitops layout and the registry come from scripts/ops.env.
#
# Usage: scripts/seal-registry-pull-secret.sh <path-to-gitops>
# Run it in a terminal, from a machine that reaches the registry: it asks for the robot's secret (input hidden).
# Replaces the existing pull secret. CHECK_ONLY=1 checks the secret and seals nothing. REGISTRY_URL, from the
# environment, sends the check to a stand-in instead of https://$REGISTRY, for a dry run: it then seals only against a
# throwaway certificate (KUBESEAL_ARGS="--cert …").
set -euo pipefail
set +x # a trace would print the secret
# Never exported to the tools below, even if the caller's shell exports these names.
unset REGISTRY_SECRET secret_q config

GITOPS="${1:?usage: $0 <path-to-gitops>}"
# shellcheck source-path=SCRIPTDIR source=lib/ops-env.sh
. "$(dirname "$0")/lib/ops-env.sh"
ops_env_require GITOPS_APP_SECRETS_DIR REGISTRY REGISTRY_PULL_ROBOT REGISTRY_PULL_SECRET REGISTRY_PROBE_REPOSITORY
ops_env_kubeseal_args
for tool in curl jq kubectl kubeseal; do
  command -v "$tool" >/dev/null || { echo "$tool is missing" >&2; exit 1; }
done

DIR="$GITOPS/$GITOPS_APP_SECRETS_DIR"
OUT="$DIR/$REGISTRY_PULL_SECRET.yaml"
[ -d "$DIR" ] || { echo "Not a gitops checkout with aisafety-newsroom: $DIR is missing" >&2; exit 1; }

# curl only over HTTPS, and never reading ~/.curlrc (-q, first), which could log the Authorization header. A stand-in
# (REGISTRY_URL) may be plain HTTP.
curl_opts=(-q -sS --max-time 15)
if [ -n "${REGISTRY_URL:-}" ]; then
  REGISTRY_URL="${REGISTRY_URL%/}"
  echo "Checking against $REGISTRY_URL (REGISTRY_URL), not the registry"
  if [ -z "${CHECK_ONLY:-}" ] && [[ " ${KUBESEAL_ARGS[*]} " != *" --cert "* ]]; then
    echo "REGISTRY_URL is for dry runs: seal against a throwaway certificate (KUBESEAL_ARGS=\"--cert …\")," >&2
    echo "or unset it" >&2
    exit 1
  fi
else
  REGISTRY_URL="https://$REGISTRY"
  curl_opts+=(--proto =https --proto-redir =https)
fi

printf 'Registry secret for %s: ' "$REGISTRY_PULL_ROBOT"
IFS= read -rs REGISTRY_SECRET || true
echo
[ -n "$REGISTRY_SECRET" ] || { echo "Empty registry secret" >&2; exit 1; }

# The registry's token service, found as the cluster finds it: /v2/ answers 401 with a Bearer challenge naming the
# realm (where tokens come from) and the service.
headers="$(curl "${curl_opts[@]}" -o /dev/null -D - "$REGISTRY_URL/v2/" | tr -d '\r')" || {
  echo "Couldn't reach the registry ($REGISTRY_URL/v2/): is this machine on the network the registry is served on?" >&2
  exit 1
}
challenge="$(sed -n 's/^[Ww][Ww][Ww]-[Aa]uthenticate: *[Bb]earer //p' <<<"$headers" | head -n 1)"
realm="$(sed -n 's/.*realm="\([^"]*\)".*/\1/p' <<<"$challenge")"
service="$(sed -n 's/.*service="\([^"]*\)".*/\1/p' <<<"$challenge")"
if [ -z "$realm" ]; then
  echo "No Bearer challenge from $REGISTRY_URL/v2/ ($(head -n 1 <<<"$headers")): is that the registry?" >&2
  exit 1
fi
# The credentials go only to the registry itself, whatever realm it names.
if [[ "$realm" != "$REGISTRY_URL"/* ]]; then
  echo "The registry names a token service elsewhere ($realm): not sending the secret there" >&2
  exit 1
fi

# token_request [scope]: the answer's body, a new line, and its HTTP status. The credentials go through curl's config
# on stdin, quoted as its format wants (\ and " escaped).
robot_q="${REGISTRY_PULL_ROBOT//\\/\\\\}"
robot_q="${robot_q//\"/\\\"}"
secret_q="${REGISTRY_SECRET//\\/\\\\}"
secret_q="${secret_q//\"/\\\"}"
token_request() {
  local scope_args=()
  [ -z "${1:-}" ] || scope_args=(--data-urlencode "scope=$1")
  printf 'user = "%s:%s"\n' "$robot_q" "$secret_q" |
    curl "${curl_opts[@]}" -K - -G -w '\n%{http_code}' --data-urlencode "service=$service" \
      ${scope_args[@]+"${scope_args[@]}"} --url "$realm" || true
}

# First without a scope, as `docker login` asks: only then does the token service answer a wrong secret, or a disabled
# or expired robot, with 401. With a scope it hands out an anonymous token instead, which grants only what anonymous
# users get: on a project they may pull from, a wrong secret would pass.
answer="$(token_request)"
case "${answer##*$'\n'}" in
  200) ;;
  401)
    echo "The registry refuses this robot and secret: refresh the robot's secret there (and its expiry, if it" >&2
    echo "lapsed) and paste the new one" >&2
    exit 1
    ;;
  *)
    echo "Couldn't check with the registry (answer: ${answer##*$'\n'})" >&2
    exit 1
    ;;
esac

# Then with the probe's pull scope: the token must be the robot's, not anonymous, and grant pull on the probe itself,
# not on any repository. The token is a JWT: its claims are the middle part, in unpadded base64url.
answer="$(token_request "repository:$REGISTRY_PROBE_REPOSITORY:pull")"
[ "${answer##*$'\n'}" = 200 ] || { echo "Couldn't get a pull token (answer: ${answer##*$'\n'})" >&2; exit 1; }
claims="$(printf '%s' "${answer%$'\n'*}" | jq -er --arg probe "$REGISTRY_PROBE_REPOSITORY" '
  (.token // .access_token) | split(".")[1] | gsub("-"; "+") | gsub("_"; "/")
  | . as $p | $p + ("===" | .[0:((4 - ($p | length) % 4) % 4)]) | @base64d | fromjson
  | (.sub // ""),
    ([.access[]? | select(.type == "repository" and .name == $probe) | .actions[]?] | join(","))' 2>/dev/null)" ||
  { echo "Couldn't read the registry's token" >&2; exit 1; }
subject="$(head -n 1 <<<"$claims")"
granted="$(sed -n 2p <<<"$claims")"
# The subject is the robot's name, with or without the registry's robot prefix (robot$ by default).
if [ -z "$subject" ] ||
  { [ "$subject" != "$REGISTRY_PULL_ROBOT" ] && [ "$subject" != "${REGISTRY_PULL_ROBOT#*\$}" ]; }; then
  echo "The registry didn't issue the token to $REGISTRY_PULL_ROBOT (${subject:-anonymous}): it refuses this" >&2
  echo "secret" >&2
  exit 1
fi
if [[ ",$granted," != *",pull,"* ]]; then
  echo "The registry accepts the secret, but the robot can't pull $REGISTRY_PROBE_REPOSITORY: give it pull rights" >&2
  echo "on the project, then run this again" >&2
  exit 1
fi
echo "The registry accepts the secret, and the robot can pull $REGISTRY_PROBE_REPOSITORY"
if [ -n "${CHECK_ONLY:-}" ]; then
  echo "CHECK_ONLY: nothing sealed"
  exit 0
fi

# Built before sealing, so a failure stops here rather than sealing an empty config.
config="$(printf '%s' "$REGISTRY_SECRET" | jq -Rsc --arg host "$REGISTRY" --arg robot "$REGISTRY_PULL_ROBOT" '
  {auths: {($host): {username: $robot, password: ., auth: ("\($robot):\(.)" | @base64)}}}')"
unset REGISTRY_SECRET secret_q

tmp="$OUT.tmp"
trap 'rm -f "$tmp"' EXIT
if ! {
  printf '# yamllint disable rule:line-length\n'
  printf '# SealedSecret encryptedData contains long base64 strings that cannot be wrapped.\n'
  printf '# Pull secret for %s/aisafety-newsroom (%s, pull only), on the default SA.\n' \
    "$REGISTRY" "$REGISTRY_PULL_ROBOT"
  kubectl create secret generic "$REGISTRY_PULL_SECRET" -n aisafety-newsroom \
    --type=kubernetes.io/dockerconfigjson \
    --from-file=.dockerconfigjson=<(printf '%s' "$config") --dry-run=client -o yaml \
    | kubeseal "${KUBESEAL_ARGS[@]}" --format yaml \
    | kubectl annotate --local -f - "argocd.argoproj.io/sync-wave=-2" -o yaml
} >"$tmp" || ! grep -q '^kind: SealedSecret$' "$tmp" || ! grep -q '^ *\.dockerconfigjson: ' "$tmp"; then
  echo "Failed to seal $OUT" >&2
  exit 1
fi
mv "$tmp" "$OUT"
echo "sealed $OUT"
echo "Done. Commit and push it in gitops; Argo CD retries the sync on its own once it changes."
