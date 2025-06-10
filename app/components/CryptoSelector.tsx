import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    Dimensions,
    Platform,
} from 'react-native';
import { CryptoService, CryptoCurrency } from '../../services/cryptoService';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

interface CryptoSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (crypto: CryptoCurrency) => void;
    selectedSymbol?: string;
}

interface CryptoSelectorState {
    cryptos: CryptoCurrency[];
    filteredCryptos: CryptoCurrency[];
    loading: boolean;
    searchQuery: string;
    searchLoading: boolean;
}

export default class CryptoSelector extends React.Component<CryptoSelectorProps, CryptoSelectorState> {
    private searchTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(props: CryptoSelectorProps) {
        super(props);
        this.state = {
            cryptos: [],
            filteredCryptos: [],
            loading: false,
            searchQuery: '',
            searchLoading: false
        };
    }

    componentDidUpdate(prevProps: CryptoSelectorProps, prevState: CryptoSelectorState) {
        if (this.props.visible && !prevProps.visible) {
            this.loadPopularCryptos();
        }

        if (this.state.searchQuery !== prevState.searchQuery) {
            // Clear previous timeout
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            if (this.state.searchQuery.trim()) {
                // Debounce search with 500ms delay
                this.searchTimeout = setTimeout(() => {
                    this.handleSearch();
                }, 500);
            } else {
                this.setState({ filteredCryptos: this.state.cryptos, searchLoading: false });
            }
        }
    }

    componentWillUnmount() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
    }

    loadPopularCryptos = async () => {
        this.setState({ loading: true });
        try {
            const data = await CryptoService.getPopularCryptocurrencies();
            this.setState({
                cryptos: data,
                filteredCryptos: data,
                loading: false
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to load cryptocurrencies. Please try again.');
            console.error('Error loading cryptos:', error);
            this.setState({ loading: false });
        }
    };

    handleSearch = async () => {
        if (this.state.searchQuery.trim().length < 2) {
            this.setState({ filteredCryptos: this.state.cryptos });
            return;
        }

        this.setState({ searchLoading: true });
        try {
            // First filter local results
            const localResults = this.state.cryptos.filter((crypto: CryptoCurrency) =>
                crypto.name.toLowerCase().includes(this.state.searchQuery.toLowerCase()) ||
                crypto.symbol.toLowerCase().includes(this.state.searchQuery.toLowerCase())
            );

            if (localResults.length > 0) {
                this.setState({
                    filteredCryptos: localResults,
                    searchLoading: false
                });
            } else {
                // Search via API if no local results
                const searchResults = await CryptoService.searchCryptocurrencies(this.state.searchQuery);
                this.setState({
                    filteredCryptos: searchResults,
                    searchLoading: false
                });
            }
        } catch (error) {
            console.error('Search error:', error);
            // Fall back to local filtering
            const localResults = this.state.cryptos.filter((crypto: CryptoCurrency) =>
                crypto.name.toLowerCase().includes(this.state.searchQuery.toLowerCase()) ||
                crypto.symbol.toLowerCase().includes(this.state.searchQuery.toLowerCase())
            );
            this.setState({
                filteredCryptos: localResults,
                searchLoading: false
            });
        }
    };

    handleSelect = (crypto: CryptoCurrency) => {
        if (typeof this.props.onSelect === 'function') {
            this.props.onSelect(crypto);
            this.props.onClose();
            this.setState({ searchQuery: '' });
        } else {
            console.error('onSelect is not a function', typeof this.props.onSelect);
            Alert.alert('Error', 'Selection function is not available');
        }
    };

    handleSearchQueryChange = (text: string) => {
        this.setState({ searchQuery: text, searchLoading: text.trim().length >= 2 });
    };

    formatPrice = (price: number) => {
        if (price < 0.01) {
            return `$${price.toFixed(6)}`;
        } else if (price < 1) {
            return `$${price.toFixed(4)}`;
        } else {
            return `$${price.toFixed(2)}`;
        }
    };

    formatPriceChange = (change: number) => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    };

    render() {
        const { visible, onClose, selectedSymbol } = this.props;
        const { loading, filteredCryptos, searchLoading, searchQuery } = this.state;

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={visible}
                onRequestClose={onClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Select Cryptocurrency</Text>
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Text style={styles.closeButtonText}>×</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search cryptocurrencies..."
                                placeholderTextColor="#9ca3af"
                                value={searchQuery}
                                onChangeText={(text) => this.handleSearchQueryChange(text)}
                                autoCapitalize="none"
                            />
                            {searchLoading && (
                                <ActivityIndicator
                                    style={styles.searchLoader}
                                    size="small"
                                    color="#3b82f6"
                                />
                            )}
                        </View>

                        {/* Loading State */}
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3b82f6" />
                                <Text style={styles.loadingText}>Loading cryptocurrencies...</Text>
                            </View>
                        ) : (
                            /* Crypto List */
                            <ScrollView style={styles.cryptoList} showsVerticalScrollIndicator={false}>
                                {filteredCryptos.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyText}>No cryptocurrencies found</Text>
                                        <Text style={styles.emptySubtext}>Try a different search term</Text>
                                    </View>
                                ) : (
                                    filteredCryptos.map((crypto: CryptoCurrency) => (
                                        <TouchableOpacity
                                            key={crypto.id}
                                            style={[
                                                styles.cryptoItem,
                                                selectedSymbol === crypto.symbol && styles.selectedCrypto
                                            ]}
                                            onPress={() => this.handleSelect(crypto)}
                                        >
                                            <View style={styles.cryptoInfo}>
                                                <View style={styles.cryptoHeader}>
                                                    <Text style={styles.cryptoSymbol}>{crypto.symbol}</Text>
                                                    <Text style={styles.cryptoName}>{crypto.name}</Text>
                                                </View>
                                                <Text style={styles.cryptoRank}>#{crypto.market_cap_rank}</Text>
                                            </View>

                                            <View style={styles.cryptoPricing}>
                                                <Text style={styles.cryptoPrice}>
                                                    {this.formatPrice(crypto.current_price)}
                                                </Text>
                                                <Text style={[
                                                    styles.cryptoChange,
                                                    crypto.price_change_percentage_24h >= 0
                                                        ? styles.positiveChange
                                                        : styles.negativeChange
                                                ]}>
                                                    {this.formatPriceChange(crypto.price_change_percentage_24h)}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        );
    }
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: isSmallScreen ? 20 : 24,
        borderTopRightRadius: isSmallScreen ? 20 : 24,
        height: isSmallScreen ? '85%' : '80%',
        paddingTop: isSmallScreen ? 16 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: isSmallScreen ? 16 : 20,
        paddingBottom: isSmallScreen ? 16 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    title: {
        fontSize: isSmallScreen ? 16 : 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    closeButton: {
        width: isSmallScreen ? 28 : 30,
        height: isSmallScreen ? 28 : 30,
        borderRadius: isSmallScreen ? 14 : 15,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: isSmallScreen ? 18 : 20,
        color: '#6b7280',
        fontWeight: '600',
    },
    searchContainer: {
        paddingHorizontal: isSmallScreen ? 16 : 20,
        paddingVertical: isSmallScreen ? 12 : 15,
        position: 'relative',
    },
    searchInput: {
        backgroundColor: '#f9fafb',
        borderRadius: isSmallScreen ? 10 : 12,
        paddingHorizontal: 16,
        paddingVertical: isSmallScreen ? 10 : 12,
        fontSize: isSmallScreen ? 14 : 16,
        color: '#1f2937',
        paddingRight: 40,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    searchLoader: {
        position: 'absolute',
        right: isSmallScreen ? 26 : 30,
        top: isSmallScreen ? 22 : 27,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: isSmallScreen ? 14 : 16,
        color: '#6b7280',
    },
    cryptoList: {
        flex: 1,
        paddingHorizontal: isSmallScreen ? 16 : 20,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: isSmallScreen ? 32 : 40,
    },
    emptyText: {
        fontSize: isSmallScreen ? 14 : 16,
        color: '#6b7280',
        fontWeight: '500',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: isSmallScreen ? 12 : 14,
        color: '#9ca3af',
    },
    cryptoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 10 : 12,
        padding: isSmallScreen ? 14 : 16,
        marginBottom: isSmallScreen ? 6 : 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    selectedCrypto: {
        borderWidth: 2,
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    cryptoInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cryptoHeader: {
        flex: 1,
    },
    cryptoSymbol: {
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 2,
    },
    cryptoName: {
        fontSize: isSmallScreen ? 12 : 14,
        color: '#6b7280',
    },
    cryptoRank: {
        fontSize: isSmallScreen ? 10 : 12,
        color: '#9ca3af',
        marginLeft: 10,
    },
    cryptoPricing: {
        alignItems: 'flex-end',
    },
    cryptoPrice: {
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    cryptoChange: {
        fontSize: isSmallScreen ? 10 : 12,
        fontWeight: '600',
    },
    positiveChange: {
        color: '#059669',
    },
    negativeChange: {
        color: '#dc2626',
    },
}); 