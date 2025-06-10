import { createContext, useContext, useState, type ReactNode } from 'react';

interface PortfolioContextType {
    balance: number;
    setBalance: (value: number) => void;
    updateBalance: (amount: number, type: 'deposit' | 'withdraw') => void;
    addRealizedGains: (gains: number) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
    const [balance, setBalance] = useState(0);

    const updateBalance = (amount: number, type: 'deposit' | 'withdraw') => {
        setBalance((prev: number) => type === 'deposit' ? prev + amount : prev - amount);
    };

    const addRealizedGains = (gains: number) => {
        console.log(`Adding realized gains to portfolio: ${gains}`);
        setBalance((prev: number) => prev + gains);
    };

    return (
        <PortfolioContext.Provider value={{ balance, setBalance, updateBalance, addRealizedGains }}>
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolio() {
    const context = useContext(PortfolioContext);
    if (context === undefined) {
        throw new Error('usePortfolio must be used within a PortfolioProvider');
    }
    return context;
} 