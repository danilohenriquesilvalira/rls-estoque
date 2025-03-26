// screens/CriticalProductsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  TextInput,
  RefreshControl,
  Share,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getProdutos, criarMovimentacao } from '../services/api';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../App';

// Define props type
type CriticalProductsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

// Interface for product
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
}

// Urgency category enum
enum UrgencyCategory {
  EMPTY = "EMPTY",           // Quantity is zero
  CRITICAL = "CRITICAL",     // Below 50% of minimum
  LOW = "LOW"                // Below minimum but above 50%
}

// Product with urgency information
interface UrgentProduct extends Produto {
  urgencyCategory: UrgencyCategory;
  deficit: number;           // How many items below minimum
  percentageLeft: number;    // Percentage of minimum quantity remaining
}

// Component for Header Category
const CategoryHeader: React.FC<{
  title: string;
  count: number;
  color: string;
}> = ({ title, count, color }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;

  return (
    <View style={[
      styles.categoryHeader,
      { backgroundColor: COLORS.card }
    ]}>
      <View style={[
        styles.categoryBadge,
        { backgroundColor: color }
      ]}>
        <Text style={styles.categoryBadgeText}>{count}</Text>
      </View>
      <Text style={[styles.categoryTitle, { color: COLORS.text }]}>{title}</Text>
    </View>
  );
};

const CriticalProductsScreen: React.FC<CriticalProductsScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allProducts, setAllProducts] = useState<Produto[]>([]);
  const [criticalProducts, setCriticalProducts] = useState<UrgentProduct[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showQuickEntryInput, setShowQuickEntryInput] = useState<{
    productId: number;
    currentQty: number;
    visible: boolean;
    quantityToAdd: string;
  }>({ productId: 0, currentQty: 0, visible: false, quantityToAdd: "0" });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Count by urgency category
  const categoryCounts = {
    [UrgencyCategory.EMPTY]: criticalProducts.filter(p => p.urgencyCategory === UrgencyCategory.EMPTY).length,
    [UrgencyCategory.CRITICAL]: criticalProducts.filter(p => p.urgencyCategory === UrgencyCategory.CRITICAL).length,
    [UrgencyCategory.LOW]: criticalProducts.filter(p => p.urgencyCategory === UrgencyCategory.LOW).length,
  };

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        
        // Get all products
        const produtos = await getProdutos();
        setAllProducts(produtos);
        
        // Process products to identify critical ones
        const processCriticalProducts = produtos
          .filter(produto => {
            const minQuantity = produto.quantidade_minima || 5; // Default minimum is 5
            return produto.quantidade <= minQuantity; // At or below minimum quantity
          })
          .map(produto => {
            const minQuantity = produto.quantidade_minima || 5;
            const percentageLeft = produto.quantidade / minQuantity * 100;
            let category = UrgencyCategory.LOW;
            
            if (produto.quantidade === 0) {
              category = UrgencyCategory.EMPTY;
            } else if (percentageLeft <= 50) {
              category = UrgencyCategory.CRITICAL;
            }
            
            return {
              ...produto,
              urgencyCategory: category,
              deficit: Math.max(0, minQuantity - produto.quantidade),
              percentageLeft
            };
          })
          .sort((a, b) => {
            // Sort by urgency category (EMPTY first, then CRITICAL, then LOW)
            const categoryOrder = { 
              [UrgencyCategory.EMPTY]: 0, 
              [UrgencyCategory.CRITICAL]: 1, 
              [UrgencyCategory.LOW]: 2 
            };
            
            const categoryA = categoryOrder[a.urgencyCategory];
            const categoryB = categoryOrder[b.urgencyCategory];
            
            if (categoryA !== categoryB) {
              return categoryA - categoryB;
            }
            
            // Within the same category, sort by percentage remaining
            return a.percentageLeft - b.percentageLeft;
          });
        
        setCriticalProducts(processCriticalProducts);
        
        // Start animations
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start();
        
      } catch (error) {
        console.error("Error loading products:", error);
        Alert.alert("Error", "Failed to load critical products");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    loadProducts();
    
    // Reload when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadProducts();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Filter products based on search
  const filteredProducts = criticalProducts.filter(product =>
    searchText === '' || 
    product.nome.toLowerCase().includes(searchText.toLowerCase()) ||
    product.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
    (product.descricao && product.descricao.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Get color based on urgency category
  const getUrgencyColor = (category: UrgencyCategory) => {
    switch (category) {
      case UrgencyCategory.EMPTY:
        return COLORS.error;
      case UrgencyCategory.CRITICAL:
        return COLORS.warning;
      case UrgencyCategory.LOW:
        return '#FFA726'; // Light orange
      default:
        return COLORS.grey;
    }
  };

  // Handle quick entry of stock
  const handleQuickEntry = async (productId: number, quantityToAdd: string) => {
    const quantity = parseInt(quantityToAdd);
    
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }
    
    try {
      setLoading(true);
      
      // Create stock entry movement
      await criarMovimentacao({
        produto_id: productId,
        tipo: 'entrada',
        quantidade: quantity,
        notas: 'Quick entry from Critical Products screen'
      });
      
      // Reset input
      setShowQuickEntryInput({
        productId: 0,
        currentQty: 0,
        visible: false,
        quantityToAdd: "0"
      });
      
      // Reload products
      const produtos = await getProdutos();
      setAllProducts(produtos);
      
      // Process critical products again
      const processCriticalProducts = produtos
        .filter(produto => {
          const minQuantity = produto.quantidade_minima || 5;
          return produto.quantidade <= minQuantity;
        })
        .map(produto => {
          const minQuantity = produto.quantidade_minima || 5;
          const percentageLeft = produto.quantidade / minQuantity * 100;
          let category = UrgencyCategory.LOW;
          
          if (produto.quantidade === 0) {
            category = UrgencyCategory.EMPTY;
          } else if (percentageLeft <= 50) {
            category = UrgencyCategory.CRITICAL;
          }
          
          return {
            ...produto,
            urgencyCategory: category,
            deficit: Math.max(0, minQuantity - produto.quantidade),
            percentageLeft
          };
        })
        .sort((a, b) => {
          const categoryOrder = { 
            [UrgencyCategory.EMPTY]: 0, 
            [UrgencyCategory.CRITICAL]: 1, 
            [UrgencyCategory.LOW]: 2 
          };
          
          const categoryA = categoryOrder[a.urgencyCategory];
          const categoryB = categoryOrder[b.urgencyCategory];
          
          if (categoryA !== categoryB) {
            return categoryA - categoryB;
          }
          
          return a.percentageLeft - b.percentageLeft;
        });
      
      setCriticalProducts(processCriticalProducts);
      
      Alert.alert("Success", "Stock entry registered successfully");
      
    } catch (error) {
      console.error("Error adding stock:", error);
      Alert.alert("Error", "Failed to register stock entry");
    } finally {
      setLoading(false);
    }
  };

  // Share critical products list
  const shareProductsList = async () => {
    try {
      let message = "CRITICAL PRODUCTS LIST\n\n";
      
      if (categoryCounts[UrgencyCategory.EMPTY] > 0) {
        message += "OUT OF STOCK:\n";
        
        criticalProducts
          .filter(p => p.urgencyCategory === UrgencyCategory.EMPTY)
          .forEach(p => {
            message += `- ${p.nome} (${p.codigo})\n`;
            message += `  Required: ${p.quantidade_minima || 5} units\n`;
            if (p.fornecedor) {
              message += `  Supplier: ${p.fornecedor}\n`;
            }
            message += "\n";
          });
      }
      
      if (categoryCounts[UrgencyCategory.CRITICAL] > 0) {
        message += "CRITICALLY LOW:\n";
        
        criticalProducts
          .filter(p => p.urgencyCategory === UrgencyCategory.CRITICAL)
          .forEach(p => {
            message += `- ${p.nome} (${p.codigo})\n`;
            message += `  Current: ${p.quantidade} / Min: ${p.quantidade_minima || 5} units\n`;
            message += `  Need to add: ${p.deficit} units\n`;
            if (p.fornecedor) {
              message += `  Supplier: ${p.fornecedor}\n`;
            }
            message += "\n";
          });
      }
      
      if (categoryCounts[UrgencyCategory.LOW] > 0) {
        message += "LOW STOCK:\n";
        
        criticalProducts
          .filter(p => p.urgencyCategory === UrgencyCategory.LOW)
          .forEach(p => {
            message += `- ${p.nome} (${p.codigo})\n`;
            message += `  Current: ${p.quantidade} / Min: ${p.quantidade_minima || 5} units\n`;
            message += `  Need to add: ${p.deficit} units\n`;
            if (p.fornecedor) {
              message += `  Supplier: ${p.fornecedor}\n`;
            }
            message += "\n";
          });
      }
      
      await Share.share({
        message,
        title: "Critical Products List"
      });
      
    } catch (error) {
      console.error("Error sharing list:", error);
      Alert.alert("Error", "Failed to share critical products list");
    }
  };

  // Render item for list
  const renderItem = ({ item }: { item: UrgentProduct }) => {
    const urgencyColor = getUrgencyColor(item.urgencyCategory);
    const minQuantity = item.quantidade_minima || 5;
    
    return (
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }}>
        <TouchableOpacity
          style={[
            styles.productCard,
            { backgroundColor: COLORS.card }
          ]}
          onPress={() => navigation.navigate('ProductDetail', { product: item })}
          activeOpacity={0.7}
        >
          <View style={styles.productHeader}>
            <View style={[
              styles.urgencyIndicator,
              { backgroundColor: urgencyColor }
            ]} />
            <View style={styles.productMainInfo}>
              <Text style={[styles.productName, { color: COLORS.text }]}>
                {item.nome}
              </Text>
              <Text style={[styles.productCode, { color: COLORS.primary }]}>
                {item.codigo}
              </Text>
            </View>
            <View style={styles.quantityContainer}>
              <Text style={[
                styles.quantityText,
                { color: urgencyColor }
              ]}>
                {item.quantidade}
              </Text>
              <Text style={[styles.minimumText, { color: COLORS.textSecondary }]}>
                min: {minQuantity}
              </Text>
            </View>
          </View>
          
          <View style={styles.stockInfoRow}>
            <View style={styles.stockInfoItem}>
              <Text style={[styles.stockInfoLabel, { color: COLORS.textSecondary }]}>
                Status:
              </Text>
              <Text style={[
                styles.stockInfoValue,
                { color: urgencyColor }
              ]}>
                {item.urgencyCategory === UrgencyCategory.EMPTY 
                  ? 'Out of Stock' 
                  : item.urgencyCategory === UrgencyCategory.CRITICAL 
                    ? 'Critically Low' 
                    : 'Low Stock'}
              </Text>
            </View>
            
            <View style={styles.stockInfoItem}>
              <Text style={[styles.stockInfoLabel, { color: COLORS.textSecondary }]}>
                Need to Add:
              </Text>
              <Text style={[styles.stockInfoValue, { color: COLORS.text }]}>
                {item.deficit} units
              </Text>
            </View>
            
            <View style={styles.stockInfoItem}>
              <Text style={[styles.stockInfoLabel, { color: COLORS.textSecondary }]}>
                Remaining:
              </Text>
              <Text style={[styles.stockInfoValue, { color: COLORS.text }]}>
                {item.percentageLeft.toFixed(0)}%
              </Text>
            </View>
          </View>
          
          {item.fornecedor && (
            <Text style={[styles.supplierText, { color: COLORS.textSecondary }]}>
              Supplier: {item.fornecedor}
            </Text>
          )}
          
          <View style={styles.actionButtonsRow}>
            {showQuickEntryInput.visible && showQuickEntryInput.productId === item.id ? (
              <View style={styles.quickEntryContainer}>
                <View style={styles.quantityInputContainer}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: COLORS.error }]}
                    onPress={() => {
                      const currentQty = parseInt(showQuickEntryInput.quantityToAdd) || 0;
                      if (currentQty > 1) {
                        setShowQuickEntryInput({
                          ...showQuickEntryInput,
                          quantityToAdd: String(currentQty - 1)
                        });
                      }
                    }}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                  
                  <TextInput
                    style={[
                      styles.quantityInput,
                      { 
                        backgroundColor: COLORS.ultraLightGrey,
                        borderColor: COLORS.lightGrey,
                        color: COLORS.text
                      }
                    ]}
                    value={showQuickEntryInput.quantityToAdd}
                    onChangeText={(text) => {
                      setShowQuickEntryInput({
                        ...showQuickEntryInput,
                        quantityToAdd: text
                      });
                    }}
                    keyboardType="numeric"
                  />
                  
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: COLORS.success }]}
                    onPress={() => {
                      const currentQty = parseInt(showQuickEntryInput.quantityToAdd) || 0;
                      setShowQuickEntryInput({
                        ...showQuickEntryInput,
                        quantityToAdd: String(currentQty + 1)
                      });
                    }}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.quickEntryButtons}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: COLORS.grey }]}
                    onPress={() => setShowQuickEntryInput({
                      productId: 0,
                      currentQty: 0,
                      visible: false,
                      quantityToAdd: "0"
                    })}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: COLORS.success }]}
                    onPress={() => {
                      if (item.id) {
                        handleQuickEntry(item.id, showQuickEntryInput.quantityToAdd);
                      }
                    }}
                  >
                    <Text style={styles.confirmButtonText}>Add Stock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                  onPress={() => {
                    if (item.id) {
                      setShowQuickEntryInput({
                        productId: item.id,
                        currentQty: item.quantidade,
                        visible: true,
                        quantityToAdd: String(item.deficit > 0 ? item.deficit : 1)
                      });
                    }
                  }}
                >
                  <Text style={styles.actionButtonText}>Quick Add</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.info }]}
                  onPress={() => navigation.navigate('ProductDetail', { product: item })}
                >
                  <Text style={styles.actionButtonText}>Details</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render a section header based on urgency category
  const renderSectionHeader = (category: UrgencyCategory) => {
    const count = categoryCounts[category];
    
    // Skip rendering if no products in this category
    if (count === 0) return null;
    
    let title = '';
    let color = '';
    
    switch (category) {
      case UrgencyCategory.EMPTY:
        title = 'Out of Stock';
        color = COLORS.error;
        break;
      case UrgencyCategory.CRITICAL:
        title = 'Critically Low Stock';
        color = COLORS.warning;
        break;
      case UrgencyCategory.LOW:
        title = 'Low Stock';
        color = '#FFA726'; // Light orange
        break;
    }
    
    return <CategoryHeader title={title} count={count} color={color} />;
  };

  // Main render
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Critical Products" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.grey }]}>
            Loading critical products...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare items for FlatList with section headers
  const itemsWithSections: React.ReactNode[] = [];
  
  // Add each section and its items
  const categories = [UrgencyCategory.EMPTY, UrgencyCategory.CRITICAL, UrgencyCategory.LOW];
  
  categories.forEach((category) => {
    const categoryItems = filteredProducts.filter(p => p.urgencyCategory === category);
    
    if (categoryItems.length > 0) {
      // Add section header
      itemsWithSections.push(
        <React.Fragment key={`header-${category}`}>
          {renderSectionHeader(category)}
        </React.Fragment>
      );
      
      // Add items for this section
      categoryItems.forEach((item) => {
        itemsWithSections.push(
          <React.Fragment key={`item-${item.id}`}>
            {renderItem({ item })}
          </React.Fragment>
        );
      });
    }
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Critical Products" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      <Animated.View 
        style={[
          styles.searchContainer,
          { 
            backgroundColor: COLORS.card,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.filterRow}>
          <TextInput
            style={[
              styles.searchInput,
              { 
                backgroundColor: COLORS.ultraLightGrey,
                borderColor: COLORS.lightGrey,
                color: COLORS.text
              }
            ]}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search products..."
            placeholderTextColor={COLORS.grey}
          />
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryLabel, { color: COLORS.textSecondary }]}>
              Total Critical:
            </Text>
            <Text style={[styles.summaryValue, { color: COLORS.text }]}>
              {criticalProducts.length}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: COLORS.info }]}
            onPress={shareProductsList}
          >
            <Text style={styles.shareButtonText}>Share List</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {criticalProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: COLORS.text }]}>
            No critical products found.
          </Text>
          <Text style={[styles.emptySubText, { color: COLORS.textSecondary }]}>
            All products are above their minimum stock levels.
          </Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: COLORS.text }]}>
            No products match your search.
          </Text>
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: COLORS.primary }]}
            onPress={() => setSearchText('')}
          >
            <Text style={styles.resetButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                // Reload products
                const loadProducts = async () => {
                  try {
                    const produtos = await getProdutos();
                    setAllProducts(produtos);
                    
                    // Process products to identify critical ones
                    const processCriticalProducts = produtos
                      .filter(produto => {
                        const minQuantity = produto.quantidade_minima || 5;
                        return produto.quantidade <= minQuantity;
                      })
                      .map(produto => {
                        const minQuantity = produto.quantidade_minima || 5;
                        const percentageLeft = produto.quantidade / minQuantity * 100;
                        let category = UrgencyCategory.LOW;
                        
                        if (produto.quantidade === 0) {
                          category = UrgencyCategory.EMPTY;
                        } else if (percentageLeft <= 50) {
                          category = UrgencyCategory.CRITICAL;
                        }
                        
                        return {
                          ...produto,
                          urgencyCategory: category,
                          deficit: Math.max(0, minQuantity - produto.quantidade),
                          percentageLeft
                        };
                      })
                      .sort((a, b) => {
                        const categoryOrder = { 
                          [UrgencyCategory.EMPTY]: 0, 
                          [UrgencyCategory.CRITICAL]: 1, 
                          [UrgencyCategory.LOW]: 2 
                        };
                        
                        const categoryA = categoryOrder[a.urgencyCategory];
                        const categoryB = categoryOrder[b.urgencyCategory];
                        
                        if (categoryA !== categoryB) {
                          return categoryA - categoryB;
                        }
                        
                        return a.percentageLeft - b.percentageLeft;
                      });
                    
                    setCriticalProducts(processCriticalProducts);
                  } catch (error) {
                    console.error("Error reloading products:", error);
                    Alert.alert("Error", "Failed to reload critical products");
                  } finally {
                    setRefreshing(false);
                  }
                };
                
                loadProducts();
              }}
              colors={[COLORS.primary]}
            />
          }
        >
          {itemsWithSections}
        </ScrollView>
      )}
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
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  searchContainer: {
    margin: 15,
    marginBottom: 5,
    padding: 15,
    borderRadius: 16,
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
  filterRow: {
    marginBottom: 15,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryBox: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
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
  categoryBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  productCard: {
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  productHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  urgencyIndicator: {
    width: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  productMainInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 13,
  },
  quantityContainer: {
    alignItems: 'center',
    marginLeft: 10,
  },
  quantityText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  minimumText: {
    fontSize: 12,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stockInfoItem: {
    alignItems: 'center',
  },
  stockInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  stockInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  supplierText: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  quickEntryContainer: {
    width: '100%',
  },
  quantityInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  quickEntryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginRight: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginLeft: 5,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default CriticalProductsScreen;