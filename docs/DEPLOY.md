# Deploying the extraction service to Azure

The service (`src/microsoft/server.ts`) needs to run somewhere Power Automate can reach
over HTTPS. Azure Container Apps is the simplest fit. **Your Claude API key goes in as a
secret — never in the repo, never in a flow definition.**

> ⚠️ The API key shared in chat is now in the session transcript. Revoke it at
> console.anthropic.com → API Keys, mint a fresh one, and use the fresh one below.

## Option A — Azure Container Apps (recommended)

```bash
# 1. Build & push the image (Dockerfile is in the repo root)
az acr create -g UMI-PM -n umipmacr --sku Basic
az acr build -r umipmacr -t umi-extract:latest .

# 2. Create the Container App with secrets (paste the FRESH key here, not in git)
az containerapp create \
  -g UMI-PM -n umi-extract \
  --environment umi-pm-env \
  --image umipmacr.azurecr.io/umi-extract:latest \
  --target-port 8787 --ingress external \
  --secrets anthropic-key=<FRESH_ANTHROPIC_KEY> umi-token=<PICK_A_RANDOM_STRING> \
  --env-vars ANTHROPIC_API_KEY=secretref:anthropic-key \
             UMI_EXTRACT_TOKEN=secretref:umi-token \
             UMI_MEMORY_PATH=/data/memory.json

# 3. (Optional but recommended) attach a storage volume at /data so the learning
#    memory survives restarts — see Azure Files volume mounts for Container Apps.
```

The command prints the public URL (e.g. `https://umi-extract.<region>.azurecontainerapps.io`).
That's `<your-host>` in `docs/FLOW_SPECS.md`. The `umi-token` value is what Power Automate
sends as the `x-umi-token` header.

## Verify it's up

```bash
curl https://<your-host>/health
# {"ok":true,"service":"umi-extract"}
```

## Secrets checklist

| Secret | Where it lives | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Container App secret | The fresh key. Rotate the leaked one first. |
| `UMI_EXTRACT_TOKEN` | Container App secret + Power Automate | Shared bearer string; any random value. |

Nothing secret is committed: `.env` is gitignored, the repo only ships `.env.example`
with blank values.
