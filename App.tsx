// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from './contexts/ThemeContext';

// Importar telas
import HomeScreen from './screens/HomeScreen';
import ProductListScreen from './screens/ProductListScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import AddProductScreen from './screens/AddProductScreen';
import ScannerScreen from './screens/ScannerScreen';
import DashboardScreen from './screens/DashboardScreen';
import SettingsScreen from './screens/SettingsScreen';
import ServerConfigScreen from './screens/ServerConfigScreen';
import DiagnosticScreen from './screens/DiagnosticScreen';
import HistoryScreen from './screens/HistoryScreen';

// Novas telas inteligentes
import SmartDashboardScreen from './screens/SmartDashboardScreen';
import ShoppingListScreen from './screens/ShoppingListScreen';
import CriticalProductsScreen from './screens/CriticalProductsScreen';

// Definição dos tipos para navegação
export type RootStackParamList = {
  Home: undefined;
  ProductList: undefined;
  ProductDetail: { product: any };
  AddProduct: undefined;
  Scanner: undefined;
  Dashboard: undefined;
  Settings: undefined;
  ServerConfig: undefined;
  Diagnostic: undefined;
  History: undefined;
  
  // Novas rotas
  SmartDashboard: undefined;
  ShoppingList: undefined;
  CriticalProducts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="ProductList" component={ProductListScreen} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <Stack.Screen name="AddProduct" component={AddProductScreen} />
          <Stack.Screen name="Scanner" component={ScannerScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ServerConfig" component={ServerConfigScreen} />
          <Stack.Screen name="Diagnostic" component={DiagnosticScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          
          {/* Novas telas inteligentes */}
          <Stack.Screen 
            name="SmartDashboard" 
            component={SmartDashboardScreen}
            options={{
              animation: 'slide_from_bottom'
            }}
          />
          <Stack.Screen 
            name="ShoppingList" 
            component={ShoppingListScreen}
            options={{
              animation: 'fade_from_bottom'
            }}
          />
          <Stack.Screen 
            name="CriticalProducts" 
            component={CriticalProductsScreen}
            options={{
              animation: 'slide_from_right'
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}