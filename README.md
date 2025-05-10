# Floe Staking


Floe is an autonomous agent that analyzes the profitability of Balancer pools and automatically claims and restakes rewards to maximize yield. Built for the Olas SDK Hackathon, Floe is designed to be gas-aware, reward-optimized, and risk-balanced.

## Key Features

- **Strategy Generation**: Analyzes top Balancer pools by liquidity, APR, swap fees, and gauge votes to recommend high-yield staking options.
- **Auto-Compound Automation**: Act on your behalf to automatically claims and restakes rewards.
- **Smart Threshold Analysis**: Considers gas costs, reward amounts, and compound benefits
- **Dashboard Interface**: User-friendly dashboard to monitor and configure the system

## Getting Started

### Prerequisites

- Node.js 18+
- Ethereum wallet with private key (for agent operations)
- Ethereum RPC endpoint

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/floe_staking.git
cd floe_staking

# Install dependencies
npm ci

# Create configuration
cp .env.local
# Edit .env.local with your Ethereum RPC and private key
```

### Configuration

Create a `data/auto_claim_settings.json` file:

```json
{
  "minRewards": 1.0,
  "gasAware": 1.2,
  "compoundAware": 1.5,
  "timePeriod": 4,
  "setAt": "2023-05-10T12:00:00.000Z",
  "walletAddress": "YOUR_WALLET_ADDRESS",
  "useDelegation": false
}
```

### Usage

```bash
# Start web interface
npm run dev

# Run auto-claim check
npm run auto-claim-check

# Start auto-claim scheduler
npm run auto-claim-scheduler

# Run with specific wallet
npm run auto-claim-check:address YOUR_WALLET_ADDRESS
```

### Deploying Delegation Contract

For delegation functionality (optional):

```bash
# Deploy to testnet (recommended first)
npm run deploy:delegator:sepolia

# Deploy to mainnet
npm run deploy:delegator:mainnet
```

After deployment:
1. Copy the contract address to your `.env.local`: `DELEGATION_CONTRACT_ADDRESS=0xYourAddress`
2. Update `auto_claim_settings.json` with `"useDelegation": true` and `"delegationContractAddress": "0xYourAddress"`
3. Call `delegateClaims` function on the contract via Etherscan or web interface

### Docker Deployment

```bash
# Build the Docker image
docker build -t floe_staking .

# Run the container
docker run -e CONNECTION_CONFIGS_CONFIG_PRIVATE_KEY=YOUR_PRIVATE_KEY -e CONNECTION_CONFIGS_CONFIG_ETH_MAINNET_RPC=YOUR_RPC_URL -p 3000:3000 floe_staking
```

## License

ISC License

## Acknowledgments

- Olas Agent Framework
- Balancer Protocol
