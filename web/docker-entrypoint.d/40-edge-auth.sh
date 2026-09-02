#!/bin/sh
# Generates the edge HTTP Basic Auth config from environment variables.
# Runs automatically before nginx starts (nginx image /docker-entrypoint.d hook).
#
#   EDGE_AUTH_USER + EDGE_AUTH_PASSWORD set  -> Basic Auth required for the app
#   either one missing                       -> auth disabled (local dev)
set -e

SNIPPET=/etc/nginx/edge-auth.conf
HTPASSWD=/etc/nginx/.htpasswd

if [ -n "${EDGE_AUTH_USER:-}" ] && [ -n "${EDGE_AUTH_PASSWORD:-}" ]; then
    printf '%s:%s\n' "$EDGE_AUTH_USER" "$(openssl passwd -apr1 "$EDGE_AUTH_PASSWORD")" > "$HTPASSWD"
    # Readable by the nginx worker (runs as the unprivileged "nginx" user).
    chmod 644 "$HTPASSWD"
    {
        echo 'auth_basic "TaskBoard — access credentials required";'
        echo "auth_basic_user_file $HTPASSWD;"
    } > "$SNIPPET"
    echo "[edge-auth] Basic Auth ENABLED (user: $EDGE_AUTH_USER)"
else
    echo 'auth_basic off;' > "$SNIPPET"
    echo "[edge-auth] Basic Auth DISABLED (set EDGE_AUTH_USER + EDGE_AUTH_PASSWORD to enable)"
fi
