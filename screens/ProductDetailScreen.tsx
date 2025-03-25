import React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { getProduto, atualizarProduto, deletarProduto, criarMovimentacao, getMovimentacoesPorProduto } from '../services/api';

// Definição dos tipos para navegação e rota
type ProductDetailScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ProductDetail'>;
  route: RouteProp<{ ProductDetail: { product: Produto } }, 'ProductDetail'>;
};

// Interface para o produto
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

// Interface para registro de movimento
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
  const { product } = route.params;
  const [produto, setProduto] = useState<Produto>(product);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(product.nome);
  const [editedDescription, setEditedDescription] = useState(product.descricao || '');
  const [quantity, setQuantity] = useState(product.quantidade);
  const [saving, setSaving] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementNotes, setMovementNotes] = useState('');
  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Carregar detalhes atualizados do produto e seu histórico
  useEffect(() => {
    const loadProductDetails = async () => {
      try {
        // Verificar se temos ID do produto para buscar detalhes atualizados
        if (produto.id) {
          const updatedProduct = await getProduto(produto.id);
          if (updatedProduct) {
            setProduto(updatedProduct);
            setQuantity(updatedProduct.quantidade);
            setEditedName(updatedProduct.nome);
            setEditedDescription(updatedProduct.descricao || '');
          }
        }
        
        // Buscar movimentações
        loadMovements();
      } catch (error) {
        console.error("Erro ao carregar detalhes do produto:", error);
      }
    };
    
    loadProductDetails();
  }, [produto.id]);

  const loadMovements = async () => {
    setLoadingHistory(true);
    try {
      if (produto.id) {
        const movementData = await getMovimentacoesPorProduto(produto.id);
        // Ordenar do mais recente para o mais antigo
        const sortedMovements = movementData.sort(
          (a, b) => new Date(b.data_movimentacao || '').getTime() - new Date(a.data_movimentacao || '').getTime()
        );
        setMovements(sortedMovements);
      } else {
        setMovements([]);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      Alert.alert("Erro", "Não foi possível carregar o histórico do produto");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Salvar alterações no produto
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
      
      // Usar a função de API para atualizar
      if (produto.id) {
        const result = await atualizarProduto(produto.id, updatedProduct);
        
        // Atualizar o estado local
        setProduto(result);
        
        // Atualizar os parâmetros de rota
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

  // Registrar movimento de estoque
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

    // Garantir que produto_id seja um número válido
    if (!produto.id) {
      Alert.alert("Erro", "ID do produto não encontrado");
      return;
    }

    // Criar registro de movimento
    const newMovement: Movimentacao = {
      produto_id: produto.id,
      tipo: movementType,
      quantidade: quantityNum,
      notas: movementNotes.trim() || undefined
    };

    try {
      // Usar a função da API para registrar movimentação
      await criarMovimentacao(newMovement);
      
      // Atualizar a quantidade localmente
      const newQuantity = movementType === 'entrada' 
        ? quantity + quantityNum 
        : quantity - quantityNum;
      
      setQuantity(newQuantity);
      
      // Atualizar o produto com a nova quantidade
      const updatedProduct = {
        ...produto,
        quantidade: newQuantity
      };
      
      setProduto(updatedProduct);
      navigation.setParams({ product: updatedProduct });
      
      // Atualizar movimentos
      loadMovements();
      
      // Resetar o modal
      setMovementQuantity('1');
      setMovementNotes('');
      setShowMovementModal(false);
      
      Alert.alert(
        "Sucesso", 
        `${movementType === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Erro ao registrar movimento:", error);
      Alert.alert("Erro", `Não foi possível registrar o movimento: ${errorMessage}`);
    }
  };

  // Excluir produto
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
              
              // Se o produto tem ID, tenta excluir no servidor
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

  // Função para formatação de data/hora
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.codeLabel}>Código: {produto.codigo}</Text>
            
            {!isEditing ? (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.cancelButton}
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
            // Modo de edição
            <View style={styles.editContainer}>
              <Text style={styles.label}>Nome do Produto:</Text>
              <TextInput
                style={styles.input}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Nome do produto"
              />
              
              <Text style={styles.label}>Descrição:</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Descrição do produto"
                multiline
                numberOfLines={4}
              />
              
              <TouchableOpacity 
                style={styles.saveButton}
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
            // Modo de visualização
            <View>
              <Text style={styles.label}>Nome:</Text>
              <Text style={styles.value}>{produto.nome}</Text>
              
              <Text style={styles.label}>Descrição:</Text>
              <Text style={styles.value}>
                {produto.descricao || "Nenhuma descrição disponível"}
              </Text>
            </View>
          )}
          
          <View style={styles.stockSection}>
            <Text style={styles.stockTitle}>Quantidade em Estoque:</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity 
                style={[styles.quantityButton, quantity <= 0 && styles.disabledButton]}
                onPress={() => quantity > 0 && setQuantity(quantity - 1)}
                disabled={quantity <= 0}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              
              <Text style={styles.quantityValue}>{quantity}</Text>
              
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.entryButton]}
              onPress={() => {
                setMovementType('entrada');
                setShowMovementModal(true);
              }}
            >
              <Text style={styles.actionButtonText}>Registrar Entrada</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                styles.exitButton,
                quantity <= 0 && styles.disabledButton
              ]}
              onPress={() => {
                setMovementType('saida');
                setShowMovementModal(true);
              }}
              disabled={quantity <= 0}
            >
              <Text style={styles.actionButtonText}>Registrar Saída</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Seção de histórico */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Histórico de Movimentações</Text>
          
          {loadingHistory ? (
            <ActivityIndicator size="small" color="#3498db" style={styles.historyLoader} />
          ) : movements.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              Nenhuma movimentação registrada
            </Text>
          ) : (
            movements.map((movement, index) => (
              <View key={index} style={styles.movementItem}>
                <View style={styles.movementHeader}>
                  <Text style={[
                    styles.movementType,
                    movement.tipo === 'entrada' ? styles.entryText : styles.exitText
                  ]}>
                    {movement.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                  </Text>
                  <Text style={styles.movementDate}>
                    {formatDateTime(movement.data_movimentacao || new Date().toISOString())}
                  </Text>
                </View>
                
                <View style={styles.movementDetails}>
                  <Text style={styles.movementQuantity}>
                    {movement.tipo === 'entrada' ? '+' : '-'}{movement.quantidade} unidades
                  </Text>
                  {movement.notas && (
                    <Text style={styles.movementNotes}>
                      Obs: {movement.notas}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={deleteProduct}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.deleteButtonText}>Excluir Produto</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      
      {/* Modal de registro de movimento */}
      <Modal
        visible={showMovementModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {movementType === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
            </Text>
            
            <Text style={styles.modalLabel}>Quantidade:</Text>
            <TextInput
              style={styles.modalInput}
              value={movementQuantity}
              onChangeText={setMovementQuantity}
              keyboardType="numeric"
              placeholder="Quantidade"
            />
            
            <Text style={styles.modalLabel}>Observações (opcional):</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={movementNotes}
              onChangeText={setMovementNotes}
              placeholder="Observações sobre esta movimentação"
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowMovementModal(false);
                  setMovementQuantity('1');
                  setMovementNotes('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalConfirmButton,
                  movementType === 'entrada' ? styles.entryButton : styles.exitButton
                ]}
                onPress={registerMovement}
              >
                <Text style={styles.modalConfirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 15,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 10,
  },
  value: {
    fontSize: 16,
    color: '#2c3e50',
    marginTop: 5,
    marginBottom: 10,
  },
  stockSection: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  stockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    backgroundColor: '#3498db',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  quantityButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 20,
    minWidth: 40,
    textAlign: 'center',
    color: '#2c3e50',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  entryButton: {
    backgroundColor: '#2ecc71',
  },
  exitButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para o modo de edição
  editContainer: {
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 5,
    marginBottom: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para o histórico
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  historyLoader: {
    marginVertical: 20,
  },
  emptyHistoryText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 14,
    marginVertical: 20,
    fontStyle: 'italic',
  },
  movementItem: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 10,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  entryText: {
    color: '#27ae60',
    borderLeftColor: '#27ae60',
  },
  exitText: {
    color: '#e74c3c',
    borderLeftColor: '#e74c3c',
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
    color: '#7f8c8d',
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
    color: '#7f8c8d',
    marginTop: 5,
    fontStyle: 'italic',
  },
  // Estilos para o modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: 5,
    color: '#2c3e50',
  },
  modalInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
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
    backgroundColor: '#95a5a6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});