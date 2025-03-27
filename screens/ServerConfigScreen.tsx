import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { obterEnderecoServidor, definirServidor, verificarConexao } from '../services/api';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

type ServerConfigScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ServerConfig'>;
};

const { width } = Dimensions.get('window');

const ServerConfigScreen = ({ navigation }: ServerConfigScreenProps) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('8080');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testStatus, setTestStatus] = useState<'untested' | 'success' | 'error' | 'testing'>('untested');
  const [testMessage, setTestMessage] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const connectingAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation for important elements
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Start entry animations
  useEffect(() => {
    // Animate content entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      })
    ]).start();
  }, []);

  // Animation for the connection testing
  useEffect(() => {
    if (testStatus === 'testing') {
      // Reset and start connecting animation
      connectingAnim.setValue(0);
      Animated.timing(connectingAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }).start();
    } else if (testStatus === 'success') {
      // Reset and start success animation
      successAnim.setValue(0);
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true
      }).start();
    } else if (testStatus === 'error') {
      // Reset and start error animation
      errorAnim.setValue(0);
      Animated.spring(errorAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true
      }).start();
    }
  }, [testStatus]);

  useEffect(() => {
    const loadServerConfig = async () => {
      try {
        setIsLoading(true);
        const { ip, porta } = await obterEnderecoServidor();
        setServerIp(ip || '');
        setServerPort(porta || '8080');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Erro ao carregar configurações de servidor:', errorMessage);
      } finally {
        setIsLoading(false);
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
      setIsConnecting(true);
      setTestStatus('testing');
      setTestMessage('Conectando ao servidor...');

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
      setIsConnecting(false);
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
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Configuração do Servidor" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
        
        {/* Decorative elements for header */}
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
      </LinearGradient>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Configuration Card */}
          <Animated.View style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: COLORS.card
            }
          ]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="dns" size={24} color={COLORS.primary} />
              <Text style={[styles.title, { color: COLORS.text }]}>Configuração do Servidor API</Text>
            </View>
            
            <Text style={[styles.description, { color: COLORS.textSecondary }]}>
              Configure o endereço IP do servidor onde a API está hospedada. 
              Esta é uma etapa crucial para que o aplicativo possa se comunicar 
              com o banco de dados PostgreSQL.
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>
                <MaterialIcons name="computer" size={18} color={COLORS.primary} style={styles.inputIcon} />
                Endereço IP do Servidor:
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: COLORS.ultraLightGrey,
                    borderColor: COLORS.lightGrey,
                    color: COLORS.text
                  }
                ]}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="Ex: 192.168.1.85"
                placeholderTextColor={COLORS.grey}
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>
                <MaterialIcons name="settings-ethernet" size={18} color={COLORS.primary} style={styles.inputIcon} />
                Porta (opcional):
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: COLORS.ultraLightGrey,
                    borderColor: COLORS.lightGrey,
                    color: COLORS.text
                  }
                ]}
                value={serverPort}
                onChangeText={setServerPort}
                placeholder="8080"
                placeholderTextColor={COLORS.grey}
                keyboardType="numeric"
              />
              
              <Text style={[styles.helperText, { color: COLORS.textSecondary }]}>
                A porta padrão é 8080. Altere apenas se o servidor estiver configurado em outra porta.
              </Text>
            </View>
            
            {/* Test Connection Button */}
            <Animated.View 
              style={[
                testStatus === 'success' ? { transform: [{ scale: pulseAnim }] } : {}
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.testButton,
                  { backgroundColor: COLORS.primary }
                ]}
                onPress={handleTestConnection}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <MaterialIcons name="wifi-tethering" size={18} color={COLORS.white} style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Testar Conexão</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
            
            {/* Status box for connection test */}
            {testStatus !== 'untested' && (
              <Animated.View 
                style={[
                  styles.statusBox,
                  testStatus === 'success' ? 
                    [styles.successBox, { 
                      opacity: successAnim,
                      transform: [{ scale: successAnim }]
                    }] : 
                  testStatus === 'error' ?
                    [styles.errorBox, { 
                      opacity: errorAnim,
                      transform: [{ scale: errorAnim }]
                    }] :
                    [styles.testingBox, { 
                      opacity: connectingAnim
                    }]
                ]}
              >
                <View style={styles.statusIconContainer}>
                  {testStatus === 'success' && (
                    <MaterialIcons name="check-circle" size={24} color={COLORS.success} />
                  )}
                  {testStatus === 'error' && (
                    <MaterialIcons name="error" size={24} color={COLORS.error} />
                  )}
                  {testStatus === 'testing' && (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  )}
                </View>
                <Text 
                  style={[
                    styles.statusText,
                    testStatus === 'success' ? [styles.successText, { color: COLORS.success }] : 
                    testStatus === 'error' ? [styles.errorText, { color: COLORS.error }] :
                    { color: COLORS.primary }
                  ]}
                >
                  {testMessage}
                </Text>
              </Animated.View>
            )}
            
            {/* Save Configuration Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: COLORS.success },
                (isLoading || !serverIp.trim()) && styles.disabledButton
              ]}
              onPress={handleSaveConfig}
              disabled={isLoading || !serverIp.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color={COLORS.white} style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Salvar Configurações</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
          
          {/* Help Card */}
          <Animated.View style={[
            styles.helpCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: COLORS.card
            }
          ]}>
            <View style={styles.helpCardHeader}>
              <MaterialIcons name="help-outline" size={22} color={COLORS.primary} />
              <Text style={[styles.helpTitle, { color: COLORS.primary }]}>
                Como encontrar o IP do servidor?
              </Text>
            </View>
            
            <View style={styles.helpStepContainer}>
              <View style={styles.helpStepNumber}>
                <Text style={styles.helpStepNumberText}>1</Text>
              </View>
              <Text style={[styles.helpText, { color: COLORS.text }]}>
                No computador onde o servidor Go está rodando, abra o Terminal/Prompt de Comando
              </Text>
            </View>
            
            <View style={styles.helpStepContainer}>
              <View style={styles.helpStepNumber}>
                <Text style={styles.helpStepNumberText}>2</Text>
              </View>
              <Text style={[styles.helpText, { color: COLORS.text }]}>
                Digite o comando específico para seu sistema:
              </Text>
            </View>
            
            <View style={[styles.codeBlock, { backgroundColor: COLORS.ultraLightGrey }]}>
              <Text style={[styles.codeText, { color: COLORS.primaryDark }]}>
                • Windows: ipconfig{'\n'}
                • Mac/Linux: ifconfig ou ip addr
              </Text>
            </View>
            
            <View style={styles.helpStepContainer}>
              <View style={styles.helpStepNumber}>
                <Text style={styles.helpStepNumberText}>3</Text>
              </View>
              <Text style={[styles.helpText, { color: COLORS.text }]}>
                Procure por "IPv4 Address" ou "inet" seguido por um número no formato 192.168.x.x
              </Text>
            </View>
            
            <View style={styles.helpStepContainer}>
              <View style={styles.helpStepNumber}>
                <Text style={styles.helpStepNumberText}>4</Text>
              </View>
              <Text style={[styles.helpText, { color: COLORS.text }]}>
                Use este IP no campo acima e certifique-se de que:
              </Text>
            </View>
            
            <View style={styles.checklistContainer}>
              <View style={styles.checklistItem}>
                <MaterialIcons name="check" size={16} color={COLORS.success} />
                <Text style={[styles.checklistText, { color: COLORS.text }]}>
                  O servidor Go esteja rodando (verá mensagens de log)
                </Text>
              </View>
              
              <View style={styles.checklistItem}>
                <MaterialIcons name="check" size={16} color={COLORS.success} />
                <Text style={[styles.checklistText, { color: COLORS.text }]}>
                  O dispositivo móvel e o servidor estejam na mesma rede WiFi
                </Text>
              </View>
              
              <View style={styles.checklistItem}>
                <MaterialIcons name="check" size={16} color={COLORS.success} />
                <Text style={[styles.checklistText, { color: COLORS.text }]}>
                  O firewall do computador permita conexões na porta 8080
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    position: 'relative',
    overflow: 'hidden',
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
  headerDecoration1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -30,
    right: -30,
  },
  headerDecoration2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    bottom: -40,
    left: 20,
  },
  keyboardView: {
    flex: 1,
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  testButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBox: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconContainer: {
    marginRight: 10,
  },
  successBox: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#C62828',
  },
  testingBox: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#1565C0',
  },
  statusText: {
    fontSize: 14,
    flex: 1,
  },
  successText: {
    fontWeight: '500',
  },
  errorText: {
    fontWeight: '500',
  },
  helpCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  helpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  helpStepContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  helpStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1565C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  helpStepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  checklistContainer: {
    marginLeft: 34,
    marginTop: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checklistText: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  codeBlock: {
    padding: 14,
    borderRadius: 10,
    marginVertical: 12,
    marginHorizontal: 4,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
});

export default ServerConfigScreen;