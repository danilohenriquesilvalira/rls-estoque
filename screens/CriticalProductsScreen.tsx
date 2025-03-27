// screens/CriticalProductsScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  TextInput,
  RefreshControl,
  Share,
  SafeAreaView,
  ScrollView,
  Dimensions
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getProdutos, criarMovimentacao } from '../services/api';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons'; // Certifique-se de instalar expo/vector-icons

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

// Sort options
enum SortOption {
  URGENCY = "URGENCY",       // Default - by urgency category
  NAME = "NAME",             // Alphabetical by name
  CODE = "CODE",             // By product code
  QUANTITY = "QUANTITY"      // By current quantity (ascending)
}

// Product with urgency information
interface UrgentProduct extends Produto {
  urgencyCategory: UrgencyCategory;
  deficit: number;           // How many items below minimum
  percentageLeft: number;    // Percentage of minimum quantity remaining
}

// Component for Filter Button
const FilterButton: React.FC<{
  label: string;
  isActive: boolean;
  count: number;
  color: string;
  onPress: () => void;
}> = ({ label, isActive, count, color, onPress }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  return (
    <TouchableOpacity
      style={[
        styles.filterButton,
        {
          backgroundColor: isActive ? color : COLORS.ultraLightGrey,
          borderColor: color,
        }
      ]}
      onPress={onPress}
    >
      <Text 
        style={[
          styles.filterButtonText, 
          { color: isActive ? '#FFF' : color }
        ]}
      >
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );
};

// Component for Category Header
const CategoryHeader: React.FC<{
  title: string;
  count: number;
  color: string;
  icon: string;
}> = ({ title, count, color, icon }) => {
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
        <MaterialIcons name={icon as any} size={16} color="#FFF" />
      </View>
      <Text style={[styles.categoryTitle, { color: COLORS.text }]}>{title}</Text>
      <View style={[
        styles.categoryCountBadge,
        { backgroundColor: color }
      ]}>
        <Text style={styles.categoryCountText}>{count}</Text>
      </View>
    </View>
  );
};

// Component for Product Card
const ProductCard: React.FC<{
  item: UrgentProduct;
  onQuickAdd: () => void;
  onDetails: () => void;
  colors: any;
}> = ({ item, onQuickAdd, onDetails, colors }) => {
  const { COLORS } = colors;
  
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
  
  const minQuantity = item.quantidade_minima || 5;
  const urgencyColor = getUrgencyColor(item.urgencyCategory);
  
  const getStatusIcon = (category: UrgencyCategory) => {
    switch (category) {
      case UrgencyCategory.EMPTY:
        return 'inventory';
      case UrgencyCategory.CRITICAL:
        return 'error';
      case UrgencyCategory.LOW:
        return 'warning';
      default:
        return 'check-circle';
    }
  };
  
  const getStatusText = (category: UrgencyCategory) => {
    switch (category) {
      case UrgencyCategory.EMPTY:
        return 'Sem Stock';
      case UrgencyCategory.CRITICAL:
        return 'Stock Crítico';
      case UrgencyCategory.LOW:
        return 'Stock Baixo';
      default:
        return 'Normal';
    }
  };
  
  return (
    <View
      style={[
        styles.productCard,
        { backgroundColor: COLORS.card }
      ]}
    >
      <View style={styles.productCardHeader}>
        <View style={[styles.urgencyBar, { backgroundColor: urgencyColor }]} />
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: COLORS.text }]}>
            {item.nome}
          </Text>
          <View style={styles.productMetaInfo}>
            <Text style={[styles.productCode, { color: COLORS.primary }]}>
              <FontAwesome5 name="barcode" size={12} color={COLORS.primary} /> {item.codigo}
            </Text>
            {item.fornecedor && (
              <Text style={[styles.supplierText, { color: COLORS.textSecondary }]}>
                <MaterialIcons name="business" size={12} color={COLORS.textSecondary} /> {item.fornecedor}
              </Text>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.stockStatus}>
        <View style={styles.stockProgressContainer}>
          <View 
            style={[
              styles.stockProgressBar, 
              { 
                backgroundColor: COLORS.ultraLightGrey,
                width: '100%'
              }
            ]}
          >
            <View 
              style={[
                styles.stockProgressFill, 
                { 
                  backgroundColor: urgencyColor,
                  width: `${Math.min(100, item.percentageLeft)}%`
                }
              ]}
            />
          </View>
          <View style={styles.stockLabels}>
            <Text style={[styles.stockCurrentLabel, { color: urgencyColor }]}>
              {item.quantidade}
            </Text>
            <Text style={[styles.stockMinLabel, { color: COLORS.textSecondary }]}>
              Min: {minQuantity}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusBadge}>
          <MaterialIcons 
            name={getStatusIcon(item.urgencyCategory) as any} 
            size={14} 
            color={urgencyColor} 
          />
          <Text style={[styles.statusText, { color: urgencyColor }]}>
            {getStatusText(item.urgencyCategory)}
          </Text>
        </View>
      </View>
      
      <View style={styles.stockMetrics}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: COLORS.textSecondary }]}>
            Adicionar:
          </Text>
          <Text style={[styles.metricValue, { color: COLORS.text }]}>
            {item.deficit} units
          </Text>
        </View>
        
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: COLORS.textSecondary }]}>
            Restante:
          </Text>
          <Text style={[styles.metricValue, { color: COLORS.text }]}>
            {item.percentageLeft.toFixed(0)}%
          </Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.actionButtonPrimary,
            { backgroundColor: COLORS.primary }
          ]}
          onPress={onQuickAdd}
        >
          <MaterialIcons name="add-shopping-cart" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>Adicionar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.actionButtonSecondary,
            { backgroundColor: COLORS.info }
          ]}
          onPress={onDetails}
        >
          <MaterialIcons name="info-outline" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>Detalhes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Component for Quick Entry Modal
const QuickEntryForm: React.FC<{
  product: UrgentProduct;
  value: string;
  onChangeValue: (text: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  colors: any;
}> = ({ product, value, onChangeValue, onCancel, onConfirm, colors }) => {
  const { COLORS } = colors;
  
  return (
    <View style={[
      styles.quickEntryForm,
      { backgroundColor: COLORS.card }
    ]}>
      <View style={styles.quickEntryHeader}>
        <Text style={[styles.quickEntryTitle, { color: COLORS.text }]}>
          Adicionar Stock: {product.nome}
        </Text>
        <Text style={[styles.quickEntrySubtitle, { color: COLORS.textSecondary }]}>
          Atual: {product.quantidade} | Mín: {product.quantidade_minima || 5}
        </Text>
      </View>
      
      <View style={styles.quantityInputContainer}>
        <TouchableOpacity
          style={[styles.quantityButton, { backgroundColor: COLORS.error }]}
          onPress={() => {
            const currentQty = parseInt(value) || 0;
            if (currentQty > 1) {
              onChangeValue(String(currentQty - 1));
            }
          }}
        >
          <MaterialIcons name="remove" size={20} color="#FFF" />
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
          value={value}
          onChangeText={onChangeValue}
          keyboardType="numeric"
        />
        
        <TouchableOpacity
          style={[styles.quantityButton, { backgroundColor: COLORS.success }]}
          onPress={() => {
            const currentQty = parseInt(value) || 0;
            onChangeValue(String(currentQty + 1));
          }}
        >
          <MaterialIcons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.quickEntryFooter}>
        <TouchableOpacity
          style={[styles.quickEntryButton, { backgroundColor: COLORS.grey }]}
          onPress={onCancel}
        >
          <MaterialIcons name="cancel" size={18} color="#FFF" />
          <Text style={styles.quickEntryButtonText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quickEntryButton, { backgroundColor: COLORS.success }]}
          onPress={onConfirm}
        >
          <MaterialIcons name="check" size={18} color="#FFF" />
          <Text style={styles.quickEntryButtonText}>Adicionar Stock</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={[styles.suggestedQuantity, { backgroundColor: COLORS.primary }]}
        onPress={() => onChangeValue(String(product.deficit))}
      >
        <Text style={styles.suggestedQuantityText}>
          Adicionar Sugerido: {product.deficit}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Main component
const CriticalProductsScreen: React.FC<CriticalProductsScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allProducts, setAllProducts] = useState<Produto[]>([]);
  const [criticalProducts, setCriticalProducts] = useState<UrgentProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<UrgentProduct[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<UrgencyCategory | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.URGENCY);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [quickEntryProduct, setQuickEntryProduct] = useState<UrgentProduct | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState("0");
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Count by urgency category
  const categoryCounts = {
    [UrgencyCategory.EMPTY]: criticalProducts.filter(p => p.urgencyCategory === UrgencyCategory.EMPTY).length,
    [UrgencyCategory.CRITICAL]: criticalProducts.filter(p => p.urgencyCategory === UrgencyCategory.CRITICAL).length,
    [UrgencyCategory.LOW]: criticalProducts.filter(p => p.urgencyCategory === UrgencyCategory.LOW).length,
  };

  // Process products to identify critical ones
  const processCriticalProducts = useCallback((produtos: Produto[]): UrgentProduct[] => {
    return produtos
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
      .sort(sortProducts);
  }, []);

  // Sort products based on selected option
  const sortProducts = useCallback((a: UrgentProduct, b: UrgentProduct): number => {
    switch (sortOption) {
      case SortOption.NAME:
        return a.nome.localeCompare(b.nome);
      case SortOption.CODE:
        return a.codigo.localeCompare(b.codigo);
      case SortOption.QUANTITY:
        return a.quantidade - b.quantidade;
      case SortOption.URGENCY:
      default:
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
    }
  }, [sortOption]);

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all products
      const produtos = await getProdutos();
      setAllProducts(produtos);
      
      // Process and set critical products
      const criticalProductsList = processCriticalProducts(produtos);
      setCriticalProducts(criticalProductsList);
      setFilteredProducts(criticalProductsList);
      
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
      Alert.alert("Erro", "Falha ao carregar produtos críticos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [processCriticalProducts, fadeAnim, slideAnim]);

  // Initial load and focus listener
  useEffect(() => {
    loadProducts();
    
    // Reload when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadProducts();
    });
    
    return unsubscribe;
  }, [navigation, loadProducts]);

  // Filter products when search text or active filter changes
  useEffect(() => {
    let filtered = criticalProducts;
    
    // Apply text search
    if (searchText !== '') {
      filtered = filtered.filter(product =>
        product.nome.toLowerCase().includes(searchText.toLowerCase()) ||
        product.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
        (product.descricao && product.descricao.toLowerCase().includes(searchText.toLowerCase())) ||
        (product.fornecedor && product.fornecedor.toLowerCase().includes(searchText.toLowerCase()))
      );
    }
    
    // Apply category filter
    if (activeFilter !== null) {
      filtered = filtered.filter(product => product.urgencyCategory === activeFilter);
    }
    
    // Sort filtered products
    filtered = [...filtered].sort(sortProducts);
    
    setFilteredProducts(filtered);
  }, [searchText, activeFilter, criticalProducts, sortOption, sortProducts]);

  // Handle quick entry of stock
  const handleQuickEntry = async (productId: number, quantityToAdd: string) => {
    const quantity = parseInt(quantityToAdd);
    
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("Erro", "Por favor, insira uma quantidade válida");
      return;
    }
    
    try {
      setLoading(true);
      
      // Create stock entry movement
      await criarMovimentacao({
        produto_id: productId,
        tipo: 'entrada',
        quantidade: quantity,
        notas: 'Entrada rápida da tela de Produtos Críticos'
      });
      
      // Reset input
      setQuickEntryProduct(null);
      setQuantityToAdd("0");
      
      // Reload products
      await loadProducts();
      
      Alert.alert("Sucesso", "Entrada de stock registada com sucesso");
      
    } catch (error) {
      console.error("Error adding stock:", error);
      Alert.alert("Erro", "Falha ao registar entrada de stock");
    } finally {
      setLoading(false);
    }
  };

  // Share critical products list
  const shareProductsList = async () => {
    try {
      let message = "LISTA DE PRODUTOS CRÍTICOS\n\n";
      
      if (categoryCounts[UrgencyCategory.EMPTY] > 0) {
        message += "SEM STOCK:\n";
        
        criticalProducts
          .filter(p => p.urgencyCategory === UrgencyCategory.EMPTY)
          .forEach(p => {
            message += `- ${p.nome} (${p.codigo})\n`;
            message += `  Necessário: ${p.quantidade_minima || 5} unidades\n`;
            if (p.fornecedor) {
              message += `  Fornecedor: ${p.fornecedor}\n`;
            }
            message += "\n";
          });
      }
      
      if (categoryCounts[UrgencyCategory.CRITICAL] > 0) {
        message += "STOCK CRÍTICO:\n";
        
        criticalProducts
          .filter(p => p.urgencyCategory === UrgencyCategory.CRITICAL)
          .forEach(p => {
            message += `- ${p.nome} (${p.codigo})\n`;
            message += `  Atual: ${p.quantidade} / Mín: ${p.quantidade_minima || 5} unidades\n`;
            message += `  Necessário adicionar: ${p.deficit} unidades\n`;
            if (p.fornecedor) {
              message += `  Supplier: ${p.fornecedor}\n`;
            }
            message += "\n";
          });
      }
      
      if (categoryCounts[UrgencyCategory.LOW] > 0) {
        message += "STOCK BAIXO:\n";
        
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
        title: "Lista de Produtos Críticos"
      });
      
    } catch (error) {
      console.error("Error sharing list:", error);
      Alert.alert("Erro", "Falha ao partilhar lista de produtos críticos");
    }
  };

  // Loading state
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
            title="Produtos Críticos" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
            A carregar produtos críticos...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare rendered sections
  const renderSections = () => {
    const sections: JSX.Element[] = [];
    const categories = [UrgencyCategory.EMPTY, UrgencyCategory.CRITICAL, UrgencyCategory.LOW];
    
    // Only show categories when no category filter is active
    if (activeFilter === null) {
      categories.forEach((category) => {
        const categoryItems = filteredProducts.filter(p => p.urgencyCategory === category);
        
        if (categoryItems.length > 0) {
          const categoryIcon = category === UrgencyCategory.EMPTY 
            ? 'inventory' 
            : category === UrgencyCategory.CRITICAL 
              ? 'error'
              : 'warning';
          
          const categoryColor = category === UrgencyCategory.EMPTY 
            ? COLORS.error 
            : category === UrgencyCategory.CRITICAL 
              ? COLORS.warning
              : '#FFA726';
              
          sections.push(
            <CategoryHeader 
              key={`header-${category}`}
              title={
                category === UrgencyCategory.EMPTY 
                  ? 'Sem Stock' 
                  : category === UrgencyCategory.CRITICAL 
                    ? 'Stock Crítico'
                    : 'Stock Baixo'
              }
              count={categoryItems.length}
              color={categoryColor}
              icon={categoryIcon}
            />
          );
          
          categoryItems.forEach((item) => {
            sections.push(
              <ProductCard
                key={`product-${item.id}`}
                item={item}
                onQuickAdd={() => {
                  if (item.id) {
                    setQuickEntryProduct(item);
                    setQuantityToAdd(String(item.deficit > 0 ? item.deficit : 1));
                  }
                }}
                onDetails={() => navigation.navigate('ProductDetail', { product: item })}
                colors={theme}
              />
            );
          });
        }
      });
    } else {
      // When filter is active, just show the filtered products without category headers
      filteredProducts.forEach((item) => {
        sections.push(
          <ProductCard
            key={`product-${item.id}`}
            item={item}
            onQuickAdd={() => {
              if (item.id) {
                setQuickEntryProduct(item);
                setQuantityToAdd(String(item.deficit > 0 ? item.deficit : 1));
              }
            }}
            onDetails={() => navigation.navigate('ProductDetail', { product: item })}
            colors={theme}
          />
        );
      });
    }
    
    return sections;
  };

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
        <View style={styles.searchInputContainer}>
          <View style={[
            styles.searchInputWrapper,
            { 
              backgroundColor: COLORS.ultraLightGrey,
              borderColor: COLORS.lightGrey,
            }
          ]}>
            <MaterialIcons name="search" size={20} color={COLORS.grey} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: COLORS.text }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search products..."
              placeholderTextColor={COLORS.grey}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <MaterialIcons name="clear" size={20} color={COLORS.grey} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.sortButton, { backgroundColor: COLORS.primary }]}
            onPress={() => setShowSortOptions(!showSortOptions)}
          >
            <MaterialIcons name="sort" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        {showSortOptions && (
          <View style={[styles.sortOptionsContainer, { backgroundColor: COLORS.ultraLightGrey }]}>
            <TouchableOpacity 
              style={[
                styles.sortOption,
                sortOption === SortOption.URGENCY && { backgroundColor: COLORS.primaryLight }
              ]}
              onPress={() => {
                setSortOption(SortOption.URGENCY);
                setShowSortOptions(false);
              }}
            >
              <MaterialIcons name="warning" size={16} color={COLORS.text} />
              <Text style={[styles.sortOptionText, { color: COLORS.text }]}>Por Urgência</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.sortOption,
                sortOption === SortOption.NAME && { backgroundColor: COLORS.primaryLight }
              ]}
              onPress={() => {
                setSortOption(SortOption.NAME);
                setShowSortOptions(false);
              }}
            >
              <MaterialIcons name="sort-by-alpha" size={16} color={COLORS.text} />
              <Text style={[styles.sortOptionText, { color: COLORS.text }]}>Por Nome</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.sortOption,
                sortOption === SortOption.CODE && { backgroundColor: COLORS.primaryLight }
              ]}
              onPress={() => {
                setSortOption(SortOption.CODE);
                setShowSortOptions(false);
              }}
            >
              <MaterialIcons name="vpn-key" size={16} color={COLORS.text} />
              <Text style={[styles.sortOptionText, { color: COLORS.text }]}>Por Código</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.sortOption,
                sortOption === SortOption.QUANTITY && { backgroundColor: COLORS.primaryLight }
              ]}
              onPress={() => {
                setSortOption(SortOption.QUANTITY);
                setShowSortOptions(false);
              }}
            >
              <MaterialIcons name="bar-chart" size={16} color={COLORS.text} />
              <Text style={[styles.sortOptionText, { color: COLORS.text }]}>Por Quantidade</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.filterButtonsContainer}>
          <FilterButton
            label="Todos"
            isActive={activeFilter === null}
            count={criticalProducts.length}
            color={COLORS.primary}
            onPress={() => setActiveFilter(null)}
          />
          
          <FilterButton
            label="Sem Stock"
            isActive={activeFilter === UrgencyCategory.EMPTY}
            count={categoryCounts[UrgencyCategory.EMPTY]}
            color={COLORS.error}
            onPress={() => setActiveFilter(UrgencyCategory.EMPTY)}
          />
          
          <FilterButton
            label="Crítico"
            isActive={activeFilter === UrgencyCategory.CRITICAL}
            count={categoryCounts[UrgencyCategory.CRITICAL]}
            color={COLORS.warning}
            onPress={() => setActiveFilter(UrgencyCategory.CRITICAL)}
          />
          
          <FilterButton
            label="Baixo"
            isActive={activeFilter === UrgencyCategory.LOW}
            count={categoryCounts[UrgencyCategory.LOW]}
            color="#FFA726"
            onPress={() => setActiveFilter(UrgencyCategory.LOW)}
          />
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryLabel, { color: COLORS.textSecondary }]}>
              A mostrar {filteredProducts.length} de {criticalProducts.length} produtos críticos
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: COLORS.info }]}
            onPress={shareProductsList}
          >
            <MaterialIcons name="share" size={16} color="#FFF" />
            <Text style={styles.shareButtonText}>Partilhar Lista</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {criticalProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="check-circle" size={60} color={COLORS.success} />
          <Text style={[styles.emptyText, { color: COLORS.text }]}>
            Não foram encontrados produtos críticos.
          </Text>
          <Text style={[styles.emptySubText, { color: COLORS.textSecondary }]}>
            Todos os produtos estão acima dos níveis mínimos de stock.
          </Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={60} color={COLORS.grey} />
          <Text style={[styles.emptyText, { color: COLORS.text }]}>
            Nenhum produto corresponde à sua pesquisa.
          </Text>
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: COLORS.primary }]}
            onPress={() => {
              setSearchText('');
              setActiveFilter(null);
            }}
          >
            <Text style={styles.resetButtonText}>Limpar Filtros</Text>
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
                loadProducts();
              }}
              colors={[COLORS.primary]}
            />
          }
        >
          {renderSections()}
        </ScrollView>
      )}
      
      {quickEntryProduct && (
        <View style={styles.quickEntryOverlay}>
          <TouchableOpacity 
            style={styles.quickEntryBackdrop}
            onPress={() => setQuickEntryProduct(null)}
          />
          <QuickEntryForm
            product={quickEntryProduct}
            value={quantityToAdd}
            onChangeValue={setQuantityToAdd}
            onCancel={() => setQuickEntryProduct(null)}
            onConfirm={() => {
              if (quickEntryProduct.id) {
                handleQuickEntry(quickEntryProduct.id, quantityToAdd);
              }
            }}
            colors={theme}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

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
  searchInputContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  sortButton: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 10,
  },
  sortOptionsContainer: {
    borderRadius: 12,
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
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  sortOptionText: {
    marginLeft: 10,
    fontSize: 15,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  filterButton: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 5,
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
    marginTop: 15,
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
    padding: 14,
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
  categoryCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 'auto',
  },
  categoryCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
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
  productCardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  urgencyBar: {
    width: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productMetaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productCode: {
    fontSize: 13,
    marginRight: 15,
  },
  supplierText: {
    fontSize: 13,
  },
  stockStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockProgressContainer: {
    flex: 1,
    marginRight: 10,
  },
  stockProgressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  stockProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  stockLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockCurrentLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stockMinLabel: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  stockMetrics: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonPrimary: {
    marginRight: 5,
  },
  actionButtonSecondary: {
    marginLeft: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 6,
  },
  quickEntryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  quickEntryBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  quickEntryForm: {
    width: width - 60,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  quickEntryHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  quickEntryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  quickEntrySubtitle: {
    fontSize: 14,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 100,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 10,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  quickEntryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickEntryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  quickEntryButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 6,
    fontSize: 16,
  },
  suggestedQuantity: {
    marginTop: 15,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  suggestedQuantityText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default CriticalProductsScreen;