#!/usr/bin/env bash
# Fails if HEAD's files, or the messages of the commits after <base>, name the infrastructure this public repo must
# never mention (CLAUDE.md). The patterns are themselves the secret, so they live outside the repo, in
# $NEWSROOM_INFRA_DENYLIST or ~/.config/aisafety-newsroom/infra-denylist: one Perl regular expression per line, matched
# case-insensitively; "allow <text>" lines name text that may appear even though a pattern matches it (the public
# site's host, say); blank lines and lines starting with # are ignored. Without the file there is nothing to check
# against, and the check says so and passes: a contributor's clone has no list.
#
# Usage: scripts/check-no-infra.sh [<base>]
set -euo pipefail

LIST="${NEWSROOM_INFRA_DENYLIST:-${XDG_CONFIG_HOME:-$HOME/.config}/aisafety-newsroom/infra-denylist}"
BASE="${1:-}"

if [ ! -r "$LIST" ]; then
  echo "No infrastructure denylist at $LIST: nothing to check against"
  exit 0
fi

# Prints each input line that still matches a pattern once the allowed text is taken out of it.
filter() {
  LIST="$LIST" perl -CS -Mutf8 -ne '
    BEGIN {
      open my $fh, "<:encoding(UTF-8)", $ENV{LIST} or die "Cannot read the denylist\n";
      while (my $line = <$fh>) {
        chomp $line;
        next if $line =~ /^\s*(#|$)/;
        if ($line =~ /^allow\s+(.+?)\s*$/) { push @allow, quotemeta $1 } else { push @deny, $line }
      }
      $allow = @allow ? join("|", @allow) : "(?!)";
    }
    my $text = $_;
    $text =~ s/$allow//gi;
    for my $pattern (@deny) { if ($text =~ /$pattern/i) { print; last } }
  '
}

found=0
files="$(git grep -I -n -e '' HEAD -- . ':!pnpm-lock.yaml' | filter || true)"
if [ -n "$files" ]; then
  echo "Infrastructure named in the files (HEAD:path:line):" >&2
  printf '%s\n' "$files" >&2
  found=1
fi
if [ -n "$BASE" ]; then
  messages="$(git log --format='%h %B' "$BASE..HEAD" | filter || true)"
  if [ -n "$messages" ]; then
    echo "Infrastructure named in commit messages after $BASE:" >&2
    printf '%s\n' "$messages" >&2
    found=1
  fi
fi
if [ "$found" = 1 ]; then
  echo "This repo is public: move these details to gitops or scripts/ops.env (CLAUDE.md)." >&2
  exit 1
fi
echo "No infrastructure named in HEAD${BASE:+ or the commits after $BASE}"
