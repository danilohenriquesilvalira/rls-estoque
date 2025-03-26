import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { criarProduto } from '../services/api';
import Header from '../components/Header';

// Definition of navigation props type
type AddProductScreenProps = {
  navigation: NativeStackNavigationProp<any, 'AddProduct'>;
};

// Interface for product (API format)
interface Produto {
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
  localizacao?: string;
  fornecedor?: string;
  notas?: string;
}

// Define colors
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

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');

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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const advancedOptionsHeight = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const saveButtonScale = useRef(new Animated.Value(1)).current;

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsJson = await AsyncStorage.getItem('@app_settings');
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          // Use saved setting or default to true
          setAutoGenerateCode(settings.autoGenerateCode ?? true);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    
    loadSettings();
    
    // Start entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5))
      })
    ]).start();
  }, []);

  // Generate automatic code
  const generateProductCode = async () => {
    try {
      // Use the correct key 'produtos' instead of 'products'
      const jsonValue = await AsyncStorage.getItem('produtos');
      let produtosList: Produto[] = jsonValue != null ? JSON.parse(jsonValue) : [];
      
      // If there are no products, start with 1001
      if (produtosList.length === 0) {
        setCode('1001');
        return;
      }
      
      // Find the highest numeric code
      const numericCodes = produtosList
        .map(item => parseInt(item.codigo))
        .filter(code => !isNaN(code));
      
      if (numericCodes.length === 0) {
        setCode('1001');
        return;
      }
      
      // Next code is the highest + 1
      const nextCode = Math.max(...numericCodes) + 1;
      setCode(nextCode.toString());
      
    } catch (error) {
      console.error("Error generating code:", error);
      // Use timestamp as fallback
      setCode(Date.now().toString().slice(-6));
    }
  };

  // Effect when user activates auto code option
  React.useEffect(() => {
    if (autoGenerateCode) {
      generateProductCode();
    }
  }, [autoGenerateCode]);
  
  // Toggle advanced options with animation
  const toggleAdvancedOptions = () => {
    const toValue = showAdvancedOptions ? 0 : 1;
    
    // Rotate the arrow icon
    Animated.timing(spinAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease)
    }).start();
    
    // Animate the height/opacity of advanced options
    Animated.timing(advancedOptionsHeight, {
      toValue,
      duration: 300,
      useNativeDriver: false, // Using height which requires non-native driver
      easing: Easing.inOut(Easing.ease)
    }).start();
    
    setShowAdvancedOptions(!showAdvancedOptions);
  };

  // Save product
  const saveProduct = async () => {
    // Basic validation
    if (!code.trim() || !name.trim()) {
      Alert.alert("Erro", "Código e nome são obrigatórios");
      return;
    }
    
    // Button press animation
    Animated.sequence([
      Animated.timing(saveButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(saveButtonScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(2))
      })
    ]).start();

    // Create product object in the format expected by the API
    const novoProduto: Produto = {
      codigo: code.trim(),
      nome: name.trim(),
      descricao: description.trim() || undefined,
      quantidade: parseInt(quantity) || 0
    };

    // Add optional fields if filled
    if (location.trim()) novoProduto.localizacao = location.trim();
    if (supplier.trim()) novoProduto.fornecedor = supplier.trim();
    if (notes.trim()) novoProduto.notas = notes.trim();
    if (minStockLevel.trim()) {
      const minStock = parseInt(minStockLevel);
      if (!isNaN(minStock) && minStock >= 0) {
        novoProduto.quantidade_minima = minStock;
      }
    }

    try {
      setSaving(true);
      
      // Use the API service to create the product
      // This service already handles offline mode and synchronization
      await criarProduto(novoProduto);
      
      Alert.alert(
        "Sucesso", 
        "Produto adicionado com sucesso",
        [
          {
            text: "Adicionar outro",
            onPress: () => {
              // Clear form, but keep some optional fields
              setCode('');
              setName('');
              setDescription('');
              setQuantity('0');
              setNotes('');
              
              // If autocode is active, generate new code
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Erro", `Não foi possível salvar o produto: ${errorMessage}`);
      console.error("Error saving product:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Adicionar Produto" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.formTitle}>Novo Produto</Text>
          
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
                trackColor={{ false: "#cccccc", true: COLORS.primaryLight }}
                thumbColor={autoGenerateCode ? COLORS.primary : "#f4f3f4"}
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
            onPress={toggleAdvancedOptions}
          >
            <View style={styles.optionsButtonContent}>
              <Text style={styles.optionsButtonText}>
                {showAdvancedOptions ? 'Ocultar Opções Avançadas' : 'Mostrar Opções Avançadas'}
              </Text>
              <Animated.View style={{
                transform: [{
                  rotate: spinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg']
                  })
                }]
              }}>
                <Text style={styles.optionsButtonIcon}>▼</Text>
              </Animated.View>
            </View>
          </TouchableOpacity>
          
          <Animated.View style={{
            opacity: advancedOptionsHeight,
            height: advancedOptionsHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 350] // Approximate height of advanced options
            }),
            overflow: 'hidden'
          }}>
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
          </Animated.View>
          
          <Animated.View style={{
            transform: [{ scale: saveButtonScale }]
          }}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={saveProduct}
              disabled={saving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.success, '#1B5E20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar Produto</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.primary,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  codeInputContainer: {
    flex: 1,
  },
  autoCodeContainer: {
    marginLeft: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  autoCodeLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    color: COLORS.black,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  disabledInput: {
    backgroundColor: '#ecf0f1',
    color: COLORS.grey,
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
  optionsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionsButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 6,
  },
  optionsButtonIcon: {
    color: COLORS.primary,
    fontSize: 14,
  },
  advancedOptions: {
    paddingTop: 5,
  },
  saveButton: {
    borderRadius: 25,
    marginTop: 25,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});