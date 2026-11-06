# Optional lock for /root/7563. Default is open (path secrecy only).
# On the VPS, add YOUR laptop/office public IP, then deny everyone else:
#   allow 203.0.113.10;
#   deny all;
# Do not allow only the VPS IP — that blocks you from logging in at home.
