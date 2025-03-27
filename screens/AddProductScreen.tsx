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
  Dimensions,
  Keyboard,
  ToastAndroid
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { criarProduto } from '../services/api';
import Header from '../components/Header';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// Definition of navigation props type
type AddProductScreenProps = {
  navigation: NativeStackNavigationProp<any, 'AddProduct'>;
  route: any;
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

export default function AddProductScreen({ navigation, route }: AddProductScreenProps) {
  // Form data state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoGenerateCode, setAutoGenerateCode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Progress state
  const totalSteps = 2;
  const progressValue = useRef(new Animated.Value(1 / totalSteps)).current;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const advancedOptionsHeight = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const saveButtonScale = useRef(new Animated.Value(1)).current;
  const stepOpacity = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(0)).current
  ];

  // Check for scanned code from barcode scanner
  useEffect(() => {
    if (route.params?.scannedCode) {
      setCode(route.params.scannedCode);
      setAutoGenerateCode(false);
    }
  }, [route.params?.scannedCode]);

  // Listen for keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

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
        console.error("Erro ao carregar configurações:", error);
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
      console.error("Erro ao gerar código:", error);
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

  // Navigate between steps
  const navigateToStep = (step: number) => {
    if (step === 2 && !validateStep1()) {
      return;
    }

    setCurrentStep(step);
    
    // Animate progress bar
    Animated.timing(progressValue, {
      toValue: step / totalSteps,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.ease)
    }).start();
    
    // Animate step opacity
    Animated.parallel([
      Animated.timing(stepOpacity[0], {
        toValue: step === 1 ? 1 : 0,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(stepOpacity[1], {
        toValue: step === 2 ? 1 : 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
  };

  // Validate first step
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!code.trim()) newErrors.code = "Código é obrigatório";
    if (!name.trim()) newErrors.name = "Nome é obrigatório";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate before saving
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!code.trim()) newErrors.code = "Código é obrigatório";
    if (!name.trim()) newErrors.name = "Nome é obrigatório";
    
    if (quantity.trim()) {
      const parsedQty = parseInt(quantity);
      if (isNaN(parsedQty) || parsedQty < 0) {
        newErrors.quantity = "Quantidade deve ser um número válido";
      }
    }
    
    if (minStockLevel.trim()) {
      const parsedMin = parseInt(minStockLevel);
      if (isNaN(parsedMin) || parsedMin < 0) {
        newErrors.minStockLevel = "Nível mínimo deve ser um número válido";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save product
  const saveProduct = async () => {
    // Validate form
    if (!validateForm()) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Por favor, corrija os erros no formulário', ToastAndroid.SHORT);
      }
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
              setCurrentStep(1);
              
              // Reset progress bar
              Animated.timing(progressValue, {
                toValue: 1 / totalSteps,
                duration: 300,
                useNativeDriver: false
              }).start();
              
              // Reset step visibility
              navigateToStep(1);
              
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
      console.error("Erro ao salvar produto:", error);
    } finally {
      setSaving(false);
    }
  };

  // Open barcode scanner
  const openScanner = () => {
    navigation.navigate('Scanner', { 
      returnRoute: 'AddProduct',
      returnParam: 'scannedCode'
    });
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
      
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressStepsContainer}>
          <TouchableOpacity 
            style={[
              styles.stepIndicator, 
              currentStep >= 1 && styles.activeStepIndicator
            ]}
            onPress={() => navigateToStep(1)}
          >
            <Text style={[
              styles.stepNumber,
              currentStep >= 1 && styles.activeStepNumber
            ]}>1</Text>
          </TouchableOpacity>
          
          <View style={styles.progressLine}>
            <View style={styles.progressLineBg} />
            <Animated.View 
              style={[
                styles.progressLineFill,
                {
                  width: progressValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })
                }
              ]} 
            />
          </View>
          
          <TouchableOpacity 
            style={[
              styles.stepIndicator, 
              currentStep >= 2 && styles.activeStepIndicator
            ]}
            onPress={() => navigateToStep(2)}
          >
            <Text style={[
              styles.stepNumber,
              currentStep >= 2 && styles.activeStepNumber
            ]}>2</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.stepLabelsContainer}>
          <Text style={[
            styles.stepLabel,
            currentStep === 1 && styles.activeStepLabel
          ]}>Informações Básicas</Text>
          
          <Text style={[
            styles.stepLabel,
            currentStep === 2 && styles.activeStepLabel
          ]}>Detalhes</Text>
        </View>
      </View>
      
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
          {/* Step 1: Basic Information */}
          <Animated.View 
            style={[
              styles.formStep,
              { 
                opacity: stepOpacity[0],
                display: currentStep === 1 ? 'flex' : 'none'
              }
            ]}
          >
            <Text style={styles.formTitle}>
              <MaterialIcons name="inventory" size={24} color={COLORS.primary} /> 
              Informações do Produto
            </Text>
            
            <View style={styles.codeContainer}>
              <View style={styles.codeInputContainer}>
                <Text style={styles.label}>
                  <MaterialIcons name="qr-code" size={16} color={COLORS.black} /> Código do Produto *
                </Text>
                <View style={styles.codeInputWrapper}>
                  <TextInput
                    style={[
                      styles.input, 
                      styles.codeInput,
                      autoGenerateCode && styles.disabledInput,
                      errors.code && styles.inputError
                    ]}
                    value={code}
                    onChangeText={text => {
                      setCode(text);
                      if (errors.code) {
                        setErrors({...errors, code: ''});
                      }
                    }}
                    placeholder="Código do produto"
                    editable={!autoGenerateCode}
                  />
                  <TouchableOpacity 
                    style={styles.scanButton}
                    onPress={openScanner}
                    disabled={autoGenerateCode}
                  >
                    <MaterialIcons 
                      name="qr-code-scanner" 
                      size={24} 
                      color={autoGenerateCode ? COLORS.lightGrey : COLORS.primary} 
                    />
                  </TouchableOpacity>
                </View>
                {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : null}
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
            
            <Text style={styles.label}>
              <MaterialIcons name="label" size={16} color={COLORS.black} /> Nome do Produto *
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.name && styles.inputError
              ]}
              value={name}
              onChangeText={text => {
                setName(text);
                if (errors.name) {
                  setErrors({...errors, name: ''});
                }
              }}
              placeholder="Nome do produto"
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            
            <Text style={styles.label}>
              <MaterialIcons name="description" size={16} color={COLORS.black} /> Descrição
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o produto (opcional)"
              multiline
              numberOfLines={4}
            />
            
            <Text style={styles.label}>
              <MaterialIcons name="inventory" size={16} color={COLORS.black} /> Quantidade Inicial
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.quantity && styles.inputError
              ]}
              value={quantity}
              onChangeText={text => {
                setQuantity(text);
                if (errors.quantity) {
                  setErrors({...errors, quantity: ''});
                }
              }}
              placeholder="0"
              keyboardType="numeric"
            />
            {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}
            
            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.nextButton]}
                onPress={() => navigateToStep(2)}
              >
                <Text style={styles.nextButtonText}>Próximo</Text>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          {/* Step 2: Additional Details */}
          <Animated.View 
            style={[
              styles.formStep,
              { 
                opacity: stepOpacity[1],
                display: currentStep === 2 ? 'flex' : 'none'
              }
            ]}
          >
            <Text style={styles.formTitle}>
              <MaterialIcons name="more-horiz" size={24} color={COLORS.primary} /> 
              Detalhes Adicionais
            </Text>
            
            <Text style={styles.label}>
              <MaterialIcons name="place" size={16} color={COLORS.black} /> Localização no Armazém
            </Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Ex: Prateleira A3, Gaveta 5"
            />
            
            <Text style={styles.label}>
              <MaterialIcons name="business" size={16} color={COLORS.black} /> Fornecedor
            </Text>
            <TextInput
              style={styles.input}
              value={supplier}
              onChangeText={setSupplier}
              placeholder="Nome do fornecedor"
            />
            
            <Text style={styles.label}>
              <MaterialIcons name="warning" size={16} color={COLORS.black} /> Nível Mínimo de Estoque
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.minStockLevel && styles.inputError
              ]}
              value={minStockLevel}
              onChangeText={text => {
                setMinStockLevel(text);
                if (errors.minStockLevel) {
                  setErrors({...errors, minStockLevel: ''});
                }
              }}
              placeholder="Quantidade mínima recomendada"
              keyboardType="numeric"
            />
            {errors.minStockLevel ? <Text style={styles.errorText}>{errors.minStockLevel}</Text> : null}
            
            <Text style={styles.label}>
              <MaterialIcons name="notes" size={16} color={COLORS.black} /> Observações Adicionais
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observações sobre este produto"
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.backButton]}
                onPress={() => navigateToStep(1)}
              >
                <MaterialIcons name="arrow-back" size={20} color={COLORS.black} />
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
              
              <Animated.View style={{
                transform: [{ scale: saveButtonScale }],
                flex: 1
              }}>
                <TouchableOpacity 
                  style={[styles.button, styles.saveButton]}
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
                      <>
                        <MaterialIcons name="save" size={20} color={COLORS.white} />
                        <Text style={styles.saveButtonText}>Salvar</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
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
  progressContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
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
  progressStepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightGrey,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.ultraLightGrey,
  },
  activeStepIndicator: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  stepNumber: {
    color: COLORS.grey,
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeStepNumber: {
    color: COLORS.white,
  },
  progressLine: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.lightGrey,
    marginHorizontal: 10,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressLineBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.lightGrey,
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  stepLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingHorizontal: 5,
  },
  stepLabel: {
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    width: 100,
  },
  activeStepLabel: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
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
  formStep: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  codeInputContainer: {
    flex: 1,
  },
  codeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  scanButton: {
    backgroundColor: COLORS.ultraLightGrey,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    borderLeftWidth: 0,
    height: 53,
    width: 53,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  disabledInput: {
    backgroundColor: '#ecf0f1',
    color: COLORS.grey,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  button: {
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    flex: 1,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  backButton: {
    backgroundColor: COLORS.ultraLightGrey,
    marginRight: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  saveButton: {
    overflow: 'hidden',
    flex: 1,
    padding: 0,
  },
  saveButtonGradient: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});