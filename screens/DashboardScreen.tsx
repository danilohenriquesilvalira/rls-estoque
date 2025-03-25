import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Header from '../components/Header';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

// Interface para o produto
interface Product {
  code: string;
  name: string;
  description?: string;
  quantity: number;
}

// Interface para registro de movimento
interface MovementRecord {
  date: string;
  type: 'in' | 'out';
  quantity: number;
  notes?: string;
}

// Interface para histórico completo do produto
interface ProductHistory {
  productCode: string;
  movements: MovementRecord[];
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
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [stockStatus, setStockStatus] = useState({
    low: 0,
    normal: 0,
    high: 0,
  });
  const [selectedChart, setSelectedChart] = useState('movimento');
  const [totalValue, setTotalValue] = useState(0);

  // Carregar dados para o dashboard
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Carregar produtos
        const productsJson = await AsyncStorage.getItem('products');
        const productsList: Product[] = productsJson ? JSON.parse(productsJson) : [];
        setProducts(productsList);
        
        // Calcular status de estoque
        const lowStock = productsList.filter(p => p.quantity < 5).length;
        const highStock = productsList.filter(p => p.quantity > 20).length;
        const normalStock = productsList.length - lowStock - highStock;
        
        setStockStatus({
          low: lowStock,
          normal: normalStock,
          high: highStock
        });
        
        // Calcular valor total estimado (simulação)
        const total = productsList.reduce((sum, product) => sum + (product.quantity * 100), 0);
        setTotalValue(total);
        
        // Carregar movimentações
        const historyJson = await AsyncStorage.getItem('productHistory');
        if (historyJson) {
          const allHistory: ProductHistory[] = JSON.parse(historyJson);
          
          // Extrair todas as movimentações
          const allMovements: MovementRecord[] = [];
          allHistory.forEach(history => {
            history.movements.forEach(movement => {
              allMovements.push(movement);
            });
          });
          
          // Ordenar por data
          allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          setMovements(allMovements);
        }
      } catch (error) {
        console.error("Erro ao carregar dados para o dashboard:", error);
      } finally {
        setLoading(false);
      }
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
    const sortedProducts = [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    
    return {
      labels: sortedProducts.map(p => p.name.length > 8 ? p.name.substring(0, 8) + '...' : p.name),
      datasets: [
        {
          data: sortedProducts.map(p => p.quantity)
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
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      dates.push(dateString.substring(5)); // Formato MM-DD
      
      // Calcular entradas e saídas para este dia
      const dayMovements = movements.filter(m => 
        m.date.startsWith(dateString)
      );
      
      const entries = dayMovements
        .filter(m => m.type === 'in')
        .reduce((sum, m) => sum + m.quantity, 0);
        
      const exits = dayMovements
        .filter(m => m.type === 'out')
        .reduce((sum, m) => sum + m.quantity, 0);
        
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

    if (products.length === 0) {
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
        {/* Resumo em Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{products.length}</Text>
            <Text style={styles.summaryLabel}>Produtos</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {products.reduce((sum, product) => sum + product.quantity, 0)}
            </Text>
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
              {movements.length === 0 ? (
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
          
          {movements.length === 0 ? (
            <Text style={styles.noDataText}>Sem movimentações registradas</Text>
          ) : (
            movements.slice(0, 5).map((movement, index) => {
              const isEntry = movement.type === 'in';
              const date = new Date(movement.date);
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
                      {isEntry ? 'Entrada' : 'Saída'} de {movement.quantity} unidade(s)
                    </Text>
                    <Text style={styles.movementDate}>{formattedDate}</Text>
                  </View>
                  
                  <Text style={styles.movementQuantity}>
                    {isEntry ? '+' : '-'}{movement.quantity}
                  </Text>
                </View>
              );
            })
          )}
          
          {movements.length > 5 && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => navigation.navigate('ProductList')}
            >
              <Text style={styles.viewMoreText}>Ver Todas Movimentações</Text>
            </TouchableOpacity>
          )}
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
});

export default DashboardScreen;