# SylOS Smart Contracts

A comprehensive suite of smart contracts for the SylOS blockchain operating system, featuring tokenomics, productivity tracking, governance, and gasless transactions.

## 🏗️ Architecture

The SylOS smart contract ecosystem consists of five main components:

1. **SylOSToken** - Base ERC-20 token with minting/burning and tax mechanisms
2. **WrappedSYLOS** - Staking and reward distribution system for PoP rewards
3. **PoPTracker** - Productivity verification and reward distribution
4. **MetaTransactionPaymaster** - Gasless transaction infrastructure
5. **SylOSGovernance** - DAO governance with proposal and voting system

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/sylos/smart-contracts.git
cd smart-contracts

# Install dependencies
npm install

# Compile contracts
npm run build

# Run tests
npm test
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Network URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
POLYGON_RPC_URL=https://polygon-rpc.com/
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com/

# Private key for deployment
PRIVATE_KEY=0xyour_private_key_here

# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key
```

### Deployment

```bash
# Deploy to hardhat local network
npm run deploy

# Deploy to Sepolia testnet
npm run deploy:testnet

# Deploy to mainnet (use with caution)
npm run deploy:mainnet
```

## 📋 Contract Details

### SylOSToken (SYLOS)

**Purpose**: Base ERC-20 token for the SylOS ecosystem

**Key Features**:
- Minting and burning capabilities
- Tax collection system (2.5% default)
- Anti-bot protection
- Pausable operations
- Role-based access control

**Key Functions**:
```solidity
// Mint tokens
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE);

// Burn tokens
function burn(uint256 amount) external;

// Transfer with tax collection
function transfer(address to, uint256 amount) public override returns (bool);

// Update tax rate
function updateTaxRate(uint256 newTaxRate) external onlyRole(TAX_MANAGER_ROLE);
```

### WrappedSYLOS (wSYLOS)

**Purpose**: Wrapper token for staking and PoP reward distribution

**Key Features**:
- 1:1 wrapping of SYLOS tokens
- Time-locked staking bonuses
- Automatic reward distribution
- Multi-tier bonus system
- Emergency recovery functions

**Key Functions**:
```solidity
// Wrap SYLOS tokens
function wrap(uint256 amount) external;

// Unwrap wSYLOS tokens
function unwrap(uint256 amount) external;

// Time-lock tokens for bonus rewards
function timeLock(uint256 amount, uint256 lockDurationIndex) external;

// Claim accumulated rewards
function claimRewards() external;

// Get pending rewards
function getPendingRewards(address user) external view returns (uint256);
```

### PoPTracker

**Purpose**: Productivity tracking and reward distribution system

**Key Features**:
- Multi-criteria productivity scoring
- Task creation and completion tracking
- Peer review and validation
- Reward distribution based on productivity
- Time-based assessment cycles

**Key Functions**:
```solidity
// Create a new task
function createTask(string calldata taskDescription, uint256 estimatedHours, uint256 complexity) 
    external onlyRole(MANAGER_ROLE) returns (uint256 taskId);

// Complete a task
function completeTask(uint256 taskId, uint256 actualHours, uint256 qualityScore, string calldata deliverableHash) 
    external;

// Record productivity metrics
function recordProductivity(address user, ProductivityMetrics calldata metrics, string calldata evidence) 
    external onlyRole(VERIFIER_ROLE);

// Distribute rewards
function distributeRewards() external onlyRole(MANAGER_ROLE);
```

### MetaTransactionPaymaster

**Purpose**: Enable gasless transactions for improved user experience

**Key Features**:
- ERC-20 token-based payment system
- Rate limiting and quotas
- Whitelist/Blacklist management
- Multiple payment token support
- Emergency controls

**Key Functions**:
```solidity
// Execute a meta transaction
function executeMetaTransaction(
    address user,
    bytes calldata signature,
    MetaTransaction calldata metaTx
) external nonReentrant returns (bytes memory result);

// Add payment token
function addPaymentToken(address token, uint256 gasPrice, string calldata name, string calldata symbol) 
    external onlyRole(MANAGER_ROLE);

// Set user whitelist
function setWhitelist(address user, bool isWhitelisted, uint256 monthlyQuota) 
    external onlyRole(MANAGER_ROLE);
```

### SylOSGovernance

**Purpose**: DAO governance system for protocol decisions

**Key Features**:
- Proposal creation and voting
- Quorum and threshold requirements
- Timelock for proposal execution
- Delegation system
- Emergency governance functions

**Key Functions**:
```solidity
// Create a proposal
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory title,
    string memory description,
    string memory evidence
) public returns (uint256);

// Vote on a proposal
function vote(uint256 proposalId, uint8 support, string calldata reason) public;

// Execute a proposal
function execute(uint256 proposalId) public payable;

// Delegate voting power
function delegate(address delegatee) public;

// Lock funds for governance participation
function lockFunds(uint256 amount) external;
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx hardhat test test/SylOSToken.test.js
```

### Test Structure

- **Unit Tests**: Test individual contract functions
- **Integration Tests**: Test contract interactions
- **Security Tests**: Test edge cases and attack vectors
- **Gas Tests**: Test gas efficiency

### Test Coverage

The project aims for >95% test coverage on all smart contracts. Coverage reports are generated using the `npm run test:coverage` command.

## 🔒 Security

### Security Features

- **Reentrancy Protection**: All state-changing functions use ReentrancyGuard
- **Access Control**: Role-based permissions using OpenZeppelin's AccessControl
- **Pausable**: Emergency pause functionality on all critical contracts
- **Input Validation**: Comprehensive input validation on all external functions
- **Safe Math**: Using SafeMath for arithmetic operations
- **Emergency Recovery**: Functions to recover accidentally sent tokens

### Security Audits

- All contracts follow OpenZeppelin security best practices
- Comprehensive test suite covering edge cases
- Static analysis using Slither (if available)
- Gas optimization and security analysis

### Reporting Security Issues

Please do not report security vulnerabilities through public GitHub issues. Instead:

1. Email: security@sylos.io
2. Include all relevant details
3. Allow reasonable time for response

## 🏛️ Governance

### Governance Structure

The SylOS protocol is governed by token holders through a DAO structure:

- **Proposal Threshold**: 1,000 SYLOS tokens
- **Voting Period**: 3 days
- **Quorum**: 10,000 SYLOS tokens
- **Execution Delay**: 2 days
- **Emergency Threshold**: 50,000 SYLOS tokens

### Governance Roles

- **Admin**: Full control over protocol settings
- **Manager**: Can create and manage tasks, update system parameters
- **Verifier**: Can verify productivity records
- **Validator**: Can validate productivity records
- **Governor**: Can participate in governance

### Making Proposals

1. Lock 1,000+ SYLOS tokens
2. Create a detailed proposal
3. Wait for voting period (3 days)
4. If quorum is met and majority votes for, execute after delay

## 💰 Tokenomics

### SYLOS Token

- **Total Supply**: Initial 1,000,000 tokens
- **Tax Rate**: 2.5% on all transfers
- **Tax Distribution**: 80% to general treasury, 20% to liquidity
- **Minting**: Controlled by MINTER_ROLE
- **Burning**: Available to all token holders

### Reward Distribution

- **PoP Rewards**: Distributed based on productivity metrics
- **Staking Rewards**: Time-locked bonuses for long-term holders
- **Governance Rewards**: Voting power for active participants

## 🔧 Development

### Project Structure

```
smart-contracts/
├── contracts/          # Smart contract source files
│   ├── SylOSToken.sol
│   ├── WrappedSYLOS.sol
│   ├── PoPTracker.sol
│   ├── MetaTransactionPaymaster.sol
│   └── SylOSGovernance.sol
├── scripts/            # Deployment and utility scripts
│   └── deploy.js
├── test/              # Test files
│   ├── SylOSToken.test.js
│   └── SylOS-Integration.js
├── artifacts/         # Compiled contract artifacts
├── cache/            # Cache files
└── docs/             # Additional documentation
```

### Compilation

```bash
# Compile all contracts
npm run build

# Clean build artifacts
npm run clean
```

### Gas Reporting

```bash
# Generate gas report
REPORT_GAS=1 npm test
```

### Code Quality

```bash
# Format code with Prettier
npm run lint:fix

# Check code style
npm run lint
```

## 🌐 Networks

### Supported Networks

- **Hardhat Local**: For development and testing
- **Sepolia**: Ethereum testnet for testing
- **Mainnet**: Production deployment
- **Polygon**: Layer 2 deployment option
- **Mumbai**: Polygon testnet

### Network Configuration

Network configurations are defined in `hardhat.config.js`. Add new networks as needed.

## 📚 API Reference

### Contract Addresses

After deployment, contract addresses are logged to the console and can be found in the deployment script output.

### Events

All contracts emit comprehensive events for on-chain activity monitoring:

- `TaxCollected` - When taxes are collected
- `ProductivityRecorded` - When productivity is recorded
- `ProposalCreated` - When governance proposals are created
- `Voted` - When users vote on proposals
- `MetaTransactionExecuted` - When gasless transactions are executed

### View Functions

All contracts provide view functions for querying state:

- `getUserProfile()` - Get user productivity profile
- `getPendingRewards()` - Get pending reward amounts
- `getProposal()` - Get proposal details
- `getSettings()` - Get current contract settings

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Standards

- Follow Solidity style guide
- Use descriptive variable names
- Add comprehensive documentation
- Include tests for all new functionality
- Follow security best practices

### Pull Request Process

1. Ensure tests pass
2. Update documentation
3. Add CHANGELOG entry
4. Request review from maintainers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Website](https://sylos.io)
- [Documentation](https://docs.sylos.io)
- [Discord](https://discord.gg/sylos)
- [Twitter](https://twitter.com/sylos_io)
- [Medium](https://medium.com/sylos)

## 🆘 Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **GitHub Issues**: Create an issue for bugs or feature requests
- **Discord**: Join our community chat
- **Email**: support@sylos.io

## 🎯 Roadmap

- [ ] V2 contract upgrades
- [ ] Cross-chain deployment
- [ ] Advanced governance features
- [ ] Integration with external protocols
- [ ] Mobile app integration
- [ ] Advanced analytics dashboard

---

**Note**: This is a complex system of interconnected smart contracts. Always test thoroughly on testnets before mainnet deployment. The contracts are designed to be upgradeable and may be improved over time based on community feedback and security audits.