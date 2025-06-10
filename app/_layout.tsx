import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, Platform, Dimensions } from 'react-native';
import { PortfolioProvider } from './context/PortfolioContext';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

export default function RootLayout() {
    return (
        <PortfolioProvider>
            <SafeAreaProvider>
                <Tabs
                    screenOptions={{
                        headerStyle: {
                            backgroundColor: '#ffffff',
                            borderBottomWidth: 1,
                            borderBottomColor: '#e5e7eb',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 3,
                            elevation: 3,
                        },
                        headerTintColor: '#1f2937',
                        headerTitleStyle: {
                            fontWeight: '600',
                            fontSize: isSmallScreen ? 18 : 20,
                        },
                        tabBarStyle: {
                            backgroundColor: '#ffffff',
                            borderTopColor: '#e5e7eb',
                            borderTopWidth: 1,
                            paddingBottom: Platform.OS === 'ios' ? 20 : 8,
                            paddingTop: 8,
                            height: Platform.OS === 'ios' ? 84 : 60,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 3,
                            elevation: 8,
                        },
                        tabBarActiveTintColor: '#3b82f6',
                        tabBarInactiveTintColor: '#6b7280',
                        tabBarLabelStyle: {
                            fontSize: isSmallScreen ? 11 : 12,
                            fontWeight: '500',
                            marginTop: 4,
                        },
                    }}
                >
                    <Tabs.Screen
                        name="index"
                        options={{
                            title: 'Portfolio',
                            tabBarLabel: 'Portfolio',
                            tabBarIcon: ({ color }) => (
                                <Text style={{ fontSize: isSmallScreen ? 20 : 22, color }}>💰</Text>
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="trades"
                        options={{
                            title: 'Trades',
                            tabBarLabel: 'Trades',
                            tabBarIcon: ({ color }) => (
                                <Text style={{ fontSize: isSmallScreen ? 20 : 22, color }}>📈</Text>
                            ),
                        }}
                    />
                </Tabs>
            </SafeAreaProvider>
        </PortfolioProvider>
    );
} 