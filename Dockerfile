# ── Multi-stage Dockerfile ─────────────────────────────────────────────────────
# Stage 1: Python backend + Solana CLI
# Stage 2: Next.js frontend build (added when frontend/ is ready)
# Final: Combined runtime image

FROM python:3.13-slim AS backend

# Install system dependencies + Solana CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates bzip2 && \
    # Install Solana CLI (latest stable)
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY pipeline/  ./pipeline/
COPY backend/   ./backend/
COPY cache/     ./cache/

# Generate devnet keypair on first start (if not mounted)
RUN mkdir -p /app/keys

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

