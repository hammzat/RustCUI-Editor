# Relay for claude.ai connectors. Build from the repo root:
#   docker build -f mcp/Dockerfile -t rustcui-relay .
#   docker run -p 8787:8787 rustcui-relay
FROM node:22-alpine
WORKDIR /app
RUN npm init -y >/dev/null && npm install --omit=dev @modelcontextprotocol/sdk@1.31.0 ws@8.22.0
COPY mcp/core.mjs mcp/relay.mjs mcp/
COPY src/lib/ai/tools.json src/lib/ai/tools.json
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["node", "mcp/relay.mjs"]
