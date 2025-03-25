import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Definição do tipo para as propriedades de navegação
type AddProductScreenProps = {
  navigation: NativeStackNavigationProp<any, 'AddProduct'>;
};

// Interface para o produto
interface Product {
  code: string;
  name: string;
  description: string;
  quantity: number;
  minStockLevel?: number;
  location?: string;
  supplier?: string;
  notes?: string;
}

export default function AddProductScreen({ navigation }: AddProductScreenProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoGenerateCode, setAutoGenerateCode] = useState(false);

  // Gerar código automático
  const generateProductCode = async () => {
    try {
      // Recuperar lista atual para encontrar o último código
      const jsonValue = await AsyncStorage.getItem('products');
      let productsList: Product[] = jsonValue != null ? JSON.parse(jsonValue) : [];
      
      // Se não há produtos, começar com 1001
      if (productsList.length === 0) {
        setCode('1001');
        return;
      }
      
      // Encontrar o maior código numérico
      const numericCodes = productsList
        .map(item => parseInt(item.code))
        .filter(code => !isNaN(code));
      
      if (numericCodes.length === 0) {
        setCode('1001');
        return;
      }
      
      // Próximo código é o maior + 1
      const nextCode = Math.max(...numericCodes) + 1;
      setCode(nextCode.toString());
      
    } catch (error) {
      console.error("Erro ao gerar código:", error);
      // Usar timestamp como fallback
      setCode(Date.now().toString().slice(-6));
    }
  };

  // Efeito quando o usuário ativa a opção de código automático
  React.useEffect(() => {
    if (autoGenerateCode) {
      generateProductCode();
    }
  }, [autoGenerateCode]);

  // Salvar produto
  const saveProduct = async () => {
    // Validação básica
    if (!code.trim() || !name.trim()) {
      Alert.alert("Erro", "Código e nome são obrigatórios");
      return;
    }

    const newProduct: Product = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      quantity: parseInt(quantity) || 0
    };

    // Adicionar campos opcionais se preenchidos
    if (location.trim()) newProduct.location = location.trim();
    if (supplier.trim()) newProduct.supplier = supplier.trim();
    if (notes.trim()) newProduct.notes = notes.trim();
    if (minStockLevel.trim()) {
      const minStock = parseInt(minStockLevel);
      if (!isNaN(minStock) && minStock >= 0) {
        newProduct.minStockLevel = minStock;
      }
    }

    try {
      setSaving(true);
      
      // Recuperar lista atual
      const jsonValue = await AsyncStorage.getItem('products');
      let productsList: Product[] = jsonValue != null ? JSON.parse(jsonValue) : [];
      
      // Verificar se o código já existe
      if (productsList.some(item => item.code === newProduct.code)) {
        Alert.alert("Erro", "Já existe um produto com este código");
        setSaving(false);
        return;
      }
      
      // Adicionar novo produto e salvar
      productsList.push(newProduct);
      await AsyncStorage.setItem('products', JSON.stringify(productsList));
      
      // Registrar a entrada inicial no histórico se a quantidade for maior que zero
      if (newProduct.quantity > 0) {
        try {
          const historyJson = await AsyncStorage.getItem('productHistory');
          let allHistory = [];
          
          if (historyJson) {
            allHistory = JSON.parse(historyJson);
          }
          
          // Adicionar registro para este produto
          allHistory.push({
            productCode: newProduct.code,
            movements: [{
              date: new Date().toISOString(),
              type: 'in',
              quantity: newProduct.quantity,
              notes: 'Estoque inicial'
            }]
          });
          
          await AsyncStorage.setItem('productHistory', JSON.stringify(allHistory));
        } catch (historyError) {
          console.error("Erro ao registrar histórico inicial:", historyError);
          // Continuar mesmo se o histórico falhar
        }
      }
      
      Alert.alert(
        "Sucesso", 
        "Produto adicionado com sucesso",
        [
          {
            text: "Adicionar outro",
            onPress: () => {
              // Limpar formulário, mas manter alguns campos opcionais
              setCode('');
              setName('');
              setDescription('');
              setQuantity('0');
              setNotes('');
              
              // Se autocode está ativado, gerar novo código
              if (autoGenerateCode) {
                generateProductCode();
              }
            }
          },
          {
            text: "Ir para a lista",
            onPress: () => navigation.navigate('ProductList')
          }
        ]
      );
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar o produto");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.formTitle}>Adicionar Novo Produto</Text>
          
          <View style={styles.codeContainer}>
            <View style={styles.codeInputContainer}>
              <Text style={styles.label}>Código do Produto *</Text>
              <TextInput
                style={[styles.input, autoGenerateCode && styles.disabledInput]}
                value={code}
                onChangeText={setCode}
                placeholder="Código do produto"
                editable={!autoGenerateCode}
              />
            </View>
            
            <View style={styles.autoCodeContainer}>
              <Text style={styles.autoCodeLabel}>Auto</Text>
              <Switch
                value={autoGenerateCode}
                onValueChange={setAutoGenerateCode}
                trackColor={{ false: "#cccccc", true: "#81b0ff" }}
                thumbColor={autoGenerateCode ? "#3498db" : "#f4f3f4"}
              />
            </View>
          </View>
          
          <Text style={styles.label}>Nome do Produto *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome do produto"
          />
          
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descrição do produto"
            multiline
            numberOfLines={4}
          />
          
          <Text style={styles.label}>Quantidade Inicial</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="numeric"
          />
          
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
          >
            <Text style={styles.optionsButtonText}>
              {showAdvancedOptions ? 'Ocultar Opções Avançadas' : 'Mostrar Opções Avançadas'}
            </Text>
          </TouchableOpacity>
          
          {showAdvancedOptions && (
            <View style={styles.advancedOptions}>
              <Text style={styles.label}>Localização no Armazém</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Ex: Prateleira A3, Gaveta 5"
              />
              
              <Text style={styles.label}>Fornecedor</Text>
              <TextInput
                style={styles.input}
                value={supplier}
                onChangeText={setSupplier}
                placeholder="Nome do fornecedor"
              />
              
              <Text style={styles.label}>Nível Mínimo de Estoque</Text>
              <TextInput
                style={styles.input}
                value={minStockLevel}
                onChangeText={setMinStockLevel}
                placeholder="Quantidade mínima recomendada"
                keyboardType="numeric"
              />
              
              <Text style={styles.label}>Observações Adicionais</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Observações sobre este produto"
                multiline
                numberOfLines={3}
              />
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={saveProduct}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Produto</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2c3e50',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  codeInputContainer: {
    flex: 1,
  },
  autoCodeContainer: {
    marginLeft: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  autoCodeLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    color: '#2c3e50',
    marginTop: 12,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  disabledInput: {
    backgroundColor: '#ecf0f1',
    color: '#7f8c8d',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionsButton: {
    marginTop: 20,
    marginBottom: 5,
    padding: 10,
    alignItems: 'center',
  },
  optionsButtonText: {
    color: '#3498db',
    fontSize: 14,
  },
  advancedOptions: {
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  saveButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 25,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});