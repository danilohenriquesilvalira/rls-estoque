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
  Image,
  Dimensions,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import ConnectionStatus from '../components/ConnectionStatus';
import { verificarConexao, sincronizarDados } from '../services/api';
import { RootStackParamList } from '../App';

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

// Definir cores do tema
const COLORS = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  accent: '#FF6F00',
  accentLight: '#FFA726',
  success: '#2E7D32',
  successLight: '#81C784',
  warning: '#F57F17',
  warningLight: '#FFD54F',
  error: '#C62828',
  errorLight: '#EF5350',
  info: '#0288D1',
  infoLight: '#4FC3F7',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  background: '#F7F9FD',
  cardBackground: '#FFFFFF',
  gradientStart: '#1976D2',
  gradientEnd: '#0D47A1',
};

// Dimensões da tela
const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function HomeScreen({ navigation }: HomeScreenProps) {
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
  
  // Animations for menu items
  const menuAnimations = useRef(Array(6).fill(0).map(() => new Animated.Value(0))).current;

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
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
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
  }, [fadeAnim, slideAnim, scaleAnim, menuAnimations]);

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
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Header showLogo={true} />
        
        {/* Connection Status inside header gradient for cleaner look */}
        <View style={styles.connectionContainer}>
          <ConnectionStatus 
            onConfigPress={() => navigation.navigate('ServerConfig')}
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
            </View>
          </LinearGradient>
        </Animated.View>
        
        {/* Dashboard cards */}
        <View style={styles.dashboardContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Resumo do Estoque</Text>
            <Text style={styles.updateText}>Atualizado: {lastUpdate}</Text>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
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
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, styles.elevatedCard]}
                >
                  <View style={styles.cardIcon}>
                    <Text style={styles.iconText}>📦</Text>
                  </View>
                  <Text style={styles.cardValue}>{totalProducts}</Text>
                  <Text style={styles.cardLabel}>Produtos</Text>
                </LinearGradient>
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
                <LinearGradient
                  colors={[COLORS.success, '#1B5E20']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, styles.elevatedCard]}
                >
                  <View style={styles.cardIcon}>
                    <Text style={styles.iconText}>🧮</Text>
                  </View>
                  <Text style={styles.cardValue}>{totalItems}</Text>
                  <Text style={styles.cardLabel}>Itens Total</Text>
                </LinearGradient>
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
                <LinearGradient
                  colors={lowStockCount > 0 ? [COLORS.warning, '#E65100'] : [COLORS.grey, '#424242']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, styles.elevatedCard]}
                >
                  <View style={styles.cardIcon}>
                    <Text style={styles.iconText}>⚠️</Text>
                  </View>
                  <Text style={styles.cardValue}>{lowStockCount}</Text>
                  <Text style={styles.cardLabel}>Est. Baixo</Text>
                </LinearGradient>
              </Animated.View>
            </View>
          )}
        </View>
        
        {/* Main menu */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu Principal</Text>
          
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
                style={[styles.menuItem, styles.elevatedCard]} 
                onPress={() => navigation.navigate('Scanner')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Text style={styles.menuIcon}>📷</Text>
                </LinearGradient>
                <Text style={styles.menuText}>Escanear QR</Text>
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
                style={[styles.menuItem, styles.elevatedCard]} 
                onPress={() => navigation.navigate('ProductList')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.accent, '#E65100']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Text style={styles.menuIcon}>📋</Text>
                </LinearGradient>
                <Text style={styles.menuText}>Produtos</Text>
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
                style={[styles.menuItem, styles.elevatedCard]} 
                onPress={() => navigation.navigate('AddProduct')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.success, '#1B5E20']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Text style={styles.menuIcon}>➕</Text>
                </LinearGradient>
                <Text style={styles.menuText}>Adicionar</Text>
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
                style={[styles.menuItem, styles.elevatedCard]} 
                onPress={() => navigation.navigate('Dashboard')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[COLORS.info, '#01579B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Text style={styles.menuIcon}>📊</Text>
                </LinearGradient>
                <Text style={styles.menuText}>Dashboard</Text>
              </TouchableOpacity>
            </Animated.View>
            
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
                style={[styles.menuItem, styles.elevatedCard]} 
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#8E24AA', '#4A148C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Text style={styles.menuIcon}>📜</Text>
                </LinearGradient>
                <Text style={styles.menuText}>Histórico</Text>
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
                style={[styles.menuItem, styles.elevatedCard]} 
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#757575', '#424242']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuIconBg}
                >
                  <Text style={styles.menuIcon}>⚙️</Text>
                </LinearGradient>
                <Text style={styles.menuText}>Configurações</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          
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
                colors={[COLORS.success, COLORS.successLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <Text style={styles.actionIcon}>📦</Text>
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Registrar Nova Entrada</Text>
                  <Text style={styles.actionDescription}>Adicione novos produtos ao estoque</Text>
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
                colors={[COLORS.info, COLORS.infoLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <Text style={styles.actionIcon}>🔄</Text>
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Sincronizar com Servidor</Text>
                  <Text style={styles.actionDescription}>Atualize dados com o banco PostgreSQL</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          
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
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <View style={styles.actionIconContainer}>
                  <Text style={styles.actionIcon}>⚙️</Text>
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Configurações</Text>
                  <Text style={styles.actionDescription}>Personalize o aplicativo</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>RLS Automação Industrial © {new Date().getFullYear()}</Text>
          <Text style={styles.versionText}>Versão 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardWidth = (windowWidth - 60) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    width: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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
    marginBottom: 20,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
    overflow: 'hidden',
  },
  welcomeCard: {
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  welcomeContent: {
    flex: 3,
  },
  welcomeDecoration: {
    flex: 1,
    position: 'relative',
  },
  circle1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -30,
    right: -30,
  },
  circle2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    bottom: -20,
    right: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 15,
    color: COLORS.white,
    opacity: 0.9,
  },
  dashboardContainer: {
    padding: 15,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  updateText: {
    fontSize: 12,
    color: COLORS.grey,
    fontStyle: 'italic',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: cardWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  elevatedCard: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  card: {
    height: 120,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconText: {
    fontSize: 20,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  cardLabel: {
    fontSize: 12,
    color: COLORS.white,
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
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  menuIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10,
    color: COLORS.black,
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
    padding: 18,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
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
    color: COLORS.white,
  },
  actionDescription: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 4,
  },
  loader: {
    marginVertical: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.grey,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 3,
  },
});