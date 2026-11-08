#!/bin/sh
# Docker entrypoint: initialise Solana devnet wallet if available

export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

KEYPAIR_PATH="${SOLANA_KEYPAIR_PATH:-/app/keys/auditor-wallet.json}"
SOLANA_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"

if command -v solana >/dev/null 2>&1; then
  if [ ! -f "$KEYPAIR_PATH" ]; then
    echo "[Solana] Generating new devnet keypair at $KEYPAIR_PATH ..."
    solana-keygen new --no-bip39-passphrase -o "$KEYPAIR_PATH" --silent 2>/dev/null || true
    echo "[Solana] Requesting devnet airdrop..."
    solana airdrop 2 --keypair "$KEYPAIR_PATH" --url "$SOLANA_URL" 2>/dev/null || echo "[Solana] Airdrop rate-limited (normal on devnet — can retry on certify)"
  else
    echo "[Solana] Keypair found at $KEYPAIR_PATH"
  fi
  solana config set --url "$SOLANA_URL" --keypair "$KEYPAIR_PATH" 2>/dev/null || true
  echo "[Solana] Wallet ready."
else
  echo "[Solana] Note: Solana CLI not on PATH; running in mock receipt mode."
fi

exec "$@"
