// screens/ProductDetailScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Alert, 
  TouchableOpacity, 
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Dimensions,
  Image
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getProduto, atualizarProduto, deletarProduto, criarMovimentacao, getMovimentacoesPorProduto } from '../services/api';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import ProductAIAnalysis from '../components/ProductAIAnalysis';
import { MaterialIcons } from '@expo/vector-icons';

// Types for navigation and route
type ProductDetailScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ProductDetail'>;
  route: RouteProp<{ ProductDetail: { product: any } }, 'ProductDetail'>;
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
  data_criacao?: string;
  data_atualizacao?: string;
}

// Interface for movement record
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

// Screen dimensions
const { width: screenWidth } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }: ProductDetailScreenProps) {
  const { theme } = useTheme();
  const { COLORS } = theme;

  // Normalize received product to ensure compatibility
  // This fixes issues when product comes from scanner (with different fields)
  const rawProduct = route.params.product;
  const normalizedProduct: Produto = {
    id: rawProduct.id,
    codigo: rawProduct.codigo || rawProduct.code || '',
    nome: rawProduct.nome || rawProduct.name || '',
    descricao: rawProduct.descricao || rawProduct.description || '',
    quantidade: typeof rawProduct.quantidade === 'number' ? rawProduct.quantidade : 
               (typeof rawProduct.quantity === 'number' ? rawProduct.quantity : 0),
    quantidade_minima: rawProduct.quantidade_minima || rawProduct.minStock || undefined,
    localizacao: rawProduct.localizacao || rawProduct.location || '',
    fornecedor: rawProduct.fornecedor || rawProduct.supplier || '',
    notas: rawProduct.notas || rawProduct.notes || ''
  };

  const [produto, setProduto] = useState<Produto>(normalizedProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(normalizedProduct.nome);
  const [editedDescription, setEditedDescription] = useState(normalizedProduct.descricao || '');
  const [editedLocation, setEditedLocation] = useState(normalizedProduct.localizacao || '');
  const [editedSupplier, setEditedSupplier] = useState(normalizedProduct.fornecedor || '');
  const [editedMinQuantity, setEditedMinQuantity] = useState(
    normalizedProduct.quantidade_minima ? String(normalizedProduct.quantidade_minima) : ''
  );
  const [editedNotes, setEditedNotes] = useState(normalizedProduct.notas || '');
  const [quantity, setQuantity] = useState(normalizedProduct.quantidade);
  const [saving, setSaving] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementNotes, setMovementNotes] = useState('');
  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const quantityScale = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const aiButtonAnim = useRef(new Animated.Value(0)).current;
  const editButtonAnim = useRef(new Animated.Value(1)).current;
  const historyItemAnims = useRef<Animated.Value[]>([]).current;

  // Load updated product details and history
  useEffect(() => {
    // Start entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.7))
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(aiButtonAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5))
      })
    ]).start();
    
    const loadProductDetails = async () => {
      try {
        // Check if we have product ID to fetch updated details
        if (produto.id) {
          const updatedProduct = await getProduto(produto.id);
          if (updatedProduct) {
            setProduto(updatedProduct);
            setQuantity(updatedProduct.quantidade);
            setEditedName(updatedProduct.nome);
            setEditedDescription(updatedProduct.descricao || '');
            setEditedLocation(updatedProduct.localizacao || '');
            setEditedSupplier(updatedProduct.fornecedor || '');
            setEditedMinQuantity(updatedProduct.quantidade_minima ? String(updatedProduct.quantidade_minima) : '');
            setEditedNotes(updatedProduct.notas || '');
          }
        }
        
        // Fetch movements
        loadMovements();
      } catch (error) {
        console.error("Error loading product details:", error);
      }
    };
    
    loadProductDetails();
  }, [produto.id]);

  const loadMovements = async () => {
    setLoadingHistory(true);
    try {
      if (produto.id) {
        const movementData = await getMovimentacoesPorProduto(produto.id);
        // Sort from newest to oldest
        const sortedMovements = movementData.sort(
          (a, b) => new Date(b.data_movimentacao || '').getTime() - new Date(a.data_movimentacao || '').getTime()
        );
        setMovements(sortedMovements);
        
        // Prepare animations for movement items
        historyItemAnims.length = 0;
        sortedMovements.forEach(() => {
          historyItemAnims.push(new Animated.Value(0));
        });
        
        // Animate movement items
        Animated.stagger(
          50,
          historyItemAnims.map(anim => 
            Animated.spring(anim, {
              toValue: 1,
              friction: 8,
              tension: 50,
              useNativeDriver: true,
            })
          )
        ).start();
      } else {
        setMovements([]);
      }
    } catch (error) {
      console.error("Error loading history:", error);
      Alert.alert("Erro", "Não foi possível carregar o histórico do produto");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Save product changes
  const saveChanges = async () => {
    if (!editedName.trim()) {
      Alert.alert("Erro", "O nome do produto não pode estar vazio");
      return;
    }

    try {
      setSaving(true);
      
      const updatedProduct: Produto = {
        ...produto,
        nome: editedName.trim(),
        descricao: editedDescription.trim() || undefined,
        quantidade: quantity,
        localizacao: editedLocation.trim() || undefined,
        fornecedor: editedSupplier.trim() || undefined,
        quantidade_minima: editedMinQuantity ? parseInt(editedMinQuantity) : undefined,
        notas: editedNotes.trim() || undefined
      };
      
      // Use API function to update
      if (produto.id) {
        const result = await atualizarProduto(produto.id, updatedProduct);
        
        // Update local state
        setProduto(result);
        
        // Update route parameters
        navigation.setParams({ product: result });
        
        // Animate the button
        Animated.sequence([
          Animated.timing(editButtonAnim, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.timing(editButtonAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.5))
          })
        ]).start();
        
        setShowConfirmSave(true);
        setTimeout(() => setShowConfirmSave(false), 2000);
        
        setIsEditing(false);
      } else {
        Alert.alert("Erro", "Produto sem ID válido");
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      Alert.alert("Erro", `Não foi possível salvar as alterações: ${errorMessage}`);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Register stock movement
  const registerMovement = async () => {
    const quantityNum = parseInt(movementQuantity);
    
    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert("Erro", "Informe uma quantidade válida");
      return;
    }

    if (movementType === 'saida' && quantityNum > quantity) {
      Alert.alert("Erro", "Quantidade de saída maior que o estoque disponível");
      return;
    }

    // Ensure product_id is a valid number
    if (!produto.id) {
      Alert.alert("Erro", "ID do produto não encontrado");
      return;
    }

    // Create movement record
    const newMovement: Movimentacao = {
      produto_id: produto.id,
      tipo: movementType,
      quantidade: quantityNum,
      notas: movementNotes.trim() || undefined
    };

    try {
      // Use API function to register movement
      await criarMovimentacao(newMovement);
      
      // Update quantity locally
      const newQuantity = movementType === 'entrada' 
        ? quantity + quantityNum 
        : quantity - quantityNum;
      
      // Animate quantity change
      Animated.sequence([
        Animated.timing(quantityScale, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(quantityScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5))
        })
      ]).start();
      
      setQuantity(newQuantity);
      
      // Update product with new quantity
      const updatedProduct = {
        ...produto,
        quantidade: newQuantity
      };
      
      setProduto(updatedProduct);
      navigation.setParams({ product: updatedProduct });
      
      // Update movements
      loadMovements();
      
      // Reset modal
      setMovementQuantity('1');
      setMovementNotes('');
      
      // Hide modal with animation
      closeMovementModal();
      
      Alert.alert(
        "Sucesso", 
        `${movementType === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error registering movement:", error);
      Alert.alert("Erro", `Não foi possível registrar o movimento: ${errorMessage}`);
    }
  };

  // Delete product
  const deleteProduct = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Excluir",
          onPress: async () => {
            try {
              setDeleting(true);
              
              // If product has ID, try to delete on server
              if (produto.id) {
                await deletarProduto(produto.id);
              }
              
              Alert.alert(
                "Sucesso", 
                "Produto excluído com sucesso",
                [
                  {
                    text: "OK",
                    onPress: () => navigation.goBack()
                  }
                ]
              );
            } catch (e) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              Alert.alert("Erro", `Não foi possível excluir o produto: ${errorMessage}`);
              console.error(e);
            } finally {
              setDeleting(false);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  // Function for date/time formatting
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };
  
  // Open movement modal with animation
  const openMovementModal = (type: 'entrada' | 'saida') => {
    setMovementType(type);
    setShowMovementModal(true);
    
    // Reset modal animation value
    modalAnim.setValue(0);
    
    // Start modal animation
    Animated.spring(modalAnim, {
      toValue: 1,
      friction: 8,
      tension: 65,
      useNativeDriver: true
    }).start();
  };
  
  // Close movement modal with animation
  const closeMovementModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start(() => {
      setShowMovementModal(false);
    });
  };

  // Toggle AI analysis display
  const toggleAIAnalysis = () => {
    setShowAIAnalysis(!showAIAnalysis);
  };

  // Get stock status color
  const getStockStatusColor = () => {
    if (!produto.quantidade_minima) return COLORS.info;
    
    if (quantity <= 0) return COLORS.error;
    if (quantity < produto.quantidade_minima) return COLORS.warning;
    return COLORS.success;
  };
  
  // Get stock status text
  const getStockStatusText = () => {
    if (!produto.quantidade_minima) return "Estoque sem mínimo definido";
    
    if (quantity <= 0) return "Sem estoque";
    if (quantity < produto.quantidade_minima) return "Estoque baixo";
    return "Estoque normal";
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: COLORS.background }]}
      keyboardVerticalOffset={100}
    >
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Detalhes do Produto" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main product card */}
        <Animated.View style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim }
            ],
            backgroundColor: COLORS.card
          }
        ]}>
          <View style={styles.productHeader}>
            <View style={styles.codeContainer}>
              <MaterialIcons name="qr-code" size={16} color={COLORS.primary} />
              <Text style={[styles.codeValue, { color: COLORS.primary }]}>{produto.codigo}</Text>
            </View>
            
            <Animated.View style={{
              transform: [{ scale: editButtonAnim }]
            }}>
              {!isEditing ? (
                <TouchableOpacity 
                  style={[styles.editButton, { backgroundColor: COLORS.primaryLight }]}
                  onPress={() => setIsEditing(true)}
                >
                  <MaterialIcons name="edit" size={16} color="#FFFFFF" />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.cancelButton, { backgroundColor: COLORS.grey }]}
                  onPress={() => {
                    setIsEditing(false);
                    setEditedName(produto.nome);
                    setEditedDescription(produto.descricao || '');
                    setEditedLocation(produto.localizacao || '');
                    setEditedSupplier(produto.fornecedor || '');
                    setEditedMinQuantity(produto.quantidade_minima ? String(produto.quantidade_minima) : '');
                    setEditedNotes(produto.notas || '');
                  }}
                >
                  <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
          
          {isEditing ? (
            // Edit mode
            <View style={styles.editContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: COLORS.textSecondary }]}>Nome do Produto:</Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderColor: COLORS.lightGrey,
                      color: COLORS.text
                    }
                  ]}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Nome do produto"
                  placeholderTextColor={COLORS.grey}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: COLORS.textSecondary }]}>Descrição:</Text>
                <TextInput
                  style={[
                    styles.input, 
                    styles.textArea,
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderColor: COLORS.lightGrey,
                      color: COLORS.text
                    }
                  ]}
                  value={editedDescription}
                  onChangeText={setEditedDescription}
                  placeholder="Descrição do produto"
                  placeholderTextColor={COLORS.grey}
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={[styles.label, { color: COLORS.textSecondary }]}>Localização:</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        backgroundColor: COLORS.ultraLightGrey,
                        borderColor: COLORS.lightGrey,
                        color: COLORS.text
                      }
                    ]}
                    value={editedLocation}
                    onChangeText={setEditedLocation}
                    placeholder="Localização"
                    placeholderTextColor={COLORS.grey}
                  />
                </View>
                
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: COLORS.textSecondary }]}>Qtd. Mínima:</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        backgroundColor: COLORS.ultraLightGrey,
                        borderColor: COLORS.lightGrey,
                        color: COLORS.text
                      }
                    ]}
                    value={editedMinQuantity}
                    onChangeText={setEditedMinQuantity}
                    placeholder="Qtd. mínima"
                    placeholderTextColor={COLORS.grey}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: COLORS.textSecondary }]}>Fornecedor:</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderColor: COLORS.lightGrey,
                      color: COLORS.text
                    }
                  ]}
                  value={editedSupplier}
                  onChangeText={setEditedSupplier}
                  placeholder="Fornecedor"
                  placeholderTextColor={COLORS.grey}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: COLORS.textSecondary }]}>Notas:</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderColor: COLORS.lightGrey,
                      color: COLORS.text
                    }
                  ]}
                  value={editedNotes}
                  onChangeText={setEditedNotes}
                  placeholder="Notas adicionais"
                  placeholderTextColor={COLORS.grey}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: COLORS.success }]}
                onPress={saveChanges}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View style={styles.buttonContent}>
                    <MaterialIcons name="save" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // View mode
            <View>
              <Text style={[styles.productName, { color: COLORS.text }]}>{produto.nome}</Text>
              
              <View style={[styles.divider, { backgroundColor: COLORS.lightGrey }]} />
              
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <View style={styles.infoLabel}>
                    <MaterialIcons name="description" size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.infoText, { color: COLORS.textSecondary }]}>Descrição:</Text>
                  </View>
                  <Text style={[styles.infoValue, { color: COLORS.text }]}>
                    {produto.descricao || "Nenhuma descrição disponível"}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <View style={styles.infoLabel}>
                    <MaterialIcons name="location-on" size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.infoText, { color: COLORS.textSecondary }]}>Localização:</Text>
                  </View>
                  <Text style={[styles.infoValue, { color: COLORS.text }]}>
                    {produto.localizacao || "Não definida"}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <View style={styles.infoLabel}>
                    <MaterialIcons name="business" size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.infoText, { color: COLORS.textSecondary }]}>Fornecedor:</Text>
                  </View>
                  <Text style={[styles.infoValue, { color: COLORS.text }]}>
                    {produto.fornecedor || "Não definido"}
                  </Text>
                </View>
                
                {produto.notas && (
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabel}>
                      <MaterialIcons name="notes" size={16} color={COLORS.textSecondary} />
                      <Text style={[styles.infoText, { color: COLORS.textSecondary }]}>Notas:</Text>
                    </View>
                    <Text style={[styles.infoValue, { color: COLORS.text }]}>
                      {produto.notas}
                    </Text>
                  </View>
                )}
                
                {produto.data_atualizacao && (
                  <View style={styles.updatedAt}>
                    <MaterialIcons name="update" size={14} color={COLORS.textSecondary} />
                    <Text style={[styles.updatedAtText, { color: COLORS.textSecondary }]}>
                      Atualizado em: {formatDateTime(produto.data_atualizacao)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          
          {showConfirmSave && (
            <View style={[styles.confirmSaveMessage, { backgroundColor: `${COLORS.success}30` }]}>
              <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
              <Text style={[styles.confirmSaveText, { color: COLORS.success }]}>
                Produto atualizado com sucesso!
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Estoque card */}
        <Animated.View style={[
          styles.stockCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card
          }
        ]}>
          <View style={styles.stockHeader}>
            <MaterialIcons name="inventory" size={20} color={COLORS.primary} />
            <Text style={[styles.stockTitle, { color: COLORS.primary }]}>Gerenciamento de Estoque</Text>
          </View>
          
          <View style={styles.stockStatusRow}>
            <View style={[
              styles.stockStatusIndicator, 
              { backgroundColor: getStockStatusColor() }
            ]}>
              <MaterialIcons 
                name={
                  quantity <= 0 ? "error" : 
                  quantity < (produto.quantidade_minima || 0) ? "warning" : "check-circle"
                } 
                size={20} 
                color="#FFFFFF" 
              />
            </View>
            
            <View style={styles.stockStatusInfo}>
              <Text style={[styles.stockStatusText, { color: getStockStatusColor() }]}>
                {getStockStatusText()}
              </Text>
              
              {produto.quantidade_minima && (
                <Text style={[styles.minQuantityText, { color: COLORS.textSecondary }]}>
                  Mínimo: {produto.quantidade_minima} unidades
                </Text>
              )}
            </View>
          </View>
          
          <View style={[styles.quantityControlContainer, { backgroundColor: COLORS.ultraLightGrey }]}>
            <View style={styles.quantityDisplay}>
              <Text style={[styles.quantityLabel, { color: COLORS.textSecondary }]}>
                Quantidade em Estoque:
              </Text>
              <Animated.View style={{
                transform: [{ scale: quantityScale }]
              }}>
                <Text style={[styles.quantityValue, { color: COLORS.text }]}>{quantity}</Text>
              </Animated.View>
            </View>
            
            <View style={styles.quantityControl}>
              <TouchableOpacity 
                style={[
                  styles.quantityButton, 
                  quantity <= 0 && styles.disabledButton, 
                  { backgroundColor: COLORS.error }
                ]}
                onPress={() => {
                  if (quantity > 0) {
                    Animated.sequence([
                      Animated.timing(quantityScale, {
                        toValue: 0.8,
                        duration: 150,
                        useNativeDriver: true
                      }),
                      Animated.timing(quantityScale, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                        easing: Easing.out(Easing.back(1.5))
                      })
                    ]).start();
                    
                    setQuantity(quantity - 1);
                  }
                }}
                disabled={quantity <= 0}
              >
                <MaterialIcons name="remove" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quantityButton, { backgroundColor: COLORS.success }]}
                onPress={() => {
                  Animated.sequence([
                    Animated.timing(quantityScale, {
                      toValue: 0.8,
                      duration: 150,
                      useNativeDriver: true
                    }),
                    Animated.timing(quantityScale, {
                      toValue: 1,
                      duration: 150,
                      useNativeDriver: true,
                      easing: Easing.out(Easing.back(1.5))
                    })
                  ]).start();
                  
                  setQuantity(quantity + 1);
                }}
              >
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.movementButtons}>
            <TouchableOpacity 
              style={[styles.movementButton, { backgroundColor: COLORS.success }]}
              onPress={() => openMovementModal('entrada')}
            >
              <MaterialIcons name="arrow-downward" size={20} color="#FFFFFF" />
              <Text style={styles.movementButtonText}>Registrar Entrada</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.movementButton, 
                quantity <= 0 ? { backgroundColor: COLORS.grey } : { backgroundColor: COLORS.error }
              ]}
              onPress={() => openMovementModal('saida')}
              disabled={quantity <= 0}
            >
              <MaterialIcons name="arrow-upward" size={20} color="#FFFFFF" />
              <Text style={styles.movementButtonText}>Registrar Saída</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Botão de Análise IA */}
        <Animated.View style={{
          opacity: aiButtonAnim,
          transform: [
            { scale: aiButtonAnim },
            { translateY: aiButtonAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })}
          ]
        }}>
          <TouchableOpacity
            style={[
              styles.aiButton,
              { backgroundColor: showAIAnalysis ? COLORS.primary : '#5E35B1' }
            ]}
            onPress={toggleAIAnalysis}
          >
            <Text style={styles.aiButtonIcon}>🧠</Text>
            <Text style={styles.aiButtonText}>
              {showAIAnalysis ? 'Ocultar Análise IA' : 'Mostrar Análise IA'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Componente de Análise IA - Mostrado apenas quando ativado */}
        {showAIAnalysis && produto.id && (
          <ProductAIAnalysis 
            produtoId={produto.id} 
            onProdutoPress={(produtoId) => {
              // Navegar para o produto similar
              const produtoSimilar = { id: produtoId };
              navigation.push('ProductDetail', { product: produtoSimilar });
            }}
          />
        )}
        
        {/* Histórico de movimentações */}
        <Animated.View style={[
          styles.historyCard,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim }
            ],
            backgroundColor: COLORS.card
          }
        ]}>
          <View style={styles.historyHeader}>
            <MaterialIcons name="history" size={20} color={COLORS.primary} />
            <Text style={[styles.historyTitle, { color: COLORS.primary }]}>Histórico de Movimentações</Text>
          </View>
          
          {loadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
                Carregando histórico...
              </Text>
            </View>
          ) : movements.length === 0 ? (
            <View style={styles.emptyHistoryContainer}>
              <MaterialIcons name="insights" size={40} color={COLORS.lightGrey} />
              <Text style={[styles.emptyHistoryText, { color: COLORS.textSecondary }]}>
                Nenhuma movimentação registrada
              </Text>
            </View>
          ) : (
            <View style={styles.movementsContainer}>
              {movements.map((movement, index) => {
                // Use existing animation or create new one
                const itemAnim = index < historyItemAnims.length 
                  ? historyItemAnims[index] 
                  : new Animated.Value(1);
                
                return (
                  <Animated.View 
                    key={index} 
                    style={{
                      opacity: itemAnim,
                      transform: [{ 
                        translateX: itemAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [movement.tipo === 'entrada' ? -50 : 50, 0]
                        }) 
                      }]
                    }}
                  >
                    <View style={[
                      styles.movementItem,
                      { backgroundColor: COLORS.ultraLightGrey }
                    ]}>
                      <View style={[
                        styles.movementTypeIndicator, 
                        { 
                          backgroundColor: movement.tipo === 'entrada' ? 
                            COLORS.success : COLORS.error 
                        }
                      ]}>
                        <MaterialIcons 
                          name={movement.tipo === 'entrada' ? "arrow-downward" : "arrow-upward"} 
                          size={16} 
                          color="#FFFFFF" 
                        />
                      </View>
                      
                      <View style={styles.movementContent}>
                        <View style={styles.movementHeader}>
                          <Text style={[
                            styles.movementTypeText,
                            { 
                              color: movement.tipo === 'entrada' ? 
                                COLORS.success : COLORS.error 
                            }
                          ]}>
                            {movement.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                          </Text>
                          <Text style={[styles.movementDate, { color: COLORS.textSecondary }]}>
                            {formatDateTime(movement.data_movimentacao || new Date().toISOString())}
                          </Text>
                        </View>
                        
                        <View style={styles.movementDetails}>
                          <View style={styles.quantityBadge}>
                            <Text style={styles.quantityBadgeText}>
                              {movement.quantidade} un
                            </Text>
                          </View>
                          
                          {movement.notas && (
                            <View style={styles.movementNotes}>
                              <MaterialIcons name="note" size={14} color={COLORS.textSecondary} />
                              <Text style={[styles.movementNotesText, { color: COLORS.textSecondary }]}>
                                {movement.notas}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>
        
        {/* Botão de exclusão */}
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          <TouchableOpacity 
            style={[styles.deleteButton, { backgroundColor: COLORS.error }]}
            onPress={deleteProduct}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View style={styles.buttonContent}>
                <MaterialIcons name="delete" size={18} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>Excluir Produto</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      
      {/* Movement registration modal */}
      <Modal
        visible={showMovementModal}
        transparent={true}
        animationType="none"
        onRequestClose={closeMovementModal}
      >
        <View style={styles.modalContainer}>
          <Animated.View 
            style={[
              styles.modalContent,
              {
                opacity: modalAnim,
                transform: [
                  { scale: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  }) },
                  { translateY: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0]
                  }) }
                ],
                backgroundColor: COLORS.card
              }
            ]}
          >
            <LinearGradient
              colors={movementType === 'entrada' ? 
                ['#43A047', '#2E7D32'] : 
                ['#E53935', '#C62828']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalHeader}
            >
              <MaterialIcons 
                name={movementType === 'entrada' ? "arrow-downward" : "arrow-upward"} 
                size={22} 
                color="#FFFFFF" 
              />
              <Text style={styles.modalTitle}>
                {movementType === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
              </Text>
            </LinearGradient>
            
            <View style={styles.modalBody}>
              <View style={styles.productInfoInModal}>
                <Text style={[styles.productNameInModal, { color: COLORS.text }]}>
                  {produto.nome}
                </Text>
                <Text style={[styles.productCodeInModal, { color: COLORS.primary }]}>
                  {produto.codigo}
                </Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.modalLabel, { color: COLORS.text }]}>Quantidade:</Text>
                <View style={styles.modalQuantityInput}>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { 
                        backgroundColor: COLORS.ultraLightGrey,
                        borderColor: COLORS.lightGrey,
                        color: COLORS.text
                      }
                    ]}
                    value={movementQuantity}
                    onChangeText={setMovementQuantity}
                    keyboardType="numeric"
                    placeholder="Quantidade"
                    placeholderTextColor={COLORS.grey}
                  />
                  <Text style={[styles.unitText, { color: COLORS.textSecondary }]}>unidades</Text>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.modalLabel, { color: COLORS.text }]}>Observações (opcional):</Text>
                <TextInput
                  style={[
                    styles.modalInput, 
                    styles.modalTextArea,
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderColor: COLORS.lightGrey,
                      color: COLORS.text
                    }
                  ]}
                  value={movementNotes}
                  onChangeText={setMovementNotes}
                  placeholder="Observações sobre esta movimentação"
                  placeholderTextColor={COLORS.grey}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalCancelButton, { backgroundColor: COLORS.grey }]}
                  onPress={closeMovementModal}
                >
                  <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.modalConfirmButton,
                    movementType === 'entrada' ? 
                      { backgroundColor: COLORS.success } : 
                      { backgroundColor: COLORS.error }
                  ]}
                  onPress={registerMovement}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

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
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  // Main card styles
  card: {
    borderRadius: 16,
    padding: 18,
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
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  infoSection: {
    marginTop: 5,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    paddingLeft: 22,
  },
  updatedAt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    justifyContent: 'flex-end',
  },
  updatedAtText: {
    fontSize: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  // Edit mode styles
  editContainer: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  confirmSaveMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  confirmSaveText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  // Stock card styles
  stockCard: {
    borderRadius: 16,
    padding: 18,
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
  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stockTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  stockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stockStatusIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stockStatusInfo: {
    flex: 1,
  },
  stockStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  minQuantityText: {
    fontSize: 14,
  },
  quantityControlContainer: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 10,
  },
  quantityDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  quantityValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  disabledButton: {
    opacity: 0.5,
  },
  movementButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  movementButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 6,
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
  movementButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  // AI button styles
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  aiButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // History card styles
  historyCard: {
    borderRadius: 16,
    padding: 18,
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
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyHistoryText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  movementsContainer: {
    marginTop: 10,
  },
  movementItem: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
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
  movementTypeIndicator: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movementContent: {
    flex: 1,
    padding: 12,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  movementTypeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  movementDate: {
    fontSize: 12,
  },
  movementDetails: {
    marginTop: 4,
  },
  quantityBadge: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  quantityBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  movementNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  movementNotesText: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  // Delete button styles
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalBody: {
    padding: 20,
  },
  productInfoInModal: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 16,
    marginBottom: 16,
  },
  productNameInModal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productCodeInModal: {
    fontSize: 14,
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  modalQuantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalInput: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  unitText: {
    marginLeft: 8,
    fontSize: 14,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  modalConfirmButton: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});