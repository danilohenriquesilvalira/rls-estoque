// screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Platform,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { getProdutos, getMovimentacoes, verificarConexao } from '../services/api';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

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
  fornecedor?: string;
  localizacao?: string;
  data_criacao?: string;
  data_atualizacao?: string;
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
  text: '#212121',
  textSecondary: '#757575',
  card: '#FFFFFF',
};

// Screen dimensions
const { width: screenWidth } = Dimensions.get('window');

const DashboardScreen = ({ navigation }: DashboardScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalItens: 0,
    estoqueBaixo: 0,
    valorTotal: 0,
    semEstoque: 0,
    movimentacoesHoje: 0
  });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const chartAnim = useRef(new Animated.Value(0)).current;
  const topProductsAnim = useRef<Animated.Value[]>([]).current;
  const movementsAnim = useRef<Animated.Value[]>([]).current;

  // Calcular estatísticas de movimento por período
  const movimentosPorPeriodo = useMemo(() => {
    if (!movimentos.length) return { entradas: 0, saidas: 0 };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    let dateLimite = new Date(hoje);
    if (selectedPeriod === 'day') {
      // Já está definido como hoje
    } else if (selectedPeriod === 'week') {
      dateLimite.setDate(hoje.getDate() - 7);
    } else {
      dateLimite.setMonth(hoje.getMonth() - 1);
    }

    const movimentosFiltrados = movimentos.filter(m => {
      if (!m.data_movimentacao) return false;
      const dataMovimento = new Date(m.data_movimentacao);
      return dataMovimento >= dateLimite;
    });

    const entradas = movimentosFiltrados
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.quantidade, 0);
    
    const saidas = movimentosFiltrados
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + m.quantidade, 0);

    return { entradas, saidas };
  }, [movimentos, selectedPeriod]);

  // Load data for the dashboard
  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
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
      const estoqueBaixo = produtosData.filter(p => p.quantidade < (p.quantidade_minima || 5) && p.quantidade > 0).length;
      const semEstoque = produtosData.filter(p => p.quantidade <= 0).length;
      const valorTotal = produtosData.reduce((sum, p) => sum + p.quantidade, 0);
      
      // Calcular movimentações de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const movimentacoesHoje = movimentacoesData.filter(m => {
        if (!m.data_movimentacao) return false;
        const dataMovimento = new Date(m.data_movimentacao);
        return dataMovimento >= hoje;
      }).length;
      
      setStats({
        totalProdutos,
        totalItens,
        estoqueBaixo,
        valorTotal,
        semEstoque,
        movimentacoesHoje
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
          useNativeDriver: false,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(chartAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
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
      console.error("Erro ao carregar dados para o dashboard:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados do dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    loadData();
    
    // Update when returning to this screen
    const unsubscribe = navigation.addListener('focus', () => loadData());
    return unsubscribe;
  }, [navigation]);

  // Get Top 5 products by quantity
  const getTopProdutos = () => {
    return [...produtos]
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  };

  // Get products with low stock
  const getProdutosBaixoEstoque = () => {
    return [...produtos]
      .filter(p => p.quantidade < (p.quantidade_minima || 5))
      .sort((a, b) => a.quantidade - b.quantidade)
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

  // Handle refresh with pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  if (loading && !refreshing) {
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
          <Text style={styles.loadingText}>A carregar dashboard...</Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {!isOnline && (
          <Animated.View style={[
            styles.offlineBanner,
            { opacity: fadeAnim }
          ]}>
            <MaterialIcons name="cloud-off" size={18} color={COLORS.white} />
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
                <MaterialIcons name="inventory" size={22} color={COLORS.white} />
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
                <MaterialIcons name="local-shipping" size={22} color={COLORS.white} />
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
                <MaterialIcons name="warning" size={22} color={COLORS.white} />
              </View>
              <Text style={styles.summaryValue}>{stats.estoqueBaixo}</Text>
              <Text style={styles.summaryLabel}>Est. Baixo</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Second row of stats */}
        <Animated.View style={[
          styles.summaryContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['#0097A7', '#006064']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <MaterialIcons name="update" size={22} color={COLORS.white} />
              </View>
              <Text style={styles.summaryValue}>{stats.movimentacoesHoje}</Text>
              <Text style={styles.summaryLabel}>Mov. Hoje</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['#7B1FA2', '#4A148C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <MaterialIcons name="trending-up" size={22} color={COLORS.white} />
              </View>
              <Text style={styles.summaryValue}>{movimentosPorPeriodo.entradas}</Text>
              <Text style={styles.summaryLabel}>Entradas</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={stats.semEstoque > 0 ? 
                ['#D32F2F', '#B71C1C'] : 
                ['#9E9E9E', '#757575']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <MaterialIcons name="trending-down" size={22} color={COLORS.white} />
              </View>
              <Text style={styles.summaryValue}>{movimentosPorPeriodo.saidas}</Text>
              <Text style={styles.summaryLabel}>Saídas</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Stock Status */}
        <Animated.View style={[
          styles.sectionCard,
          { opacity: fadeAnim }
        ]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="pie-chart" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Status do Estoque</Text>
          </View>
          
          <View style={styles.statusBars}>
            <View style={styles.statusBar}>
              <View style={styles.statusLabelContainer}>
                <MaterialIcons name="error-outline" size={16} color={COLORS.error} />
                <Text style={styles.statusLabel}>Sem Estoque</Text>
              </View>
              <View style={styles.barContainer}>
                <Animated.View 
                  style={[
                    styles.barFill, 
                    { 
                      width: barAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${(stats.semEstoque / stats.totalProdutos * 100) || 0}%`]
                      }),
                      backgroundColor: COLORS.error
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.semEstoque}</Text>
            </View>
            
            <View style={styles.statusBar}>
              <View style={styles.statusLabelContainer}>
                <MaterialIcons name="warning" size={16} color={COLORS.warning} />
                <Text style={styles.statusLabel}>Estoque Baixo</Text>
              </View>
              <View style={styles.barContainer}>
                <Animated.View 
                  style={[
                    styles.barFill, 
                    { 
                      width: barAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${(stats.estoqueBaixo / stats.totalProdutos * 100) || 0}%`]
                      }),
                      backgroundColor: COLORS.warning
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.estoqueBaixo}</Text>
            </View>
            
            <View style={styles.statusBar}>
              <View style={styles.statusLabelContainer}>
                <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                <Text style={styles.statusLabel}>Estoque Normal</Text>
              </View>
              <View style={styles.barContainer}>
                <Animated.View 
                  style={[
                    styles.barFill, 
                    { 
                      width: barAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${((stats.totalProdutos - stats.estoqueBaixo - stats.semEstoque) / stats.totalProdutos * 100) || 0}%`]
                      }),
                      backgroundColor: COLORS.success
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.totalProdutos - stats.estoqueBaixo - stats.semEstoque}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Movement Chart */}
        <Animated.View style={[
          styles.sectionCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="swap-horiz" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Movimentações</Text>
            
            <View style={styles.periodSelector}>
              <TouchableOpacity 
                style={[
                  styles.periodOption,
                  selectedPeriod === 'day' && styles.periodOptionActive
                ]}
                onPress={() => setSelectedPeriod('day')}
              >
                <Text style={[
                  styles.periodOptionText,
                  selectedPeriod === 'day' && styles.periodOptionTextActive
                ]}>Dia</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.periodOption,
                  selectedPeriod === 'week' && styles.periodOptionActive
                ]}
                onPress={() => setSelectedPeriod('week')}
              >
                <Text style={[
                  styles.periodOptionText,
                  selectedPeriod === 'week' && styles.periodOptionTextActive
                ]}>Semana</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.periodOption,
                  selectedPeriod === 'month' && styles.periodOptionActive
                ]}
                onPress={() => setSelectedPeriod('month')}
              >
                <Text style={[
                  styles.periodOptionText,
                  selectedPeriod === 'month' && styles.periodOptionTextActive
                ]}>Mês</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              <View style={styles.chartLabels}>
                <View style={styles.chartLabelItem}>
                  <View style={[styles.chartLabelDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.chartLabelText}>Entradas</Text>
                </View>
                <View style={styles.chartLabelItem}>
                  <View style={[styles.chartLabelDot, { backgroundColor: COLORS.error }]} />
                  <Text style={styles.chartLabelText}>Saídas</Text>
                </View>
              </View>
              
              <View style={styles.chartBars}>
                <View style={styles.chartBarGroup}>
                  <Text style={styles.chartBarLabel}>Entradas</Text>
                  <View style={styles.chartBarContainer}>
                    <Animated.View
                      style={[
                        styles.chartBar,
                        {
                          height: chartAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${Math.min(100, (movimentosPorPeriodo.entradas / (movimentosPorPeriodo.entradas + movimentosPorPeriodo.saidas) * 100) || 0)}%`]
                          }),
                          backgroundColor: COLORS.success
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarValue}>{movimentosPorPeriodo.entradas}</Text>
                </View>
                
                <View style={styles.chartBarGroup}>
                  <Text style={styles.chartBarLabel}>Saídas</Text>
                  <View style={styles.chartBarContainer}>
                    <Animated.View
                      style={[
                        styles.chartBar,
                        {
                          height: chartAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${Math.min(100, (movimentosPorPeriodo.saidas / (movimentosPorPeriodo.entradas + movimentosPorPeriodo.saidas) * 100) || 0)}%`]
                          }),
                          backgroundColor: COLORS.error
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarValue}>{movimentosPorPeriodo.saidas}</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
        
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
                <MaterialIcons name="warning" size={24} color={COLORS.white} />
              </View>
              <View style={styles.criticalTextContainer}>
                <Text style={styles.criticalLinkTitle}>Produtos Críticos</Text>
                <Text style={styles.criticalLinkDescription}>
                  Visualize e gerencie produtos com estoque baixo ou esgotado
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Top 5 Products */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="local-mall" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Top Produtos por Quantidade</Text>
          </View>
          
          {getTopProdutos().length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inventory" size={40} color={COLORS.lightGrey} />
              <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
            </View>
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
                      <View style={styles.productMetaInfo}>
                        <View style={styles.productCodeContainer}>
                          <MaterialIcons name="qr-code" size={12} color={COLORS.primary} />
                          <Text style={styles.productCode}>{produto.codigo}</Text>
                        </View>
                        {produto.fornecedor && (
                          <View style={styles.productMetaItem}>
                            <MaterialIcons name="business" size={12} color={COLORS.grey} />
                            <Text style={styles.productMetaText}>{produto.fornecedor}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.productQuantity,
                      produto.quantidade <= 0 ? styles.emptyQuantity :
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
        
        {/* Low Stock Products */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="error-outline" size={22} color={COLORS.error} />
            <Text style={styles.sectionTitle}>Produtos com Estoque Baixo</Text>
          </View>
          
          {getProdutosBaixoEstoque().length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="check-circle" size={40} color={COLORS.success} />
              <Text style={styles.emptyText}>Nenhum produto com estoque baixo</Text>
            </View>
          ) : (
            getProdutosBaixoEstoque().map((produto, index) => {
              const stockPercentage = produto.quantidade_minima 
                ? (produto.quantidade / produto.quantidade_minima) * 100 
                : (produto.quantidade / 5) * 100;
                
              return (
                <TouchableOpacity 
                  key={index}
                  style={styles.lowStockItem}
                  onPress={() => navigation.navigate('ProductDetail', { product: produto })}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.lowStockIndicator,
                    produto.quantidade <= 0 ? { backgroundColor: COLORS.error } : { backgroundColor: COLORS.warning }
                  ]}>
                    <MaterialIcons 
                      name={produto.quantidade <= 0 ? "remove-shopping-cart" : "warning"} 
                      size={20} 
                      color={COLORS.white} 
                    />
                  </View>
                  <View style={styles.lowStockInfo}>
                    <Text style={styles.lowStockName}>{produto.nome}</Text>
                    <View style={styles.lowStockMeta}>
                      <Text style={styles.lowStockCode}>{produto.codigo}</Text>
                      {produto.quantidade_minima && (
                        <Text style={styles.lowStockMinimum}>Min: {produto.quantidade_minima}</Text>
                      )}
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarBg} />
                      <View 
                        style={[
                          styles.progressBarFill,
                          { 
                            width: `${Math.min(100, stockPercentage)}%`,
                            backgroundColor: produto.quantidade <= 0 ? COLORS.error : stockPercentage < 50 ? COLORS.warning : COLORS.info
                          }
                        ]} 
                      />
                    </View>
                  </View>
                  <View style={styles.lowStockQuantity}>
                    <Text style={[
                      styles.lowStockValue,
                      produto.quantidade <= 0 ? { color: COLORS.error } : { color: COLORS.warning }
                    ]}>
                      {produto.quantidade}
                    </Text>
                    <Text style={styles.lowStockUnit}>unid.</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          
          {stats.estoqueBaixo + stats.semEstoque > 5 && (
            <TouchableOpacity 
              style={styles.viewMoreButton}
              onPress={() => navigation.navigate('CriticalProducts')}
            >
              <Text style={styles.viewMoreText}>Ver Todos os Produtos Críticos</Text>
              <MaterialIcons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Latest Movements */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="history" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Últimas Movimentações</Text>
          </View>
          
          {getUltimasMovimentacoes().length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={40} color={COLORS.lightGrey} />
              <Text style={styles.emptyText}>Nenhuma movimentação registrada</Text>
            </View>
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
                    <View style={[
                      styles.movementType,
                      { backgroundColor: movimento.tipo === 'entrada' ? COLORS.success : COLORS.error }
                    ]}>
                      <MaterialIcons 
                        name={movimento.tipo === 'entrada' ? "add" : "remove"} 
                        size={20} 
                        color={COLORS.white} 
                      />
                    </View>
                    <View style={styles.movementInfo}>
                      <Text style={styles.movementName}>
                        {movimento.produto_nome || `Produto ID: ${movimento.produto_id}`}
                      </Text>
                      <View style={styles.movementDetailRow}>
                        <View style={styles.movementDetailItem}>
                          <MaterialIcons name={movimento.tipo === 'entrada' ? "add-shopping-cart" : "remove-shopping-cart"} size={12} color={COLORS.grey} />
                          <Text style={styles.movementDetailText}>
                            {movimento.tipo === 'entrada' ? 'Entrada' : 'Saída'} de {movimento.quantidade} unid.
                          </Text>
                        </View>
                        <View style={styles.movementDetailItem}>
                          <MaterialIcons name="schedule" size={12} color={COLORS.grey} />
                          <Text style={styles.movementDetailText}>
                            {formatarData(movimento.data_movimentacao).split(' ')[0]}
                          </Text>
                        </View>
                      </View>
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
              <MaterialIcons name="arrow-forward" size={16} color={COLORS.primary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginLeft: 8,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: COLORS.black,
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 20,
    padding: 2,
  },
  periodOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  periodOptionActive: {
    backgroundColor: COLORS.primary,
  },
  periodOptionText: {
    fontSize: 12,
    color: COLORS.grey,
  },
  periodOptionTextActive: {
    color: COLORS.white,
    fontWeight: '500',
  },
  statusBars: {
    marginTop: 10,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusLabelContainer: {
    width: 120,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.black,
    marginLeft: 6,
  },
  barContainer: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  statusValue: {
    width: 30,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  chartContainer: {
    marginTop: 15,
    marginBottom: 10,
  },
  chart: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 16,
    padding: 16,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  chartLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  chartLabelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chartLabelText: {
    fontSize: 12,
    color: COLORS.grey,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 150,
    paddingBottom: 10,
  },
  chartBarGroup: {
    alignItems: 'center',
    width: 80,
  },
  chartBarLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 8,
  },
  chartBarContainer: {
    width: 40,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 20,
  },
  chartBarValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 8,
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
    marginBottom: 4,
  },
  productMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  productCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  productCode: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
  },
  productMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productMetaText: {
    fontSize: 12,
    color: COLORS.grey,
    marginLeft: 4,
  },
  productQuantity: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyQuantity: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  lowQuantity: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
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
  lowStockItem: {
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
  lowStockIndicator: {
    width: 40,
    height: 'auto',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lowStockInfo: {
    flex: 1,
    padding: 12,
  },
  lowStockName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  lowStockMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lowStockCode: {
    fontSize: 12,
    color: COLORS.grey,
  },
  lowStockMinimum: {
    fontSize: 12,
    color: COLORS.grey,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.lightGrey,
  },
  progressBarFill: {
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  lowStockQuantity: {
    width: 50,
    alignItems: 'center',
    padding: 12,
  },
  lowStockValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  lowStockUnit: {
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
    height: 'auto',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movementInfo: {
    flex: 1,
    padding: 12,
  },
  movementName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  movementDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  movementDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  movementDetailText: {
    fontSize: 12,
    color: COLORS.grey,
    marginLeft: 4,
  },
  viewMoreButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  viewMoreText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey,
    marginTop: 12,
    fontSize: 14,
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
  }
});

export default DashboardScreen;