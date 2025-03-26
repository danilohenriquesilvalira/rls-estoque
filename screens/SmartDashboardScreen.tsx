// screens/SmartDashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, subDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { pt } from 'date-fns/locale/pt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { getProdutos, getMovimentacoes, verificarConexao } from '../services/api';
import { preverEsgotamentoEstoque, getProdutosPrioritarios } from '../services/stockPrediction';

type SmartDashboardScreenProps = {
  navigation: NativeStackNavigationProp<any, 'SmartDashboard'>;
};

// Interface para produto
interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
}

// Interface para movimentação
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

// Interface para produto prioritário
interface ProdutoPrioritario {
  id: number;
  codigo: string;
  nome: string;
  diasRestantes: number | null;
  urgencia: 'alta' | 'media' | 'baixa';
  quantidadeRecomendada: number;
}

const screenWidth = Dimensions.get('window').width;

const SmartDashboardScreen: React.FC<SmartDashboardScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [produtosPrioritarios, setProdutosPrioritarios] = useState<ProdutoPrioritario[]>([]);
  
  // Dados dos gráficos
  const [movimentacoesPorDia, setMovimentacoesPorDia] = useState<{
    labels: string[];
    entradas: number[];
    saidas: number[];
  }>({ labels: [], entradas: [], saidas: [] });
  
  const [distribuicaoEstoque, setDistribuicaoEstoque] = useState<{
    labels: string[];
    data: number[];
    colors: string[];
  }>({ labels: [], data: [], colors: [] });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Carregar dados para o dashboard
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Verificar conexão com o servidor
        const connected = await verificarConexao();
        setIsOnline(connected);
        
        // Carregar produtos
        const produtosData = await getProdutos();
        setProdutos(produtosData);
        
        // Carregar movimentações
        const movimentacoesData = await getMovimentacoes();
        setMovimentos(movimentacoesData);
        
        // Processar dados para os gráficos
        processarDadosGraficos(produtosData, movimentacoesData, selectedTimeRange);
        
        // Carregar produtos prioritários
        const prioritarios = await getProdutosPrioritarios();
        setProdutosPrioritarios(prioritarios);
        
        setLastUpdate(new Date());
        
        // Iniciar animações
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          })
        ]).start();
        
      } catch (error) {
        console.error("Erro ao carregar dados para o dashboard:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados do dashboard");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Recarregar ao voltar para esta tela
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, selectedTimeRange]);
  
  // Processar dados para os gráficos
  const processarDadosGraficos = (
    produtosData: Produto[], 
    movimentacoesData: Movimentacao[],
    timeRange: '7d' | '30d' | '90d'
  ) => {
    // Definir intervalo de datas com base na seleção
    const hoje = new Date();
    let dataInicial: Date;
    
    switch (timeRange) {
      case '7d':
        dataInicial = subDays(hoje, 7);
        break;
      case '30d':
        dataInicial = subDays(hoje, 30);
        break;
      case '90d':
        dataInicial = subDays(hoje, 90);
        break;
    }
    
    // Gerar array de dias no intervalo
    const diasIntervalo = eachDayOfInterval({
      start: dataInicial,
      end: hoje
    });
    
    // Inicializar arrays de dados
    const labels: string[] = [];
    const entradas: number[] = [];
    const saidas: number[] = [];
    
    // Para cada dia no intervalo, calcular total de entradas e saídas
    diasIntervalo.forEach(dia => {
      const diaFormatado = format(dia, 'dd/MM');
      labels.push(diaFormatado);
      
      // Filtrar movimentações do dia
      const movimentacoesDia = movimentacoesData.filter(mov => {
        if (!mov.data_movimentacao) return false;
        const dataMov = parseISO(mov.data_movimentacao);
        return (
          dataMov.getDate() === dia.getDate() &&
          dataMov.getMonth() === dia.getMonth() &&
          dataMov.getFullYear() === dia.getFullYear()
        );
      });
      
      // Calcular total de entradas e saídas do dia
      const totalEntradas = movimentacoesDia
        .filter(mov => mov.tipo === 'entrada')
        .reduce((sum, mov) => sum + mov.quantidade, 0);
        
      const totalSaidas = movimentacoesDia
        .filter(mov => mov.tipo === 'saida')
        .reduce((sum, mov) => sum + mov.quantidade, 0);
        
      entradas.push(totalEntradas);
      saidas.push(totalSaidas);
    });
    
    // Se o intervalo for muito grande, reduzir o número de labels
    if (timeRange === '30d' || timeRange === '90d') {
      // Reduzir para mostrar apenas alguns pontos
      const labelsReduzidos: string[] = [];
      const entradasReduzidas: number[] = [];
      const saidasReduzidas: number[] = [];
      
      const intervalo = timeRange === '30d' ? 5 : 15; // A cada 5 ou 15 dias
      
      labels.forEach((label, index) => {
        if (index % intervalo === 0 || index === labels.length - 1) {
          labelsReduzidos.push(label);
          entradasReduzidas.push(entradas[index]);
          saidasReduzidas.push(saidas[index]);
        }
      });
      
      setMovimentacoesPorDia({
        labels: labelsReduzidos,
        entradas: entradasReduzidas,
        saidas: saidasReduzidas
      });
    } else {
      setMovimentacoesPorDia({ labels, entradas, saidas });
    }
    
    // Dados para o gráfico de pizza de distribuição de estoque
    // Agrupar produtos por faixas de quantidade
    const faixasEstoque = [
      { label: 'Crítico (0-5)', min: 0, max: 5, color: '#C62828' },
      { label: 'Baixo (6-15)', min: 6, max: 15, color: '#F57F17' },
      { label: 'Normal (16-40)', min: 16, max: 40, color: '#0D47A1' },
      { label: 'Alto (41+)', min: 41, max: Infinity, color: '#2E7D32' }
    ];
    
    const contagem = faixasEstoque.map(faixa => ({
      label: faixa.label,
      count: produtosData.filter(
        p => p.quantidade >= faixa.min && p.quantidade <= faixa.max
      ).length,
      color: faixa.color
    }));
    
    // Filtrar faixas sem produtos
    const faixasComProdutos = contagem.filter(f => f.count > 0);
    
    setDistribuicaoEstoque({
      labels: faixasComProdutos.map(f => f.label),
      data: faixasComProdutos.map(f => f.count),
      colors: faixasComProdutos.map(f => f.color)
    });
  };
  
  // Obter cores para os gráficos
  const chartConfig = {
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    color: (opacity = 1) => `rgba(21, 101, 192, ${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
    style: {
      borderRadius: 16
    }
  };
  
  // Formatar cor de urgência
  const getUrgenciaColor = (urgencia: 'alta' | 'media' | 'baixa') => {
    switch (urgencia) {
      case 'alta': return COLORS.error;
      case 'media': return COLORS.warning;
      case 'baixa': return COLORS.success;
      default: return COLORS.grey;
    }
  };
  
  // Formatar data
  const formatarData = (dataString: string | undefined): string => {
    if (!dataString) return "N/A";
    
    try {
      return format(parseISO(dataString), "dd/MM/yyyy", { locale: pt });
    } catch (error) {
      return "Data inválida";
    }
  };
  
  // Formatar texto para dias restantes
  const formatarDiasRestantes = (dias: number | null): string => {
    if (dias === null) return "Indeterminado";
    if (dias <= 0) return "Esgotado";
    return `${dias} dias`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Dashboard Inteligente" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.grey }]}>Carregando dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Dashboard Inteligente" 
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
            { 
              opacity: fadeAnim,
              backgroundColor: COLORS.error
            }
          ]}>
            <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
          </Animated.View>
        )}
        
        {/* Seletor de período */}
        <Animated.View style={[
          styles.timeSelector,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card
          }
        ]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Período de Análise</Text>
          
          <View style={styles.timeButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.timeButton,
                selectedTimeRange === '7d' && [styles.activeTimeButton, { backgroundColor: COLORS.primary }]
              ]}
              onPress={() => setSelectedTimeRange('7d')}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTimeRange === '7d' && styles.activeTimeButtonText
              ]}>7 dias</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.timeButton,
                selectedTimeRange === '30d' && [styles.activeTimeButton, { backgroundColor: COLORS.primary }]
              ]}
              onPress={() => setSelectedTimeRange('30d')}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTimeRange === '30d' && styles.activeTimeButtonText
              ]}>30 dias</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.timeButton,
                selectedTimeRange === '90d' && [styles.activeTimeButton, { backgroundColor: COLORS.primary }]
              ]}
              onPress={() => setSelectedTimeRange('90d')}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTimeRange === '90d' && styles.activeTimeButtonText
              ]}>90 dias</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Resumo de estoque */}
        <Animated.View style={[
          styles.summaryContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>📦</Text>
              </View>
              <Text style={styles.summaryValue}>{produtos.length}</Text>
              <Text style={styles.summaryLabel}>Produtos</Text>
            </LinearGradient>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <LinearGradient
              colors={['#43A047', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>🧮</Text>
              </View>
              <Text style={styles.summaryValue}>
                {produtos.reduce((sum, p) => sum + p.quantidade, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Unidades</Text>
            </LinearGradient>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <LinearGradient
              colors={produtosPrioritarios.some(p => p.urgencia === 'alta') ? 
                ['#E53935', '#C62828'] : ['#9E9E9E', '#757575']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>⚠️</Text>
              </View>
              <Text style={styles.summaryValue}>
                {produtosPrioritarios.filter(p => p.urgencia === 'alta').length}
              </Text>
              <Text style={styles.summaryLabel}>Urgentes</Text>
            </LinearGradient>
          </View>
        </Animated.View>
        
        {/* Gráfico de Movimentações */}
        <Animated.View style={[
          styles.chartCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>
            Movimentações de Estoque
          </Text>
          
          {movimentacoesPorDia.labels.length > 0 ? (
            <LineChart
              data={{
                labels: movimentacoesPorDia.labels,
                datasets: [
                  {
                    data: movimentacoesPorDia.entradas,
                    color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                    strokeWidth: 2
                  },
                  {
                    data: movimentacoesPorDia.saidas,
                    color: (opacity = 1) => `rgba(198, 40, 40, ${opacity})`,
                    strokeWidth: 2
                  }
                ],
                legend: ["Entradas", "Saídas"]
              }}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                ...chartConfig,
                propsForDots: {
                  r: "4",
                  strokeWidth: "1",
                }
              }}
              bezier
              style={styles.chart}
              fromZero
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={[styles.noDataText, { color: COLORS.grey }]}>
                Sem dados de movimentação para o período selecionado
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Distribuição de Estoque */}
        <Animated.View style={[
          styles.chartCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>
            Distribuição do Estoque
          </Text>
          
          {distribuicaoEstoque.labels.length > 0 ? (
            <PieChart
              data={distribuicaoEstoque.labels.map((label, index) => ({
                name: label,
                population: distribuicaoEstoque.data[index],
                color: distribuicaoEstoque.colors[index],
                legendFontColor: COLORS.text,
                legendFontSize: 12
              }))}
              width={screenWidth - 40}
              height={220}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              center={[10, 0]}
              absolute
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={[styles.noDataText, { color: COLORS.grey }]}>
                Sem dados de estoque disponíveis
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Produtos Prioritários */}
        <Animated.View style={[
          styles.priorityCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>
            Produtos Prioritários
          </Text>
          
          {produtosPrioritarios.length > 0 ? (
            <>
              {produtosPrioritarios
                .filter((p, index) => showFullAnalysis || index < 3)
                .map((produto, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.priorityItem}
                  onPress={() => {
                    // Navegar para detalhes do produto
                    const produtoCompleto = produtos.find(p => p.id === produto.id);
                    if (produtoCompleto) {
                      navigation.navigate('ProductDetail', { product: produtoCompleto });
                    }
                  }}
                >
                  <View style={[
                    styles.priorityBadge,
                    { backgroundColor: getUrgenciaColor(produto.urgencia) }
                  ]}>
                    <Text style={styles.priorityBadgeText}>
                      {produto.urgencia === 'alta' ? '!!!' : 
                       produto.urgencia === 'media' ? '!!' : '!'}
                    </Text>
                  </View>
                  
                  <View style={styles.priorityInfo}>
                    <Text style={[styles.priorityName, { color: COLORS.text }]}>
                      {produto.nome}
                    </Text>
                    <Text style={[styles.priorityCode, { color: COLORS.primary }]}>
                      {produto.codigo}
                    </Text>
                    <View style={styles.priorityDetails}>
                      <Text style={[styles.priorityDetailText, { color: COLORS.textSecondary }]}>
                        {formatarDiasRestantes(produto.diasRestantes)} restantes
                      </Text>
                      {produto.quantidadeRecomendada > 0 && (
                        <Text style={[
                          styles.priorityDetailText,
                          { color: getUrgenciaColor(produto.urgencia) }
                        ]}>
                          Comprar: {produto.quantidadeRecomendada} unid.
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              {produtosPrioritarios.length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowFullAnalysis(!showFullAnalysis)}
                >
                  <Text style={[styles.showMoreText, { color: COLORS.primary }]}>
                    {showFullAnalysis ? 'Mostrar menos' : `Ver mais ${produtosPrioritarios.length - 3} produtos`}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.generateListButton, { backgroundColor: COLORS.primary }]}
                onPress={() => navigation.navigate('ShoppingList')}
              >
                <Text style={styles.generateListText}>Gerar Lista de Compras</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={[styles.noDataText, { color: COLORS.grey }]}>
                Não há produtos prioritários no momento
              </Text>
            </View>
          )}
        </Animated.View>
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: COLORS.grey }]}>
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
  },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  offlineBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  timeSelector: {
    borderRadius: 16,
    padding: 15,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 25,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeTimeButton: {
    borderWidth: 0,
  },
  timeButtonText: {
    fontWeight: '500',
  },
  activeTimeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
        shadowColor: '#000',
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
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    opacity: 0.9,
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  priorityCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  priorityItem: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  priorityBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  priorityInfo: {
    flex: 1,
  },
  priorityName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  priorityCode: {
    fontSize: 12,
    marginBottom: 6,
  },
  priorityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityDetailText: {
    fontSize: 12,
  },
  showMoreButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  showMoreText: {
    fontWeight: '600',
  },
  generateListButton: {
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  generateListText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default SmartDashboardScreen;