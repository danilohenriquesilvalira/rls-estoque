import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { obterEnderecoServidor, definirServidor, verificarConexao } from '../services/api';

type ServerConfigScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ServerConfig'>;
};

// Definir cores do tema
const COLORS = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  success: '#2E7D32',
  warning: '#F57F17',
  error: '#C62828',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  background: '#F5F7FA',
};

const ServerConfigScreen = ({ navigation }: ServerConfigScreenProps) => {
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('8080');
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'untested' | 'success' | 'error'>('untested');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    const loadServerConfig = async () => {
      try {
        const { ip, porta } = await obterEnderecoServidor();
        setServerIp(ip);
        setServerPort(porta);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Erro ao carregar configurações de servidor:', errorMessage);
      }
    };

    loadServerConfig();
  }, []);

  const handleTestConnection = async () => {
    if (!serverIp.trim()) {
      Alert.alert('Erro', 'Por favor, informe o endereço IP do servidor');
      return;
    }

    try {
      setIsLoading(true);
      setTestStatus('untested');
      setTestMessage('');

      // Temporariamente define o servidor para teste
      const success = await definirServidor(serverIp, serverPort);

      if (success) {
        setTestStatus('success');
        setTestMessage('Conexão bem-sucedida! Servidor respondeu corretamente.');
      } else {
        setTestStatus('error');
        setTestMessage('Não foi possível conectar ao servidor. Verifique o IP e a porta.');
      }
    } catch (error) {
      setTestStatus('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestMessage(`Erro ao testar conexão: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!serverIp.trim()) {
      Alert.alert('Erro', 'Por favor, informe o endereço IP do servidor');
      return;
    }

    try {
      setIsLoading(true);
      
      const success = await definirServidor(serverIp, serverPort);
      
      if (success) {
        Alert.alert(
          'Sucesso', 
          'Conexão com servidor configurada com sucesso!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'Atenção',
          'Não foi possível conectar ao servidor, mas as configurações foram salvas. Deseja continuar?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Continuar', 
              onPress: () => navigation.goBack() 
            }
          ]
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erro', `Falha ao salvar configurações: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Configuração do Servidor" 
        showLogo={false} 
        showBack={true} 
        onBack={() => navigation.goBack()} 
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>Configuração do Servidor API</Text>
            
            <Text style={styles.description}>
              Configure o endereço IP do servidor onde a API está hospedada. 
              Esta é uma etapa crucial para que o aplicativo possa se comunicar 
              com o banco de dados PostgreSQL.
            </Text>
            
            <Text style={styles.label}>Endereço IP do Servidor:</Text>
            <TextInput
              style={styles.input}
              value={serverIp}
              onChangeText={setServerIp}
              placeholder="Ex: 192.168.1.85"
              keyboardType="numeric"
              autoCapitalize="none"
            />
            
            <Text style={styles.label}>Porta (opcional):</Text>
            <TextInput
              style={styles.input}
              value={serverPort}
              onChangeText={setServerPort}
              placeholder="8080"
              keyboardType="numeric"
            />
            
            <Text style={styles.helperText}>
              A porta padrão é 8080. Altere apenas se o servidor estiver configurado em outra porta.
            </Text>
            
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestConnection}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Testar Conexão</Text>
              )}
            </TouchableOpacity>
            
            {testStatus !== 'untested' && (
              <View 
                style={[
                  styles.statusBox,
                  testStatus === 'success' ? styles.successBox : styles.errorBox
                ]}
              >
                <Text 
                  style={[
                    styles.statusText,
                    testStatus === 'success' ? styles.successText : styles.errorText
                  ]}
                >
                  {testStatus === 'success' ? '✓ ' : '✗ '}
                  {testMessage}
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[
                styles.saveButton,
                (isLoading || !serverIp.trim()) && styles.disabledButton
              ]}
              onPress={handleSaveConfig}
              disabled={isLoading || !serverIp.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Salvar Configurações</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>Como encontrar o IP do servidor?</Text>
            
            <Text style={styles.helpText}>
              1. No computador onde o servidor Go está rodando, abra o Terminal/Prompt de Comando
            </Text>
            
            <Text style={styles.helpText}>
              2. Digite o comando específico para seu sistema:
            </Text>
            
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                • Windows: ipconfig{'\n'}
                • Mac/Linux: ifconfig ou ip addr
              </Text>
            </View>
            
            <Text style={styles.helpText}>
              3. Procure por "IPv4 Address" ou "inet" seguido por um número no formato 192.168.x.x
            </Text>
            
            <Text style={styles.helpText}>
              4. Use este IP no campo acima e certifique-se de que:
            </Text>
            
            <Text style={styles.helpItem}>
              • O servidor Go esteja rodando (verá mensagens de log)
            </Text>
            
            <Text style={styles.helpItem}>
              • O dispositivo móvel e o servidor estejam na mesma rede WiFi
            </Text>
            
            <Text style={styles.helpItem}>
              • O firewall do computador permita conexões na porta 8080
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: COLORS.grey,
    marginBottom: 16,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    fontSize: 16,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  testButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: COLORS.success,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.lightGrey,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successBox: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  statusText: {
    fontSize: 14,
  },
  successText: {
    color: COLORS.success,
  },
  errorText: {
    color: COLORS.error,
  },
  helpCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 8,
    lineHeight: 20,
  },
  helpItem: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 4,
    marginLeft: 16,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: COLORS.ultraLightGrey,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: COLORS.primaryDark,
  },
});

export default ServerConfigScreen;