import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Image,
  Vibration,
  StatusBar
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getProdutos } from '../services/api';

// Types for navigation and route props
type ScannerScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Scanner'>;
  route: RouteProp<any, 'Scanner'>;
};

// Interface for product data
interface ProductData {
  code: string;
  name: string;
  description?: string;
  quantity?: number;
  supplier?: string;
  location?: string;
  minStock?: number;
  notes?: string;
}

// Interface for system product
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

// Define colors
const COLORS = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  accent: '#FF6F00',
  accentLight: '#FFA726',
  success: '#2E7D32',
  error: '#C62828',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  background: '#F5F7FA',
  info: '#2196F3'
};

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ScannerScreen({ navigation, route }: ScannerScreenProps) {
  // Check if we need to return a parameter to another screen
  const returnRoute = route.params?.returnRoute;
  const returnParam = route.params?.returnParam;

  // State variables
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true); // Start in scanning mode by default
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<Produto[]>([]);
  // Mantemos o estado mas ele não terá efeito na câmera devido a limitações da API
  const [torchOn, setTorchOn] = useState(false);
  const [scanType, setScanType] = useState<'qr' | 'barcode'>('qr');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanFrameAnim = useRef(new Animated.Value(0.95)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scannerMaskAnim = useRef(new Animated.Value(0)).current;
  
  // Preload products for quick lookups
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const produtos = await getProdutos();
        setAllProducts(produtos);
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    
    loadProducts();
  }, []);
  
  // Start entry animations when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start();
    
    // Start scanner mask animation
    Animated.timing(scannerMaskAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic)
    }).start();
    
    // If scanning mode is active, start scan animations
    if (scanning) {
      startScanAnimations();
    }
  }, [scanning]);

  // Request camera permission
  useEffect(() => {
    (async () => {
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        
        // Start scanner automatically if permission is granted
        if (status === 'granted') {
          setScanning(true);
        }
      } catch (error) {
        console.log('Error requesting camera permission:', error);
        setHasPermission(false);
      }
    })();
  }, []);
  
  // Start scanner animations
  const startScanAnimations = () => {
    // Scale animation for scan frame
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanFrameAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(scanFrameAnim, {
          toValue: 0.95,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    ).start();
    
    // Scan line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    ).start();
    
    // Pulse animation for action buttons
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    ).start();
  };

  // Function to process the scanned code
  const handleCodeScanned = ({ type, data }: { type: string; data: string }) => {
    // Prevent duplicate scans in quick succession
    if (lastScanned === data && new Date().getTime() - (lastScanned ? 1000 : 0) < 2000) {
      return;
    }
    
    setLastScanned(data);
    setScanned(true);
    setScanning(false);
    
    // Vibrate when code is scanned
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Vibration.vibrate(100);
    }
    
    processCode(data);
  };

  // Function to process the code (scanned or manual)
  const processCode = async (code: string) => {
    setLoading(true);
    
    try {
      let productData: ProductData | null = null;
      let existingProduct: Produto | undefined;
      
      // First check if code matches any existing product
      existingProduct = allProducts.find(p => p.codigo === code.trim());
      
      if (existingProduct) {
        // If we need to return to another screen
        if (returnRoute && returnParam) {
          // Return to the specified route with the code as parameter
          navigation.navigate(returnRoute, { [returnParam]: code.trim() });
          return;
        }
        
        setLoading(false);
        
        // Show product found alert with options
        Alert.alert(
          "Produto Encontrado",
          `Código: ${existingProduct.codigo}\nNome: ${existingProduct.nome}`,
          [
            {
              text: "Ver Detalhes",
              onPress: () => navigation.navigate('ProductDetail', { product: existingProduct }),
            },
            {
              text: "Escanear outro",
              onPress: () => {
                setScanned(false);
                setScanning(true);
              },
              style: "cancel"
            }
          ]
        );
        return;
      }
      
      // If not found, try to parse as JSON
      try {
        const jsonData = JSON.parse(code);
        // Validate if it has the necessary fields
        if (jsonData.code && jsonData.name) {
          productData = {
            code: jsonData.code,
            name: jsonData.name,
            description: jsonData.description,
            quantity: jsonData.quantity,
            supplier: jsonData.supplier,
            location: jsonData.location,
            minStock: jsonData.minStock,
            notes: jsonData.notes
          };
        }
      } catch (error) {
        // Not a valid JSON, use code as identifier
        if (code.trim()) {
          productData = {
            code: code.trim(),
            name: `Novo Item ${code.trim()}`,
            quantity: 0
          };
        }
      }
      
      // If we could not extract product data, show error
      if (!productData) {
        setLoading(false);
        Alert.alert(
          "Erro", 
          "Código inválido ou sem dados", 
          [
            {
              text: "OK",
              onPress: () => {
                setScanned(false);
                if (!manualMode) {
                  setScanning(true);
                }
              }
            }
          ]
        );
        return;
      }
      
      // If we need to return to another screen
      if (returnRoute && returnParam) {
        // Return to the specified route with the code as parameter
        navigation.navigate(returnRoute, { [returnParam]: productData.code });
        return;
      }
      
      // Normalize product properties to the format expected by the system
      const normalizedProduct = {
        codigo: productData.code,
        nome: productData.name,
        descricao: productData.description || '',
        quantidade: typeof productData.quantity === 'number' ? productData.quantity : 0,
        quantidade_minima: typeof productData.minStock === 'number' ? productData.minStock : 0,
        localizacao: productData.location || '',
        fornecedor: productData.supplier || '',
        notas: productData.notes || ''
      };
      
      setLoading(false);
      
      // Show options for the new product
      Alert.alert(
        "Novo Produto Encontrado",
        `Código: ${productData.code}\nNome: ${productData.name}`,
        [
          {
            text: "Adicionar Produto",
            onPress: () => navigation.navigate('AddProduct', { scannedProduct: normalizedProduct }),
          },
          {
            text: "Escanear outro",
            onPress: () => {
              setScanned(false);
              setScanning(true);
            },
            style: "cancel"
          }
        ]
      );
      
    } catch (error) {
      setLoading(false);
      Alert.alert(
        "Erro", 
        "Falha ao processar o código", 
        [
          {
            text: "OK",
            onPress: () => {
              setScanned(false);
              if (!manualMode) {
                setScanning(true);
              }
            }
          }
        ]
      );
    }
  };

  // Function to process manually entered code
  const handleManualCode = () => {
    if (!manualCode.trim()) {
      Alert.alert("Erro", "Por favor, insira um código");
      return;
    }
    
    processCode(manualCode.trim());
  };

  // Toggle torch/flashlight
  // Nota: A funcionalidade de lanterna foi removida devido a limitações da API
  const toggleTorch = () => {
    // Esta API não está disponível diretamente no BarCodeScanner
    // Em uma implementação futura, pode ser necessário usar a Camera API diretamente
    Alert.alert(
      "Funcionalidade não disponível",
      "O controle da lanterna não está disponível nesta versão."
    );
    setTorchOn(false);
  };
  
  // Toggle scan type between QR and barcode
  const toggleScanType = () => {
    setScanType(scanType === 'qr' ? 'barcode' : 'qr');
  };

  // Determine barcode types based on scanType
  const getBarcodeTypes = () => {
    if (scanType === 'qr') {
      return [BarCodeScanner.Constants.BarCodeType.qr];
    } else {
      return [
        BarCodeScanner.Constants.BarCodeType.code128,
        BarCodeScanner.Constants.BarCodeType.code39,
        BarCodeScanner.Constants.BarCodeType.ean13,
        BarCodeScanner.Constants.BarCodeType.ean8,
        BarCodeScanner.Constants.BarCodeType.upc_e
      ];
    }
  };

  // Rendering based on permission state
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Scanner" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.messageText}>A solicitar permissão de câmara...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Scanner" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <Animated.View 
          style={[
            styles.centeredContainer,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.permissionErrorContainer}>
            <MaterialIcons name="camera-alt" size={60} color={COLORS.error} />
            <Text style={styles.errorText}>Acesso à câmara negado</Text>
            <Text style={styles.messageText}>
              Para usar o scanner, por favor conceda permissão de acesso à câmara nas configurações do dispositivo.
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setManualMode(true)}
          >
            <MaterialIcons name="edit" size={20} color={COLORS.white} />
            <Text style={styles.manualButtonText}>Inserir Código Manualmente</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Scanner" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.messageText}>A processar código...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Scanner" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      {/* Scanner with camera */}
      {scanning && !manualMode && (
        <View style={styles.cameraContainer}>
          <BarCodeScanner
            style={styles.camera}
            onBarCodeScanned={scanned ? undefined : handleCodeScanned}
            barCodeTypes={getBarcodeTypes()}
          >
            <Animated.View 
              style={[
                styles.scanOverlay,
                {
                  backgroundColor: scannerMaskAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']
                  })
                }
              ]}
            >
              <View style={styles.scanTypeIndicator}>
                <Text style={styles.scanTypeText}>
                  {scanType === 'qr' ? 'QR Code' : 'Código de Barras'}
                </Text>
              </View>
              
              <Animated.View style={[
                styles.scanFrame,
                { 
                  transform: [{ scale: scanFrameAnim }],
                  height: scanType === 'qr' ? 250 : 140,
                  width: scanType === 'qr' ? 250 : 300
                }
              ]}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
                
                <Animated.View style={[
                  styles.scanLine,
                  { 
                    transform: [{ 
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, scanType === 'qr' ? 250 : 140]
                      }) 
                    }] 
                  }
                ]} />
              </Animated.View>
              
              <Text style={styles.scanText}>
                {scanType === 'qr' 
                  ? 'Posicione o QR Code no centro da tela' 
                  : 'Alinhe o código de barras dentro da área'}
              </Text>
              
              <View style={styles.scannerControls}>
                <TouchableOpacity 
                  style={styles.scannerControlButton}
                  onPress={toggleScanType}
                >
                  <MaterialIcons 
                    name={scanType === 'qr' ? 'view-week' : 'qr-code'} 
                    size={24} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.scannerControlText}>
                    {scanType === 'qr' ? 'Barcode' : 'QR Code'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.scannerControlButton}
                  onPress={toggleTorch}
                >
                  <MaterialIcons 
                    name={torchOn ? 'flash-off' : 'flash-on'} 
                    size={24} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.scannerControlText}>
                    {torchOn ? 'Desligar Luz' : 'Ligar Luz'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.manualButton}
                onPress={() => {
                  setScanning(false);
                  setManualMode(true);
                }}
              >
                <MaterialIcons name="edit" size={20} color={COLORS.white} />
                <Text style={styles.manualButtonText}>Inserir Código Manualmente</Text>
              </TouchableOpacity>
            </Animated.View>
          </BarCodeScanner>
        </View>
      )}
      
      {/* Manual input or when camera is not active */}
      {(!scanning || manualMode) && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View style={{ opacity: fadeAnim }}>
              {!manualMode && (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={styles.scanButton}
                    onPress={() => {
                      setScanned(false);
                      setScanning(true);
                      setManualMode(false);
                    }}
                  >
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.scanButtonGradient}
                    >
                      <MaterialIcons name="camera-alt" size={22} color={COLORS.white} />
                      <Text style={styles.scanButtonText}>Ativar Scanner</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={styles.manualContainer}>
                <View style={styles.manualTitleContainer}>
                  <MaterialIcons name="edit" size={22} color={COLORS.primary} />
                  <Text style={styles.manualTitle}>Inserir código manualmente</Text>
                </View>
                
                <TextInput
                  style={styles.manualInput}
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder="Digite o código do produto"
                  multiline
                />
                
                <View style={styles.helpContainer}>
                  <MaterialIcons name="info-outline" size={20} color={COLORS.info} style={styles.helpIcon} />
                  <Text style={styles.helpText}>
                    Você pode digitar um código simples ou um objeto JSON completo no formato:
                  </Text>
                </View>
                
                <View style={styles.codeExampleContainer}>
                  <Text style={styles.codeExample}>
                    {"{"}"code":"001","name":"Motor 220V","quantity":5{"}"}
                  </Text>
                </View>
                
                <View style={styles.codeExampleContainer}>
                  <Text style={styles.codeExampleTitle}>Campos suportados:</Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>code</Text>: Código único do produto (obrigatório)
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>name</Text>: Nome do produto (obrigatório)
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>description</Text>: Descrição do produto
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>quantity</Text>: Quantidade inicial
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>supplier</Text>: Fornecedor
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>location</Text>: Localização no armazém
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>minStock</Text>: Nível mínimo de estoque
                  </Text>
                  <Text style={styles.codeExampleField}>
                    • <Text style={styles.fieldName}>notes</Text>: Notas adicionais
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.processButton}
                  onPress={handleManualCode}
                >
                  <LinearGradient
                    colors={[COLORS.success, '#43A047']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.processButtonGradient}
                  >
                    <MaterialIcons name="check" size={22} color={COLORS.white} />
                    <Text style={styles.processButtonText}>Processar Código</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                {manualMode && (
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => {
                      setManualMode(false);
                      setManualCode('');
                    }}
                  >
                    <MaterialIcons name="camera-alt" size={20} color={COLORS.black} />
                    <Text style={styles.backButtonText}>Voltar para o Scanner</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.tipContainer}>
                <View style={styles.tipIconContainer}>
                  <MaterialIcons name="lightbulb" size={24} color={COLORS.accent} />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Dica:</Text>
                  <Text style={styles.tipText}>
                    Você pode escanear códigos QR que contenham um ID simples ou um objeto JSON
                    com informações do produto para adicionar automaticamente.
                  </Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionErrorContainer: {
    backgroundColor: COLORS.white,
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  messageText: {
    fontSize: 16,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 12,
    marginTop: 16,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  scanTypeIndicator: {
    position: 'absolute',
    top: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  scanTypeText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 0,
    borderColor: COLORS.white,
    backgroundColor: 'transparent',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.white,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.white,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.white,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.white,
    borderBottomRightRadius: 10,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 2,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 5,
  },
  scanText: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
    fontWeight: '500',
  },
  scannerControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 50,
    marginBottom: 20,
  },
  scannerControlButton: {
    alignItems: 'center',
    padding: 10,
  },
  scannerControlText: {
    color: COLORS.white,
    marginTop: 5,
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  scanButton: {
    borderRadius: 16,
    overflow: 'hidden',
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
  scanButtonGradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  manualContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  manualTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
    marginLeft: 8,
  },
  manualInput: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  helpIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.grey,
    flex: 1,
  },
  codeExampleContainer: {
    backgroundColor: COLORS.ultraLightGrey,
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  codeExample: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.black,
  },
  codeExampleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 6,
  },
  codeExampleField: {
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 4,
    lineHeight: 18,
  },
  fieldName: {
    color: COLORS.info,
    fontWeight: '500',
  },
  processButton: {
    borderRadius: 25,
    marginTop: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  processButtonGradient: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  processButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButton: {
    backgroundColor: COLORS.lightGrey,
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  manualButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    flexDirection: 'row',
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
  manualButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tipContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: COLORS.accent,
  },
  tipText: {
    fontSize: 14,
    color: COLORS.grey,
    lineHeight: 20,
  },
});