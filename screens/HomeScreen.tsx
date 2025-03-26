// screens/HomeScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import ConnectionStatus from '../components/ConnectionStatus';
import { verificarConexao, sincronizarDados } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../App';

// Importações dos ícones SVG
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Octicons from 'react-native-vector-icons/Octicons';

// Definição do tipo para as propriedades de navegação
type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

// Interface para o produto
interface Product {
  code: string;
  name: string;
  description?: string;
  quantidade: number;
  quantity?: number;
}

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme } = useTheme();
  const { COLORS } = theme;

  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [shouldShowServerConfig, setShouldShowServerConfig] = useState<boolean>(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Animations for menu items
  const menuAnimations = useRef(Array(10).fill(0).map(() => new Animated.Value(0))).current;

  // Verify if it's first use
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        const firstRun = await AsyncStorage.getItem('@first_run');
        if (firstRun === null) {
          // First run
          setShouldShowServerConfig(true);
          await AsyncStorage.setItem('@first_run', 'false');
        }
      } catch (error) {
        console.error("Error checking first run:", error);
      }
    };
    
    checkFirstRun();
  }, []);

  // Show server config if it's first time
  useEffect(() => {
    if (shouldShowServerConfig) {
      Alert.alert(
        "Configuração Necessária",
        "Parece que é a primeira vez que você usa o aplicativo. É necessário configurar o endereço do servidor para sincronizar os dados com o banco de dados PostgreSQL.",
        [
          {
            text: "Mais tarde",
            style: "cancel"
          },
          {
            text: "Configurar Agora",
            onPress: () => navigation.navigate('ServerConfig')
          }
        ]
      );
      setShouldShowServerConfig(false);
    }
  }, [shouldShowServerConfig, navigation]);

  // Start animations when component mounts
  useEffect(() => {
    // Main animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          })
        ])
      )
    ]).start();
    
    // Staggered animations for menu items
    Animated.stagger(
      100,
      menuAnimations.map(anim => 
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [fadeAnim, slideAnim, scaleAnim, rotateAnim, menuAnimations]);

  // Load inventory summary data
  useEffect(() => {
    const loadInventorySummary = async () => {
      try {
        setLoading(true);
        
        // Try to connect to server first
        await verificarConexao();
        
        const jsonValue = await AsyncStorage.getItem('produtos');
        
        if (jsonValue != null) {
          const products: Product[] = JSON.parse(jsonValue);
          setTotalProducts(products.length);
          
          // Count products with low stock (less than 5 units)
          const lowStock = products.filter(p => p.quantidade < 5).length;
          setLowStockCount(lowStock);

          // Count total items in stock
          const total = products.reduce((sum: number, p: Product) => sum + p.quantidade, 0);
          setTotalItems(total);
        } else {
          // No products found
          setTotalProducts(0);
          setLowStockCount(0);
          setTotalItems(0);
        }
        
        // Register update time
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        console.error("Error loading inventory summary:", error);
      } finally {
        setLoading(false);
      }
    };

    // Execute when component mounts
    loadInventorySummary();
    
    // Set up a focus listener to update when screen receives focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadInventorySummary();
    });

    // Cleanup when unmounting
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Animated.View 
          style={[
            styles.decorativeShape, 
            {
              transform: [
                { 
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }
              ]
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.decorativeShape2, 
            {
              transform: [
                { 
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-360deg']
                  })
                }
              ]
            }
          ]} 
        />
        
        <Header showLogo={true} />
        
        {/* Connection Status inside header gradient for cleaner look */}
        <View style={styles.connectionContainer}>
          <ConnectionStatus 
            onConfigPress={() => navigation.navigate('ServerConfig')}
            compact={true}
          />
        </View>
      </LinearGradient>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome card with Gradient */}
        <Animated.View style={[
          styles.welcomeCardContainer, 
          { 
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}>
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeCard}
          >
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeTitle}>
                Bem-vindo ao Sistema
              </Text>
              <Text style={styles.welcomeText}>
                Controle seu estoque com facilidade e eficiência
              </Text>
            </View>
            
            <View style={styles.welcomeDecoration}>
              <View style={styles.circle1} />
              <View style={styles.circle2} />
              <View style={styles.circle3} />
            </View>
            
            <View style={styles.welcomeIllustration}>
              <MaterialIcons name="dashboard" size={40} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </Animated.View>
        
        {/* Dashboard cards */}
        <View style={styles.dashboardContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleContainer}>
              <View style={styles.titleDecoration} />
              <Text style={[styles.sectionTitle, { color: COLORS.black }]}>Resumo do Estoque</Text>
            </View>
            <Text style={[styles.updateText, { color: COLORS.grey }]}>Atualizado: {lastUpdate}</Text>
          </View>
          
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              <Text style={[styles.loaderText, { color: COLORS.grey }]}>Carregando dados...</Text>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              <Animated.View 
                style={[
                  styles.cardWrapper,
                  { 
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('ProductList')}
                  style={styles.cardTouchable}
                >
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.card, styles.elevatedCard]}
                  >
                    <View style={styles.cardContentTop}>
                      <View style={styles.cardIcon}>
                        <MaterialIcons name="inventory" size={30} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.cardContentBottom}>
                      <Text style={styles.cardValue}>{totalProducts}</Text>
                      <Text style={styles.cardLabel}>Produtos</Text>
                    </View>
                    <View style={styles.cardDecoration} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              
              <Animated.View 
                style={[
                  styles.cardWrapper,
                  { 
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0]
                    }) }]
                  }
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('Dashboard')}
                  style={styles.cardTouchable}
                >
                  <LinearGradient
                    colors={[COLORS.success, '#1B5E20']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.card, styles.elevatedCard]}
                  >
                    <View style={styles.cardContentTop}>
                      <View style={styles.cardIcon}>
                        <MaterialCommunityIcons name="counter" size={30} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.cardContentBottom}>
                      <Text style={styles.cardValue}>{totalItems}</Text>
                      <Text style={styles.cardLabel}>Itens Total</Text>
                    </View>
                    <View style={styles.cardDecoration} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              
              <Animated.View 
                style={[
                  styles.cardWrapper,
                  { 
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('CriticalProducts')}
                  style={styles.cardTouchable}
                >
                  <LinearGradient
                    colors={lowStockCount > 0 ? [COLORS.warning, '#E65100'] : [COLORS.grey, '#424242']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.card, styles.elevatedCard]}
                  >
                    <View style={styles.cardContentTop}>
                      <View style={styles.cardIcon}>
                        <MaterialIcons name="warning" size={30} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.cardContentBottom}>
                      <Text style={styles.cardValue}>{lowStockCount}</Text>
                      <Text style={styles.cardLabel}>Est. Baixo</Text>
                    </View>
                    <View style={styles.cardDecoration} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </View>
        
        {/* Main menu */}
        <View style={styles.menuSection}>
          <View style={styles.titleContainer}>
            <View style={[styles.titleDecoration, {backgroundColor: COLORS.accent}]} />
            <Text style={[styles.sectionTitle, { color: COLORS.black }]}>Menu Principal</Text>
          </View>
          
          <View style={styles.menuGrid}>
            <Animated.View style={{
              opacity: menuAnimations[0],
              transform: [
                { scale: menuAnimations[0] },
                { translateY: menuAnimations[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('Scanner')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialIcons name="qr-code-scanner" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Escanear QR</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{
              opacity: menuAnimations[1],
              transform: [
                { scale: menuAnimations[1] },
                { translateY: menuAnimations[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('ProductList')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.accent, '#E65100']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialIcons name="list-alt" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Produtos</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{
              opacity: menuAnimations[2],
              transform: [
                { scale: menuAnimations[2] },
                { translateY: menuAnimations[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('AddProduct')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.success, '#1B5E20']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Ionicons name="add" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Adicionar</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{
              opacity: menuAnimations[3],
              transform: [
                { scale: menuAnimations[3] },
                { translateY: menuAnimations[3].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('Dashboard')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.info, '#01579B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialIcons name="bar-chart" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Dashboard</Text>
              </TouchableOpacity>
            </Animated.View>
            
            {/* Dashboard Inteligente */}
            <Animated.View style={{
              opacity: menuAnimations[4],
              transform: [
                { scale: menuAnimations[4] },
                { translateY: menuAnimations[4].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('SmartDashboard')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#5E35B1', '#4527A0']} // Roxo
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialCommunityIcons name="brain" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>IA Dashboard</Text>
              </TouchableOpacity>
            </Animated.View>
            
            <Animated.View style={{
              opacity: menuAnimations[5],
              transform: [
                { scale: menuAnimations[5] },
                { translateY: menuAnimations[5].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#8E24AA', '#4A148C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialIcons name="history" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Histórico</Text>
              </TouchableOpacity>
            </Animated.View>
            
            {/* Lista de Compras Inteligente */}
            <Animated.View style={{
              opacity: menuAnimations[6],
              transform: [
                { scale: menuAnimations[6] },
                { translateY: menuAnimations[6].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('ShoppingList')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#D81B60', '#AD1457']} // Rosa
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialIcons name="shopping-cart" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Lista Compras</Text>
              </TouchableOpacity>
            </Animated.View>
            
            <Animated.View style={{
              opacity: menuAnimations[7],
              transform: [
                { scale: menuAnimations[7] },
                { translateY: menuAnimations[7].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#757575', '#424242']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Ionicons name="settings-sharp" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Configurações</Text>
              </TouchableOpacity>
            </Animated.View>
            
            {/* Produtos Críticos */}
            <Animated.View style={{
              opacity: menuAnimations[9],
              transform: [
                { scale: menuAnimations[9] },
                { translateY: menuAnimations[9].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }) }
              ]
            }}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.elevatedCard, { backgroundColor: COLORS.card }]} 
                onPress={() => navigation.navigate('CriticalProducts')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.error, '#C62828']} // Vermelho
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <MaterialIcons name="error-outline" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.menuText, { color: COLORS.text }]}>Produtos Críticos</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.titleContainer}>
            <View style={[styles.titleDecoration, {backgroundColor: COLORS.success}]} />
            <Text style={[styles.sectionTitle, { color: COLORS.black }]}>Ações Rápidas</Text>
          </View>
          
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              })}
            ]
          }}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.elevatedCard]}
              onPress={() => navigation.navigate('AddProduct')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[COLORS.success, '#81C784']} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <MaterialIcons name="add-box" size={30} color="#FFFFFF" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Registrar Nova Entrada</Text>
                  <Text style={styles.actionDescription}>Adicione novos produtos ao estoque</Text>
                </View>
                <View style={styles.actionArrow}>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })}
            ]
          }}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.elevatedCard]}
              onPress={async () => {
                try {
                  const result = await sincronizarDados();
                  if (result.sucesso) {
                    Alert.alert("Sincronização", result.mensagem);
                    // Reload data after successful sync
                    const jsonValue = await AsyncStorage.getItem('produtos');
                    if (jsonValue != null) {
                      const products = JSON.parse(jsonValue);
                      setTotalProducts(products.length);
                      setLowStockCount(products.filter((p: Product) => p.quantidade < 5).length);
                      setTotalItems(products.reduce((sum: number, p: Product) => sum + p.quantidade, 0));
                      setLastUpdate(new Date().toLocaleTimeString());
                    }
                  } else {
                    Alert.alert("Erro na sincronização", result.mensagem);
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  Alert.alert("Erro", `Falha ao sincronizar: ${errorMessage}`);
                }
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[COLORS.info, '#4FC3F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <MaterialIcons name="sync" size={30} color="#FFFFFF" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Sincronizar com Servidor</Text>
                  <Text style={styles.actionDescription}>Atualize dados com o banco PostgreSQL</Text>
                </View>
                <View style={styles.actionArrow}>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          
          {/* IA Dashboard */}
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              })}
            ]
          }}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.elevatedCard]}
              onPress={() => navigation.navigate('SmartDashboard')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#5E35B1', '#7E57C2']} // Roxo (para análise IA)
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <MaterialCommunityIcons name="brain" size={30} color="#FFFFFF" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Análise Inteligente</Text>
                  <Text style={styles.actionDescription}>Visualizar análises e previsões de estoque</Text>
                </View>
                <View style={styles.actionArrow}>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          
          {/* Produtos Críticos */}
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              })}
            ]
          }}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.elevatedCard]}
              onPress={() => navigation.navigate('CriticalProducts')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[COLORS.error, '#D50000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <MaterialIcons name="warning" size={30} color="#FFFFFF" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Ver Produtos Críticos</Text>
                  <Text style={styles.actionDescription}>Gerencie itens com estoque baixo ou esgotado</Text>
                </View>
                <View style={styles.actionArrow}>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <LinearGradient
            colors={['rgba(21, 101, 192, 0.1)', 'rgba(13, 71, 161, 0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.footerGradient}
          >
            <Text style={[styles.footerText, { color: COLORS.grey }]}>RLS Automação Industrial © {new Date().getFullYear()}</Text>
            <Text style={[styles.versionText, { color: COLORS.grey }]}>Versão 1.0.0</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardWidth = (windowWidth - 60) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    width: '100%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 15,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  decorativeShape: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorativeShape2: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  connectionContainer: {
    marginTop: -5,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  welcomeCardContainer: {
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 24,
    height: 140,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
    overflow: 'hidden',
  },
  welcomeCard: {
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    overflow: 'hidden',
    height: '100%',
  },
  welcomeContent: {
    flex: 3,
    justifyContent: 'center',
  },
  welcomeDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  circle1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -60,
    right: -30,
  },
  circle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    bottom: -30,
    right: 40,
  },
  circle3: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: 30,
    right: 100,
  },
  welcomeIllustration: {
    position: 'absolute',
    bottom: 5,
    right: 20,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  welcomeText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 22,
  },
  dashboardContainer: {
    padding: 15,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleDecoration: {
    width: 4,
    height: 20,
    backgroundColor: '#1565C0', // Default color, will be overridden in-line
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  updateText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loader: {
    marginBottom: 10,
  },
  loaderText: {
    fontSize: 14,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: cardWidth,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTouchable: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  elevatedCard: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  card: {
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  cardContentTop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 15,
  },
  cardContentBottom: {
    alignItems: 'center',
    paddingBottom: 15,
  },
  cardDecoration: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    top: -40,
    right: -40,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconText: {
    fontSize: 24,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardLabel: {
    fontSize: 13,
    color: '#FFFFFF',
    marginTop: 5,
    opacity: 0.9,
  },
  menuSection: {
    padding: 15,
    marginBottom: 20,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  menuItem: {
    width: (windowWidth - 45) / 2,
    height: 120,
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
  },
  menuIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuIcon: {
    fontSize: 26,
    color: '#FFFFFF',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  quickActionsContainer: {
    padding: 15,
    marginBottom: 20,
  },
  actionButton: {
    marginTop: 15,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionDescription: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  actionArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionArrowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  footer: {
    marginHorizontal: 15,
    marginTop: 5,
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  footerGradient: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  versionText: {
    fontSize: 12,
    marginTop: 3,
  },
});