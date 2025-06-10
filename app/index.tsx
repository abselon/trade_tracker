import { useState } from 'react';
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
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortfolio } from './context/PortfolioContext';

interface Transaction {
    id: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    date: Date;
}

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 380;
const isTablet = width >= 768;

export default function HomeScreen() {
    const { balance, updateBalance } = usePortfolio();
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'deposit' | 'withdraw'>('deposit');
    const [amount, setAmount] = useState('');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [successVisible, setSuccessVisible] = useState(false);
    const [successData, setSuccessData] = useState<{ type: 'deposit' | 'withdraw', amount: number } | null>(null);

    const handleDeposit = () => {
        setModalType('deposit');
        setModalVisible(true);
    };

    const handleWithdraw = () => {
        setModalType('withdraw');
        setModalVisible(true);
    };

    const confirmTransaction = () => {
        const numAmount = parseFloat(amount);

        if (isNaN(numAmount) || numAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (modalType === 'withdraw' && numAmount > balance) {
            Alert.alert('Error', 'Insufficient funds');
            return;
        }

        const newTransaction: Transaction = {
            id: Date.now().toString(),
            type: modalType,
            amount: numAmount,
            date: new Date(),
        };

        setTransactions((prev: Transaction[]) => [newTransaction, ...prev]);
        updateBalance(numAmount, modalType);

        setAmount('');
        setModalVisible(false);

        // Show custom success notification
        setSuccessData({ type: modalType, amount: numAmount });
        setSuccessVisible(true);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            setSuccessVisible(false);
        }, 3000);
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
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Portfolio Balance Card */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                        <Text style={styles.balanceLabel}>Total Portfolio</Text>
                        <View style={styles.balanceIconContainer}>
                            <Text style={styles.balanceIcon}>💰</Text>
                        </View>
                    </View>
                    <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
                    <Text style={styles.balanceSubText}>Available Balance</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.depositButton]}
                        onPress={handleDeposit}
                        activeOpacity={0.8}
                    >
                        <View style={styles.actionButtonContent}>
                            <Text style={styles.actionButtonIcon}>↗️</Text>
                            <Text style={styles.actionButtonText}>Deposit</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.withdrawButton]}
                        onPress={handleWithdraw}
                        activeOpacity={0.8}
                    >
                        <View style={styles.actionButtonContent}>
                            <Text style={styles.actionButtonIcon}>↙️</Text>
                            <Text style={styles.actionButtonText}>Withdraw</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Recent Transactions */}
                <View style={styles.transactionsContainer}>
                    <Text style={styles.transactionsTitle}>Recent Transactions</Text>
                    {transactions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateIcon}>📝</Text>
                            <Text style={styles.emptyStateText}>No transactions yet</Text>
                            <Text style={styles.emptyStateSubtext}>Start by making your first deposit!</Text>
                        </View>
                    ) : (
                        <View style={styles.transactionsList}>
                            {transactions.map((transaction) => (
                                <View key={transaction.id} style={styles.transactionItem}>
                                    <View style={styles.transactionLeft}>
                                        <View style={[
                                            styles.transactionIconContainer,
                                            transaction.type === 'deposit' ? styles.depositIconBg : styles.withdrawIconBg
                                        ]}>
                                            <Text style={styles.transactionIcon}>
                                                {transaction.type === 'deposit' ? '↗️' : '↙️'}
                                            </Text>
                                        </View>
                                        <View style={styles.transactionInfo}>
                                            <Text style={styles.transactionType}>
                                                {transaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                                            </Text>
                                            <Text style={styles.transactionDate}>{formatDate(transaction.date)}</Text>
                                        </View>
                                    </View>
                                    <Text style={[
                                        styles.transactionAmount,
                                        transaction.type === 'deposit' ? styles.positiveAmount : styles.negativeAmount
                                    ]}>
                                        {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Transaction Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {modalType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
                            </Text>
                            <Text style={styles.modalSubtitle}>
                                {modalType === 'deposit'
                                    ? 'Add money to your portfolio'
                                    : 'Remove money from your portfolio'
                                }
                            </Text>
                        </View>

                        {/* Amount Input */}
                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Enter Amount</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.currencySymbol}>$</Text>
                                <TextInput
                                    style={styles.input}
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder="0.00"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="numeric"
                                    autoFocus={true}
                                />
                            </View>

                            {modalType === 'withdraw' && (
                                <View style={styles.balanceInfo}>
                                    <Text style={styles.availableLabel}>Available Balance</Text>
                                    <Text style={styles.availableAmount}>{formatCurrency(balance)}</Text>
                                </View>
                            )}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setAmount('');
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton,
                                modalType === 'deposit' ? styles.confirmDepositButton : styles.confirmWithdrawButton]}
                                onPress={confirmTransaction}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {modalType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Success Notification */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={successVisible}
                onRequestClose={() => setSuccessVisible(false)}
            >
                <View style={styles.successOverlay}>
                    <View style={styles.successContent}>
                        <View style={styles.successIcon}>
                            <Text style={styles.successIconText}>✓</Text>
                        </View>
                        <Text style={styles.successTitle}>
                            {successData?.type === 'deposit' ? 'Deposit Successful!' : 'Withdrawal Successful!'}
                        </Text>
                        <Text style={styles.successMessage}>
                            {successData?.type === 'deposit' ? 'Added' : 'Withdrew'} {successData ? formatCurrency(successData.amount) : ''} {successData?.type === 'deposit' ? 'to' : 'from'} your portfolio
                        </Text>
                        <TouchableOpacity
                            style={styles.successButton}
                            onPress={() => setSuccessVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.successButtonText}>Continue</Text>
                        </TouchableOpacity>
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
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: isSmallScreen ? 16 : 20,
        paddingBottom: 30,
    },

    // Balance Card
    balanceCard: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 16 : 20,
        padding: isSmallScreen ? 20 : 24,
        marginBottom: isSmallScreen ? 20 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    balanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    balanceLabel: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '500',
    },
    balanceIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    balanceIcon: {
        fontSize: 16,
    },
    balanceAmount: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 28 : 36,
        fontWeight: '700',
        marginBottom: 4,
    },
    balanceSubText: {
        color: '#9ca3af',
        fontSize: isSmallScreen ? 12 : 14,
    },

    // Action Buttons
    actionContainer: {
        flexDirection: isTablet ? 'row' : 'row',
        gap: isSmallScreen ? 12 : 16,
        marginBottom: isSmallScreen ? 24 : 32,
    },
    actionButton: {
        flex: 1,
        paddingVertical: isSmallScreen ? 16 : 18,
        borderRadius: isSmallScreen ? 12 : 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    depositButton: {
        backgroundColor: '#3b82f6',
    },
    withdrawButton: {
        backgroundColor: '#ef4444',
    },
    actionButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionButtonIcon: {
        fontSize: isSmallScreen ? 16 : 18,
    },
    actionButtonText: {
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        color: '#ffffff',
    },

    // Transactions
    transactionsContainer: {
        flex: 1,
    },
    transactionsTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 18 : 20,
        fontWeight: '600',
        marginBottom: isSmallScreen ? 12 : 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: isSmallScreen ? 32 : 40,
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 12 : 16,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    emptyStateIcon: {
        fontSize: isSmallScreen ? 32 : 40,
        marginBottom: 12,
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
    },
    transactionsList: {
        gap: isSmallScreen ? 8 : 12,
    },
    transactionItem: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 12 : 16,
        padding: isSmallScreen ? 14 : 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionIconContainer: {
        width: isSmallScreen ? 36 : 40,
        height: isSmallScreen ? 36 : 40,
        borderRadius: isSmallScreen ? 18 : 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    depositIconBg: {
        backgroundColor: '#dbeafe',
    },
    withdrawIconBg: {
        backgroundColor: '#fecaca',
    },
    transactionIcon: {
        fontSize: isSmallScreen ? 14 : 16,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionType: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    transactionDate: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 11 : 12,
    },
    transactionAmount: {
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
    positiveAmount: {
        color: '#059669',
    },
    negativeAmount: {
        color: '#dc2626',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 20 : 24,
        width: '100%',
        maxWidth: isSmallScreen ? 340 : 380,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
    },
    modalHeader: {
        padding: isSmallScreen ? 20 : 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 18 : 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    modalSubtitle: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 13 : 14,
        textAlign: 'center',
    },
    inputSection: {
        padding: isSmallScreen ? 20 : 24,
    },
    inputLabel: {
        color: '#374151',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: isSmallScreen ? 12 : 16,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    currencySymbol: {
        color: '#3b82f6',
        fontSize: isSmallScreen ? 20 : 24,
        fontWeight: '600',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: isSmallScreen ? 20 : 24,
        fontWeight: '600',
        color: '#1f2937',
        paddingVertical: isSmallScreen ? 12 : 16,
    },
    balanceInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
    },
    availableLabel: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 12 : 14,
        fontWeight: '500',
    },
    availableAmount: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 13 : 14,
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        padding: isSmallScreen ? 16 : 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    modalButton: {
        flex: 1,
        paddingVertical: isSmallScreen ? 12 : 16,
        borderRadius: isSmallScreen ? 10 : 12,
        alignItems: 'center',
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
    confirmDepositButton: {
        backgroundColor: '#3b82f6',
    },
    confirmWithdrawButton: {
        backgroundColor: '#ef4444',
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

    // Success Modal
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    successContent: {
        backgroundColor: '#ffffff',
        borderRadius: isSmallScreen ? 20 : 24,
        padding: isSmallScreen ? 24 : 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: isSmallScreen ? 300 : 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
    },
    successIcon: {
        width: isSmallScreen ? 60 : 80,
        height: isSmallScreen ? 60 : 80,
        borderRadius: isSmallScreen ? 30 : 40,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: isSmallScreen ? 16 : 20,
    },
    successIconText: {
        fontSize: isSmallScreen ? 24 : 32,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    successTitle: {
        color: '#1f2937',
        fontSize: isSmallScreen ? 18 : 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    successMessage: {
        color: '#6b7280',
        fontSize: isSmallScreen ? 13 : 14,
        textAlign: 'center',
        marginBottom: isSmallScreen ? 20 : 24,
        lineHeight: 20,
    },
    successButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: isSmallScreen ? 24 : 32,
        paddingVertical: isSmallScreen ? 10 : 12,
        borderRadius: isSmallScreen ? 8 : 10,
    },
    successButtonText: {
        color: '#ffffff',
        fontSize: isSmallScreen ? 14 : 16,
        fontWeight: '600',
    },
}); 