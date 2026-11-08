# Deploy (Vultr Cloud Compute, Ubuntu 24.04, 2 vCPU 4 GB)

1. Create the VM in the Vultr console, add the SSH public key, note the IP.
2. `ssh root@<ip> 'bash -s' < deploy/setup.sh` installs Docker CE, Node 24, strace, Caddy and the systemd unit.
3. Copy `.env.example` to `.env`, set `VULTR_INFERENCE_KEY`, `OPERATOR_TOKEN`, `PUBLIC_URL`.
4. `SERVER=root@<ip> CADDY_DOMAIN=canary.vantapointlabs.com bash deploy/publish.sh` rsyncs the tree, installs, builds the sandbox and gateway images, restarts the unit, checks `/healthz`.
5. DNS: A record `canary.vantapointlabs.com` to the VM IP. Caddy issues TLS automatically. Until then the IP over HTTP is the public URL.
6. The UI footer shows the Vultr metadata (region, instance id) read from `http://169.254.169.254/v1.json` on the VM.

The orchestrator runs as a systemd service on the host, not in Docker, so `strace -f -p` can attach to container pids without exposing the Docker socket to any container. Containers never see the inference key.
