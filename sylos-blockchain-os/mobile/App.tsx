// Mobile App Entry Point for Sylos Blockchain OS
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import { store } from './src/store/store';

// Screens
import WalletScreen from './src/screens/WalletScreen';
import DeFiScreen from './src/screens/DeFiScreen';
import GovernanceScreen from './src/screens/GovernanceScreen';
import StakingScreen from './src/screens/StakingScreen';
import NFTScreen from './src/screens/NFTScreen';
import IdentityScreen from './src/screens/IdentityScreen';
import BridgeScreen from './src/screens/BridgeScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Icons
import { Ionicons } from '@expo/vector-icons';

// Theme
import { theme } from './src/theme/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Wallet':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'DeFi':
              iconName = focused ? 'trending-up' : 'trending-up-outline';
              break;
            case 'Governance':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Staking':
              iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
              break;
            case 'NFTs':
              iconName = focused ? 'image' : 'image-outline';
              break;
            case 'Identity':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Bridge':
              iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="DeFi" component={DeFiScreen} />
      <Tab.Screen name="Governance" component={GovernanceScreen} />
      <Tab.Screen name="Staking" component={StakingScreen} />
      <Tab.Screen name="NFTs" component={NFTScreen} />
      <Tab.Screen name="Identity" component={IdentityScreen} />
      <Tab.Screen name="Bridge" component={BridgeScreen} />
    </Tab.Navigator>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
          <StatusBar style="light" />
        </NavigationContainer>
      </Provider>
    </SafeAreaProvider>
  );
};

export default App;