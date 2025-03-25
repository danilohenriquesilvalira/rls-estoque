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
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Definição do tipo para as propriedades de navegação
type ProductListScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ProductList'>;
};

// Interface para o produto
interface Product {
  code: string;
  name: string;
  description?: string;
  quantity: number;
}

export default function ProductListScreen({ navigation }: ProductListScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<'name' | 'code' | 'quantity'>('name');
  const [sortAscending, setSortAscending] = useState(true);

  // Função para carregar produtos
  const loadProducts = async () => {
    try {
      setLoading(true);
      const jsonValue = await AsyncStorage.getItem('products');
      let productsData: Product[] = [];
      
      if (jsonValue != null) {
        productsData = JSON.parse(jsonValue);
      }
      
      setProducts(productsData);
      applyFiltersAndSorts(productsData, searchText, sortOrder, sortAscending);
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
    productsList: Product[], 
    search: string, 
    order: 'name' | 'code' | 'quantity', 
    ascending: boolean
  ) => {
    // Primeiro aplicar a pesquisa
    let result = productsList;
    
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      result = productsList.filter(
        item => 
          item.name.toLowerCase().includes(searchLower) || 
          item.code.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Depois aplicar a ordenação
    result = [...result].sort((a, b) => {
      if (order === 'name') {
        return ascending 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (order === 'code') {
        return ascending 
          ? a.code.localeCompare(b.code)
          : b.code.localeCompare(a.code);
      } else { // quantity
        return ascending 
          ? a.quantity - b.quantity
          : b.quantity - a.quantity;
      }
    });
    
    setFilteredProducts(result);
  };

  // Efeito para carregar produtos ao montar o componente
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProducts();
    });

    return unsubscribe;
  }, [navigation]);

  // Efeito para aplicar filtros quando os critérios mudarem
  useEffect(() => {
    applyFiltersAndSorts(products, searchText, sortOrder, sortAscending);
  }, [searchText, sortOrder, sortAscending]);

  // Função para atualizar a ordem de classificação
  const updateSortOrder = (order: 'name' | 'code' | 'quantity') => {
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
  const getSortIcon = (field: 'name' | 'code' | 'quantity') => {
    if (sortOrder !== field) return '⋯';
    return sortAscending ? '↑' : '↓';
  };

  // Renderizar o indicador de carregamento
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Carregando produtos...</Text>
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
  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => navigation.navigate('ProductDetail', { product: item })}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productCode}>{item.code}</Text>
        <Text style={styles.productName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.productDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <View style={[
        styles.quantityContainer, 
        item.quantity < 5 ? styles.lowQuantity : 
        item.quantity > 20 ? styles.highQuantity : 
        styles.normalQuantity
      ]}>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <Text style={styles.quantityLabel}>unid.</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Barra de pesquisa */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar produtos..."
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
        />
      </View>
      
      {/* Cabeçalho de ordenação */}
      <View style={styles.sortHeader}>
        <TouchableOpacity 
          style={styles.sortButton} 
          onPress={() => updateSortOrder('code')}
        >
          <Text style={styles.sortButtonText}>
            Código {getSortIcon('code')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.sortButtonName} 
          onPress={() => updateSortOrder('name')}
        >
          <Text style={styles.sortButtonText}>
            Nome {getSortIcon('name')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.sortButton} 
          onPress={() => updateSortOrder('quantity')}
        >
          <Text style={styles.sortButtonText}>
            Qtd {getSortIcon('quantity')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de produtos */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.code}
        renderItem={renderProductItem}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={filteredProducts.length === 0 ? { flex: 1 } : {}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProducts();
            }}
            colors={['#3498db']}
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
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  searchContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  sortHeader: {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  sortButton: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
  },
  sortButtonName: {
    flex: 2,
    paddingVertical: 5,
    alignItems: 'center',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 10,
    marginTop: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  productName: {
    fontSize: 16,
    color: '#2c3e50',
    marginTop: 4,
    fontWeight: '500',
  },
  productDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  quantityContainer: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
    justifyContent: 'center',
    marginLeft: 10,
  },
  lowQuantity: {
    backgroundColor: '#ffcccc',
  },
  normalQuantity: {
    backgroundColor: '#e8f4f8',
  },
  highQuantity: {
    backgroundColor: '#d5f5e3',
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
  },
  clearButton: {
    backgroundColor: '#95a5a6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '60%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButtonText: {
    color: 'white',
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
    backgroundColor: '#3498db',
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
    color: 'white',
  },
});