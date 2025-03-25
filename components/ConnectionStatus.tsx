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

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onConfigPress }) => {
  const [isConnected, setIsConnected] = useState(getStatusConexao());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState({ sincronizados: 0, pendentes: 0 });
  const [isPulsing, setIsPulsing] = useState(false);

  // Animação de pulso para o indicador
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

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
    // Configurar animação de pulso
    if (syncResult) {
      const timeout = setTimeout(() => {
        setSyncResult(null);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [syncResult]);

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
          style={[styles.syncButton, isSyncing && styles.syncingButton]}
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
        
        {syncResult && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>{syncResult}</Text>
          </View>
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
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginHorizontal: 15,
    marginBottom: 5,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connectedIndicator: {
    backgroundColor: '#4CAF50',
  },
  disconnectedIndicator: {
    backgroundColor: '#F44336',
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#424242',
  },
  configButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
  },
  configText: {
    fontSize: 12,
    color: '#616161',
  },
  syncContainer: {
    alignItems: 'center',
    marginTop: 5,
  },
  syncButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#1565C0',
    borderRadius: 5,
    minWidth: 150,
    alignItems: 'center',
  },
  syncingButton: {
    backgroundColor: '#42A5F5',
  },
  syncText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  resultContainer: {
    marginTop: 5,
  },
  resultText: {
    fontSize: 12,
    color: '#616161',
    fontStyle: 'italic',
  },
});

export default ConnectionStatus;