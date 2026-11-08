# Canary Cage sandbox image. Contains Node 24, the probe harness, the SYNTHETIC
# @canary-lab/repo-assistant MCP server and the synthetic repository.
# Per-run inputs (probe, run.json, bait files) are bind-mounted read-only at /run-input
# and reached through fixed symlinks, so the image digest is identical across runs.
FROM node:24-slim
RUN groupadd -g 10001 mcp && useradd -m -u 10001 -g 10001 -s /usr/sbin/nologin mcp \
 && mkdir -p /opt/sandbox/node_modules/@canary-cage /opt/sandbox/node_modules/@canary-lab /workspace /etc/repo-assistant /home/mcp/.ssh /run-input \
 && chown -R 10001:10001 /home/mcp
COPY --chown=0:0 harness/ /opt/sandbox/node_modules/@canary-cage/harness/
COPY --chown=0:0 fixture/package.json fixture/server.mjs /opt/sandbox/node_modules/@canary-lab/repo-assistant/
COPY --chown=0:0 fixture/bin/repo-assistant.mjs /opt/sandbox/node_modules/@canary-lab/repo-assistant/bin/repo-assistant.mjs
COPY --chown=0:0 fixture/repository/ /workspace/repository/
RUN ln -s /opt/sandbox/node_modules/@canary-lab/repo-assistant/bin/repo-assistant.mjs /usr/local/bin/repo-assistant \
 && ln -s /run-input/probe /opt/sandbox/probe \
 && ln -s /run-input/run.json /etc/repo-assistant/run.json \
 && ln -s /run-input/bait/.env /workspace/.env \
 && ln -s /run-input/bait/id_rsa /home/mcp/.ssh/id_rsa \
 && printf '#!/bin/sh\n# wait for the host to attach the tracer, then run the frozen probe\nread -r _go\nexec node --preserve-symlinks --preserve-symlinks-main /opt/sandbox/probe/probe.mjs\n' > /usr/local/bin/launch \
 && chmod 755 /usr/local/bin/launch /opt/sandbox/node_modules/@canary-lab/repo-assistant/bin/repo-assistant.mjs
USER 10001:10001
WORKDIR /opt/sandbox
ENTRYPOINT ["/usr/local/bin/launch"]
