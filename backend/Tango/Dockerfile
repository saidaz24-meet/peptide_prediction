FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/Tango
# No COPY needed; we will volume-mount the host Tango dir at runtime.
ENTRYPOINT ["/bin/bash","-lc"]
