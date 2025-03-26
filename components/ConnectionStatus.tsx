import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated
} from 'react-native';
import { getStatusConexao, verificarConexao, sincronizarDados } from '../services/api';

interface ConnectionStatusProps {
  onConfigPress?: () => void;
}

// Definir cores
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

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onConfigPress }) => {
  const [isConnected, setIsConnected] = useState(getStatusConexao());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState({ sincronizados: 0, pendentes: 0 });
  const [isPulsing, setIsPulsing] = useState(false);
  const [isResultVisible, setIsResultVisible] = useState(false);

  // Animações
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const resultOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Verificar conexão quando o componente montar
    const checkConnection = async () => {
      const connected = await verificarConexao();
      setIsConnected(connected);
    };
    
    checkConnection();
    
    // Verificar conexão a cada 30 segundos
    const intervalId = setInterval(checkConnection, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Mostrar e ocultar resultado com animação
    if (syncResult) {
      setIsResultVisible(true);
      
      Animated.sequence([
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.delay(2500),
        Animated.timing(resultOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => {
        setIsResultVisible(false);
        setSyncResult(null);
      });
    }
  }, [syncResult, resultOpacity]);

  // Animar o indicador de status
  useEffect(() => {
    if (isPulsing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isPulsing, pulseAnim]);

  const handleSync = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      setIsPulsing(true);
      setSyncResult(null);
      
      // Verificar conexão primeiro
      const connected = await verificarConexao();
      setIsConnected(connected);
      
      if (!connected) {
        setSyncResult('Sem conexão com o servidor');
        return;
      }
      
      // Tentar sincronizar
      const result = await sincronizarDados();
      
      if (result.sucesso) {
        setSyncResult(result.mensagem);
        setSyncStats({
          sincronizados: result.sincronizados,
          pendentes: result.pendentes
        });
      } else {
        setSyncResult(`Falha: ${result.mensagem}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSyncResult(`Erro: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
      setIsPulsing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Animated.View 
          style={[
            styles.indicator,
            isConnected ? styles.connectedIndicator : styles.disconnectedIndicator,
            { transform: [{ scale: pulseAnim }] }
          ]} 
        />
        
        <Text style={styles.statusText}>
          {isConnected ? 'Conectado ao servidor' : 'Offline - Modo local'}
        </Text>
        
        <TouchableOpacity 
          style={styles.configButton}
          onPress={onConfigPress}
        >
          <Text style={styles.configText}>Config</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.syncContainer}>
        <TouchableOpacity 
          style={[
            styles.syncButton, 
            isSyncing ? styles.syncingButton : (isConnected ? styles.connectedSyncButton : styles.disconnectedSyncButton)
          ]}
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.syncText}>
              {syncStats.pendentes > 0 
                ? `Sincronizar (${syncStats.pendentes} pendentes)` 
                : 'Sincronizar'}
            </Text>
          )}
        </TouchableOpacity>
        
        {isResultVisible && (
          <Animated.View 
            style={[
              styles.resultContainer,
              { opacity: resultOpacity }
            ]}
          >
            <Text style={[
              styles.resultText,
              syncResult && syncResult.includes('Erro') ? styles.errorResultText : 
              syncResult && syncResult.includes('Falha') ? styles.errorResultText : 
              styles.successResultText
            ]}>
              {syncResult}
            </Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginHorizontal: 15,
    marginBottom: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connectedIndicator: {
    backgroundColor: COLORS.success,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  disconnectedIndicator: {
    backgroundColor: COLORS.error,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  configButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: 15,
  },
  configText: {
    fontSize: 12,
    color: COLORS.black,
    fontWeight: '500',
  },
  syncContainer: {
    alignItems: 'center',
    marginTop: 5,
  },
  syncButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 170,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  syncingButton: {
    backgroundColor: COLORS.info,
  },
  connectedSyncButton: {
    backgroundColor: COLORS.primary,
  },
  disconnectedSyncButton: {
    backgroundColor: COLORS.grey,
  },
  syncText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultContainer: {
    marginTop: 8,
    paddingHorizontal: 15,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  resultText: {
    fontSize: 12,
    textAlign: 'center',
  },
  successResultText: {
    color: COLORS.success,
    fontWeight: '500',
  },
  errorResultText: {
    color: COLORS.error,
    fontWeight: '500',
  },
});

export default ConnectionStatus;