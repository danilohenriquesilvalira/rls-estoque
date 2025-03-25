import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { obterEnderecoServidor } from '../services/api';
import NetInfoMock from '../utils/netInfoMock';

// Usar o mock em vez da importação real
const NetInfo = NetInfoMock;

type DiagnosticScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Diagnostic'>;
};

const DiagnosticScreen = ({ navigation }: DiagnosticScreenProps) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string>('');
  const [ipAddress, setIpAddress] = useState<string>('');
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: string}>({});
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [serverConfig, setServerConfig] = useState<{ip: string, porta: string}>({ip: '', porta: ''});
  const [showAddLog, setShowAddLog] = useState(false);
  const [logInput, setLogInput] = useState('');

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
  }, []);

  const runDiagnostics = async () => {
    setRunningTests(true);
    setTestResults({});

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

    // Exibir resultados
    setTestResults(results);
    setRunningTests(false);
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

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Diagnóstico" 
        showLogo={false} 
        showBack={true} 
        onBack={() => navigation.goBack()} 
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Status da Conexão</Text>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Internet:</Text>
            <Text style={styles.statusValue}>
              {isConnected === null ? 'Verificando...' : isConnected ? 'Conectado' : 'Desconectado'}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Tipo de Rede:</Text>
            <Text style={styles.statusValue}>{connectionType || 'Desconhecido'}</Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Endereço IP do Dispositivo:</Text>
            <Text style={styles.statusValue}>{ipAddress || 'Desconhecido'}</Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Servidor API:</Text>
            <Text style={styles.statusValue}>
              {serverConfig.ip}:{serverConfig.porta}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.configButton}
            onPress={() => navigation.navigate('ServerConfig')}
          >
            <Text style={styles.configButtonText}>Alterar Configurações do Servidor</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.diagnosticCard}>
          <Text style={styles.cardTitle}>Testes de Diagnóstico</Text>
          
          <TouchableOpacity 
            style={styles.runButton}
            onPress={runDiagnostics}
            disabled={runningTests}
          >
            {runningTests ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Executar Testes</Text>
            )}
          </TouchableOpacity>
          
          {Object.keys(testResults).length > 0 && (
            <View style={styles.resultsContainer}>
              {Object.entries(testResults).map(([test, result]) => (
                <View key={test} style={styles.testResult}>
                  <Text style={styles.testName}>{test}:</Text>
                  <Text 
                    style={[
                      styles.testResultText,
                      result.includes('✅') ? styles.successText : styles.errorText
                    ]}
                  >
                    {result}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.logsCard}>
          <View style={styles.logsHeader}>
            <Text style={styles.cardTitle}>Logs do Servidor</Text>
            
            <View style={styles.logsActions}>
              <TouchableOpacity 
                style={styles.smallButton}
                onPress={() => setShowAddLog(true)}
              >
                <Text style={styles.smallButtonText}>Adicionar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.smallButton, styles.dangerButton]}
                onPress={clearLogs}
              >
                <Text style={styles.smallButtonText}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {showAddLog && (
            <View style={styles.addLogContainer}>
              <TextInput 
                style={styles.logInput}
                value={logInput}
                onChangeText={setLogInput}
                placeholder="Adicionar observação de diagnóstico..."
                multiline
              />
              
              <View style={styles.logInputActions}>
                <TouchableOpacity 
                  style={[styles.smallButton, styles.cancelButton]}
                  onPress={() => setShowAddLog(false)}
                >
                  <Text style={styles.smallButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.smallButton, styles.confirmButton]}
                  onPress={addLog}
                >
                  <Text style={styles.smallButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <View style={styles.logsContainer}>
            {serverLogs.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum log disponível</Text>
            ) : (
              serverLogs.map((log, index) => (
                <Text key={index} style={styles.logItem}>{log}</Text>
              ))
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.helpButton}
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
          <Text style={styles.helpButtonText}>Obter Ajuda</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1565C0',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  configButton: {
    backgroundColor: '#1565C0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  configButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  diagnosticCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  runButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  testResult: {
    marginBottom: 10,
  },
  testName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  testResultText: {
    fontSize: 14,
    paddingLeft: 8,
  },
  successText: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
  },
  logsCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsActions: {
    flexDirection: 'row',
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#1565C0',
    marginLeft: 8,
  },
  smallButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  dangerButton: {
    backgroundColor: '#C62828',
  },
  logsContainer: {
    maxHeight: 300,
  },
  logItem: {
    fontSize: 12,
    fontFamily: 'monospace',
    padding: 8,
    marginBottom: 4,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  addLogContainer: {
    marginVertical: 10,
  },
  logInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  logInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  confirmButton: {
    backgroundColor: '#2E7D32',
  },
  helpButton: {
    backgroundColor: '#0288D1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  helpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DiagnosticScreen;