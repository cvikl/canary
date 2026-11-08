import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadDotEnv(): void {
  const file = resolve(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

const env = (k: string, d = ""): string => process.env[k] ?? d;

export const config = {
  vultrKey: env("VULTR_INFERENCE_KEY"),
  vultrBaseUrl: env("VULTR_INFERENCE_BASE_URL", "https://api.vultrinference.com/v1"),
  model: env("VULTR_MODEL", "deepseek-v4.1-flash-1017"),
  modelRepair: env("VULTR_MODEL_REPAIR", "glm-5.3"),
  publicUrl: env("PUBLIC_URL", "http://127.0.0.1:8080"),
  operatorToken: env("OPERATOR_TOKEN", ""),
  dailyInferenceBudget: Number(env("DAILY_INFERENCE_BUDGET", "400")),
  maxRunSeconds: Number(env("MAX_RUN_SECONDS", "20")),
  fakeLlm: env("CANARY_FAKE_LLM", "0") === "1",
  port: Number(env("PORT", "8080")),
  dataDir: resolve(ROOT, env("CANARY_DATA_DIR", "data")),
  localDir: resolve(ROOT, ".local"),
  sandboxImage: env("CANARY_SANDBOX_IMAGE", "canary-cage/sandbox:dev"),
  gatewayImage: env("CANARY_GATEWAY_IMAGE", "canary-cage/gateway:dev"),
  network: env("CANARY_NETWORK", "canary-net"),
  networkSubnet: env("CANARY_NETWORK_SUBNET", "10.77.0.0/24"),
  networkDynamicRange: env("CANARY_NETWORK_DYNAMIC_RANGE", "10.77.0.128/25"),
  gatewayIp: env("CANARY_GATEWAY_IP", "10.77.0.2"),
  canarySuffix: "canary.canary-lab.io",
  traceDisabled: env("CANARY_NO_STRACE", "0") === "1",
};

for (const d of [config.dataDir, resolve(config.dataDir, "runs"), config.localDir]) mkdirSync(d, { recursive: true });
