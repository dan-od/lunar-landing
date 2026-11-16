# The terrain worker: runs the existing Python terrain tool against the shared
# Postgres, one job at a time. Debian slim (not alpine) so rasterio/pyproj
# install from wheels. The maps live in a mounted volume, never in this image.
FROM python:3.12-slim AS runtime
WORKDIR /app/tools/terrain

# curl lets this same image run download_maps.py as a one-off to fill the maps
# volume (mounted read-write for that run); the long-running worker mounts it
# read-only and never downloads.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
COPY tools/terrain/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The worker code and the map catalogue. Maps themselves come from a volume.
COPY tools/terrain/maps.py tools/terrain/maps.json tools/terrain/compute.py \
     tools/terrain/worker.py tools/terrain/download_maps.py ./

ENV TERRAIN_DATA_ROOT=/maps \
    WORKER_HEARTBEAT=/tmp/terrain-worker.alive \
    PYTHONUNBUFFERED=1

# Healthy while the loop keeps touching its heartbeat (within the last 2 min).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD \
  python -c "import os,sys,time; sys.exit(0 if os.path.exists('/tmp/terrain-worker.alive') and time.time()-os.path.getmtime('/tmp/terrain-worker.alive')<120 else 1)"

CMD ["python", "worker.py"]
