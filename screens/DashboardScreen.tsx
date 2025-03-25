import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Header from '../components/Header';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { getProdutos, getMovimentacoes, getDashboardData, verificarConexao } from '../services/api';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

// Interface para o produto
interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
  localizacao?: string;
  fornecedor?: string;
  notas?: string;
  data_criacao?: string;
  data_atualizacao?: string;
}

// Interface para registro de movimento
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

// Interface para histórico completo do produto
interface MovimentacaoView {
  id?: number;
  tipo: string;
  quantidade: number;
  data_movimentacao: string;
  notas?: string;
  produto_codigo: string;
  produto_nome: string;
}

// Interface para dados simplificados de produtos
interface ProdutoView {
  codigo: string;
  nome: string;
  quantidade: number;
}

// Interface para dados do dashboard
interface DashboardData {
  total_produtos: number;
  total_itens: number;
  estoque_baixo: number;
  ultimas_movimentacoes: MovimentacaoView[];
  top_produtos: ProdutoView[];
}

// Definir cores do tema
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
  statusBar: '#0D47A1',
  chartColors: [
    '#1565C0', // primary
    '#FF6F00', // accent
    '#2E7D32', // success
    '#C62828', // error
    '#0288D1', // info
    '#F57F17', // warning
    '#5E35B1', // purple
    '#00897B', // teal
  ]
};

const screenWidth = Dimensions.get('window').width;

const DashboardScreen = ({ navigation }: DashboardScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [stockStatus, setStockStatus] = useState({
    low: 0,
    normal: 0,
    high: 0,
  });
  const [selectedChart, setSelectedChart] = useState('movimento');
  const [totalValue, setTotalValue] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Carregar dados para o dashboard
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Verificar conexão
        const connected = await verificarConexao();
        setIsOnline(connected);

        if (connected) {
          // Tentar carregar dados do servidor
          try {
            const dashData = await getDashboardData();
            setDashboardData(dashData);
            
            // Definir estatísticas de estoque
            setStockStatus({
              low: dashData.estoque_baixo || 0,
              normal: dashData.total_produtos - (dashData.estoque_baixo || 0) - 0, // Vamos considerar 0 high stock por enquanto
              high: 0
            });
            
            // Calcular valor total estimado (simulação)
            const valorTotal = dashData.top_produtos.reduce((sum, p) => sum + (p.quantidade * 100), 0);
            setTotalValue(valorTotal);
          } catch (dashError) {
            console.error("Erro ao carregar dashboard do servidor:", dashError);
            loadLocalData();
          }
        } else {
          // Modo offline - carregar dados locais
          loadLocalData();
        }
        
        setLastUpdate(new Date());
      } catch (error) {
        console.error("Erro geral ao carregar dados para o dashboard:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados do dashboard");
      } finally {
        setLoading(false);
      }
    };
    
    const loadLocalData = async () => {
      // Carregar produtos
      const produtosData = await getProdutos();
      setProdutos(produtosData);
      
      // Carregar movimentações
      const movimentacoesData = await getMovimentacoes();
      setMovimentos(movimentacoesData);
      
      // Calcular estatísticas
      const lowStock = produtosData.filter(p => p.quantidade < (p.quantidade_minima || 5)).length;
      const highStock = produtosData.filter(p => p.quantidade > 20).length;
      const normalStock = produtosData.length - lowStock - highStock;
      
      setStockStatus({
        low: lowStock,
        normal: normalStock,
        high: highStock
      });
      
      // Calcular valor total estimado (simulação)
      const totalValue = produtosData.reduce((sum, product) => sum + (product.quantidade * 100), 0);
      setTotalValue(totalValue);
    };
    
    loadData();
    
    // Atualizar ao voltar para a tela
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  // Dados para o gráfico de pizza de status de estoque
  const pieChartData = [
    {
      name: "Baixo",
      population: stockStatus.low,
      color: COLORS.error,
      legendFontColor: COLORS.black,
      legendFontSize: 12
    },
    {
      name: "Normal",
      population: stockStatus.normal,
      color: COLORS.success,
      legendFontColor: COLORS.black,
      legendFontSize: 12
    },
    {
      name: "Alto",
      population: stockStatus.high,
      color: COLORS.info,
      legendFontColor: COLORS.black,
      legendFontSize: 12
    }
  ];

  // Preparar dados para o gráfico de barras (Top 5 produtos por quantidade)
  const getTopProductsData = () => {
    let topProdutos: ProdutoView[] = [];
    
    if (dashboardData && dashboardData.top_produtos.length > 0) {
      // Usar dados do servidor se disponíveis
      topProdutos = dashboardData.top_produtos.slice(0, 5);
    } else {
      // Usar dados locais
      topProdutos = [...produtos]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5)
        .map(p => ({
          codigo: p.codigo,
          nome: p.nome,
          quantidade: p.quantidade
        }));
    }
    
    return {
      labels: topProdutos.map(p => p.nome.length > 8 ? p.nome.substring(0, 8) + '...' : p.nome),
      datasets: [
        {
          data: topProdutos.map(p => p.quantidade)
        }
      ]
    };
  };

  // Preparar dados para o gráfico de linha (Movimentações nos últimos 7 dias)
  const getMovementData = () => {
    // Obter os últimos 7 dias
    const dates = [];
    const entriesData = [];
    const exitsData = [];
    
    // Preparar array de datas (últimos 7 dias)
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      dates.push(dateString.substring(5)); // Formato MM-DD
    }
    
    // Lista de movimentações a usar
    let movs: Movimentacao[] = [];
    
    if (dashboardData && dashboardData.ultimas_movimentacoes && dashboardData.ultimas_movimentacoes.length > 0) {
      // Converter dados do servidor para o formato de Movimentacao
      movs = dashboardData.ultimas_movimentacoes.map(m => ({
        ...m,
        tipo: m.tipo as 'entrada' | 'saida',
        produto_id: 0, // Valor fictício já que não é usado neste contexto
      }));
    } else {
      // Usar movimentações locais
      movs = movimentos;
    }
    
    // Calcular valores para cada dia
    for (const dateStr of dates) {
      // Formato completo YYYY-MM-DD para comparação
      const currentYear = new Date().getFullYear();
      const fullDateStr = `${currentYear}-${dateStr}`;
      
      // Filtrar movimentações para este dia
      const dayMovs = movs.filter(m => {
        if (!m.data_movimentacao) return false;
        const movDate = new Date(m.data_movimentacao);
        const movDateStr = movDate.toISOString().split('T')[0];
        return movDateStr === fullDateStr;
      });
      
      // Calcular entradas e saídas
      const entries = dayMovs
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + m.quantidade, 0);
      
      const exits = dayMovs
        .filter(m => m.tipo === 'saida')
        .reduce((sum, m) => sum + m.quantidade, 0);
      
      entriesData.push(entries);
      exitsData.push(exits);
    }
    
    return {
      labels: dates,
      datasets: [
        {
          data: entriesData,
          color: () => COLORS.success,
          strokeWidth: 2
        },
        {
          data: exitsData,
          color: () => COLORS.error,
          strokeWidth: 2
        }
      ],
      legend: ["Entradas", "Saídas"]
    };
  };

  const getBarChartConfig = () => ({
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces: 0,
    color: () => COLORS.primary,
    labelColor: () => COLORS.black,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: COLORS.white
    }
  });

  const getLineChartConfig = () => ({
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: COLORS.white
    }
  });

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando dashboard...</Text>
        </View>
      );
    }

    // Calcular valores para o resumo
    let totalProdutosCount = 0;
    let totalItensCount = 0;
    
    if (dashboardData) {
      totalProdutosCount = dashboardData.total_produtos;
      totalItensCount = dashboardData.total_itens;
    } else {
      totalProdutosCount = produtos.length;
      totalItensCount = produtos.reduce((sum, p) => sum + p.quantidade, 0);
    }

    if (totalProdutosCount === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Não há produtos cadastrados para gerar o dashboard.
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <Text style={styles.buttonText}>Adicionar Produto</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.container}>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
          </View>
        )}
        
        {/* Resumo em Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalProdutosCount}</Text>
            <Text style={styles.summaryLabel}>Produtos</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalItensCount}</Text>
            <Text style={styles.summaryLabel}>Unidades</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              R$ {(totalValue / 100).toLocaleString('pt-BR')}
            </Text>
            <Text style={styles.summaryLabel}>Valor Est.</Text>
          </View>
        </View>

        {/* Status do Estoque (Gráfico de Pizza) */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Status do Estoque</Text>
          {stockStatus.low === 0 && stockStatus.normal === 0 && stockStatus.high === 0 ? (
            <Text style={styles.noDataText}>Sem dados suficientes</Text>
          ) : (
            <PieChart
              data={pieChartData}
              width={screenWidth - 40}
              height={200}
              chartConfig={getBarChartConfig()}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              center={[10, 0]}
              absolute
            />
          )}
        </View>

        {/* Seletor de Gráfico */}
        <View style={styles.chartSelector}>
          <TouchableOpacity
            style={[
              styles.selectorButton,
              selectedChart === 'movimento' && styles.selectorButtonActive
            ]}
            onPress={() => setSelectedChart('movimento')}
          >
            <Text style={[
              styles.selectorText,
              selectedChart === 'movimento' && styles.selectorTextActive
            ]}>
              Movimentação
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.selectorButton,
              selectedChart === 'top5' && styles.selectorButtonActive
            ]}
            onPress={() => setSelectedChart('top5')}
          >
            <Text style={[
              styles.selectorText,
              selectedChart === 'top5' && styles.selectorTextActive
            ]}>
              Top 5 Produtos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Gráfico Selecionado */}
        <View style={styles.chartContainer}>
          {selectedChart === 'movimento' ? (
            <>
              <Text style={styles.chartTitle}>Movimentação (7 dias)</Text>
              {movimentos.length === 0 ? (
                <Text style={styles.noDataText}>Sem movimentações registradas</Text>
              ) : (
                <LineChart
                  data={getMovementData()}
                  width={screenWidth - 40}
                  height={220}
                  chartConfig={getLineChartConfig()}
                  bezier
                />
              )}
            </>
          ) : (
            <>
              <Text style={styles.chartTitle}>Top 5 Produtos por Quantidade</Text>
              <BarChart
                data={getTopProductsData()}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" un"
                chartConfig={getBarChartConfig()}
                verticalLabelRotation={30}
              />
            </>
          )}
        </View>

        {/* Últimas Movimentações */}
        <View style={styles.movementsContainer}>
          <Text style={styles.chartTitle}>Últimas Movimentações</Text>
          
          {(() => {
            // Determinar quais movimentações mostrar
            let movsToShow: MovimentacaoView[] = [];
            
            if (dashboardData && dashboardData.ultimas_movimentacoes && dashboardData.ultimas_movimentacoes.length > 0) {
              movsToShow = dashboardData.ultimas_movimentacoes.slice(0, 5);
            } else if (movimentos.length > 0) {
              // Ordenar movimentos pelo mais recente
              movsToShow = [...movimentos]
                .sort((a, b) => {
                  const dateA = new Date(a.data_movimentacao || '');
                  const dateB = new Date(b.data_movimentacao || '');
                  return dateB.getTime() - dateA.getTime();
                })
                .slice(0, 5)
                .map(m => ({
                  id: m.id,
                  tipo: m.tipo,
                  quantidade: m.quantidade,
                  data_movimentacao: m.data_movimentacao || new Date().toISOString(),
                  notas: m.notas,
                  produto_codigo: m.produto_codigo || 'N/D',
                  produto_nome: m.produto_nome || 'Produto'
                }));
            }
            
            if (movsToShow.length === 0) {
              return <Text style={styles.noDataText}>Sem movimentações registradas</Text>;
            }
            
            return movsToShow.map((movement, index) => {
              const isEntry = movement.tipo === 'entrada';
              const date = new Date(movement.data_movimentacao);
              const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              
              return (
                <View key={index} style={styles.movementItem}>
                  <View style={[
                    styles.movementType,
                    { backgroundColor: isEntry ? COLORS.success : COLORS.error }
                  ]}>
                    <Text style={styles.movementTypeText}>
                      {isEntry ? '+' : '-'}
                    </Text>
                  </View>
                  
                  <View style={styles.movementInfo}>
                    <Text style={styles.movementTitle}>
                      {isEntry ? 'Entrada' : 'Saída'} de {movement.quantidade} unidade(s)
                    </Text>
                    <Text style={styles.movementSubtitle}>
                      {movement.produto_nome}
                    </Text>
                    <Text style={styles.movementDate}>{formattedDate}</Text>
                  </View>
                  
                  <Text style={[
                    styles.movementQuantity,
                    { color: isEntry ? COLORS.success : COLORS.error }
                  ]}>
                    {isEntry ? '+' : '-'}{movement.quantidade}
                  </Text>
                </View>
              );
            });
          })()}
          
          {((dashboardData?.ultimas_movimentacoes?.length || 0) > 5 || movimentos.length > 5) && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => navigation.navigate('ProductList')}
            >
              <Text style={styles.viewMoreText}>Ver Todas Movimentações</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.updateInfo}>
          <Text style={styles.updateInfoText}>
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Dashboard" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.grey,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.grey,
    marginBottom: 20,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 10,
    width: '30%',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 5,
  },
  chartContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.black,
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.grey,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  chartSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  selectorButton: {
    flex: 1,
    backgroundColor: COLORS.ultraLightGrey,
    padding: 10,
    alignItems: 'center',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  selectorButtonActive: {
    backgroundColor: COLORS.primary,
  },
  selectorText: {
    fontSize: 14,
    color: COLORS.grey,
  },
  selectorTextActive: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  movementsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ultraLightGrey,
  },
  movementType: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  movementTypeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  movementInfo: {
    flex: 1,
  },
  movementTitle: {
    fontSize: 14,
    color: COLORS.black,
  },
  movementSubtitle: {
    fontSize: 12,
    color: COLORS.black,
    fontWeight: '500',
  },
  movementDate: {
    fontSize: 12,
    color: COLORS.grey,
  },
  movementQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewMoreButton: {
    alignItems: 'center',
    padding: 10,
    marginTop: 10,
  },
  viewMoreText: {
    color: COLORS.primary,
    fontSize: 14,
  },
  offlineBanner: {
    backgroundColor: COLORS.error,
    padding: 8,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'center',
  },
  offlineText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  updateInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  updateInfoText: {
    fontSize: 12,
    color: COLORS.grey,
    fontStyle: 'italic',
  },
});

export default DashboardScreen;