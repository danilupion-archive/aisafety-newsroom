# shellcheck shell=bash
# Sourced by the seal scripts: the infrastructure they work with (cluster, gitops layout, registry, in-cluster hosts)
# comes from scripts/ops.env, which git ignores, so none of it is in this repo. scripts/ops.env.example shows the keys.
#
# Loads the file (OPS_ENV_FILE overrides its path) without overriding what the environment already sets, then
# ops_env_require checks the keys a script needs and ops_env_kubeseal_args builds kubeseal's arguments. Errors name
# keys and line numbers, never values. The file is read, not sourced: nothing in it runs, and `$` is a plain character.
# Its keys become shell variables, not exported: tools see only what a script passes them (kubeseal, for one, takes
# any SEALED_SECRETS_* variable in its environment as a flag).

OPS_ENV_FILE="${OPS_ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/ops.env}"

if [ -f "$OPS_ENV_FILE" ]; then
  ops_env_line=0
  while IFS= read -r ops_env_entry || [ -n "$ops_env_entry" ]; do
    ops_env_line=$((ops_env_line + 1))
    case "$ops_env_entry" in '' | '#'*) continue ;; esac
    ops_env_key="${ops_env_entry%%=*}"
    if [ "$ops_env_key" = "$ops_env_entry" ] || [[ ! "$ops_env_key" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
      echo "$OPS_ENV_FILE, line $ops_env_line: expected KEY=value" >&2
      exit 1
    fi
    ops_env_value="${ops_env_entry#*=}"
    # Quotes around the whole value are dropped, so the file also works with `set -a; . scripts/ops.env; set +a`.
    if [[ "$ops_env_value" =~ ^\'(.*)\'$ ]] || [[ "$ops_env_value" =~ ^\"(.*)\"$ ]]; then
      ops_env_value="${BASH_REMATCH[1]}"
    fi
    if [ -z "${!ops_env_key+set}" ]; then
      printf -v "$ops_env_key" '%s' "$ops_env_value"
    fi
  done <"$OPS_ENV_FILE"
  unset ops_env_line ops_env_entry ops_env_key ops_env_value
fi

# ops_env_require <KEY>...: exits naming every key that is unset or empty.
ops_env_require() {
  local name missing=()
  for name in "$@"; do
    [ -n "${!name:-}" ] || missing+=("$name")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Not set in $OPS_ENV_FILE or the environment: ${missing[*]} (scripts/ops.env.example shows each)" >&2
    exit 1
  fi
}

# ops_env_kubeseal_args: sets the array KUBESEAL_ARGS. A KUBESEAL_ARGS string already in the environment wins, for a
# dry run against a throwaway certificate (KUBESEAL_ARGS="--cert cert.pem"); otherwise the cluster's controller.
ops_env_kubeseal_args() {
  if [ -n "${KUBESEAL_ARGS:-}" ]; then
    read -r -a KUBESEAL_ARGS <<<"$KUBESEAL_ARGS"
  else
    ops_env_require KUBE_CONTEXT SEAL_CONTROLLER_NAMESPACE SEAL_CONTROLLER_NAME
    KUBESEAL_ARGS=(--context "$KUBE_CONTEXT" --controller-namespace "$SEAL_CONTROLLER_NAMESPACE"
      --controller-name "$SEAL_CONTROLLER_NAME")
  fi
}
