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
  Platform
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';

// Types for navigation props
type ScannerScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Scanner'>;
};

// Interface for product data
interface ProductData {
  code: string;
  name: string;
  description?: string;
  quantity?: number;
}

// Define colors with added "info" property to fix error
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

export default function ScannerScreen({ navigation }: ScannerScreenProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanFrameAnim = useRef(new Animated.Value(0.95)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Start entry animations when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
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
    setScanned(true);
    setScanning(false);
    processCode(data);
  };

  // Function to process the code (scanned or manual)
  const processCode = (code: string) => {
    setLoading(true);
    
    try {
      // Try to parse as JSON
      let productData: ProductData;
      
      try {
        productData = JSON.parse(code);
        // Validate if it has the necessary fields
        if (!productData.code || !productData.name) {
          throw new Error("Invalid product format");
        }
      } catch (e) {
        // If not valid JSON, use the code as identifier
        productData = {
          code: code.trim(),
          name: `Produto ${code.trim()}`,
          quantity: 0
        };
      }
      
      // Normalize product properties to the format expected by the system
      const normalizedProduct = {
        codigo: productData.code,
        nome: productData.name,
        descricao: productData.description || '',
        quantidade: typeof productData.quantity === 'number' ? productData.quantity : 0,
        quantidade_minima: 0,
        localizacao: '',
        fornecedor: '',
        notas: ''
      };
      
      setLoading(false);
      
      Alert.alert(
        "Produto Encontrado",
        `Código: ${productData.code}\nNome: ${productData.name}`,
        [
          {
            text: "Ver Detalhes",
            onPress: () => navigation.navigate('ProductDetail', { product: normalizedProduct }),
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
        "Formato de código inválido", 
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

  // Rendering based on permission state
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
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
          <Text style={styles.messageText}>Solicitando permissão de câmera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
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
            <Text style={styles.errorIcon}>📷</Text>
            <Text style={styles.errorText}>Acesso à câmera negado</Text>
            <Text style={styles.messageText}>
              Para usar o scanner, por favor conceda permissão de acesso à câmera nas configurações do dispositivo.
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setManualMode(true)}
          >
            <Text style={styles.manualButtonText}>Inserir Código Manualmente</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
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
          <Text style={styles.messageText}>Processando código...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
            barCodeTypes={[
              BarCodeScanner.Constants.BarCodeType.qr,
              BarCodeScanner.Constants.BarCodeType.code128,
              BarCodeScanner.Constants.BarCodeType.code39,
              BarCodeScanner.Constants.BarCodeType.ean13,
            ]}
          >
            <View style={styles.scanOverlay}>
              <Animated.View style={[
                styles.scanFrame,
                { transform: [{ scale: scanFrameAnim }] }
              ]}>
                <Animated.View style={[
                  styles.scanLine,
                  { 
                    transform: [{ 
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 240] // Height of scan frame
                      }) 
                    }] 
                  }
                ]} />
              </Animated.View>
              
              <Text style={styles.scanText}>Posicione o código no centro da tela</Text>
              
              <Animated.View style={{
                transform: [{ scale: pulseAnim }]
              }}>
                <TouchableOpacity 
                  style={styles.manualButton}
                  onPress={() => {
                    setScanning(false);
                    setManualMode(true);
                  }}
                >
                  <Text style={styles.manualButtonText}>Inserir Código Manualmente</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </BarCodeScanner>
        </View>
      )}
      
      {/* Manual input or when camera is not active */}
      {(!scanning || manualMode) && (
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
                    <Text style={styles.scanButtonIcon}>📷</Text>
                    <Text style={styles.scanButtonText}>Ativar Scanner de Código</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.manualContainer}>
              <Text style={styles.manualTitle}>Inserir código manualmente:</Text>
              <TextInput
                style={styles.manualInput}
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Digite o código do produto"
                multiline
              />
              <Text style={styles.helpText}>
                Você pode digitar um código simples ou um objeto JSON completo no formato:
              </Text>
              <View style={styles.codeExampleContainer}>
                <Text style={styles.codeExample}>
                  {"{"}"code":"001","name":"Motor 220V","quantity":5{"}"}
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
                  <Text style={styles.backButtonText}>Voltar para o Scanner</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.tipContainer}>
              <View style={styles.tipIconContainer}>
                <Text style={styles.tipIcon}>💡</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Dica:</Text>
                <Text style={styles.tipText}>
                  Você pode escanear códigos QR que contenham um ID simples ou um objeto JSON
                  com informações do produto.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
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
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: COLORS.white,
    backgroundColor: 'transparent',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
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
  scanButtonIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
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
  manualTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: COLORS.black,
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
  helpText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    color: COLORS.grey,
  },
  codeExampleContainer: {
    backgroundColor: COLORS.ultraLightGrey,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  codeExample: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.black,
  },
  processButton: {
    borderRadius: 25,
    marginTop: 8,
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
  },
  processButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: COLORS.lightGrey,
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 12,
  },
  backButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '500',
  },
  manualButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
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
  },
  tipContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tipIcon: {
    fontSize: 20,
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
