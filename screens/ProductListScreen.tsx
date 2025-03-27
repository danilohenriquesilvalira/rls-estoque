import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Easing,
  Image,
  Switch,
  ToastAndroid
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getProdutos, verificarConexao, getStatusConexao } from '../services/api';
import Header from '../components/Header';
import FloatingActionButton from '../components/FloatingActionButton';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

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

// Filtro group by
type GroupBy = null | 'fornecedor' | 'localizacao';

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

// Formatar data
const formatarData = (dataString?: string): string => {
  if (!dataString) return 'N/A';
  
  try {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Data inválida';
  }
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
  const [showSearch, setShowSearch] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const listItemAnims = useRef<Animated.Value[]>([]).current;
  const searchExpandAnim = useRef(new Animated.Value(0)).current;
  const filterOptionsAnim = useRef(new Animated.Value(0)).current;

  // Check connection to server
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await verificarConexao();
      setIsOnline(connected);
    };
    
    checkConnection();

    // Verificar conexão a cada 30 segundos
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Toggle search bar
  const toggleSearchBar = () => {
    if (showSearch) {
      // Ocultar a barra de pesquisa
      Animated.timing(searchExpandAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowSearch(false);
        setSearchText('');
      });
    } else {
      // Mostrar a barra de pesquisa
      setShowSearch(true);
      Animated.timing(searchExpandAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // Toggle filter options
  const toggleFilterOptions = () => {
    if (showFilterOptions) {
      // Ocultar opções de filtro
      Animated.timing(filterOptionsAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowFilterOptions(false);
      });
    } else {
      // Mostrar opções de filtro
      setShowFilterOptions(true);
      Animated.timing(filterOptionsAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // Function to load products
  const loadProdutos = async () => {
    try {
      setLoading(true);
      
      // Use API function to fetch products
      const produtosData = await getProdutos();
      setProdutos(produtosData);
      setLastUpdate(new Date());
      
      // Create animation values for each product
      if (listItemAnims.length !== produtosData.length) {
        listItemAnims.length = 0;
        produtosData.forEach(() => {
          listItemAnims.push(new Animated.Value(0));
        });
      }
      
      applyFiltersAndSorts(produtosData, searchText, sortOrder, sortAscending, showLowStock, groupBy);
      
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
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Produtos atualizados', ToastAndroid.SHORT);
      }
      
    } catch (e) {
      console.error("Erro ao carregar produtos", e);
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
    ascending: boolean,
    onlyLowStock: boolean,
    groupByField: GroupBy
  ) => {
    // First apply search and low stock filter
    let result = produtosList;
    
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      result = produtosList.filter(
        item => 
          item.nome.toLowerCase().includes(searchLower) || 
          item.codigo.toLowerCase().includes(searchLower) ||
          (item.descricao && item.descricao.toLowerCase().includes(searchLower)) ||
          (item.fornecedor && item.fornecedor.toLowerCase().includes(searchLower)) ||
          (item.localizacao && item.localizacao.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter low stock if enabled
    if (onlyLowStock) {
      result = result.filter(item => {
        const minQuantity = item.quantidade_minima || 5;
        return item.quantidade <= minQuantity;
      });
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

  // Aplicando groupBy
  const groupedProdutos = useMemo(() => {
    if (!groupBy) return null;
    
    const groups: { [key: string]: Produto[] } = {};
    
    filteredProdutos.forEach(produto => {
      const groupValue = groupBy === 'fornecedor' 
        ? (produto.fornecedor || 'Sem fornecedor')
        : (produto.localizacao || 'Sem localização');
      
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      
      groups[groupValue].push(produto);
    });
    
    // Converter em array para o FlatList
    return Object.entries(groups)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, items]) => ({
        title: key,
        data: items
      }));
  }, [filteredProdutos, groupBy]);

  // Effect to load products when component mounts
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProdutos();
    });

    return unsubscribe;
  }, [navigation]);

  // Effect to apply filters when criteria change
  useEffect(() => {
    applyFiltersAndSorts(produtos, searchText, sortOrder, sortAscending, showLowStock, groupBy);
  }, [searchText, sortOrder, sortAscending, showLowStock, groupBy]);

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

  // Function to get sort icon name
  const getSortIconName = (field: 'nome' | 'codigo' | 'quantidade') => {
    if (sortOrder !== field) return null;
    return sortAscending ? "arrow-upward" : "arrow-downward";
  };

  // Function to calculate stock status
  const getStockStatus = (quantidade: number, quantidade_minima?: number) => {
    const min = quantidade_minima || 5;
    if (quantidade <= 0) return "empty";
    if (quantidade < min) return "low";
    if (quantidade < min * 2) return "medium";
    return "high";
  };

  // Function to get stock icon and color
  const getStockInfo = (status: string) => {
    switch (status) {
      case "empty":
        return { icon: "error-outline", color: COLORS.error, bgColor: '#FFEBEE', borderColor: '#FFCDD2' };
      case "low":
        return { icon: "warning", color: COLORS.warning, bgColor: '#FFF3E0', borderColor: '#FFE0B2' };
      case "medium":
        return { icon: "check-circle-outline", color: COLORS.info, bgColor: '#E3F2FD', borderColor: '#BBDEFB' };
      case "high":
        return { icon: "check-circle", color: COLORS.success, bgColor: '#E8F5E9', borderColor: '#C8E6C9' };
      default:
        return { icon: "help", color: COLORS.grey, bgColor: COLORS.lightGrey, borderColor: COLORS.grey };
    }
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
          <Text style={styles.loadingText}>A carregar produtos...</Text>
        </View>
      </View>
    );
  }

  // Render message when there are no products
  const renderEmptyList = () => {
    if (searchText || showLowStock || groupBy) {
      return (
        <Animated.View 
          style={[
            styles.emptyContainer,
            { opacity: fadeAnim }
          ]}
        >
          <MaterialIcons name="search-off" size={64} color={COLORS.grey} />
          <Text style={styles.emptyText}>
            Nenhum produto encontrado com os filtros aplicados
          </Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearchText('');
              setShowLowStock(false);
              setGroupBy(null);
            }}
          >
            <MaterialIcons name="clear" size={16} color={COLORS.white} />
            <Text style={styles.clearButtonText}>Limpar Filtros</Text>
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
        <MaterialIcons name="inventory" size={64} color={COLORS.grey} />
        <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <MaterialIcons name="add" size={18} color={COLORS.white} />
          <Text style={styles.buttonText}>Adicionar Produto</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render a group header
  const renderGroupHeader = (title: string, count: number) => (
    <View style={styles.groupHeader}>
      <MaterialIcons 
        name={groupBy === 'fornecedor' ? "business" : "place"} 
        size={18} 
        color={COLORS.primary} 
      />
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCount}>
        <Text style={styles.groupCountText}>{count}</Text>
      </View>
    </View>
  );

  // Render list header
  const renderListHeader = () => (
    <>
      {!isOnline && (
        <Animated.View 
          style={[
            styles.offlineBanner,
            { opacity: fadeAnim }
          ]}
        >
          <MaterialIcons name="cloud-off" size={18} color={COLORS.white} />
          <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
        </Animated.View>
      )}
      
      {/* Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.infoContainer}>
          <Text style={styles.productCount}>
            {filteredProdutos.length} {filteredProdutos.length === 1 ? 'Produto' : 'Produtos'}
          </Text>
          {lastUpdate && (
            <Text style={styles.lastUpdateText}>
              Atualizado: {formatarData(lastUpdate.toISOString())}
            </Text>
          )}
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleFilterOptions}
          >
            <MaterialIcons 
              name={showFilterOptions ? "filter-list-off" : "filter-list"} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleSearchBar}
          >
            <MaterialIcons 
              name={showSearch ? "close" : "search"} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Scanner')}
          >
            <MaterialIcons name="qr-code-scanner" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Filter Options */}
      {showFilterOptions && (
        <Animated.View 
          style={[
            styles.filterOptionsContainer,
            {
              maxHeight: filterOptionsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 200]
              }),
              opacity: filterOptionsAnim
            }
          ]}
        >
          <View style={styles.filterOption}>
            <Text style={styles.filterLabel}>Apenas produtos em baixo stock:</Text>
            <Switch
              value={showLowStock}
              onValueChange={setShowLowStock}
              trackColor={{ false: COLORS.lightGrey, true: COLORS.primaryLight }}
              thumbColor={showLowStock ? COLORS.primary : COLORS.grey}
            />
          </View>
          
          <Text style={styles.filterSectionTitle}>Agrupar por:</Text>
          
          <View style={styles.groupByOptions}>
            <TouchableOpacity
              style={[
                styles.groupByOption,
                groupBy === null && styles.activeGroupByOption
              ]}
              onPress={() => setGroupBy(null)}
            >
              <MaterialIcons 
                name="format-list-bulleted" 
                size={18} 
                color={groupBy === null ? COLORS.primary : COLORS.grey} 
              />
              <Text style={[
                styles.groupByText,
                groupBy === null && styles.activeGroupByText
              ]}>
                Nenhum
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.groupByOption,
                groupBy === 'fornecedor' && styles.activeGroupByOption
              ]}
              onPress={() => setGroupBy('fornecedor')}
            >
              <MaterialIcons 
                name="business" 
                size={18} 
                color={groupBy === 'fornecedor' ? COLORS.primary : COLORS.grey} 
              />
              <Text style={[
                styles.groupByText,
                groupBy === 'fornecedor' && styles.activeGroupByText
              ]}>
                Fornecedor
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.groupByOption,
                groupBy === 'localizacao' && styles.activeGroupByOption
              ]}
              onPress={() => setGroupBy('localizacao')}
            >
              <MaterialIcons 
                name="place" 
                size={18} 
                color={groupBy === 'localizacao' ? COLORS.primary : COLORS.grey} 
              />
              <Text style={[
                styles.groupByText,
                groupBy === 'localizacao' && styles.activeGroupByText
              ]}>
                Localização
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      
      {/* Search bar */}
      {showSearch && (
        <Animated.View 
          style={[
            styles.searchContainer,
            {
              maxHeight: searchExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 60]
              }),
              opacity: searchExpandAnim
            }
          ]}
        >
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color={COLORS.grey} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar produtos..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor={COLORS.grey}
              autoFocus={showSearch}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <MaterialIcons name="clear" size={20} color={COLORS.grey} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
      
      {/* Sorting header */}
      {!groupBy && (
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
            style={[
              styles.sortButton,
              sortOrder === 'codigo' && styles.activeSortButton
            ]} 
            onPress={() => updateSortOrder('codigo')}
          >
            <Text style={[
              styles.sortButtonText,
              sortOrder === 'codigo' && styles.activeSortText
            ]}>
              Código
            </Text>
            {getSortIconName('codigo') && (
              <MaterialIcons 
                name={getSortIconName('codigo') as any} 
                size={16} 
                color={sortOrder === 'codigo' ? COLORS.primary : COLORS.grey} 
              />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.sortButtonName,
              sortOrder === 'nome' && styles.activeSortButton
            ]} 
            onPress={() => updateSortOrder('nome')}
          >
            <Text style={[
              styles.sortButtonText,
              sortOrder === 'nome' && styles.activeSortText
            ]}>
              Nome
            </Text>
            {getSortIconName('nome') && (
              <MaterialIcons 
                name={getSortIconName('nome') as any} 
                size={16} 
                color={sortOrder === 'nome' ? COLORS.primary : COLORS.grey} 
              />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.sortButton,
              sortOrder === 'quantidade' && styles.activeSortButton
            ]} 
            onPress={() => updateSortOrder('quantidade')}
          >
            <Text style={[
              styles.sortButtonText,
              sortOrder === 'quantidade' && styles.activeSortText
            ]}>
              Qtd
            </Text>
            {getSortIconName('quantidade') && (
              <MaterialIcons 
                name={getSortIconName('quantidade') as any} 
                size={16} 
                color={sortOrder === 'quantidade' ? COLORS.primary : COLORS.grey} 
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );

  // Render a list item
  const renderProductItem = ({ item, index }: { item: Produto, index: number }) => {
    // Use existing animation or create a new one if needed
    const animValue = index < listItemAnims.length 
      ? listItemAnims[index] 
      : new Animated.Value(1);
    
    const stockStatus = getStockStatus(item.quantidade, item.quantidade_minima);
    const { icon, color, bgColor, borderColor } = getStockInfo(stockStatus);
      
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
          <View style={[styles.productStatusBar, { backgroundColor: color }]} />
          
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <View style={styles.productCodeContainer}>
                <FontAwesome5 name="barcode" size={12} color={COLORS.primary} />
                <Text style={styles.productCode}>{item.codigo}</Text>
              </View>
              
              {item.localizacao && !groupBy && (
                <View style={styles.locationContainer}>
                  <MaterialIcons name="place" size={12} color={COLORS.grey} />
                  <Text style={styles.locationText}>{item.localizacao}</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.productName}>{item.nome}</Text>
            
            {item.descricao ? (
              <Text style={styles.productDescription} numberOfLines={1}>
                {item.descricao}
              </Text>
            ) : null}
            
            {item.fornecedor && !groupBy && (
              <View style={styles.supplierContainer}>
                <MaterialIcons name="business" size={12} color={COLORS.grey} />
                <Text style={styles.supplierText}>
                  {item.fornecedor}
                </Text>
              </View>
            )}
            
            {item.data_atualizacao && (
              <View style={styles.dataContainer}>
                <MaterialIcons name="update" size={10} color={COLORS.grey} />
                <Text style={styles.dataText}>
                  {formatarData(item.data_atualizacao).split(' ')[0]}
                </Text>
              </View>
            )}
          </View>
          
          <View style={[
            styles.quantityContainer, 
            { backgroundColor: bgColor, borderColor: borderColor }
          ]}>
            <MaterialIcons name={icon as any} size={16} color={color} />
            <Text style={[styles.quantity, { color }]}>{item.quantidade}</Text>
            <Text style={styles.quantityLabel}>unid.</Text>
            
            {item.quantidade_minima && (
              <Text style={styles.minimumLabel}>
                min: {item.quantidade_minima}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Renderizar lista agrupada
  const renderGroupedList = () => {
    if (!groupedProdutos) return null;
    
    return (
      <FlatList
        data={groupedProdutos}
        keyExtractor={(item) => item.title}
        renderItem={({ item }) => (
          <View>
            {renderGroupHeader(item.title, item.data.length)}
            {item.data.map((produto, index) => (
              <View key={String(produto.id || produto.codigo)}>
                {renderProductItem({ item: produto, index })}
              </View>
            ))}
          </View>
        )}
        ListHeaderComponent={renderListHeader}
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
    );
  };

  // FAB actions
  const fabActions = [
    {
      icon: "add-box",
      name: 'Novo Produto',
      onPress: () => navigation.navigate('AddProduct'),
      color: COLORS.success
    },
    {
      icon: "insights",
      name: 'Dashboard',
      onPress: () => navigation.navigate('Dashboard'),
      color: COLORS.info
    },
    {
      icon: "error",
      name: 'Críticos',
      onPress: () => navigation.navigate('CriticalProducts'),
      color: COLORS.warning
    }
  ];

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
      
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

      {/* Products list or grouped list */}
      {groupBy ? renderGroupedList() : (
        <FlatList
          data={filteredProdutos}
          keyExtractor={(item) => String(item.id || item.codigo)}
          renderItem={renderProductItem}
          ListHeaderComponent={renderListHeader}
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
      )}

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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoContainer: {
    flex: 1,
  },
  productCount: {
    fontSize: 14,
    color: COLORS.grey,
    fontWeight: '500',
  },
  lastUpdateText: {
    fontSize: 11,
    color: COLORS.grey,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    marginLeft: 8,
  },
  filterOptionsContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  filterLabel: {
    fontSize: 14,
    color: COLORS.black,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.grey,
    marginTop: 12,
    marginBottom: 8,
  },
  groupByOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupByOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  activeGroupByOption: {
    backgroundColor: COLORS.primaryLight + '33', // 20% opacity
  },
  groupByText: {
    fontSize: 13,
    color: COLORS.grey,
    marginLeft: 4,
  },
  activeGroupByText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  searchContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 0,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    height: 44,
    marginVertical: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.black,
    marginLeft: 8,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  sortButtonName: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeSortButton: {
    backgroundColor: COLORS.primaryLight + '33', // 20% opacity
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.grey,
    marginRight: 4,
  },
  activeSortText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingTop: 0,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginLeft: 8,
    flex: 1,
  },
  groupCount: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupCountText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '600',
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  productStatusBar: {
    width: 6,
    height: '100%',
  },
  productInfo: {
    flex: 1,
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productCode: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: COLORS.grey,
    marginLeft: 2,
  },
  productName: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: COLORS.grey,
    marginBottom: 4,
  },
  supplierContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  supplierText: {
    fontSize: 12,
    color: COLORS.grey,
    marginLeft: 4,
  },
  dataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dataText: {
    fontSize: 10,
    color: COLORS.grey,
    marginLeft: 4,
  },
  quantityContainer: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  quantityLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 2,
  },
  minimumLabel: {
    fontSize: 10,
    color: COLORS.grey,
    marginTop: 6,
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
    marginVertical: 20,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    backgroundColor: COLORS.grey,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '60%',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clearButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.error,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});