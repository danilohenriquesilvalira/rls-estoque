import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  SafeAreaView,
  Switch,
  Alert,
  Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { RootStackParamList } from '../App';
import { getMovimentacoes, getProdutos, getStatusConexao } from '../services/api';
import { format, parseISO, subDays } from 'date-fns';
import { pt } from 'date-fns/locale';

// Definição do tipo para as propriedades de navegação
type HistoryScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'History'>;
};

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

// Interface para produto
interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
}

// Opções para filtros de período
type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

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
  background: '#F7F9FD',
};

const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  // Estados para dados
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(getStatusConexao());
  
  // Estados para filtros
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productModalVisible, setProductModalVisible] = useState(false);
  
  // Estados para estatísticas
  const [showStats, setShowStats] = useState(false);
  
  // Carregar dados iniciais
  useEffect(() => {
    loadData();
    
    // Recarregar ao retornar para esta tela
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);
  
  // Função para carregar dados
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar movimentações
      const movimentacoesData = await getMovimentacoes();
      setMovimentacoes(movimentacoesData);
      
      // Carregar produtos para os filtros e exibições
      const produtosData = await getProdutos();
      setProdutos(produtosData);
      
      // Verificar status de conexão
      setIsOnline(getStatusConexao());
    } catch (error) {
      console.error("Erro ao carregar dados de histórico:", error);
      Alert.alert("Erro", "Não foi possível carregar o histórico de movimentações");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Função para aplicar filtros de período
  const getDateRange = (period: PeriodFilter): [Date | null, Date | null] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (period) {
      case 'today':
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        return [today, endOfDay];
        
      case 'week':
        return [subDays(today, 7), new Date()];
        
      case 'month':
        return [subDays(today, 30), new Date()];
        
      case 'custom':
        return [startDate, endDate];
        
      default:
        return [null, null];
    }
  };
  
  // Aplicar todos os filtros às movimentações
  const filteredMovimentos = useMemo(() => {
    if (!movimentacoes.length) return [];
    
    let result = [...movimentacoes];
    
    // Aplicar filtro de texto (busca por nome ou código do produto)
    if (searchText.trim() !== '') {
      const searchLower = searchText.toLowerCase();
      result = result.filter(
        (m) => 
          (m.produto_nome && m.produto_nome.toLowerCase().includes(searchLower)) || 
          (m.produto_codigo && m.produto_codigo.toLowerCase().includes(searchLower)) ||
          (m.notas && m.notas.toLowerCase().includes(searchLower))
      );
    }
    
    // Aplicar filtro de tipo de movimentação
    if (tipoFiltro !== 'todos') {
      result = result.filter(m => m.tipo === tipoFiltro);
    }
    
    // Aplicar filtro de produto
    if (selectedProductId !== null) {
      result = result.filter(m => m.produto_id === selectedProductId);
    }
    
    // Aplicar filtro de período
    const [start, end] = getDateRange(periodFilter);
    if (start && end) {
      result = result.filter(m => {
        if (!m.data_movimentacao) return false;
        const movDate = new Date(m.data_movimentacao);
        return movDate >= start && movDate <= end;
      });
    }
    
    // Ordenar por data (mais recente primeiro)
    result.sort((a, b) => {
      const dateA = new Date(a.data_movimentacao || new Date().toISOString());
      const dateB = new Date(b.data_movimentacao || new Date().toISOString());
      return dateB.getTime() - dateA.getTime();
    });
    
    return result;
  }, [movimentacoes, searchText, tipoFiltro, selectedProductId, periodFilter, startDate, endDate]);
  
  // Calcular estatísticas
  const stats = useMemo(() => {
    const totalEntradas = filteredMovimentos
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.quantidade, 0);
      
    const totalSaidas = filteredMovimentos
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + m.quantidade, 0);
      
    // Produtos mais movimentados
    const produtoCount: Record<number, { entrada: number, saida: number, nome: string }> = {};
    
    filteredMovimentos.forEach(m => {
      if (!produtoCount[m.produto_id]) {
        produtoCount[m.produto_id] = { 
          entrada: 0, 
          saida: 0, 
          nome: m.produto_nome || `Produto ${m.produto_id}` 
        };
      }
      
      if (m.tipo === 'entrada') {
        produtoCount[m.produto_id].entrada += m.quantidade;
      } else {
        produtoCount[m.produto_id].saida += m.quantidade;
      }
    });
    
    // Converter para array e ordenar
    const topProdutos = Object.entries(produtoCount)
      .map(([id, data]) => ({
        id: Number(id),
        nome: data.nome,
        entrada: data.entrada,
        saida: data.saida,
        total: data.entrada + data.saida
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    return {
      totalMovimentacoes: filteredMovimentos.length,
      totalEntradas,
      totalSaidas,
      balanco: totalEntradas - totalSaidas,
      topProdutos
    };
  }, [filteredMovimentos]);
  
  // Função para formatar data (formato europeu)
  const formatarData = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: pt });
    } catch (error) {
      return "Data inválida";
    }
  };
  
  // Renderizar filtros
  const renderFilters = () => {
    return (
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>Filtros</Text>
        
        {/* Filtro de texto */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Procurar:</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Nome do produto, código..."
            clearButtonMode="while-editing"
          />
        </View>
        
        {/* Filtro de tipo */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Tipo:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton, 
                tipoFiltro === 'todos' && styles.activeFilterButton
              ]}
              onPress={() => setTipoFiltro('todos')}
            >
              <Text style={[
                styles.filterButtonText,
                tipoFiltro === 'todos' && styles.activeFilterText
              ]}>Todos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton, 
                tipoFiltro === 'entrada' && styles.entryFilterButton
              ]}
              onPress={() => setTipoFiltro('entrada')}
            >
              <Text style={[
                styles.filterButtonText,
                tipoFiltro === 'entrada' && styles.activeFilterText
              ]}>Entradas</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton, 
                tipoFiltro === 'saida' && styles.exitFilterButton
              ]}
              onPress={() => setTipoFiltro('saida')}
            >
              <Text style={[
                styles.filterButtonText,
                tipoFiltro === 'saida' && styles.activeFilterText
              ]}>Saídas</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Filtro de período */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Período:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton, 
                periodFilter === 'all' && styles.activeFilterButton
              ]}
              onPress={() => setPeriodFilter('all')}
            >
              <Text style={[
                styles.filterButtonText,
                periodFilter === 'all' && styles.activeFilterText
              ]}>Todos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton, 
                periodFilter === 'today' && styles.activeFilterButton
              ]}
              onPress={() => setPeriodFilter('today')}
            >
              <Text style={[
                styles.filterButtonText,
                periodFilter === 'today' && styles.activeFilterText
              ]}>Hoje</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton, 
                periodFilter === 'week' && styles.activeFilterButton
              ]}
              onPress={() => setPeriodFilter('week')}
            >
              <Text style={[
                styles.filterButtonText,
                periodFilter === 'week' && styles.activeFilterText
              ]}>7 dias</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton, 
                periodFilter === 'month' && styles.activeFilterButton
              ]}
              onPress={() => setPeriodFilter('month')}
            >
              <Text style={[
                styles.filterButtonText,
                periodFilter === 'month' && styles.activeFilterText
              ]}>30 dias</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Filtro de produto */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Produto:</Text>
          <TouchableOpacity
            style={styles.productFilterButton}
            onPress={() => setProductModalVisible(true)}
          >
            <Text style={styles.productFilterText}>
              {selectedProductId 
                ? produtos.find(p => p.id === selectedProductId)?.nome || 'Produto selecionado' 
                : 'Selecionar produto'}
            </Text>
          </TouchableOpacity>
          
          {selectedProductId && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSelectedProductId(null)}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Botões de ação */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setSearchText('');
              setTipoFiltro('todos');
              setPeriodFilter('all');
              setSelectedProductId(null);
              setStartDate(null);
              setEndDate(null);
            }}
          >
            <Text style={styles.resetButtonText}>Limpar filtros</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyButtonText}>Aplicar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Renderizar estatísticas
  const renderStats = () => {
    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Estatísticas</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalMovimentacoes}</Text>
            <Text style={styles.statLabel}>Movimentações</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              {stats.totalEntradas}
            </Text>
            <Text style={styles.statLabel}>Entradas</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.error }]}>
              {stats.totalSaidas}
            </Text>
            <Text style={styles.statLabel}>Saídas</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue, 
              stats.balanco >= 0 ? { color: COLORS.success } : { color: COLORS.error }
            ]}>
              {stats.balanco}
            </Text>
            <Text style={styles.statLabel}>Balanço</Text>
          </View>
        </View>
        
        {stats.topProdutos.length > 0 && (
          <>
            <Text style={styles.topProductsTitle}>Produtos Mais Movimentados</Text>
            
            {stats.topProdutos.map((produto, index) => (
              <View key={index} style={styles.topProductItem}>
                <Text style={styles.topProductRank}>{index + 1}</Text>
                <View style={styles.topProductInfo}>
                  <Text style={styles.topProductName}>{produto.nome}</Text>
                  <View style={styles.topProductStats}>
                    <Text style={[styles.topProductStat, { color: COLORS.success }]}>
                      E: {produto.entrada}
                    </Text>
                    <Text style={[styles.topProductStat, { color: COLORS.error }]}>
                      S: {produto.saida}
                    </Text>
                    <Text style={styles.topProductStat}>
                      Total: {produto.total}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };
  
  // Renderizar um item da lista
  const renderMovementItem = ({ item }: { item: Movimentacao }) => (
    <TouchableOpacity
      style={styles.movementItem}
      onPress={() => {
        if (item.produto_id) {
          // Buscar o produto completo
          const produto = produtos.find(p => p.id === item.produto_id);
          if (produto) {
            navigation.navigate('ProductDetail', { product: produto });
          }
        }
      }}
    >
      <View style={[
        styles.movementIndicator,
        item.tipo === 'entrada' ? styles.entryIndicator : styles.exitIndicator
      ]} />
      
      <View style={styles.movementContent}>
        <View style={styles.movementHeader}>
          <Text style={styles.productName}>{item.produto_nome || 'Produto desconhecido'}</Text>
          <Text style={styles.movementDate}>{formatarData(item.data_movimentacao)}</Text>
        </View>
        
        <View style={styles.movementDetails}>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Código: </Text>
            <Text style={styles.codeValue}>{item.produto_codigo || 'N/A'}</Text>
          </View>
          
          <View style={styles.quantityContainer}>
            <Text style={[
              styles.quantityValue,
              item.tipo === 'entrada' ? styles.entryText : styles.exitText
            ]}>
              {item.tipo === 'entrada' ? '+' : '-'}{item.quantidade} unid.
            </Text>
          </View>
        </View>
        
        {item.notas && (
          <Text style={styles.notesText}>Obs: {item.notas}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
  
  // Renderizar modal de seleção de produto
  const renderProductModal = () => (
    <Modal
      visible={productModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setProductModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Selecionar Produto</Text>
          
          <TextInput
            style={styles.modalSearchInput}
            placeholder="Procurar produto..."
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
          />
          
          <FlatList
            data={produtos.filter(p => 
              searchText.trim() === '' ||
              p.nome.toLowerCase().includes(searchText.toLowerCase()) ||
              p.codigo.toLowerCase().includes(searchText.toLowerCase())
            )}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.productItem,
                  selectedProductId === item.id && styles.selectedProductItem
                ]}
                onPress={() => {
                  setSelectedProductId(item.id || null);
                  setProductModalVisible(false);
                  setSearchText('');
                }}
              >
                <Text style={styles.productItemCode}>{item.codigo}</Text>
                <Text style={styles.productItemName}>{item.nome}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>
                Nenhum produto encontrado
              </Text>
            }
            style={styles.productList}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setProductModalVisible(false);
                setSearchText('');
              }}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Header 
            title="Histórico" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>A carregar histórico...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Header 
          title="Histórico" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </View>
      
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Modo Offline - A exibir dados locais</Text>
        </View>
      )}
      
      {/* Barra de filtros e estatísticas */}
      <View style={styles.controlBar}>
        {/* Contador de resultados e filtros ativos */}
        <View style={styles.resultsSummary}>
          <Text style={styles.resultsText}>
            {filteredMovimentos.length} movimentações
          </Text>
          
          {/* Mostrar badges para filtros ativos */}
          <View style={styles.filterBadges}>
            {tipoFiltro !== 'todos' && (
              <View style={[
                styles.filterBadge, 
                tipoFiltro === 'entrada' ? styles.entryBadge : styles.exitBadge
              ]}>
                <Text style={styles.filterBadgeText}>
                  {tipoFiltro === 'entrada' ? 'Entradas' : 'Saídas'}
                </Text>
              </View>
            )}
            
            {periodFilter !== 'all' && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {periodFilter === 'today' ? 'Hoje' : 
                   periodFilter === 'week' ? '7 dias' : 
                   periodFilter === 'month' ? '30 dias' : 'Período'}
                </Text>
              </View>
            )}
            
            {selectedProductId && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {produtos.find(p => p.id === selectedProductId)?.codigo || 'Produto'}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Botões de filtro e estatísticas */}
        <View style={styles.controlButtons}>
          <TouchableOpacity 
            style={[
              styles.controlButton,
              showFilters && styles.activeControlButton
            ]}
            onPress={() => {
              setShowFilters(!showFilters);
              if (showStats && !showFilters) setShowStats(false);
            }}
          >
            <Text style={[
              styles.controlButtonText,
              showFilters && styles.activeControlText
            ]}>Filtros</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.controlButton,
              showStats && styles.activeControlButton
            ]}
            onPress={() => {
              setShowStats(!showStats);
              if (showFilters && !showStats) setShowFilters(false);
            }}
          >
            <Text style={[
              styles.controlButtonText,
              showStats && styles.activeControlText
            ]}>Estatísticas</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Painéis expansíveis */}
      {showFilters && renderFilters()}
      {showStats && renderStats()}
      
      {/* Lista de movimentações */}
      <FlatList
        data={filteredMovimentos}
        renderItem={renderMovementItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhuma movimentação encontrada
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => {
                setSearchText('');
                setTipoFiltro('todos');
                setPeriodFilter('all');
                setSelectedProductId(null);
              }}
            >
              <Text style={styles.emptyButtonText}>Limpar filtros</Text>
            </TouchableOpacity>
          </View>
        }
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadData();
        }}
      />
      
      {/* Modal de seleção de produto */}
      {renderProductModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.grey,
  },
  offlineBanner: {
    backgroundColor: COLORS.error,
    padding: 8,
    alignItems: 'center',
  },
  offlineText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  resultsSummary: {
    flex: 1,
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.grey,
  },
  filterBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  filterBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  entryBadge: {
    backgroundColor: COLORS.success,
  },
  exitBadge: {
    backgroundColor: COLORS.error,
  },
  filterBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  controlButtons: {
    flexDirection: 'row',
  },
  controlButton: {
    backgroundColor: COLORS.ultraLightGrey,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  activeControlButton: {
    backgroundColor: COLORS.primary,
  },
  controlButtonText: {
    color: COLORS.grey,
    fontSize: 14,
    fontWeight: '500',
  },
  activeControlText: {
    color: COLORS.white,
  },
  filtersContainer: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: COLORS.primary,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 5,
  },
  searchInput: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterButton: {
    backgroundColor: COLORS.ultraLightGrey,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
  },
  entryFilterButton: {
    backgroundColor: COLORS.success,
  },
  exitFilterButton: {
    backgroundColor: COLORS.error,
  },
  filterButtonText: {
    color: COLORS.grey,
    fontSize: 14,
  },
  activeFilterText: {
    color: COLORS.white,
    fontWeight: '500',
  },
  productFilterButton: {
    backgroundColor: COLORS.ultraLightGrey,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productFilterText: {
    color: COLORS.black,
    flex: 1,
  },
  clearButton: {
    backgroundColor: COLORS.lightGrey,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -12,
  },
  clearButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  resetButton: {
    borderWidth: 1,
    borderColor: COLORS.grey,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  resetButtonText: {
    color: COLORS.grey,
    fontSize: 14,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    flex: 1,
  },
  applyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  // Estatísticas
  statsContainer: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: COLORS.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statItem: {
    width: '48%',
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 5,
  },
  topProductsTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 5,
    marginBottom: 10,
    color: COLORS.black,
  },
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  topProductRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    marginRight: 10,
  },
  topProductInfo: {
    flex: 1,
  },
  topProductName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 3,
  },
  topProductStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topProductStat: {
    fontSize: 12,
    marginRight: 10,
  },
  // Lista de movimentações
  listContent: {
    padding: 15,
    paddingBottom: 30,
  },
  movementItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  movementIndicator: {
    width: 8,
    backgroundColor: COLORS.primary,
  },
  entryIndicator: {
    backgroundColor: COLORS.success,
  },
  exitIndicator: {
    backgroundColor: COLORS.error,
  },
  movementContent: {
    flex: 1,
    padding: 12,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.black,
    flex: 1,
    marginRight: 10,
  },
  movementDate: {
    fontSize: 12,
    color: COLORS.grey,
  },
  movementDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 13,
    color: COLORS.grey,
  },
  codeValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },
  quantityContainer: {
    
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  entryText: {
    color: COLORS.success,
  },
  exitText: {
    color: COLORS.error,
  },
  notesText: {
    fontSize: 13,
    color: COLORS.grey,
    fontStyle: 'italic',
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 15,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal de seleção de produto
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalSearchInput: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    marginBottom: 15,
  },
  productList: {
    maxHeight: 400,
  },
  productItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  selectedProductItem: {
    backgroundColor: COLORS.ultraLightGrey,
  },
  productItemCode: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  productItemName: {
    fontSize: 14,
    color: COLORS.black,
    marginTop: 3,
  },
  emptyListText: {
    fontSize: 14,
    color: COLORS.grey,
    textAlign: 'center',
    padding: 20,
  },
  modalButtons: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: COLORS.grey,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HistoryScreen;