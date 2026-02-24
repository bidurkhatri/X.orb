# SylOS Blockchain OS - Quick Start Guide

## Get Started in 5 Minutes

### Prerequisites
- Node.js 16+ or 18+
- npm or pnpm package manager

### Option 1: Run Locally

```bash
# Navigate to project
cd /workspace/sylos-blockchain-os

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev

# Open in browser
# Visit: http://localhost:5173
```

### Option 2: Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build
npm run preview
```

### Project Structure at a Glance

```
src/
├── App.tsx                    # Main app with lock screen
├── components/
│   ├── Desktop.tsx            # Desktop environment
│   ├── LockScreen.tsx         # Initial login screen
│   ├── Taskbar.tsx            # Bottom taskbar
│   ├── AppWindow.tsx          # Draggable windows
│   └── apps/                  # All blockchain apps
│       ├── WalletApp.tsx      # Crypto wallet
│       ├── PoPTrackerApp.tsx  # Productivity tracker
│       ├── FileManagerApp.tsx # IPFS files
│       ├── TokenDashboardApp.tsx # Token portfolio
│       └── SettingsApp.tsx    # System settings
```

### Features to Explore

1. **Lock Screen** - Click "Unlock System" to enter the OS
2. **Desktop Icons** - Click any icon to launch an app
3. **Wallet** - Connect wallet and view balances
4. **PoP Tracker** - See productivity scores and rewards
5. **Files** - Browse IPFS file manager
6. **Tokens** - View SYLOS/wSYLOS portfolio
7. **Settings** - System configuration

### Mobile Testing

The app is optimized for mobile devices:

```bash
# Run dev server
npm run dev

# Access from mobile device
# Use your computer's local IP address
# Example: http://192.168.1.100:5173
```

Or scan QR code to access on phone (generate with ngrok or similar).

### Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Lucide Icons** - Icon library

### Customization

**Colors** - Edit `tailwind.config.js`:
```js
colors: {
  'sylos-primary': '#6366f1',
  'sylos-secondary': '#8b5cf6',
  'sylos-accent': '#06b6d4',
}
```

**Apps** - Add new apps in `src/components/Desktop.tsx`:
```tsx
const apps = [
  { id: 'my-app', title: 'My App', icon: <Icon />, component: <MyApp /> }
]
```

### Troubleshooting

**Issue**: `npm install` fails
**Solution**: Use `npm install --legacy-peer-deps`

**Issue**: Port 5173 already in use  
**Solution**: Change port in `vite.config.ts` or use `npm run dev -- --port 3000`

**Issue**: TypeScript errors
**Solution**: Run `npm run build` to see specific errors

### Next Steps

1. **Integrate Real Wallet**: Add WalletConnect SDK
2. **Connect to Polygon**: Use ethers.js or viem
3. **Add IPFS**: Integrate Web3.Storage
4. **Deploy Backend**: Set up Supabase
5. **Mobile App**: Package with Capacitor

### Deploy to Production

**Option A: Vercel (Recommended)**
```bash
npm i -g vercel
vercel
```

**Option B: Netlify**
```bash
npm run build
# Upload dist/ folder to Netlify
```

**Option C: Traditional Hosting**
```bash
npm run build
# Upload dist/ folder to any web server
```

### Support & Documentation

- **Full Documentation**: See README.md
- **Implementation Report**: See SYLOS_IMPLEMENTATION_REPORT.md
- **Technical Specs**: See docs/sylos_implementation_roadmap.md

### Demo Features

All data in the app is currently demo/placeholder data:
- Wallet balances: Simulated
- PoP scores: Example data
- Files: Mock IPFS entries
- Tokens: Sample portfolio

To connect real data, integrate with:
1. Polygon RPC endpoints
2. IPFS/Web3.Storage APIs
3. Supabase backend
4. Smart contracts

---

**Ready to Build the Future of Blockchain OS!**

For questions or issues, refer to the complete documentation or implementation report.
