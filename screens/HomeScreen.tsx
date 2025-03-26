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
  ImageBackground,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import ConnectionStatus from '../components/ConnectionStatus';
import { verificarConexao, sincronizarDados } from '../services/api';
import { RootStackParamList } from '../App';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [shouldShowServerConfig, setShouldShowServerConfig] = useState<boolean>(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Verificar se é o primeiro uso
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        const firstRun = await AsyncStorage.getItem('@first_run');
        if (firstRun === null) {
          // É a primeira execução
          setShouldShowServerConfig(true);
          await AsyncStorage.setItem('@first_run', 'false');
        }
      } catch (error) {
        console.error("Erro ao verificar primeira execução:", error);
      }
    };
    
    checkFirstRun();
  }, []);

  // Mostrar configuração de servidor se for a primeira vez
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

  // Iniciar animações quando o componente montar
  useEffect(() => {
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
  }, [fadeAnim, slideAnim, scaleAnim]);

  // Carregar dados resumidos do estoque
  useEffect(() => {
    const loadInventorySummary = async () => {
      try {
        setLoading(true);
        
        // Tentar conectar ao servidor primeiro
        await verificarConexao();
        
        const jsonValue = await AsyncStorage.getItem('produtos');
        
        if (jsonValue != null) {
          const products: Product[] = JSON.parse(jsonValue);
          setTotalProducts(products.length);
          
          // Contar produtos com estoque baixo (menos de 5 unidades)
          const lowStock = products.filter(p => p.quantidade < 5).length;
          setLowStockCount(lowStock);

          // Contar total de itens em estoque
          const total = products.reduce((sum: number, p: Product) => sum + p.quantidade, 0);
          setTotalItems(total);
        } else {
          // Nenhum produto encontrado
          setTotalProducts(0);
          setLowStockCount(0);
          setTotalItems(0);
        }
        
        // Registrar horário da atualização
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        console.error("Erro ao carregar resumo do estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    // Executar ao montar o componente
    loadInventorySummary();
    
    // Configurar um ouvinte de foco para atualizar quando a tela receber foco
    const unsubscribe = navigation.addListener('focus', () => {
      loadInventorySummary();
    });

    // Limpeza ao desmontar
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
      
      {/* Header com Gradiente */}
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <Header showLogo={true} />
      </LinearGradient>
      
      {/* Status de Conexão */}
      <ConnectionStatus 
        onConfigPress={() => navigation.navigate('ServerConfig')}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de boas-vindas com Gradiente */}
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
                Bem-vindo ao Sistema de Gestão
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
        
        {/* Cartões de resumo */}
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
                  style={styles.card}
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
                  style={styles.card}
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
                  style={styles.card}
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
        
        {/* Menu principal */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu Principal</Text>
          
          <View style={styles.menuGrid}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('Scanner')}
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

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('ProductList')}
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

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('AddProduct')}
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

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('Dashboard')}
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
          </View>
        </View>

        {/* Ações rápidas */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddProduct')}
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
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={async () => {
              try {
                const result = await sincronizarDados();
                if (result.sucesso) {
                  Alert.alert("Sincronização", result.mensagem);
                  // Recarregar dados após sincronização bem-sucedida
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
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Settings')}
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
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  welcomeCardContainer: {
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden',
  },
  welcomeCard: {
    padding: 20,
    borderRadius: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 14,
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
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: cardWidth,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
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
    marginBottom: 15,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  menuItem: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
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
    fontSize: 15,
    fontWeight: '500',
    marginTop: 5,
    color: COLORS.black,
  },
  quickActionsContainer: {
    padding: 15,
    marginBottom: 20,
  },
  actionButton: {
    marginTop: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    padding: 15,
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
    fontWeight: '500',
    color: COLORS.white,
  },
  actionDescription: {
    fontSize: 12,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 3,
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