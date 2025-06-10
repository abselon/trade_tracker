import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import CryptoSelector from './components/CryptoSelector';
import { CryptoService, CryptoCurrency } from '../services/cryptoService';
import { usePortfolio } from './context/PortfolioContext';

interface Crypto {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
}

interface Trade {
    id: string;
    type: 'buy' | 'sell';
    coinId: string;
    symbol: string;
    name: string;
    amount: number;
    price: number;
    total: number;
    date: Date;
    positionId?: string; // Links multiple trades to same position
}

interface Position {
    id: string;
    coinId: string;
    symbol: string;
    name: string;
    totalBought: number;
    totalSold: number;
    averageBuyPrice: number;
    averageSellPrice: number;
    totalInvested: number;
    totalReceived: number;
    remainingAmount: number;
    isActive: boolean;
    pnl: number;
    roi: number;
    unrealizedPNL: number;
    realizedPNL: number;
    firstBuyDate: Date;
    lastSellDate?: Date;
    trades: Trade[];
    currentPrice?: number;
}

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 380;
const isTablet = width >= 768;

export default function TradesScreen() {
    const { balance, addRealizedGains } = usePortfolio();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
    const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency | null>(null);
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [cryptoSelectorVisible, setCryptoSelectorVisible] = useState(false);
    const [currentPrices, setCurrentPrices] = useState<{ [key: string]: number }>({});
    const [priceLoading, setPriceLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'ongoing' | 'history'>('ongoing');
    const [sliderPercentage, setSliderPercentage] = useState(0);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [cryptos, setCryptos] = useState<Crypto[]>([]);
    const [lastApiCall, setLastApiCall] = useState<number>(0);
    const API_RATE_LIMIT = 6000; // 6 seconds between calls

    // Load initial default crypto
    useEffect(() => {
        loadDefaultCrypto();
    }, []);

    // Update prices and positions when trades change
    useEffect(() => {
        updatePositions();
        if (trades.length > 0) {
            updateCurrentPrices();
        }
    }, [trades]);

    // Update PNL when current prices change
    useEffect(() => {
        if (Object.keys(currentPrices).length > 0) {
            updatePositionsPNL();
        }
    }, [currentPrices]);

    // Update amount when slider changes
    useEffect(() => {
        if (modalVisible && selectedCrypto) {
            updateAmountFromSlider();
        }
    }, [sliderPercentage, modalVisible, selectedCrypto, tradeType]);

    // Add initial data load
    useEffect(() => {
        const initializeData = async () => {
            try {
                const data = await fetchWithRateLimit('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false');

                if (!data) {
                    console.log('Initial API call failed, using default values');
                    return;
                }

                setCryptos(data);

                const initialPrices: Record<string, number> = {};
                data.forEach((crypto: Crypto) => {
                    initialPrices[crypto.id] = crypto.current_price;
                });
                setCurrentPrices(initialPrices);

                // Calculate initial portfolio value
                const totalValue = positions.reduce((total: number, position: Position) => {
                    if (position.isActive) {
                        const currentPrice = initialPrices[position.coinId] || 0;
                        return total + (position.remainingAmount * currentPrice);
                    }
                    return total;
                }, 0);
            } catch (error) {
                console.error('Error initializing data:', error);
            }
        };

        initializeData();
    }, []);

    // Add this useEffect for real-time price updates
    useEffect(() => {
        const intervalId = setInterval(() => {
            refreshAllData();
        }, 60000); // Refresh every 60 seconds instead of 30

        return () => clearInterval(intervalId);
    }, []);

    // Modify the existing refreshAllData function to be more efficient
    const refreshAllData = async () => {
        try {
            const data = await fetchWithRateLimit('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false');

            if (!data) {
                // If API call fails, use existing prices
                console.log('Using existing prices due to API failure');
                return;
            }

            setCryptos(data);

            const newPrices: Record<string, number> = {};
            data.forEach((crypto: Crypto) => {
                newPrices[crypto.id] = crypto.current_price;
            });
            setCurrentPrices(newPrices);

            // Update positions and calculate new portfolio value
            setPositions((prevPositions: Position[]) => {
                const updatedPositions = prevPositions.map((position: Position) => {
                    const currentPrice = newPrices[position.coinId] || position.currentPrice || 0;

                    // Calculate PNL components
                    const unrealizedPNL = position.isActive ? (currentPrice - position.averageBuyPrice) * position.remainingAmount : 0;
                    const realizedPNL = position.totalReceived - (position.totalSold * position.averageBuyPrice);
                    const pnl = unrealizedPNL + realizedPNL;
                    const roi = position.totalInvested > 0 ? (pnl / position.totalInvested) * 100 : 0;

                    return {
                        ...position,
                        currentPrice,
                        pnl,
                        roi,
                        unrealizedPNL,
                        realizedPNL
                    };
                });

                return updatedPositions;
            });

            setLastRefresh(new Date());
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    };

    const loadDefaultCrypto = async () => {
        try {
            const cryptos = await CryptoService.getPopularCryptocurrencies();
            if (cryptos.length > 0) {
                setSelectedCrypto(cryptos[0]); // Default to Bitcoin
            }
        } catch (error) {
            console.error('Error loading default crypto:', error);
        }
    };

    const updateCurrentPrices = async () => {
        if (trades.length === 0) return;

        setPriceLoading(true);
        try {
            const uniqueCoinIds = [...new Set(trades.map(trade => trade.coinId))];
            const pricePromises = uniqueCoinIds.map(async (coinId) => {
                const price = await CryptoService.getCryptocurrencyPrice(coinId);
                return { coinId, price };
            });

            const priceResults = await Promise.all(pricePromises);
            const priceMap: { [key: string]: number } = {};
            priceResults.forEach(result => {
                priceMap[result.coinId] = result.price;
            });

            setCurrentPrices(priceMap);
        } catch (error) {
            console.error('Error updating prices:', error);
        } finally {
            setPriceLoading(false);
        }
    };

    const updatePositions = () => {
        const positionMap = new Map<string, Position>();

        trades.forEach((trade: Trade) => {
            if (!positionMap.has(trade.coinId)) {
                positionMap.set(trade.coinId, {
                    id: trade.coinId,
                    coinId: trade.coinId,
                    symbol: trade.symbol,
                    name: trade.name,
                    totalBought: 0,
                    totalSold: 0,
                    averageBuyPrice: 0,
                    averageSellPrice: 0,
                    totalInvested: 0,
                    totalReceived: 0,
                    remainingAmount: 0,
                    isActive: false,
                    pnl: 0,
                    roi: 0,
                    unrealizedPNL: 0,
                    realizedPNL: 0,
                    firstBuyDate: new Date(),
                    trades: []
                });
            }

            const position = positionMap.get(trade.coinId)!;
            position.trades.push(trade);

            if (trade.type === 'buy') {
                position.totalBought += trade.amount;
                position.totalInvested += trade.total;
                if (position.totalBought > 0) {
                    position.averageBuyPrice = position.totalInvested / position.totalBought;
                }
                if (!position.firstBuyDate || trade.date < position.firstBuyDate) {
                    position.firstBuyDate = trade.date;
                }
            } else {
                position.totalSold += trade.amount;
                position.totalReceived += trade.total;
                if (position.totalSold > 0) {
                    position.averageSellPrice = position.totalReceived / position.totalSold;
                }
                position.lastSellDate = trade.date;
            }

            position.remainingAmount = position.totalBought - position.totalSold;
            // Update isActive based on remaining amount with a small threshold for floating point precision
            position.isActive = position.remainingAmount > 0.00000001;
        });

        // Sort positions by first buy date (newest first)
        const sortedPositions = Array.from(positionMap.values()).sort((a, b) =>
            b.firstBuyDate.getTime() - a.firstBuyDate.getTime()
        );

        setPositions(sortedPositions);
    };

    const updatePositionsPNL = () => {
        const updatedPositions = positions.map((position: Position) => {
            const currentPrice = currentPrices[position.coinId] || 0;
            console.log(`Debug - PNL Update for ${position.symbol}:`, {
                currentPrice,
                remainingAmount: position.remainingAmount,
                totalBought: position.totalBought,
                totalSold: position.totalSold,
                averageBuyPrice: position.averageBuyPrice,
                totalInvested: position.totalInvested,
                totalReceived: position.totalReceived
            });

            if (position.isActive && currentPrice > 0) {
                // For active positions: calculate unrealized and realized PNL separately
                position.unrealizedPNL = (currentPrice - position.averageBuyPrice) * position.remainingAmount;
                position.realizedPNL = position.totalReceived - (position.totalSold * position.averageBuyPrice);
                position.pnl = position.unrealizedPNL + position.realizedPNL;
            } else {
                // For closed positions: PNL = total_received - total_invested
                position.realizedPNL = position.totalReceived - position.totalInvested;
                position.unrealizedPNL = 0;
                position.pnl = position.realizedPNL;
            }

            // ROI = (PNL / total_invested) * 100
            position.roi = position.totalInvested > 0 ? (position.pnl / position.totalInvested) * 100 : 0;

            return position;
        });

        setPositions(updatedPositions);
    };

    // Calculate available balance (total balance minus invested amount)
    const getAvailableBalance = () => {
        const totalInvested = positions.reduce((total, position) => {
            if (position.isActive) {
                const positionValue = position.remainingAmount * (currentPrices[position.coinId] || 0);
                console.log(`Position ${position.symbol}: ${position.remainingAmount} * ${currentPrices[position.coinId] || 0} = ${positionValue}`);
                return total + positionValue;
            }
            return total;
        }, 0);
        const available = Math.max(0, balance - totalInvested);
        console.log(`Debug - Balance: ${balance}, Total Invested: ${totalInvested}, Available: ${available}`);
        return available;
    };

    const roundToDecimalPlaces = (num: number, decimals: number = 8): number => {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    // For buying, we need to round DOWN to ensure we never exceed available balance
    const roundDownToDecimalPlaces = (num: number, decimals: number = 8): number => {
        return Math.floor(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    const updateAmountFromSlider = () => {
        if (!selectedCrypto) return;

        const currentPrice = parseFloat(price) || selectedCrypto.current_price;
        console.log(`Debug - updateAmountFromSlider - Current Price: ${currentPrice}, Slider: ${sliderPercentage}%`);

        if (tradeType === 'buy') {
            const availableBalance = getAvailableBalance();
            const maxAmount = roundDownToDecimalPlaces(availableBalance / currentPrice);
            console.log(`Debug - Buy - Available Balance: ${availableBalance}, Max Amount: ${maxAmount}`);

            const calculatedAmount = sliderPercentage === 100 ?
                maxAmount :
                roundDownToDecimalPlaces(maxAmount * sliderPercentage / 100);
            console.log(`Debug - Buy - Calculated Amount: ${calculatedAmount}`);
            setAmount(calculatedAmount.toString());
        } else {
            const activePosition = positions.find((p: Position) => p.coinId === selectedCrypto.id && p.isActive);
            console.log(`Debug - Sell - Active Position:`, activePosition);

            if (activePosition) {
                const calculatedAmount = sliderPercentage === 100 ?
                    roundToDecimalPlaces(activePosition.remainingAmount) :
                    roundToDecimalPlaces(activePosition.remainingAmount * sliderPercentage / 100);
                console.log(`Debug - Sell - Remaining Amount: ${activePosition.remainingAmount}, Calculated Amount: ${calculatedAmount}`);
                setAmount(calculatedAmount.toString());
            }
        }
    };

    const updateSliderFromAmount = (inputAmount: string) => {
        if (!selectedCrypto || !inputAmount) {
            setSliderPercentage(0);
            return;
        }

        const numAmount = parseFloat(inputAmount);
        const currentPrice = parseFloat(price) || selectedCrypto.current_price;
        console.log(`Debug - updateSliderFromAmount - Amount: ${numAmount}, Price: ${currentPrice}`);

        if (tradeType === 'buy') {
            const availableBalance = getAvailableBalance();
            const maxAmount = roundDownToDecimalPlaces(availableBalance / currentPrice);
            console.log(`Debug - Buy Slider - Available Balance: ${availableBalance}, Max Amount: ${maxAmount}`);

            const roundedAmount = roundToDecimalPlaces(numAmount);
            const roundedMaxAmount = maxAmount; // Already rounded down

            if (roundedAmount >= roundedMaxAmount || Math.abs(roundedAmount - roundedMaxAmount) < 0.00000001) {
                console.log('Debug - Buy Slider - Setting to 100% (exact match)');
                setSliderPercentage(100);
            } else {
                const percentage = Math.min((roundedAmount / roundedMaxAmount) * 100, 100);
                console.log(`Debug - Buy Slider - Setting to ${percentage}%`);
                setSliderPercentage(percentage);
            }
        } else {
            const activePosition = positions.find((p: Position) => p.coinId === selectedCrypto.id && p.isActive);
            console.log(`Debug - Sell Slider - Active Position:`, activePosition);

            if (activePosition && activePosition.remainingAmount > 0) {
                const roundedAmount = roundToDecimalPlaces(numAmount);
                const roundedRemaining = roundToDecimalPlaces(activePosition.remainingAmount);

                if (roundedAmount >= roundedRemaining || Math.abs(roundedAmount - roundedRemaining) < 0.00000001) {
                    console.log('Debug - Sell Slider - Setting to 100% (exact match)');
                    setSliderPercentage(100);
                } else {
                    const percentage = Math.min((roundedAmount / roundedRemaining) * 100, 100);
                    console.log(`Debug - Sell Slider - Setting to ${percentage}%`);
                    setSliderPercentage(percentage);
                }
            }
        }
    };

    const handleBuy = () => {
        if (!selectedCrypto) {
            Alert.alert('Error', 'Please select a cryptocurrency first');
            return;
        }
        setTradeType('buy');
        setPrice(selectedCrypto.current_price.toString());
        setSliderPercentage(0);
        setAmount('');
        setModalVisible(true);
    };

    const handleSell = () => {
        if (!selectedCrypto) {
            Alert.alert('Error', 'Please select a cryptocurrency first');
            return;
        }

        // Check if there's an active position to sell
        const activePosition = positions.find((p: Position) => p.coinId === selectedCrypto.id && p.isActive);
        if (!activePosition) {
            Alert.alert('Error', `No active position found for ${selectedCrypto.symbol}. You need to buy first.`);
            return;
        }

        setTradeType('sell');
        setPrice(selectedCrypto.current_price.toString());
        setSliderPercentage(0);
        setAmount('');
        setModalVisible(true);
    };

    const handleSellFromPosition = (position: Position) => {
        const crypto = {
            id: position.coinId,
            symbol: position.symbol,
            name: position.name,
            current_price: currentPrices[position.coinId] || 0,
            price_change_percentage_24h: 0
        };

        setSelectedCrypto(crypto as CryptoCurrency);
        setTradeType('sell');
        setPrice((currentPrices[position.coinId] || 0).toString());
        setSliderPercentage(0);
        setAmount('');
        setDetailModalVisible(false);
        setModalVisible(true);
    };

    const handlePositionPress = (position: Position) => {
        setSelectedPosition(position);
        setDetailModalVisible(true);
    };

    const confirmTrade = () => {
        if (!selectedCrypto) {
            Alert.alert('Error', 'Please select a cryptocurrency first');
            return;
        }

        const numAmount = parseFloat(amount);
        const numPrice = parseFloat(price);
        const total = numAmount * numPrice;
        console.log(`Debug - confirmTrade - Amount: ${numAmount}, Price: ${numPrice}, Total: ${total}`);

        if (isNaN(numAmount) || isNaN(numPrice) || numAmount <= 0 || numPrice <= 0) {
            Alert.alert('Error', 'Please enter valid amount and price');
            return;
        }

        if (tradeType === 'buy') {
            const availableBalance = getAvailableBalance();
            const roundedTotal = roundToDecimalPlaces(total);
            const roundedAvailable = roundToDecimalPlaces(availableBalance);
            console.log(`Debug - Buy Trade - Available Balance: ${roundedAvailable}, Total: ${roundedTotal}`);
            if (roundedTotal > roundedAvailable) {
                Alert.alert('Error', `Insufficient uninvested funds for this trade. Available: ${formatCurrency(roundedAvailable)}`);
                return;
            }
        }

        if (tradeType === 'sell') {
            const activePosition = positions.find(p => p.coinId === selectedCrypto.id && p.isActive);
            console.log(`Debug - Sell Trade - Active Position:`, activePosition);

            if (!activePosition) {
                Alert.alert('Error', `No active position found for ${selectedCrypto.symbol}`);
                return;
            }

            // Use proper decimal precision comparison to avoid floating-point errors
            const roundedAmount = roundToDecimalPlaces(numAmount);
            const roundedRemaining = roundToDecimalPlaces(activePosition.remainingAmount);
            console.log(`Debug - Sell Trade - Rounded Amount: ${roundedAmount}, Rounded Remaining: ${roundedRemaining}`);

            if (roundedAmount > roundedRemaining) {
                Alert.alert('Error', `Insufficient holdings for this trade. Available: ${roundedRemaining} ${selectedCrypto.symbol}`);
                return;
            }
        }

        const newTrade: Trade = {
            id: Date.now().toString(),
            type: tradeType,
            coinId: selectedCrypto.id,
            symbol: selectedCrypto.symbol,
            name: selectedCrypto.name,
            amount: numAmount,
            price: numPrice,
            total: total,
            date: new Date(),
        };

        console.log('Debug - Executing Trade:', newTrade);
        setTrades((prev: Trade[]) => [newTrade, ...prev]);
        setAmount('');
        setPrice('');
        setSliderPercentage(0);
        setModalVisible(false);

        Alert.alert(
            'Trade Executed',
            `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${numAmount.toFixed(8)} ${selectedCrypto.symbol} at ${formatCurrency(numPrice)}`
        );

        if (tradeType === 'sell') {
            const activePosition = positions.find(p => p.coinId === selectedCrypto.id && p.isActive);
            if (activePosition) {
                // Calculate realized gain: (sell price - average buy price) * amount sold
                const realizedGain = (numPrice - activePosition.averageBuyPrice) * numAmount;
                console.log(`Debug - Realized Gain: Sell Price: ${numPrice}, Avg Buy Price: ${activePosition.averageBuyPrice}, Amount: ${numAmount}, Gain: ${realizedGain}`);
                addRealizedGains(realizedGain);
            }
        }
    };

    const getTotalPNL = (): number => {
        return positions.reduce((total: number, position: Position) => total + position.pnl, 0);
    };

    const getTotalROI = (): number => {
        const totalInvested = positions.reduce((total: number, pos: Position) => total + pos.totalInvested, 0);
        return totalInvested > 0 ? (getTotalPNL() / totalInvested) * 100 : 0;
    };

    const handleCryptoSelect = (crypto: CryptoCurrency) => {
        console.log('handleCryptoSelect called with:', crypto);
        setSelectedCrypto(crypto);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatPNL = (pnl: number) => {
        const sign = pnl >= 0 ? '+' : '';
        return `${sign}${formatCurrency(pnl)}`;
    };

    const formatROI = (roi: number) => {
        const sign = roi >= 0 ? '+' : '';
        return `${sign}${roi.toFixed(2)}%`;
    };

    const activePositions = positions.filter((p: Position) => p.isActive);
    const closedPositions = positions.filter((p: Position) => !p.isActive);
    const displayPositions = activeTab === 'ongoing' ? activePositions : closedPositions;

    // Calculate available info for modal
    const getAvailableInfo = () => {
        if (!selectedCrypto) return null;

        if (tradeType === 'buy') {
            const currentPrice = parseFloat(price) || selectedCrypto.current_price;
            const maxAmount = getAvailableBalance() / currentPrice;
            return {
                type: 'funds',
                available: getAvailableBalance(),
                maxAmount: maxAmount,
                label: 'Available Funds',
                amountLabel: `Max ${selectedCrypto.symbol}`
            };
        } else {
            const activePosition = positions.find((p: Position) => p.coinId === selectedCrypto.id && p.isActive);
            if (activePosition) {
                const currentValue = (currentPrices[selectedCrypto.id] || 0) * activePosition.remainingAmount;
                return {
                    type: 'holdings',
                    available: activePosition.remainingAmount,
                    currentValue: currentValue,
                    label: 'Available Holdings',
                    amountLabel: `${selectedCrypto.symbol} Holdings`
                };
            }
        }
        return null;
    };

    const availableInfo = getAvailableInfo();

    // Update the header component
    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Trades</Text>
            <View style={styles.refreshInfo}>
                <Text style={styles.refreshText}>
                    Last updated: {lastRefresh.toLocaleTimeString()}
                </Text>
            </View>
        </View>
    );

    // Add a function to handle API calls with rate limiting
    const fetchWithRateLimit = async (url: string) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCall;

        if (timeSinceLastCall < API_RATE_LIMIT) {
            // Wait for the remaining time
            await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT - timeSinceLastCall));
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setLastApiCall(Date.now());
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

            {renderHeader()}

            {/* PNL Summary Card */}
            <View style={styles.pnlCard}>
                <Text style={styles.pnlLabel}>Total P&L</Text>
                <Text style={[styles.pnlAmount, getTotalPNL() >= 0 ? styles.profit : styles.loss]}>
                    {formatPNL(getTotalPNL())}
                </Text>
                <Text style={styles.pnlSubText}>
                    ROI: {formatROI(getTotalROI())} • {activePositions.length} active, {closedPositions.length} closed
                </Text>
            </View>

            {/* Crypto Selector */}
            <TouchableOpacity
                style={styles.cryptoSelector}
                onPress={() => setCryptoSelectorVisible(true)}
            >
                {selectedCrypto ? (
                    <>
                        <View style={styles.cryptoInfo}>
                            <Text style={styles.cryptoSelectorText}>{selectedCrypto.symbol}</Text>
                            <Text style={styles.cryptoName}>{selectedCrypto.name}</Text>
                        </View>
                        <View style={styles.cryptoPriceInfo}>
                            <Text style={styles.cryptoPrice}>{formatCurrency(selectedCrypto.current_price)}</Text>
                            <Text style={[
                                styles.cryptoChange,
                                selectedCrypto.price_change_percentage_24h >= 0 ? styles.positiveChange : styles.negativeChange
                            ]}>
                                {selectedCrypto.price_change_percentage_24h >= 0 ? '+' : ''}{selectedCrypto.price_change_percentage_24h.toFixed(2)}%
                            </Text>
                        </View>
                    </>
                ) : (
                    <Text style={styles.cryptoSelectorText}>Select Cryptocurrency</Text>
                )}
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.buyButton, !selectedCrypto && styles.disabledButton]}
                    onPress={handleBuy}
                    disabled={!selectedCrypto}
                >
                    <Text style={styles.actionButtonText}>📈 Buy {selectedCrypto?.symbol || 'Crypto'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.sellButton, !selectedCrypto && styles.disabledButton]}
                    onPress={handleSell}
                    disabled={!selectedCrypto}
                >
                    <Text style={styles.actionButtonText}>📉 Sell {selectedCrypto?.symbol || 'Crypto'}</Text>
                </TouchableOpacity>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'ongoing' && styles.activeTab]}
                    onPress={() => setActiveTab('ongoing')}
                >
                    <Text style={[styles.tabText, activeTab === 'ongoing' && styles.activeTabText]}>
                        Ongoing ({activePositions.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                        History ({closedPositions.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Positions List */}
            <View style={styles.tradesContainer}>
                <ScrollView style={styles.tradesList}>
                    {displayPositions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                {activeTab === 'ongoing' ? 'No ongoing trades' : 'No completed trades'}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                {activeTab === 'ongoing'
                                    ? 'Start trading to track your active positions!'
                                    : 'Complete a trade to see it here!'
                                }
                            </Text>
                        </View>
                    ) : (
                        displayPositions.map((position: Position) => (
                            <TouchableOpacity
                                key={position.id}
                                style={styles.positionCard}
                                onPress={() => handlePositionPress(position)}
                            >
                                <View style={styles.positionCardContent}>
                                    <View>
                                        <Text style={styles.positionSymbol}>{position.symbol}</Text>
                                        <Text style={styles.positionName}>{position.name}</Text>
                                    </View>

                                    <View style={styles.positionMetrics}>
                                        {position.isActive ? (
                                            <>
                                                <Text style={[styles.unrealizedPNL, position.unrealizedPNL >= 0 ? styles.profitText : styles.lossText]}>
                                                    Unrealized: {formatPNL(position.unrealizedPNL)}
                                                </Text>
                                                <Text style={[styles.realizedPNL, position.realizedPNL >= 0 ? styles.profitText : styles.lossText]}>
                                                    Realized: {formatPNL(position.realizedPNL)}
                                                </Text>
                                            </>
                                        ) : (
                                            <Text style={[styles.roiText, position.roi >= 0 ? styles.profitText : styles.lossText]}>
                                                ROI: {formatROI(position.roi)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Position Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={detailModalVisible}
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.detailModalContent}>
                        {selectedPosition && (
                            <>
                                <View style={styles.detailModalHeader}>
                                    <View style={styles.detailHeaderInfo}>
                                        <Text style={styles.detailModalTitle}>
                                            {selectedPosition.symbol}
                                        </Text>
                                        <Text style={styles.detailModalSubtitle}>
                                            {selectedPosition.isActive ? 'Active Position' : 'Closed Position'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.closeButton}
                                        onPress={() => setDetailModalVisible(false)}
                                    >
                                        <Text style={styles.closeButtonText}>×</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.detailModalBody}>
                                    <ScrollView
                                        style={styles.scrollView}
                                        contentContainerStyle={styles.scrollViewContent}
                                    >
                                        {/* Performance Summary */}
                                        <View style={styles.performanceSection}>
                                            <Text style={styles.sectionTitle}>Performance</Text>
                                            <View style={styles.performanceGrid}>
                                                <View style={styles.performanceItem}>
                                                    <Text style={styles.performanceLabel}>Total P&L</Text>
                                                    <Text style={[styles.performanceValue, selectedPosition.pnl >= 0 ? styles.profitText : styles.lossText]}>
                                                        {formatPNL(selectedPosition.pnl)}
                                                    </Text>
                                                </View>
                                                <View style={styles.performanceItem}>
                                                    <Text style={styles.performanceLabel}>ROI</Text>
                                                    <Text style={[styles.performanceValue, selectedPosition.roi >= 0 ? styles.profitText : styles.lossText]}>
                                                        {formatROI(selectedPosition.roi)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Position Details */}
                                        <View style={styles.positionSection}>
                                            <Text style={styles.sectionTitle}>Position Details</Text>
                                            <View style={styles.detailGrid}>
                                                <View style={styles.detailItem}>
                                                    <Text style={styles.detailLabel}>Total Invested</Text>
                                                    <Text style={styles.detailValue}>{formatCurrency(selectedPosition.totalInvested)}</Text>
                                                </View>
                                                <View style={styles.detailItem}>
                                                    <Text style={styles.detailLabel}>Average Buy Price</Text>
                                                    <Text style={styles.detailValue}>{formatCurrency(selectedPosition.averageBuyPrice)}</Text>
                                                </View>
                                                {selectedPosition.isActive && (
                                                    <View style={styles.detailItem}>
                                                        <Text style={styles.detailLabel}>Current Holdings</Text>
                                                        <Text style={styles.detailValue}>
                                                            {selectedPosition.remainingAmount.toFixed(8)} {selectedPosition.symbol}
                                                        </Text>
                                                    </View>
                                                )}
                                                {selectedPosition.isActive && (
                                                    <View style={styles.detailItem}>
                                                        <Text style={styles.detailLabel}>Current Value</Text>
                                                        <Text style={styles.detailValue}>
                                                            {formatCurrency((currentPrices[selectedPosition.coinId] || 0) * selectedPosition.remainingAmount)}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* Trade History */}
                                        <View style={styles.tradeHistorySection}>
                                            <Text style={styles.sectionTitle}>Trade History</Text>
                                            {selectedPosition.trades.map((trade: Trade, index: number) => (
                                                <View key={`trade-${trade.id}`} style={styles.tradeHistoryItem}>
                                                    <View style={styles.tradeHistoryHeader}>
                                                        <Text style={[styles.tradeTypeText, trade.type === 'buy' ? styles.buyText : styles.sellText]}>
                                                            {trade.type.toUpperCase()}
                                                        </Text>
                                                        <Text style={styles.tradeDate}>{formatDate(trade.date)}</Text>
                                                    </View>
                                                    <View style={styles.tradeHistoryDetails}>
                                                        <Text style={styles.tradeHistoryText}>
                                                            Amount: {trade.amount.toFixed(8)} {selectedPosition.symbol}
                                                        </Text>
                                                        <Text style={styles.tradeHistoryText}>
                                                            Price: {formatCurrency(trade.price)}
                                                        </Text>
                                                        <Text style={styles.tradeHistoryText}>
                                                            Total: {formatCurrency(trade.total)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>

                                {/* Action Buttons for Active Positions */}
                                {selectedPosition.isActive && (
                                    <View style={styles.detailModalActions}>
                                        <TouchableOpacity
                                            style={[styles.modalActionButton, styles.sellActionButton]}
                                            onPress={() => handleSellFromPosition(selectedPosition)}
                                        >
                                            <Text style={styles.modalActionButtonText}>Sell {selectedPosition.symbol}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Crypto Selector Modal */}
            <CryptoSelector
                visible={cryptoSelectorVisible}
                onClose={() => setCryptoSelectorVisible(false)}
                onSelect={handleCryptoSelect}
                selectedSymbol={selectedCrypto?.symbol}
            />

            {/* Trade Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <View style={[styles.modalIcon, tradeType === 'buy' ? styles.buyIcon : styles.sellIcon]}>
                                    <Text style={styles.modalIconText}>{tradeType === 'buy' ? 'B' : 'S'}</Text>
                                </View>
                            </View>
                            <Text style={styles.modalTitle}>
                                {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedCrypto?.symbol || 'Crypto'}
                            </Text>
                            <Text style={styles.modalSubtitle}>
                                {selectedCrypto?.name || 'Select a cryptocurrency'}
                            </Text>
                        </View>

                        <View style={styles.modalBody}>
                            <ScrollView
                                style={styles.scrollView}
                                contentContainerStyle={styles.scrollViewContent}
                            >
                                <View style={styles.inputSection}>
                                    <TouchableOpacity
                                        style={styles.cryptoSelector}
                                        onPress={() => setCryptoSelectorVisible(true)}
                                    >
                                        {selectedCrypto ? (
                                            <>
                                                <View style={styles.cryptoInfo}>
                                                    <Text style={styles.cryptoSymbol}>{selectedCrypto.symbol}</Text>
                                                    <Text style={styles.cryptoName}>{selectedCrypto.name}</Text>
                                                </View>
                                                <View style={styles.cryptoPriceInfo}>
                                                    <Text style={styles.cryptoPrice}>{formatCurrency(selectedCrypto.current_price)}</Text>
                                                    <Text style={[
                                                        styles.cryptoChange,
                                                        selectedCrypto.price_change_percentage_24h >= 0 ? styles.positiveChange : styles.negativeChange
                                                    ]}>
                                                        {selectedCrypto.price_change_percentage_24h >= 0 ? '+' : ''}{selectedCrypto.price_change_percentage_24h.toFixed(2)}%
                                                    </Text>
                                                </View>
                                            </>
                                        ) : (
                                            <Text style={styles.cryptoSelectorText}>Select Cryptocurrency</Text>
                                        )}
                                    </TouchableOpacity>

                                    {/* Available Balance */}
                                    <View style={styles.availableBalanceContainer}>
                                        <Text style={styles.availableBalanceLabel}>
                                            {tradeType === 'buy' ? 'Available Funds' : 'Available Holdings'}
                                        </Text>
                                        <Text style={styles.availableBalanceValue}>
                                            {tradeType === 'buy'
                                                ? formatCurrency(getAvailableBalance())
                                                : selectedCrypto && positions.find(p => p.coinId === selectedCrypto.id && p.isActive)
                                                    ? `${positions.find(p => p.coinId === selectedCrypto.id && p.isActive)?.remainingAmount.toFixed(8)} ${selectedCrypto.symbol}`
                                                    : '0.00000000'
                                            }
                                        </Text>
                                    </View>

                                    {/* Percentage Quick Select */}
                                    <View style={styles.quickSelectContainer}>
                                        <Text style={styles.inputLabel}>Quick Select</Text>
                                        <View style={styles.quickSelectButtons}>
                                            <TouchableOpacity
                                                style={styles.quickSelectButton}
                                                onPress={() => setSliderPercentage(25)}
                                            >
                                                <Text style={styles.quickSelectButtonText}>25%</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.quickSelectButton}
                                                onPress={() => setSliderPercentage(50)}
                                            >
                                                <Text style={styles.quickSelectButtonText}>50%</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.quickSelectButton}
                                                onPress={() => setSliderPercentage(75)}
                                            >
                                                <Text style={styles.quickSelectButtonText}>75%</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.quickSelectButton}
                                                onPress={() => setSliderPercentage(100)}
                                            >
                                                <Text style={styles.quickSelectButtonText}>Max</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <Text style={styles.inputLabel}>Amount ({selectedCrypto?.symbol || 'Crypto'})</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={amount}
                                        onChangeText={(text) => {
                                            setAmount(text);
                                            updateSliderFromAmount(text);
                                        }}
                                        placeholder="0.00"
                                        placeholderTextColor="#64748b"
                                        keyboardType="numeric"
                                        autoFocus={true}
                                    />

                                    <Text style={styles.inputLabel}>Price (USD)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={price}
                                        onChangeText={setPrice}
                                        placeholder="0.00"
                                        placeholderTextColor="#64748b"
                                        keyboardType="numeric"
                                    />

                                    {amount && price && (
                                        <View style={styles.totalInfo}>
                                            <Text style={styles.totalLabel}>Total</Text>
                                            <Text style={styles.totalAmount}>
                                                {formatCurrency(parseFloat(amount || '0') * parseFloat(price || '0'))}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setAmount('');
                                    setPrice('');
                                    setSliderPercentage(0);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton, tradeType === 'buy' ? styles.confirmBuyButton : styles.confirmSellButton]}
                                onPress={confirmTrade}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {tradeType === 'buy' ? 'Execute Buy' : 'Execute Sell'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
        padding: isSmallScreen ? 16 : 20,
    },
    pnlCard: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 16 : 20,
        padding: isSmallScreen ? 20 : 24,
        marginBottom: isSmallScreen ? 16 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    pnlLabel: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '500',
        marginBottom: 8,
        textAlign: 'center',
    },
    pnlAmount: {
        fontSize: isSmallScreen ? 26 : 32,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    profit: {
        color: '#059669',
    },
    loss: {
        color: '#dc2626',
    },
    pnlSubText: {
        color: '#9ca3af',
        fontSize: isSmallScreen ? 12 : 14,
        textAlign: 'center',
    },
    cryptoSelector: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 12 : 16,
        padding: isSmallScreen ? 14 : 16,
        marginBottom: isSmallScreen ? 16 : 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    cryptoSelectorText: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '600',
    },
    cryptoPrice: {
        color: '#3b82f6',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    actionContainer: {
        flexDirection: 'row',
        marginBottom: isSmallScreen ? 20 : 24,
        gap: isSmallScreen ? 12 : 16,
    },
    actionButton: {
        flex: 1,
        paddingVertical: isSmallScreen ? 14 : 16,
        borderRadius: isSmallScreen ? 12 : 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    buyButton: {
        backgroundColor: '#059669',
    },
    sellButton: {
        backgroundColor: '#dc2626',
    },
    actionButtonText: {
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    tradesContainer: {
        flex: 1,
    },
    tradesTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 18 : 20,
        fontWeight: '600',
        marginBottom: isSmallScreen ? 12 : 16,
    },
    tradesList: {
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: isSmallScreen ? 32 : 40,
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 12 : 16,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        marginTop: 8,
    },
    emptyStateText: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '500',
        marginBottom: 4,
    },
    emptyStateSubtext: {
        color: '#9ca3af',
        fontSize: isSmallScreen ? 13 : 14,
        textAlign: 'center',
    },
    tradeItem: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tradeInfo: {
        flex: 1,
    },
    tradeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    tradeType: {
        fontSize: 16,
        fontWeight: '600',
    },
    buyText: {
        color: '#059669',
    },
    sellText: {
        color: '#dc2626',
    },
    tradeDate: {
        color: '#8892b0',
        fontSize: 12,
    },
    tradeDetails: {
        color: '#8892b0',
        fontSize: 14,
    },
    tradePnl: {
        alignItems: 'flex-end',
    },
    pnlText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    profitText: {
        color: '#059669',
    },
    lossText: {
        color: '#dc2626',
    },
    currentPrice: {
        color: '#8892b0',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: isSmallScreen ? 20 : 24,
        borderTopRightRadius: isSmallScreen ? 20 : 24,
        width: '100%',
        height: isSmallScreen ? '90%' : '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        alignItems: 'center',
        padding: isSmallScreen ? 16 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    buyIcon: {
        backgroundColor: 'rgba(100, 255, 218, 0.1)',
        borderWidth: 2,
        borderColor: 'rgba(100, 255, 218, 0.3)',
    },
    sellIcon: {
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderWidth: 2,
        borderColor: 'rgba(255, 107, 107, 0.3)',
    },
    modalIconText: {
        fontSize: 36,
        color: '#f8fafc',
    },
    modalTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 20 : 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
    },
    modalSubtitle: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 14 : 16,
        textAlign: 'center',
    },
    modalBody: {
        flex: 1,
        minHeight: 0,
    },
    inputSection: {
        paddingHorizontal: isSmallScreen ? 20 : 24,
        paddingBottom: isSmallScreen ? 20 : 24,
    },
    inputLabel: {
        color: '#374151',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: isSmallScreen ? 12 : 16,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderRadius: isSmallScreen ? 10 : 12,
        padding: isSmallScreen ? 14 : 16,
        fontSize: isSmallScreen ? 16 : 18,
        color: '#1f2937',
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    totalInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        padding: isSmallScreen ? 12 : 16,
        backgroundColor: '#f3f4f6',
        borderRadius: isSmallScreen ? 8 : 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    totalLabel: {
        color: '#374151',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    totalAmount: {
        color: '#3b82f6',
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '700',
    },
    modalActions: {
        flexDirection: 'row',
        padding: isSmallScreen ? 16 : 20,
        gap: isSmallScreen ? 12 : 16,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        backgroundColor: '#ffffff',
    },
    modalButton: {
        flex: 1,
        paddingVertical: isSmallScreen ? 12 : 14,
        borderRadius: isSmallScreen ? 10 : 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
    },
    confirmButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmBuyButton: {
        backgroundColor: '#059669',
    },
    confirmSellButton: {
        backgroundColor: '#dc2626',
    },
    cancelButtonText: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    confirmButtonText: {
        color: '#ffffff',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    cryptoModalContent: {
        backgroundColor: '#1e1e2e',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 350,
        maxHeight: '70%',
    },
    cryptoModalTitle: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    cryptoList: {
        maxHeight: 400,
    },
    cryptoOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#0f172a',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCrypto: {
        borderColor: '#64ffda',
        backgroundColor: 'rgba(100, 255, 218, 0.1)',
    },
    cryptoSymbol: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: 'bold',
    },
    cryptoName: {
        color: '#94a3b8',
        fontSize: 14,
        marginTop: 2,
    },
    cryptoPriceInfo: {
        alignItems: 'flex-end',
    },
    cryptoChange: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    positiveChange: {
        color: '#10b981',
    },
    negativeChange: {
        color: '#ef4444',
    },
    disabledButton: {
        opacity: 0.5,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: isSmallScreen ? 20 : 24,
        backgroundColor: '#f3f4f6',
        borderRadius: isSmallScreen ? 8 : 10,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: isSmallScreen ? 10 : 12,
        paddingHorizontal: 8,
        borderRadius: isSmallScreen ? 6 : 8,
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#3b82f6',
        fontWeight: '600',
    },
    tradeSymbol: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    positionDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    positionAmount: {
        color: '#ccd6f6',
        fontSize: 16,
        fontWeight: '600',
    },
    positionPrice: {
        color: '#8892b0',
        fontSize: 14,
    },
    roiText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    positionCard: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 12 : 16,
        padding: isSmallScreen ? 14 : 16,
        marginBottom: isSmallScreen ? 10 : 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    positionCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    positionSymbol: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '700',
    },
    positionName: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
        marginTop: 2,
    },
    positionMetrics: {
        alignItems: 'flex-end',
    },
    unrealizedPNL: {
        color: '#64ffda',
        fontSize: 16,
        fontWeight: 'bold',
    },
    realizedPNL: {
        color: '#ff6b6b',
        fontSize: 16,
        fontWeight: 'bold',
    },
    detailModalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: isSmallScreen ? 20 : 24,
        borderTopRightRadius: isSmallScreen ? 20 : 24,
        width: '100%',
        height: isSmallScreen ? '90%' : '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    detailModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isSmallScreen ? 16 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    detailHeaderInfo: {
        flex: 1,
    },
    detailModalTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 18 : 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    detailModalSubtitle: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
    },
    closeButton: {
        padding: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '600',
    },
    detailModalBody: {
        flex: 1,
        minHeight: 0,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        padding: isSmallScreen ? 16 : 20,
        paddingBottom: 32,
    },
    performanceSection: {
        marginBottom: 16,
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 10 : 12,
        padding: isSmallScreen ? 14 : 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    performanceGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
    },
    performanceItem: {
        flex: 1,
        alignItems: 'center',
    },
    performanceLabel: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
        fontWeight: '500',
        marginBottom: 4,
        textAlign: 'center',
    },
    performanceValue: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    positionSection: {
        marginBottom: 16,
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 10 : 12,
        padding: isSmallScreen ? 14 : 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    detailGrid: {
        gap: isSmallScreen ? 10 : 12,
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    detailLabel: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
        fontWeight: '500',
    },
    detailValue: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 12 : 14,
        fontWeight: '600',
    },
    tradeHistorySection: {
        marginBottom: 16,
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 10 : 12,
        padding: isSmallScreen ? 14 : 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tradeHistoryItem: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    tradeHistoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    tradeHistoryDetails: {
        gap: 4,
    },
    tradeHistoryText: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
    },
    detailModalActions: {
        padding: isSmallScreen ? 16 : 20,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        backgroundColor: '#ffffff',
    },
    modalActionButton: {
        backgroundColor: '#dc2626',
        paddingVertical: isSmallScreen ? 12 : 14,
        paddingHorizontal: isSmallScreen ? 20 : 24,
        borderRadius: isSmallScreen ? 10 : 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    modalActionButtonText: {
        color: '#ffffff',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    availableInfoSection: {
        marginBottom: isSmallScreen ? 20 : 24,
    },
    availableInfoCard: {
        backgroundColor: '#f9fafb',
        borderRadius: isSmallScreen ? 10 : 12,
        padding: isSmallScreen ? 14 : 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    availableInfoLabel: {
        color: '#374151',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    availableInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    availableInfoValue: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '700',
    },
    availableInfoSecondary: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
    },
    sliderSection: {
        marginBottom: isSmallScreen ? 20 : 24,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sliderLabel: {
        color: '#374151',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    quickSelectContainer: {
        marginBottom: 16,
    },
    quickSelectButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: isSmallScreen ? 6 : 8,
    },
    quickSelectButton: {
        flex: 1,
        backgroundColor: '#ffffff',
        paddingVertical: isSmallScreen ? 8 : 10,
        paddingHorizontal: isSmallScreen ? 8 : 12,
        borderRadius: isSmallScreen ? 6 : 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    quickSelectButtonText: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
        fontWeight: '600',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
    },
    tradeTypeText: {
        color: '#ccd6f6',
        fontSize: 14,
        fontWeight: '600',
    },
    sellActionButton: {
        backgroundColor: '#ff6b6b',
    },
    cryptoInfo: {
        flex: 1,
    },
    availableBalanceContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    availableBalanceLabel: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 4,
    },
    availableBalanceValue: {
        color: '#ccd6f6',
        fontSize: 18,
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        color: '#ccd6f6',
        fontSize: 20,
        fontWeight: 'bold',
    },
    refreshInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    refreshText: {
        color: '#94a3b8',
        fontSize: 12,
    },
}); 