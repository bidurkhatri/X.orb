import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletApp } from '../../src/components/apps/WalletApp';
import { PoPTrackerApp } from '../../src/components/apps/PoPTrackerApp';
import { FileManagerApp } from '../../src/components/apps/FileManagerApp';
import { TokenDashboardApp } from '../../src/components/apps/TokenDashboardApp';
import { SettingsApp } from '../../src/components/apps/SettingsApp';

describe('SylOS Core Components', () => {
  describe('WalletApp', () => {
    const mockProps = {
      onClose: jest.fn(),
      isMinimized: false,
    };

    beforeEach(() => {
      // Mock Web3 provider
      global.window.ethereum = {
        request: jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
        on: jest.fn(),
        removeListener: jest.fn(),
        selectedAddress: '0x1234567890abcdef1234567890abcdef12345678',
        networkVersion: '137',
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should render wallet interface with connected address', () => {
      render(<WalletApp {...mockProps} />);
      
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('SYLOS Balance')).toBeInTheDocument();
      expect(screen.getByText('12450.50')).toBeInTheDocument();
      expect(screen.getByText('wSYLOS Balance')).toBeInTheDocument();
      expect(screen.getByText('3280.75')).toBeInTheDocument();
    });

    it('should show connect wallet button when not connected', () => {
      global.window.ethereum.selectedAddress = null;
      
      render(<WalletApp {...mockProps} />);
      
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<WalletApp {...mockProps} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should display transaction history', () => {
      render(<WalletApp {...mockProps} />);
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument();
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
      expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('should open send transaction modal', async () => {
      const user = userEvent.setup();
      render(<WalletApp {...mockProps} />);
      
      const sendButton = screen.getByText('Send');
      await user.click(sendButton);
      
      expect(screen.getByText('Send Transaction')).toBeInTheDocument();
      expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    });
  });

  describe('PoPTrackerApp', () => {
    const mockProps = {
      onClose: jest.fn(),
      isMinimized: false,
    };

    it('should render PoP tracker interface', () => {
      render(<PoPTrackerApp {...mockProps} />);
      
      expect(screen.getByText('Proof of Productivity')).toBeInTheDocument();
      expect(screen.getByText('8,547')).toBeInTheDocument();
      expect(screen.getByText('Diamond')).toBeInTheDocument();
      expect(screen.getByText('Weekly Reward')).toBeInTheDocument();
      expect(screen.getByText('145.5 wSYLOS')).toBeInTheDocument();
    });

    it('should display task list with verification status', () => {
      render(<PoPTrackerApp {...mockProps} />);
      
      expect(screen.getByText('Task History')).toBeInTheDocument();
      expect(screen.getByText('DApp Integration')).toBeInTheDocument();
      expect(screen.getByText('Smart Contract Review')).toBeInTheDocument();
      expect(screen.getAllByText('Verified')).toHaveLength(2);
    });

    it('should show pending tasks for verification', () => {
      render(<PoPTrackerApp {...mockProps} />);
      
      expect(screen.getByText('User Testing')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should display productivity timeline', () => {
      render(<PoPTrackerApp {...mockProps} />);
      
      expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });
  });

  describe('FileManagerApp', () => {
    const mockProps = {
      onClose: jest.fn(),
      isMinimized: false,
    };

    it('should render file manager interface', () => {
      render(<FileManagerApp {...mockProps} />);
      
      expect(screen.getByText('File Manager')).toBeInTheDocument();
      expect(screen.getByText('IPFS Storage')).toBeInTheDocument();
      expect(screen.getByText('9.8 GB / 100 GB')).toBeInTheDocument();
    });

    it('should display file list with IPFS CIDs', () => {
      render(<FileManagerApp {...mockProps} />);
      
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Images')).toBeInTheDocument();
      expect(screen.getByText('QmXwN9dYd4T8J2kF3mZpA')).toBeInTheDocument();
      expect(screen.getByText('QmYf7rEs2R6gQ5hP3xKvT')).toBeInTheDocument();
    });

    it('should show upload file option', () => {
      render(<FileManagerApp {...mockProps} />);
      
      expect(screen.getByText('Upload to IPFS')).toBeInTheDocument();
      expect(screen.getByText('New Folder')).toBeInTheDocument();
    });

    it('should display file details when clicked', async () => {
      const user = userEvent.setup();
      render(<FileManagerApp {...mockProps} />);
      
      const fileItem = screen.getByText('Documents');
      await user.click(fileItem);
      
      expect(screen.getByText('File Details')).toBeInTheDocument();
    });
  });

  describe('TokenDashboardApp', () => {
    const mockProps = {
      onClose: jest.fn(),
      isMinimized: false,
    };

    it('should render token dashboard interface', () => {
      render(<TokenDashboardApp {...mockProps} />);
      
      expect(screen.getByText('Token Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
      expect(screen.getByText('$31,791')).toBeInTheDocument();
    });

    it('should display token balances', () => {
      render(<TokenDashboardApp {...mockProps} />);
      
      expect(screen.getByText('SYLOS')).toBeInTheDocument();
      expect(screen.getByText('12,450.50')).toBeInTheDocument();
      expect(screen.getByText('$24,901')).toBeInTheDocument();
      expect(screen.getByText('wSYLOS')).toBeInTheDocument();
      expect(screen.getByText('3,280.75')).toBeInTheDocument();
      expect(screen.getByText('$6,890')).toBeInTheDocument();
    });

    it('should show staking information', () => {
      render(<TokenDashboardApp {...mockProps} />);
      
      expect(screen.getByText('Staking')).toBeInTheDocument();
      expect(screen.getByText('12% APY')).toBeInTheDocument();
      expect(screen.getByText('1,000 SYLOS Staked')).toBeInTheDocument();
    });

    it('should open buy/sell modal', async () => {
      const user = userEvent.setup();
      render(<TokenDashboardApp {...mockProps} />);
      
      const buyButton = screen.getByText('Buy');
      await user.click(buyButton);
      
      expect(screen.getByText('Buy SYLOS')).toBeInTheDocument();
    });
  });

  describe('SettingsApp', () => {
    const mockProps = {
      onClose: jest.fn(),
      isMinimized: false,
    };

    it('should render settings interface', () => {
      render(<SettingsApp {...mockProps} />);
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Network')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should display account information', () => {
      render(<SettingsApp {...mockProps} />);
      
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
      expect(screen.getByText('test@sylos.com')).toBeInTheDocument();
    });

    it('should show network configuration', () => {
      render(<SettingsApp {...mockProps} />);
      
      expect(screen.getByText('Network Settings')).toBeInTheDocument();
      expect(screen.getByText('Polygon PoS Mainnet')).toBeInTheDocument();
      expect(screen.getByText('RPC URL')).toBeInTheDocument();
    });

    it('should allow changing settings', async () => {
      const user = userEvent.setup();
      render(<SettingsApp {...mockProps} />);
      
      const networkSelect = screen.getByDisplayValue('Polygon PoS Mainnet');
      await user.click(networkSelect);
      
      expect(screen.getByText('Polygon PoS Testnet')).toBeInTheDocument();
    });
  });
});