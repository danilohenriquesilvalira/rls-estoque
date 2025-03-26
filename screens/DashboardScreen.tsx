// screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
  Easing,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { getProdutos, getMovimentacoes, verificarConexao } from '../services/api';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

// Interface for product
interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
}

// Interface for movement
interface Movimentacao {
  id?: number;
  produto_id: number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  notas?: string;
  data_movimentacao?: string;
  produto_codigo?: string;
  produto_nome?: string;
}

// Define theme colors
const COLORS = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  accent: '#FF6F00',
  success: '#2E7D32',
  warning: '#F57F17',
  error: '#C62828',
  info: '#0288D1',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  background: '#F5F7FA',
  text: '#212121',          // Adicionando text
  textSecondary: '#757575', // Adicionando textSecondary
  card: '#FFFFFF',          // Adicionando card
};

// Screen dimensions
const { width: screenWidth } = Dimensions.get('window');

const DashboardScreen = ({ navigation }: DashboardScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalItens: 0,
    estoqueBaixo: 0
  });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current; // Adicionando slideAnim
  const topProductsAnim = useRef<Animated.Value[]>([]).current;
  const movementsAnim = useRef<Animated.Value[]>([]).current;

  // Load data for the dashboard
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Check connection
        const connected = await verificarConexao();
        setIsOnline(connected);

        // Load products
        const produtosData = await getProdutos();
        setProdutos(produtosData);
        
        // Load movements
        const movimentacoesData = await getMovimentacoes();
        setMovimentos(movimentacoesData);
        
        // Calculate statistics
        const totalProdutos = produtosData.length;
        const totalItens = produtosData.reduce((sum, p) => sum + p.quantidade, 0);
        const estoqueBaixo = produtosData.filter(p => p.quantidade < (p.quantidade_minima || 5)).length;
        
        setStats({
          totalProdutos,
          totalItens,
          estoqueBaixo
        });
        
        setLastUpdate(new Date());
        
        // Initialize animations for the lists
        const topProducts = getTopProdutos();
        const latestMovements = getUltimasMovimentacoes();
        
        // Reset animation arrays
        topProductsAnim.length = 0;
        movementsAnim.length = 0;
        
        // Create animation values for each item
        topProducts.forEach(() => {
          topProductsAnim.push(new Animated.Value(0));
        });
        
        latestMovements.forEach(() => {
          movementsAnim.push(new Animated.Value(0));
        });
        
        // Start animations when data is loaded
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease)
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease)
          }),
          Animated.timing(barAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false, // We're animating width which needs native: false
            easing: Easing.out(Easing.ease)
          }),
          Animated.stagger(
            100,
            topProductsAnim.map(anim => 
              Animated.spring(anim, {
                toValue: 1,
                friction: 8,
                tension: 50,
                useNativeDriver: true
              })
            )
          ),
          Animated.stagger(
            100,
            movementsAnim.map(anim => 
              Animated.spring(anim, {
                toValue: 1,
                friction: 8,
                tension: 50,
                useNativeDriver: true
              })
            )
          )
        ]).start();
        
      } catch (error) {
        console.error("Error loading data for dashboard:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados do dashboard");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Update when returning to this screen
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  // Get Top 5 products by quantity
  const getTopProdutos = () => {
    return [...produtos]
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  };

  // Get latest movements
  const getUltimasMovimentacoes = () => {
    return [...movimentos]
      .sort((a, b) => {
        const dateA = new Date(a.data_movimentacao || new Date().toISOString());
        const dateB = new Date(b.data_movimentacao || new Date().toISOString());
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
  };

  // Function to format date
  const formatarData = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Dashboard" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Dashboard" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isOnline && (
          <Animated.View style={[
            styles.offlineBanner,
            { opacity: fadeAnim }
          ]}>
            <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
          </Animated.View>
        )}
        
        {/* Summary Cards */}
        <Animated.View style={[
          styles.summaryContainer,
          { opacity: fadeAnim }
        ]}>
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>📦</Text>
              </View>
              <Text style={styles.summaryValue}>{stats.totalProdutos}</Text>
              <Text style={styles.summaryLabel}>Produtos</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['#43A047', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>🧮</Text>
              </View>
              <Text style={styles.summaryValue}>{stats.totalItens}</Text>
              <Text style={styles.summaryLabel}>Unidades</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={stats.estoqueBaixo > 0 ? 
                ['#F57F17', '#FF6F00'] : 
                ['#9E9E9E', '#757575']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>⚠️</Text>
              </View>
              <Text style={styles.summaryValue}>{stats.estoqueBaixo}</Text>
              <Text style={styles.summaryLabel}>Est. Baixo</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Stock Status */}
        <Animated.View style={[
          styles.sectionCard,
          { opacity: fadeAnim }
        ]}>
          <Text style={styles.sectionTitle}>Status do Estoque</Text>
          
          <View style={styles.statusBars}>
            <View style={styles.statusBar}>
              <Text style={styles.statusLabel}>Estoque Baixo</Text>
              <View style={styles.barContainer}>
                <Animated.View 
                  style={[
                    styles.barFill, 
                    { 
                      width: barAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${(stats.estoqueBaixo / stats.totalProdutos * 100) || 0}%`]
                      }),
                      backgroundColor: COLORS.error
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.estoqueBaixo}</Text>
            </View>
            
            <View style={styles.statusBar}>
              <Text style={styles.statusLabel}>Estoque Normal</Text>
              <View style={styles.barContainer}>
                <Animated.View 
                  style={[
                    styles.barFill, 
                    { 
                      width: barAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${((stats.totalProdutos - stats.estoqueBaixo) / stats.totalProdutos * 100) || 0}%`]
                      }),
                      backgroundColor: COLORS.success
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.totalProdutos - stats.estoqueBaixo}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Top 5 Products */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top 5 Produtos por Quantidade</Text>
          
          {getTopProdutos().length === 0 ? (
            <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
          ) : (
            getTopProdutos().map((produto, index) => {
              // Use existing animation or create a new one if needed
              const animValue = index < topProductsAnim.length 
                ? topProductsAnim[index] 
                : new Animated.Value(1);
                
              return (
                <Animated.View key={index} style={{
                  opacity: animValue,
                  transform: [
                    { translateX: animValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0]
                    }) }
                  ]
                }}>
                  <TouchableOpacity 
                    style={styles.productItem}
                    onPress={() => navigation.navigate('ProductDetail', { product: produto })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.productRank}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{produto.nome}</Text>
                      <Text style={styles.productCode}>{produto.codigo}</Text>
                    </View>
                    <View style={[
                      styles.productQuantity,
                      produto.quantidade < (produto.quantidade_minima || 5) ? 
                        styles.lowQuantity : 
                        produto.quantidade > 20 ? 
                          styles.highQuantity : 
                          styles.normalQuantity
                    ]}>
                      <Text style={styles.quantityText}>{produto.quantidade}</Text>
                      <Text style={styles.quantityLabel}>unid.</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })
          )}
        </View>
        
        {/* Link para Produtos Críticos */}
        <Animated.View style={[
          styles.linkCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <TouchableOpacity 
            style={styles.criticalLink}
            onPress={() => navigation.navigate('CriticalProducts')}
          >
            <LinearGradient
              colors={[COLORS.error, '#C62828']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.criticalLinkGradient}
            >
              <View style={styles.criticalIconContainer}>
                <Text style={styles.criticalIcon}>⚠️</Text>
              </View>
              <View style={styles.criticalTextContainer}>
                <Text style={styles.criticalLinkTitle}>Produtos Críticos</Text>
                <Text style={styles.criticalLinkDescription}>
                  Visualize e gerencie produtos com estoque baixo ou esgotado
                </Text>
              </View>
              <Text style={styles.criticalLinkArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Latest Movements */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Últimas Movimentações</Text>
          
          {getUltimasMovimentacoes().length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma movimentação registrada</Text>
          ) : (
            getUltimasMovimentacoes().map((movimento, index) => {
              // Use existing animation or create a new one if needed
              const animValue = index < movementsAnim.length 
                ? movementsAnim[index] 
                : new Animated.Value(1);
                
              return (
                <Animated.View key={index} style={{
                  opacity: animValue,
                  transform: [
                    { translateX: animValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    }) }
                  ]
                }}>
                  <TouchableOpacity 
                    style={styles.movementItem}
                    onPress={() => {
                      if (movimento.produto_id) {
                        const produto = produtos.find(p => p.id === movimento.produto_id);
                        if (produto) {
                          navigation.navigate('ProductDetail', { product: produto });
                        }
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={movimento.tipo === 'entrada' ? 
                        ['#43A047', '#2E7D32'] : 
                        ['#E53935', '#C62828']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.movementType}
                    >
                      <Text style={styles.typeText}>{movimento.tipo === 'entrada' ? '+' : '-'}</Text>
                    </LinearGradient>
                    <View style={styles.movementInfo}>
                      <Text style={styles.movementName}>
                        {movimento.produto_nome || `Produto ID: ${movimento.produto_id}`}
                      </Text>
                      <Text style={styles.movementDetails}>
                        {movimento.tipo === 'entrada' ? 'Entrada' : 'Saída'} de {movimento.quantidade} unid. • {formatarData(movimento.data_movimentacao)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })
          )}
          
          {movimentos.length > 5 && (
            <TouchableOpacity 
              style={styles.viewMoreButton}
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.viewMoreText}>Ver Histórico Completo</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.grey,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  offlineBanner: {
    backgroundColor: COLORS.error,
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  offlineText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    width: '31%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  summaryCardGradient: {
    padding: 15,
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryIcon: {
    fontSize: 18,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.white,
    marginTop: 4,
    opacity: 0.9,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: COLORS.black,
  },
  statusBars: {
    marginTop: 10,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusLabel: {
    width: 100,
    fontSize: 14,
    color: COLORS.black,
  },
  barContainer: {
    flex: 1,
    height: 15,
    backgroundColor: COLORS.lightGrey,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
  },
  statusValue: {
    width: 30,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ultraLightGrey,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  productRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  productCode: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 2,
  },
  productQuantity: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  lowQuantity: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  normalQuantity: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  highQuantity: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityLabel: {
    fontSize: 10,
    color: COLORS.grey,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  movementType: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 18,
  },
  movementInfo: {
    flex: 1,
    padding: 12,
  },
  movementName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  movementDetails: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 2,
  },
  viewMoreButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  viewMoreText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey,
    fontStyle: 'italic',
    padding: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.grey,
    fontStyle: 'italic',
  },
  // Novos estilos para o card de link para Produtos Críticos
  linkCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  criticalLink: {
    width: '100%',
  },
  criticalLinkGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  criticalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  criticalIcon: {
    fontSize: 20,
  },
  criticalTextContainer: {
    flex: 1,
  },
  criticalLinkTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  criticalLinkDescription: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  criticalLinkArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  }
});

export default DashboardScreen;