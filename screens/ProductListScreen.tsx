import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
  Animated,
  Dimensions,
  Easing
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getProdutos, verificarConexao, getStatusConexao } from '../services/api';
import Header from '../components/Header';
import FloatingActionButton from '../components/FloatingActionButton';

// Definition of navigation props type
type ProductListScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ProductList'>;
};

// Interface for product (API format)
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
  background: '#F7F9FD',
};

// Window dimensions
const windowWidth = Dimensions.get('window').width;

export default function ProductListScreen({ navigation }: ProductListScreenProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<'nome' | 'codigo' | 'quantidade'>('nome');
  const [sortAscending, setSortAscending] = useState(true);
  const [isOnline, setIsOnline] = useState(getStatusConexao());
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const listItemAnims = useRef<Animated.Value[]>([]).current;

  // Check connection to server
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await verificarConexao();
      setIsOnline(connected);
    };
    
    checkConnection();
  }, []);

  // Function to load products
  const loadProdutos = async () => {
    try {
      setLoading(true);
      
      // Use API function to fetch products
      const produtosData = await getProdutos();
      setProdutos(produtosData);
      
      // Create animation values for each product
      if (listItemAnims.length !== produtosData.length) {
        listItemAnims.length = 0;
        produtosData.forEach(() => {
          listItemAnims.push(new Animated.Value(0));
        });
      }
      
      applyFiltersAndSorts(produtosData, searchText, sortOrder, sortAscending);
      
      // Check connection status again
      const connected = await verificarConexao();
      setIsOnline(connected);
      
      // Animate elements when data is loaded
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(searchBarAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
        Animated.stagger(
          50,
          listItemAnims.map(anim => 
            Animated.spring(anim, {
              toValue: 1,
              friction: 8,
              tension: 40,
              useNativeDriver: true,
            })
          )
        )
      ]).start();
      
    } catch (e) {
      console.error("Error loading products", e);
      Alert.alert("Erro", "Não foi possível carregar a lista de produtos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Apply filters and sorting to product list
  const applyFiltersAndSorts = (
    produtosList: Produto[], 
    search: string, 
    order: 'nome' | 'codigo' | 'quantidade', 
    ascending: boolean
  ) => {
    // First apply search
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
    
    // Then apply sorting
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

  // Effect to load products when component mounts
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProdutos();
    });

    return unsubscribe;
  }, [navigation]);

  // Effect to apply filters when criteria change
  useEffect(() => {
    applyFiltersAndSorts(produtos, searchText, sortOrder, sortAscending);
  }, [searchText, sortOrder, sortAscending]);

  // Function to update sort order
  const updateSortOrder = (order: 'nome' | 'codigo' | 'quantidade') => {
    if (sortOrder === order) {
      // If already sorting by this field, reverse direction
      setSortAscending(!sortAscending);
    } else {
      // Change to new field and start ascending
      setSortOrder(order);
      setSortAscending(true);
    }
  };

  // Function to display sort icon
  const getSortIcon = (field: 'nome' | 'codigo' | 'quantidade') => {
    if (sortOrder !== field) return '⋯';
    return sortAscending ? '↑' : '↓';
  };

  // Render loading indicator
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Lista de Produtos" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      </View>
    );
  }

  // Render message when there are no products
  const renderEmptyList = () => {
    if (searchText) {
      return (
        <Animated.View 
          style={[
            styles.emptyContainer,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.emptyText}>
            Nenhum produto encontrado para "{searchText}"
          </Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Text style={styles.clearButtonText}>Limpar Pesquisa</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }
    
    return (
      <Animated.View 
        style={[
          styles.emptyContainer,
          { opacity: fadeAnim }
        ]}
      >
        <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <Text style={styles.buttonText}>Adicionar Produto</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render a list item
  const renderProductItem = ({ item, index }: { item: Produto, index: number }) => {
    // Use existing animation or create a new one if needed
    const animValue = index < listItemAnims.length 
      ? listItemAnims[index] 
      : new Animated.Value(1);
      
    return (
      <Animated.View
        style={{
          opacity: animValue,
          transform: [
            { translateX: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, 0],
            })},
            { scale: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            })}
          ]
        }}
      >
        <TouchableOpacity
          style={styles.productItem}
          onPress={() => navigation.navigate('ProductDetail', { product: item })}
          activeOpacity={0.7}
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
      </Animated.View>
    );
  };

  // FAB actions
  const fabActions = [
    {
      icon: '📦',
      name: 'Novo Produto',
      onPress: () => navigation.navigate('AddProduct'),
      color: COLORS.success
    },
    {
      icon: '📊',
      name: 'Dashboard',
      onPress: () => navigation.navigate('Dashboard'),
      color: COLORS.info
    },
    {
      icon: '🔍',
      name: 'Escanear',
      onPress: () => navigation.navigate('Scanner'),
      color: COLORS.accent
    }
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Lista de Produtos" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>

      {!isOnline && (
        <Animated.View 
          style={[
            styles.offlineBanner,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
        </Animated.View>
      )}
      
      {/* Search bar */}
      <Animated.View style={[
        styles.searchContainer,
        {
          opacity: searchBarAnim,
          transform: [
            { translateY: searchBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            })}
          ]
        }
      ]}>
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
      </Animated.View>
      
      {/* Sorting header */}
      <Animated.View style={[
        styles.sortHeader,
        {
          opacity: searchBarAnim,
          transform: [
            { translateY: searchBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            })}
          ]
        }
      ]}>
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
      </Animated.View>

      {/* Products list */}
      <FlatList
        data={filteredProdutos}
        keyExtractor={(item) => item.codigo}
        renderItem={renderProductItem}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={[
          filteredProdutos.length === 0 ? { flex: 1 } : { paddingBottom: 80 },
          styles.listContainer
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              // Reset animations for refresh effect
              listItemAnims.forEach(anim => anim.setValue(0));
              loadProdutos();
            }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />

      {/* Floating action button */}
      <FloatingActionButton
        actions={fabActions}
        mainButtonColor={COLORS.primary}
        mainButtonIcon="+"
      />
    </View>
  );
}

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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.grey,
  },
  searchContainer: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
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
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
  listContainer: {
    paddingTop: 10,
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 16,
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 16,
    alignItems: 'center',
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  clearButton: {
    backgroundColor: COLORS.grey,
    padding: 12,
    borderRadius: 16,
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