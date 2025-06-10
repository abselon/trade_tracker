# Crypto Trade Tracker

A React Native Expo app for tracking cryptocurrency trades and portfolio management.

## Features

- **Portfolio Overview**: View your total portfolio balance
- **Deposit Funds**: Add money to your trading portfolio
- **Withdraw Funds**: Remove money from your portfolio with validation
- **Transaction History**: View all your deposits and withdrawals
- **Dark Theme**: Modern dark UI optimized for crypto trading

## Tech Stack

- React Native
- Expo SDK 52
- TypeScript
- Expo Router for navigation

## Getting Started

### Prerequisites

- Node.js (14 or higher)
- Expo CLI
- Expo Go app on your mobile device (for testing)

### Installation

1. Dependencies are already installed with `npm install`

### Running the App

Start the development server:

```bash
npm start
```

This will open the Expo developer tools. You can then:

- Scan the QR code with the Expo Go app on your phone
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Press `w` to open in web browser

## Project Structure

```
├── app/
│   ├── _layout.tsx      # Root layout with navigation
│   └── index.tsx        # Home screen with deposit/withdraw
├── assets/              # App icons and images
├── package.json         # Dependencies and scripts
├── app.json            # Expo configuration
└── tsconfig.json       # TypeScript configuration
```

## Features Overview

### Home Screen (`app/index.tsx`)

- **Portfolio Balance Card**: Shows current total balance
- **Action Buttons**: Deposit (green) and Withdraw (red) buttons
- **Transaction List**: Scrollable list of recent transactions
- **Modal Interface**: Clean modal for entering transaction amounts

### Key Functionality

1. **Deposit**: Add funds to portfolio (no limit)
2. **Withdraw**: Remove funds with insufficient balance validation
3. **Transaction Tracking**: All transactions stored with timestamps
4. **Currency Formatting**: Proper USD formatting
5. **Input Validation**: Prevents invalid amounts

## Styling

The app uses a dark theme with:
- Primary background: `#0f0f23`
- Card background: `#1a1a2e`
- Accent green: `#64ffda` (for deposits)
- Accent red: `#ff6b6b` (for withdrawals)
- Text colors: Various shades of blue/white for hierarchy

## Next Steps

This is the foundation for a crypto trade tracker. Future enhancements could include:

- Actual cryptocurrency integration
- Real-time price tracking
- Trading functionality
- Portfolio analytics
- User authentication
- Data persistence

## Development

The app is built with TypeScript for type safety and uses modern React hooks for state management. The UI is responsive and follows mobile-first design principles. 