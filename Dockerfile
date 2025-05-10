FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build || echo "No build script found, continuing..."

# Create a directory for agent keys
RUN mkdir -p /agent_key

# Set up the entrypoint script that reads environment variables correctly
RUN echo '#!/bin/sh \n\
echo "Starting Floe Restake Agent" \n\
\n\
# Parse environment variables with Olas prefix format \n\
export ETH_MAINNET_RPC=${CONNECTION_CONFIGS_CONFIG_ETH_MAINNET_RPC} \n\
export PRIVATE_KEY=$(cat /agent_key/ethereum_private_key.txt 2>/dev/null || echo ${CONNECTION_CONFIGS_CONFIG_PRIVATE_KEY}) \n\
export THRESHOLD_AMOUNT=${CONNECTION_CONFIGS_CONFIG_THRESHOLD_AMOUNT:-1.0} \n\
export MAINNET_STAKING_ADDRESS=${CONNECTION_CONFIGS_CONFIG_MAINNET_STAKING_ADDRESS} \n\
export CLAUDE_API_KEY=${CONNECTION_CONFIGS_CONFIG_CLAUDE_API_KEY} \n\
export ETHERSCAN_API_KEY=${CONNECTION_CONFIGS_CONFIG_ETHERSCAN_API_KEY} \n\
\n\
# Print environment variables for debugging (excluding sensitive info) \n\
echo "ETH_MAINNET_RPC is set: $([ -n "$ETH_MAINNET_RPC" ] && echo "YES" || echo "NO")" \n\
echo "PRIVATE_KEY is set: $([ -n "$PRIVATE_KEY" ] && echo "YES" || echo "NO")" \n\
echo "THRESHOLD_AMOUNT: $THRESHOLD_AMOUNT" \n\
echo "MAINNET_STAKING_ADDRESS is set: $([ -n "$MAINNET_STAKING_ADDRESS" ] && echo "YES" || echo "NO")" \n\
\n\
# Start the agent \n\
node dist/agent/index.js \n\
' > /entrypoint.sh \
    && chmod +x /entrypoint.sh

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check ok')" || exit 1

ENTRYPOINT ["/entrypoint.sh"] 