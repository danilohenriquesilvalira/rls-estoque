import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  StatusBar
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getProdutos, verificarConexao, getStatusConexao } from '../services/api';
import Header from '../components/Header';

// Definição do tipo para as propriedades de navegação
type ProductListScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ProductList'>;
};

// Interface para o produto (formato da API)
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

export default function ProductListScreen({ navigation }: ProductListScreenProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<'nome' | 'codigo' | 'quantidade'>('nome');
  const [sortAscending, setSortAscending] = useState(true);
  const [isOnline, setIsOnline] = useState(getStatusConexao());

  // Verificar conexão com o servidor
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await verificarConexao();
      setIsOnline(connected);
    };
    
    checkConnection();
  }, []);

  // Função para carregar produtos
  const loadProdutos = async () => {
    try {
      setLoading(true);
      
      // Usar a função de API para buscar produtos
      const produtosData = await getProdutos();
      setProdutos(produtosData);
      applyFiltersAndSorts(produtosData, searchText, sortOrder, sortAscending);
      
      // Verificar novamente o status da conexão
      const connected = await verificarConexao();
      setIsOnline(connected);
    } catch (e) {
      console.error("Erro ao carregar produtos", e);
      Alert.alert("Erro", "Não foi possível carregar a lista de produtos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Aplicar filtros e ordenação à lista de produtos
  const applyFiltersAndSorts = (
    produtosList: Produto[], 
    search: string, 
    order: 'nome' | 'codigo' | 'quantidade', 
    ascending: boolean
  ) => {
    // Primeiro aplicar a pesquisa
    let result = produtosList;
    
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      result = produtosList.filter(
        item => 
          item.nome.toLowerCase().includes(searchLower) || 
          item.codigo.toLowerCase().includes(searchLower) ||
          (item.descricao && item.descricao.toLowerCase().includes(searchLower))
      );
    }
    
    // Depois aplicar a ordenação
    result = [...result].sort((a, b) => {
      if (order === 'nome') {
        return ascending 
          ? a.nome.localeCompare(b.nome)
          : b.nome.localeCompare(a.nome);
      } else if (order === 'codigo') {
        return ascending 
          ? a.codigo.localeCompare(b.codigo)
          : b.codigo.localeCompare(a.codigo);
      } else { // quantidade
        return ascending 
          ? a.quantidade - b.quantidade
          : b.quantidade - a.quantidade;
      }
    });
    
    setFilteredProdutos(result);
  };

  // Efeito para carregar produtos ao montar o componente
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProdutos();
    });

    return unsubscribe;
  }, [navigation]);

  // Efeito para aplicar filtros quando os critérios mudarem
  useEffect(() => {
    applyFiltersAndSorts(produtos, searchText, sortOrder, sortAscending);
  }, [searchText, sortOrder, sortAscending]);

  // Função para atualizar a ordem de classificação
  const updateSortOrder = (order: 'nome' | 'codigo' | 'quantidade') => {
    if (sortOrder === order) {
      // Se já está ordenando por este campo, inverte a direção
      setSortAscending(!sortAscending);
    } else {
      // Muda para o novo campo e começa ascendente
      setSortOrder(order);
      setSortAscending(true);
    }
  };

  // Função para exibir o ícone de ordenação
  const getSortIcon = (field: 'nome' | 'codigo' | 'quantidade') => {
    if (sortOrder !== field) return '⋯';
    return sortAscending ? '↑' : '↓';
  };

  // Renderizar o indicador de carregamento
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Header 
            title="Lista de Produtos" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </View>

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      </View>
    );
  }

  // Renderizar mensagem quando não há produtos
  const renderEmptyList = () => {
    if (searchText) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhum produto encontrado para "{searchText}"
          </Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Text style={styles.clearButtonText}>Limpar Pesquisa</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <Text style={styles.buttonText}>Adicionar Produto</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Renderizar um item da lista
  const renderProductItem = ({ item }: { item: Produto }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => navigation.navigate('ProductDetail', { product: item })}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productCode}>{item.codigo}</Text>
        <Text style={styles.productName}>{item.nome}</Text>
        {item.descricao ? (
          <Text style={styles.productDescription} numberOfLines={1}>
            {item.descricao}
          </Text>
        ) : null}
      </View>
      <View style={[
        styles.quantityContainer, 
        item.quantidade < (item.quantidade_minima || 5) ? styles.lowQuantity : 
        item.quantidade > 20 ? styles.highQuantity : 
        styles.normalQuantity
      ]}>
        <Text style={styles.quantity}>{item.quantidade}</Text>
        <Text style={styles.quantityLabel}>unid.</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Header 
          title="Lista de Produtos" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
        </View>
      )}
      
      {/* Barra de pesquisa */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar produtos..."
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
          />
        </View>
      </View>
      
      {/* Cabeçalho de ordenação */}
      <View style={styles.sortHeader}>
        <TouchableOpacity 
          style={styles.sortButton} 
          onPress={() => updateSortOrder('codigo')}
        >
          <Text style={[
            styles.sortButtonText,
            sortOrder === 'codigo' && styles.activeSortText
          ]}>
            Código {getSortIcon('codigo')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.sortButtonName} 
          onPress={() => updateSortOrder('nome')}
        >
          <Text style={[
            styles.sortButtonText,
            sortOrder === 'nome' && styles.activeSortText
          ]}>
            Nome {getSortIcon('nome')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.sortButton} 
          onPress={() => updateSortOrder('quantidade')}
        >
          <Text style={[
            styles.sortButtonText,
            sortOrder === 'quantidade' && styles.activeSortText
          ]}>
            Qtd {getSortIcon('quantidade')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de produtos */}
      <FlatList
        data={filteredProdutos}
        keyExtractor={(item) => item.codigo}
        renderItem={renderProductItem}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={filteredProdutos.length === 0 ? { flex: 1 } : { paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProdutos();
            }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />

      {/* Botão flutuante para adicionar */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => navigation.navigate('AddProduct')}
      >
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.grey,
  },
  searchContainer: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: COLORS.grey,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.black,
  },
  sortHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sortButtonName: {
    flex: 2,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.grey,
  },
  activeSortText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 15,
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productCode: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 16,
    color: COLORS.black,
    marginTop: 4,
    fontWeight: '500',
  },
  productDescription: {
    fontSize: 14,
    color: COLORS.grey,
    marginTop: 4,
  },
  quantityContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
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
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  quantityLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
  },
  clearButton: {
    backgroundColor: COLORS.grey,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '60%',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  floatingButtonText: {
    fontSize: 30,
    color: COLORS.white,
    fontWeight: 'bold',
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
});