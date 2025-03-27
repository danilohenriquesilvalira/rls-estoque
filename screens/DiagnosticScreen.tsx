// screens/DiagnosticScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
  Animated,
  Easing,
  Platform,
  Dimensions
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { obterEnderecoServidor } from '../services/api';
import NetInfoMock from '../utils/netInfoMock';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

// Usar o mock em vez da importação real
const NetInfo = NetInfoMock;

type DiagnosticScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Diagnostic'>;
};

// Screen dimensions
const { width: screenWidth } = Dimensions.get('window');

const DiagnosticScreen = ({ navigation }: DiagnosticScreenProps) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string>('');
  const [ipAddress, setIpAddress] = useState<string>('');
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: string}>({});
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [serverConfig, setServerConfig] = useState<{ip: string, porta: string}>({ip: '', porta: ''});
  const [showAddLog, setShowAddLog] = useState(false);
  const [logInput, setLogInput] = useState('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const resultsFadeAnim = useRef(new Animated.Value(0)).current;
  const resultsSlideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const checkConnection = async () => {
      // Verificar status da conexão
      const netInfo = await NetInfo.fetch();
      setIsConnected(netInfo.isConnected);
      setConnectionType(netInfo.type);
      
      if (netInfo.details && 'ipAddress' in netInfo.details) {
        setIpAddress(netInfo.details.ipAddress || 'Não disponível');
      }
    };

    const loadServerConfig = async () => {
      const config = await obterEnderecoServidor();
      setServerConfig(config);
    };

    const loadLogs = async () => {
      try {
        const logs = await AsyncStorage.getItem('@debug_logs');
        if (logs) {
          setServerLogs(JSON.parse(logs));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Erro ao carregar logs:', errorMessage);
      }
    };

    checkConnection();
    loadServerConfig();
    loadLogs();
    
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      })
    ]).start();
    
    // Iniciar animação de pulse para o indicador de status
    startPulseAnimation();
  }, []);
  
  // Animação de pulse para o indicador de status
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        })
      ])
    ).start();
  };

  const runDiagnostics = async () => {
    setRunningTests(true);
    setTestResults({});
    
    // Reset animation values for results
    resultsFadeAnim.setValue(0);
    resultsSlideAnim.setValue(20);

    const results: {[key: string]: string} = {};

    // Teste 1: Verificar conexão com a internet
    try {
      const netInfo = await NetInfo.fetch();
      results['Internet'] = netInfo.isConnected 
        ? '✅ Conectado à internet' 
        : '❌ Sem conexão com a internet';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results['Internet'] = `❌ Erro ao verificar internet: ${errorMessage}`;
    }

    // Teste 2: Verificar configurações do servidor
    try {
      const { ip, porta } = await obterEnderecoServidor();
      if (ip && porta) {
        results['Servidor'] = `✅ Configuração encontrada: ${ip}:${porta}`;
      } else {
        results['Servidor'] = '❌ Configuração de servidor incompleta';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results['Servidor'] = `❌ Erro ao verificar configuração: ${errorMessage}`;
    }

    // Teste 3: Tentar conectar ao servidor
    try {
      const { ip, porta } = await obterEnderecoServidor();
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000);
      
      try {
        const response = await fetch(`http://${ip}:${porta}/api/produtos?limit=1`, {
          signal: abortController.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          results['API'] = '✅ API respondeu corretamente';
        } else {
          results['API'] = `❌ API retornou erro: ${response.status} ${response.statusText}`;
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          results['API'] = '❌ Tempo limite esgotado ao conectar com o servidor';
        } else {
          const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
          results['API'] = `❌ Falha ao conectar com API: ${errorMessage}`;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results['API'] = `❌ Falha ao configurar teste de API: ${errorMessage}`;
    }

    // Teste 4: Verificar fila de sincronização
    try {
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      results['Sincronização'] = `✅ Fila de sincronização: ${syncQueue.length} item(s) pendente(s)`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results['Sincronização'] = `❌ Erro ao verificar fila: ${errorMessage}`;
    }

    // Exibir resultados com animação
    setTestResults(results);
    setRunningTests(false);
    
    // Animar os resultados aparecendo
    Animated.parallel([
      Animated.timing(resultsFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(resultsSlideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      })
    ]).start();
  };

  const clearLogs = async () => {
    Alert.alert(
      'Limpar Logs',
      'Tem certeza que deseja limpar todos os logs de diagnóstico?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Limpar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.setItem('@debug_logs', JSON.stringify([]));
              setServerLogs([]);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error('Erro ao limpar logs:', errorMessage);
              Alert.alert('Erro', 'Não foi possível limpar os logs');
            }
          }
        }
      ]
    );
  };

  const addLog = async () => {
    if (!logInput.trim()) return;
    
    try {
      const newLogs = [...serverLogs, `[${new Date().toLocaleString()}] ${logInput}`];
      await AsyncStorage.setItem('@debug_logs', JSON.stringify(newLogs));
      setServerLogs(newLogs);
      setLogInput('');
      setShowAddLog(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Erro ao adicionar log:', errorMessage);
      Alert.alert('Erro', 'Não foi possível adicionar o log');
    }
  };
  
  // Obter cor baseado no status da conexão
  const getConnectionStatusColor = () => {
    if (isConnected === null) return COLORS.grey;
    return isConnected ? COLORS.success : COLORS.error;
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
          title="Diagnóstico" 
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
            styles.statusCard,
            { 
              backgroundColor: COLORS.card,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <MaterialIcons name="wifi" size={22} color={COLORS.primary} />
            <Text style={[styles.cardTitle, { color: COLORS.primary }]}>Status da Conexão</Text>
          </View>
          
          <View style={styles.connectionStatus}>
            <Animated.View 
              style={[
                styles.connectionIndicator,
                { 
                  backgroundColor: getConnectionStatusColor(),
                  transform: [{ scale: pulseAnim }]
                }
              ]}
            />
            <View style={styles.connectionInfo}>
              <Text style={[styles.connectionState, { color: COLORS.text }]}>
                {isConnected === null 
                  ? 'Verificando conexão...' 
                  : isConnected 
                    ? 'Conectado à internet' 
                    : 'Sem conexão de internet'}
              </Text>
              <Text style={[styles.connectionType, { color: COLORS.textSecondary }]}>
                {connectionType || 'Tipo de rede desconhecido'}
              </Text>
            </View>
          </View>
          
          <View style={[styles.divider, { backgroundColor: COLORS.lightGrey }]} />
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="computer" size={18} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                IP do Dispositivo:
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {ipAddress || 'Desconhecido'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="dns" size={18} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                Servidor API:
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {serverConfig.ip}:{serverConfig.porta}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.configButton, { backgroundColor: COLORS.primary }]}
            onPress={() => navigation.navigate('ServerConfig')}
          >
            <MaterialIcons name="settings" size={18} color="#FFFFFF" />
            <Text style={styles.configButtonText}>Configurações do Servidor</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.diagnosticCard,
            { 
              backgroundColor: COLORS.card,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <MaterialIcons name="bug-report" size={22} color={COLORS.primary} />
            <Text style={[styles.cardTitle, { color: COLORS.primary }]}>Testes de Diagnóstico</Text>
          </View>
          
          <Text style={[styles.diagnosticDescription, { color: COLORS.textSecondary }]}>
            Execute os testes para verificar a conexão com o servidor e o status da aplicação.
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.runButton,
              { backgroundColor: runningTests ? COLORS.primaryLight : COLORS.success }
            ]}
            onPress={runDiagnostics}
            disabled={runningTests}
          >
            {runningTests ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Executando testes...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Executar Testes</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {Object.keys(testResults).length > 0 && (
            <Animated.View 
              style={[
                styles.resultsContainer,
                { 
                  opacity: resultsFadeAnim,
                  transform: [{ translateY: resultsSlideAnim }],
                  borderTopColor: COLORS.lightGrey 
                }
              ]}
            >
              {Object.entries(testResults).map(([test, result]) => (
                <View key={test} style={styles.testResult}>
                  <View style={styles.testHeader}>
                    <MaterialIcons 
                      name={
                        result.includes('✅') ? "check-circle" : "error"
                      } 
                      size={20} 
                      color={result.includes('✅') ? COLORS.success : COLORS.error} 
                    />
                    <Text style={[styles.testName, { color: COLORS.text }]}>{test}</Text>
                  </View>
                  <Text 
                    style={[
                      styles.testResultText,
                      { 
                        color: result.includes('✅') ? COLORS.success : COLORS.error,
                        backgroundColor: result.includes('✅') 
                          ? `${COLORS.success}10` 
                          : `${COLORS.error}10` 
                      }
                    ]}
                  >
                    {result}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.logsCard,
            { 
              backgroundColor: COLORS.card,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.logsHeader}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="list" size={22} color={COLORS.primary} />
              <Text style={[styles.cardTitle, { color: COLORS.primary }]}>Logs de Diagnóstico</Text>
            </View>
            
            <View style={styles.logsActions}>
              <TouchableOpacity 
                style={[styles.smallButton, { backgroundColor: COLORS.info }]}
                onPress={() => setShowAddLog(true)}
              >
                <MaterialIcons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.smallButtonText}>Novo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.smallButton, { backgroundColor: COLORS.error }]}
                onPress={clearLogs}
              >
                <MaterialIcons name="delete" size={16} color="#FFFFFF" />
                <Text style={styles.smallButtonText}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {showAddLog && (
            <View style={styles.addLogContainer}>
              <TextInput 
                style={[
                  styles.logInput,
                  { 
                    backgroundColor: COLORS.ultraLightGrey,
                    borderColor: COLORS.lightGrey,
                    color: COLORS.text 
                  }
                ]}
                value={logInput}
                onChangeText={setLogInput}
                placeholder="Adicionar observação de diagnóstico..."
                placeholderTextColor={COLORS.grey}
                multiline
              />
              
              <View style={styles.logInputActions}>
                <TouchableOpacity 
                  style={[styles.smallButton, { backgroundColor: COLORS.grey }]}
                  onPress={() => setShowAddLog(false)}
                >
                  <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  <Text style={styles.smallButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.smallButton, { backgroundColor: COLORS.success }]}
                  onPress={addLog}
                >
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.smallButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <View style={styles.logsContainer}>
            {serverLogs.length === 0 ? (
              <View style={styles.emptyLogsContainer}>
                <MaterialIcons name="info" size={40} color={COLORS.lightGrey} />
                <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
                  Nenhum log disponível
                </Text>
              </View>
            ) : (
              serverLogs.map((log, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.logItem, 
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderLeftColor: log.includes('ERRO') || log.includes('erro') 
                        ? COLORS.error 
                        : log.includes('AVISO') || log.includes('aviso')
                          ? COLORS.warning
                          : COLORS.info
                    }
                  ]}
                >
                  <Text style={[styles.logText, { color: COLORS.text }]}>{log}</Text>
                </View>
              ))
            )}
          </View>
        </Animated.View>
        
        <TouchableOpacity 
          style={[styles.helpButton, { backgroundColor: COLORS.info }]}
          onPress={() => {
            Alert.alert(
              "Ajuda",
              "Para sincronizar sua aplicação mobile com o servidor PostgreSQL:\n\n" +
              "1. Certifique-se que o servidor Go está rodando no computador\n" +
              "2. Configure o endereço IP correto na tela de configurações\n" +
              "3. Verifique se o dispositivo mobile e o servidor estão na mesma rede WiFi\n" +
              "4. Se o problema persistir, execute os testes de diagnóstico\n\n" +
              "Os logs dessa tela podem ajudar a identificar o problema."
            );
          }}
        >
          <MaterialIcons name="help" size={20} color="#FFFFFF" />
          <Text style={styles.helpButtonText}>Obter Ajuda</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionState: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  connectionType: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    marginLeft: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  configButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  diagnosticCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  diagnosticDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  runButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resultsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  testResult: {
    marginBottom: 16,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  testName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  testResultText: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 28,
  },
  logsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logsActions: {
    flexDirection: 'row',
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  logsContainer: {
    maxHeight: 300,
  },
  emptyLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  logItem: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  logText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addLogContainer: {
    marginVertical: 10,
  },
  logInput: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  logInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  helpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default DiagnosticScreen;