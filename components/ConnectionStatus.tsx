import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated,
  Platform,
  Easing,
  Dimensions
} from 'react-native';
import { getStatusConexao, verificarConexao, sincronizarDados } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface ConnectionStatusProps {
  onConfigPress?: () => void;
  onSyncPress?: () => void;
  compact?: boolean;
}

const { width } = Dimensions.get('window');

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  onConfigPress, 
  onSyncPress,
  compact = false 
}) => {
  const { theme } = useTheme();
  const { COLORS } = theme;

  const [isConnected, setIsConnected] = useState(getStatusConexao());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState({ sincronizados: 0, pendentes: 0 });
  const [isPulsing, setIsPulsing] = useState(false);
  const [isResultVisible, setIsResultVisible] = useState(false);
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const statusBarWidth = useRef(new Animated.Value(0)).current;
  const syncButtonScale = useRef(new Animated.Value(1)).current;
  const syncButtonOpacity = useRef(new Animated.Value(1)).current;
  const statusDetailsHeight = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
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

  // Toggle status details
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: showStatusDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();

    Animated.timing(statusDetailsHeight, {
      toValue: showStatusDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.ease),
    }).start();
  }, [showStatusDetails, rotateAnim, statusDetailsHeight]);

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
      
      // If there's a custom sync handler, use it
      if (onSyncPress) {
        onSyncPress();
      } else {
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
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSyncResult(`Erro: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
      setIsPulsing(false);
    }
  };

  // Renderização compacta (apenas ícones)
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.iconRow}>
          {/* Indicador de status */}
          <Animated.View style={{
            transform: [{ scale: pulseAnim }]
          }}>
            <TouchableOpacity 
              style={[
                styles.statusIconButton,
                isConnected ? styles.connectedIconButton : styles.disconnectedIconButton
              ]}
              onPress={() => setShowStatusDetails(!showStatusDetails)}
            >
              <Feather
                name={isConnected ? "wifi" : "wifi-off"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Botão de sincronização */}
          <Animated.View style={{
            transform: [{ scale: syncButtonScale }],
            opacity: syncButtonOpacity,
            marginLeft: 8
          }}>
            <TouchableOpacity 
              style={[
                styles.syncIconButton, 
                isConnected ? styles.activeSyncButton : styles.inactiveSyncButton
              ]}
              onPress={handleSync}
              disabled={isSyncing || !isConnected}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather 
                  name="refresh-cw" 
                  size={18} 
                  color="#fff" 
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Botão de configuração */}
          <TouchableOpacity 
            style={styles.configIconButton}
            onPress={onConfigPress}
          >
            <Feather 
              name="settings" 
              size={18} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
        </View>

        {/* Detalhes de status (expandível) */}
        <Animated.View style={{
          height: statusDetailsHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 60]
          }),
          opacity: statusDetailsHeight,
          overflow: 'hidden'
        }}>
          <View style={[
            styles.statusDetailsContainer,
            { backgroundColor: isConnected ? 'rgba(46, 125, 50, 0.1)' : 'rgba(198, 40, 40, 0.1)' }
          ]}>
            <Text style={[
              styles.statusDetailsText,
              { color: isConnected ? COLORS.success : COLORS.error }
            ]}>
              {isConnected ? 'Conectado ao servidor' : 'Modo offline - sem conexão'}
            </Text>
            
            {syncStats.pendentes > 0 && (
              <Text style={styles.pendingText}>
                {syncStats.pendentes} {syncStats.pendentes === 1 ? 'item pendente' : 'itens pendentes'}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Mensagem de resultado */}
        {isResultVisible && (
          <Animated.View 
            style={[
              styles.compactResultContainer,
              { opacity: resultOpacity }
            ]}
          >
            <Text style={[
              styles.compactResultText,
              syncResult && syncResult.includes('Erro') ? styles.errorResultText : 
              syncResult && syncResult.includes('Falha') ? styles.errorResultText : 
              styles.successResultText
            ]}>
              {syncResult}
            </Text>
          </Animated.View>
        )}
      </View>
    );
  }

  // Renderização completa (design original com melhorias)
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
          <View style={styles.statusContent}>
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
          </View>
          
          <TouchableOpacity 
            style={styles.configButton}
            onPress={onConfigPress}
          >
            <Feather name="settings" size={16} color="#fff" />
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
              <View style={styles.syncButtonContent}>
                <Feather 
                  name="refresh-cw" 
                  size={16} 
                  color="#fff" 
                  style={styles.syncIcon} 
                />
                <Text style={styles.syncText}>
                  {syncStats.pendentes > 0 
                    ? `Sincronizar (${syncStats.pendentes} pendentes)` 
                    : 'Sincronizar'}
                </Text>
              </View>
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
  // Estilos para a versão compacta (apenas ícones)
  compactContainer: {
    marginVertical: 5,
    alignItems: 'center',
    width: '100%',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
  },
  statusIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  connectedIconButton: {
    backgroundColor: '#43A047',
  },
  disconnectedIconButton: {
    backgroundColor: '#E53935',
  },
  syncIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  activeSyncButton: {
    backgroundColor: '#1976D2',
  },
  inactiveSyncButton: {
    backgroundColor: '#757575',
  },
  configIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginLeft: 8,
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
  statusDetailsContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    width: '95%',
    alignSelf: 'center',
  },
  statusDetailsText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  pendingText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    color: '#FF6F00',
  },
  compactResultContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  compactResultText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#fff',
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
  // Estilos para a versão original melhorada
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 30,
  },
  statusContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedStatus: {
    // Estilos adicionais para status conectado
  },
  disconnectedStatus: {
    // Estilos adicionais para status desconectado
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
  syncButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncIcon: {
    marginRight: 8,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  androidShadow: {
    elevation: 4,
  },
  syncingButton: {
    backgroundColor: '#0288D1',
  },
  connectedSyncButton: {
    backgroundColor: '#1565C0',
  },
  disconnectedSyncButton: {
    backgroundColor: '#757575',
  },
  syncText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultContainer: {
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  successResultText: {
    color: '#2E7D32',
  },
  errorResultText: {
    color: '#C62828',
  },
});

export default ConnectionStatus;