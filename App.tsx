import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ScannerScreen from './screens/ScannerScreen';
import ProductListScreen from './screens/ProductListScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import AddProductScreen from './screens/AddProductScreen';
import DashboardScreen from './screens/DashboardScreen';
import SettingsScreen from './screens/SettingsScreen';

// Definição de tipos para as rotas de navegação
export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  ProductList: undefined;
  ProductDetail: { product: any };
  AddProduct: undefined;
  Dashboard: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerShown: false, // Removemos os headers padrão pois usamos nosso próprio componente Header
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
        />
        <Stack.Screen 
          name="Scanner" 
          component={ScannerScreen} 
        />
        <Stack.Screen 
          name="ProductList" 
          component={ProductListScreen} 
        />
        <Stack.Screen 
          name="ProductDetail" 
          component={ProductDetailScreen} 
        />
        <Stack.Screen 
          name="AddProduct" 
          component={AddProductScreen} 
        />
        <Stack.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}