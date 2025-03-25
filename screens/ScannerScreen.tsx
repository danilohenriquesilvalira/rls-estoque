import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';

// Definição do tipo para as propriedades de navegação
type ScannerScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Scanner'>;
};

// Interface para representar os dados do produto
interface ProductData {
  code: string;
  name: string;
  description?: string;
  quantity?: number;
}

// Definir cores diretamente para este componente
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
  const [manualCode, setManualCode] = useState('');

  // Função para processar o código inserido manualmente
  const handleManualCode = () => {
    if (!manualCode.trim()) {
      Alert.alert("Erro", "Por favor, insira um código");
      return;
    }
    
    try {
      // Tenta analisar o código como JSON
      let productData: ProductData;
      
      try {
        productData = JSON.parse(manualCode);
        // Validar se tem os campos necessários
        if (!productData.code || !productData.name) {
          throw new Error("Formato de produto inválido");
        }
      } catch (e) {
        // Se não for JSON válido, usamos o código como identificador
        productData = {
          code: manualCode.trim(),
          name: `Produto ${manualCode.trim()}`,
          quantity: 0
        };
      }
      
      Alert.alert(
        "Produto Encontrado",
        `Código: ${productData.code}\nNome: ${productData.name}`,
        [
          {
            text: "Ver Detalhes",
            onPress: () => navigation.navigate('ProductDetail', { product: productData }),
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
    } catch (error) {
      Alert.alert("Erro", "Formato de código inválido");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Scanner" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Scanner temporariamente indisponível</Text>
          <Text style={styles.infoText}>
            O scanner de QR code não está disponível neste momento devido a limitações técnicas.
            Por favor, digite o código do produto manualmente.
          </Text>
        </View>
        
        <View style={styles.manualContainer}>
          <Text style={styles.manualTitle}>Digite o código manualmente:</Text>
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
            style={styles.manualButton}
            onPress={handleManualCode}
          >
            <Text style={styles.manualButtonText}>Processar Código</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.tipContainer}>
          <Text style={styles.tipTitle}>Dica:</Text>
          <Text style={styles.tipText}>
            Quando o aplicativo for instalado no seu dispositivo (não através do Expo Go), 
            o scanner QR code funcionará normalmente.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 15,
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 20,
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
  manualButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
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