import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated,
  Platform,
  Easing
} from 'react-native';
import { getStatusConexao, verificarConexao, sincronizarDados } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

interface ConnectionStatusProps {
  onConfigPress?: () => void;
}

// Define colors
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

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const statusBarWidth = useRef(new Animated.Value(0)).current;
  const syncButtonScale = useRef(new Animated.Value(1)).current;
  const syncButtonOpacity = useRef(new Animated.Value(1)).current;
  
  // Initial appear animation
  useEffect(() => {
    Animated.spring(statusBarWidth, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: false, // We're animating width which requires non-native
    }).start();
  }, []);

  useEffect(() => {
    // Check connection when component mounts
    const checkConnection = async () => {
      const connected = await verificarConexao();
      setIsConnected(connected);
    };
    
    checkConnection();
    
    // Check connection every 30 seconds
    const intervalId = setInterval(checkConnection, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Show and hide result with animation
    if (syncResult) {
      setIsResultVisible(true);
      
      Animated.sequence([
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.delay(2500),
        Animated.timing(resultOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        })
      ]).start(() => {
        setIsResultVisible(false);
        setSyncResult(null);
      });
    }
  }, [syncResult, resultOpacity]);

  // Animate the status indicator
  useEffect(() => {
    if (isPulsing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          })
        ])
      ).start();
    } else {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    }
  }, [isPulsing, pulseAnim]);

  const handleSync = async () => {
    if (isSyncing) return;
    
    // Button press animation
    Animated.sequence([
      Animated.timing(syncButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(syncButtonScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(2)),
      })
    ]).start();
    
    try {
      setIsSyncing(true);
      setIsPulsing(true);
      setSyncResult(null);
      
      // Check connection first
      const connected = await verificarConexao();
      setIsConnected(connected);
      
      if (!connected) {
        setSyncResult('Sem conexão com o servidor');
        return;
      }
      
      // Try to sync
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
      <Animated.View style={[
        styles.statusContainer,
        { 
          width: statusBarWidth.interpolate({
            inputRange: [0, 1],
            outputRange: ['50%', '100%']
          }),
          opacity: statusBarWidth
        }
      ]}>
        <LinearGradient
          colors={isConnected ? ['#43A047', '#2E7D32'] : ['#E53935', '#C62828']} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.statusGradient,
            isConnected ? styles.connectedStatus : styles.disconnectedStatus
          ]}
        >
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
        </LinearGradient>
      </Animated.View>
      
      <View style={styles.syncContainer}>
        <Animated.View style={{
          transform: [{ scale: syncButtonScale }],
          opacity: syncButtonOpacity
        }}>
          <TouchableOpacity 
            style={[
              styles.syncButton, 
              isSyncing ? styles.syncingButton : (isConnected ? styles.connectedSyncButton : styles.disconnectedSyncButton),
              Platform.OS === 'ios' ? styles.iosShadow : styles.androidShadow
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
        </Animated.View>
        
        {isResultVisible && (
          <Animated.View 
            style={[
              styles.resultContainer,
              { opacity: resultOpacity },
              Platform.OS === 'ios' ? styles.iosShadow : styles.androidShadow
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
    alignItems: 'center',
  },
  statusContainer: {
    marginHorizontal: 15,
    marginBottom: 5,
    borderRadius: 30,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 30,
  },
  connectedStatus: {
    // Additional styles for connected status
  },
  disconnectedStatus: {
    // Additional styles for disconnected status
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  connectedIndicator: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 4,
  },
  disconnectedIndicator: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 4,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '600',
  },
  configButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
  },
  configText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '600',
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
  },
  iosShadow: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  androidShadow: {
    elevation: 4,
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
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderRadius: 15,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  successResultText: {
    color: COLORS.success,
  },
  errorResultText: {
    color: COLORS.error,
  },
});

export default ConnectionStatus;