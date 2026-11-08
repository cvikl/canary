# Canary Cage recording gateway. The only other member of the internal canary-net.
# Answers DNS only for *.canary.canary-lab.io, accepts TLS and plain HTTP, records, forwards nothing.
FROM node:24-slim
COPY gateway/gateway.mjs /opt/gateway/gateway.mjs
ENTRYPOINT ["node", "/opt/gateway/gateway.mjs"]
