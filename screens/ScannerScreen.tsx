import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';

// Tipo para as props de navegação
type ScannerScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Scanner'>;
};

// Interface para dados do produto
interface ProductData {
  code: string;
  name: string;
  description?: string;
  quantity?: number;
}

// Definir cores
const COLORS = {
  primary: '#1565C0',
  primaryLight: '#42A5F5',
  accent: '#FF6F00',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  background: '#F5F7FA',
};

export default function ScannerScreen({ navigation }: ScannerScreenProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Solicitar permissão para usar a câmera
  useEffect(() => {
    (async () => {
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.log('Erro ao solicitar permissão de câmera:', error);
        setHasPermission(false);
      }
    })();
  }, []);

  // Função para processar o código lido
  const handleCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setScanning(false);
    processCode(data);
  };

  // Função para processar o código (lido ou manual)
  const processCode = (code: string) => {
    setLoading(true);
    
    try {
      // Tenta analisar como JSON
      let productData: ProductData;
      
      try {
        productData = JSON.parse(code);
        // Validar se tem os campos necessários
        if (!productData.code || !productData.name) {
          throw new Error("Formato de produto inválido");
        }
      } catch (e) {
        // Se não for JSON válido, usamos o código como identificador
        productData = {
          code: code.trim(),
          name: `Produto ${code.trim()}`,
          quantity: 0
        };
      }
      
      // CORREÇÃO: Normalizar propriedades do produto para o formato esperado pelo sistema
      const normalizedProduct = {
        codigo: productData.code,
        nome: productData.name,
        descricao: productData.description || '',
        quantidade: typeof productData.quantity === 'number' ? productData.quantity : 0,
        // Incluir outras propriedades padrão que podem ser necessárias
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

  // Função para processar o código inserido manualmente
  const handleManualCode = () => {
    if (!manualCode.trim()) {
      Alert.alert("Erro", "Por favor, insira um código");
      return;
    }
    
    processCode(manualCode.trim());
  };

  // Renderização com base no estado das permissões
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Scanner" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
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
        <Header title="Scanner" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>Acesso à câmera negado</Text>
          <Text style={styles.messageText}>
            Para usar o scanner, por favor conceda permissão de acesso à câmera nas configurações do dispositivo.
          </Text>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setManualMode(true)}
          >
            <Text style={styles.manualButtonText}>Inserir Código Manualmente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Scanner" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.messageText}>Processando código...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Scanner" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
      
      {/* Scanner de código com câmera */}
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
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>Posicione o QR code no centro da tela</Text>
            </View>
          </BarCodeScanner>
          
          <TouchableOpacity 
            style={styles.manualButton}
            onPress={() => {
              setScanning(false);
              setManualMode(true);
            }}
          >
            <Text style={styles.manualButtonText}>Inserir Código Manualmente</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Input manual ou quando câmera não estiver ativa */}
      {(!scanning || manualMode) && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                <Text style={styles.scanButtonText}>Ativar Scanner de QR Code</Text>
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
            <Text style={styles.codeExample}>
              {"{"}"code":"001","name":"Motor 220V","quantity":5{"}"}
            </Text>
            <TouchableOpacity 
              style={styles.processButton}
              onPress={handleManualCode}
            >
              <Text style={styles.processButtonText}>Processar Código</Text>
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
            <Text style={styles.tipTitle}>Dica:</Text>
            <Text style={styles.tipText}>
              Você pode escanear códigos QR que contenham um ID simples ou um objeto JSON
              com informações do produto.
            </Text>
          </View>
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    fontSize: 16,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: 10,
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
  },
  scanText: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  scrollContent: {
    padding: 15,
    flexGrow: 1,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.black,
  },
  manualInput: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 5,
    color: COLORS.grey,
  },
  codeExample: {
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: COLORS.ultraLightGrey,
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  processButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  processButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: COLORS.grey,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: COLORS.accent,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    margin: 15,
  },
  manualButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipContainer: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: COLORS.accent,
  },
  tipText: {
    fontSize: 14,
    color: COLORS.grey,
    lineHeight: 20,
  },
});