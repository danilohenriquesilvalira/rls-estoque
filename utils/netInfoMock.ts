// Mock para substituir @react-native-community/netinfo em ambientes web
// Este arquivo imita a funcionalidade básica do NetInfo para que o código funcione na web

interface NetInfoState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  details: any;
}

// Estado padrão - assume conectado
const defaultState: NetInfoState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
  details: {
    isConnectionExpensive: false,
    ipAddress: '192.168.1.1',
  }
};

// Função para buscar estado da rede (sempre retorna o estado padrão)
const fetch = async (): Promise<NetInfoState> => {
  return defaultState;
};

// Função para adicionar ouvinte de evento (não faz nada no mock)
const addEventListener = (
  eventName: string,
  listener: (state: NetInfoState) => void
): (() => void) => {
  // Retorna função para remover ouvinte (também não faz nada)
  return () => {};
};

export default {
  fetch,
  addEventListener,
  useNetInfo: () => defaultState
};