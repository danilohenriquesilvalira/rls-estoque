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
  Dimensions
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getProduto, atualizarProduto, deletarProduto, criarMovimentacao, getMovimentacoesPorProduto } from '../services/api';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import ProductAIAnalysis from '../components/ProductAIAnalysis';

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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const quantityScale = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const aiButtonAnim = useRef(new Animated.Value(0)).current;

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
        quantidade: quantity
      };
      
      // Use API function to update
      if (produto.id) {
        const result = await atualizarProduto(produto.id, updatedProduct);
        
        // Update local state
        setProduto(result);
        
        // Update route parameters
        navigation.setParams({ product: result });
        
        Alert.alert("Sucesso", "Produto atualizado com sucesso");
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
          <View style={styles.headerRow}>
            <View style={styles.codeContainer}>
              <Text style={[styles.codeLabel, { color: COLORS.grey }]}>Código</Text>
              <Text style={[styles.codeValue, { color: COLORS.primary }]}>{produto.codigo}</Text>
            </View>
            
            {!isEditing ? (
              <TouchableOpacity 
                style={[styles.editButton, { backgroundColor: COLORS.primaryLight }]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.cancelButton, { backgroundColor: COLORS.grey }]}
                onPress={() => {
                  setIsEditing(false);
                  setEditedName(produto.nome);
                  setEditedDescription(produto.descricao || '');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isEditing ? (
            // Edit mode
            <View style={styles.editContainer}>
              <Text style={[styles.label, { color: COLORS.grey }]}>Nome do Produto:</Text>
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
              />
              
              <Text style={[styles.label, { color: COLORS.grey }]}>Descrição:</Text>
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
                multiline
                numberOfLines={4}
              />
              
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: COLORS.success }]}
                onPress={saveChanges}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // View mode
            <View>
              <Text style={[styles.label, { color: COLORS.grey }]}>Nome:</Text>
              <Text style={[styles.value, { color: COLORS.text }]}>{produto.nome}</Text>
              
              <Text style={[styles.label, { color: COLORS.grey }]}>Descrição:</Text>
              <Text style={[styles.value, { color: COLORS.text }]}>
                {produto.descricao || "Nenhuma descrição disponível"}
              </Text>
            </View>
          )}
          
          <View style={[styles.stockSection, { backgroundColor: COLORS.ultraLightGrey }]}>
            <Text style={[styles.stockTitle, { color: COLORS.text }]}>Quantidade em Estoque:</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity 
                style={[styles.quantityButton, quantity <= 0 && styles.disabledButton, { backgroundColor: COLORS.error }]}
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
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              
              <Animated.View style={{
                transform: [{ scale: quantityScale }]
              }}>
                <Text style={[styles.quantityValue, { color: COLORS.text }]}>{quantity}</Text>
              </Animated.View>
              
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
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.entryButton, { backgroundColor: COLORS.success }]}
              onPress={() => openMovementModal('entrada')}
            >
              <Text style={styles.actionButtonText}>Registrar Entrada</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                styles.exitButton,
                quantity <= 0 && styles.disabledButton,
                { backgroundColor: quantity > 0 ? COLORS.error : COLORS.lightGrey }
              ]}
              onPress={() => openMovementModal('saida')}
              disabled={quantity <= 0}
            >
              <Text style={styles.actionButtonText}>Registrar Saída</Text>
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
        
        {/* History section */}
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
          <Text style={[styles.historyTitle, { color: COLORS.text }]}>Histórico de Movimentações</Text>
          
          {loadingHistory ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.historyLoader} />
          ) : movements.length === 0 ? (
            <Text style={[styles.emptyHistoryText, { color: COLORS.grey }]}>
              Nenhuma movimentação registrada
            </Text>
          ) : (
            movements.map((movement, index) => (
              <View key={index} style={[
                styles.movementItem,
                movement.tipo === 'entrada' ? styles.entryItemBorder : styles.exitItemBorder,
                { backgroundColor: COLORS.ultraLightGrey }
              ]}>
                <View style={styles.movementHeader}>
                  <Text style={[
                    styles.movementType,
                    movement.tipo === 'entrada' ? { color: COLORS.success } : { color: COLORS.error }
                  ]}>
                    {movement.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                  </Text>
                  <Text style={[styles.movementDate, { color: COLORS.grey }]}>
                    {formatDateTime(movement.data_movimentacao || new Date().toISOString())}
                  </Text>
                </View>
                
                <View style={styles.movementDetails}>
                  <Text style={[
                    styles.movementQuantity,
                    movement.tipo === 'entrada' ? { color: COLORS.success } : { color: COLORS.error }
                  ]}>
                    {movement.tipo === 'entrada' ? '+' : '-'}{movement.quantidade} unidades
                  </Text>
                  {movement.notas && (
                    <Text style={[styles.movementNotes, { color: COLORS.grey }]}>
                      Obs: {movement.notas}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </Animated.View>
        
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim }
          ]
        }}>
          <TouchableOpacity 
            style={[styles.deleteButton, { backgroundColor: COLORS.error }]}
            onPress={deleteProduct}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.deleteButtonText}>Excluir Produto</Text>
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
              <Text style={styles.modalTitle}>
                {movementType === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
              </Text>
            </LinearGradient>
            
            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: COLORS.text }]}>Quantidade:</Text>
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
              />
              
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
                multiline
                numberOfLines={3}
              />
              
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
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  codeContainer: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 12,
  },
  codeValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    marginTop: 10,
  },
  value: {
    fontSize: 16,
    marginTop: 5,
    marginBottom: 10,
  },
  stockSection: {
    marginTop: 20,
    padding: 15,
    borderRadius: 16,
  },
  stockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 20,
    minWidth: 40,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginHorizontal: 5,
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
  entryButton: {
    backgroundColor: '#2E7D32',
  },
  exitButton: {
    backgroundColor: '#C62828',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginVertical: 10,
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
  },
  // Styles for edit mode
  editContainer: {
    marginTop: 10,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    marginTop: 5,
    marginBottom: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    padding: 15,
    borderRadius: 25,
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
  },
  // Styles for history
  historyCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  historyLoader: {
    marginVertical: 20,
  },
  emptyHistoryText: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
    fontStyle: 'italic',
  },
  movementItem: {
    borderLeftWidth: 4,
    paddingLeft: 14,
    paddingVertical: 12,
    paddingRight: 8,
    marginBottom: 16,
    borderRadius: 10,
  },
  entryItemBorder: {
    borderLeftColor: '#2E7D32',
  },
  exitItemBorder: {
    borderLeftColor: '#C62828',
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  movementType: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  movementDate: {
    fontSize: 12,
  },
  movementDetails: {
    marginTop: 5,
  },
  movementQuantity: {
    fontSize: 15,
    fontWeight: '500',
  },
  movementNotes: {
    fontSize: 14,
    marginTop: 5,
    fontStyle: 'italic',
  },
  // Styles for modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    width: '85%',
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
    padding: 16,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  modalInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginRight: 10,
  },
  modalConfirmButton: {
    flex: 1.5,
    padding: 14,
    borderRadius: 25,
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
  // Estilos para o botão de IA
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 25,
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
    fontSize: 18,
    marginRight: 10,
    color: '#FFFFFF',
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});