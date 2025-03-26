// services/api.ts - Cliente para conectar com a API backend (VERSÃO CORRIGIDA COMPLETA)

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfoMock from '../utils/netInfoMock';

// Usar o mock em vez da importação real
const NetInfo = NetInfoMock;

// CONFIGURAÇÃO
// Porta padrão da API Go
const DEFAULT_PORT = '8080';

// DEBUG: Ative para mais informações nos logs
const DEBUG = true;

// Função para log de depuração
const log = (message: string, data?: any) => {
  if (DEBUG) {
    if (data) {
      console.log(`[API] ${message}`, data);
    } else {
      console.log(`[API] ${message}`);
    }
  }
};

// Tipos de dados
export interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
  localizacao?: string;
  fornecedor?: string;
  notas?: string;
  data_criacao?: string;
  data_atualizacao?: string;
}

export interface Movimentacao {
  id?: number;
  produto_id: number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  notas?: string;
  data_movimentacao?: string;
  produto_codigo?: string;
  produto_nome?: string;
}

export interface Configuracao {
  id?: number;
  chave: string;
  valor: string;
  descricao?: string;
  data_atualizacao?: string;
}

export interface DashboardData {
  total_produtos: number;
  total_itens: number;
  estoque_baixo: number;
  ultimas_movimentacoes: MovimentacaoView[];
  top_produtos: ProdutoView[];
}

export interface MovimentacaoView {
  id?: number;
  tipo: string;
  quantidade: number;
  data_movimentacao: string;
  notas?: string;
  produto_codigo: string;
  produto_nome: string;
}

export interface ProdutoView {
  codigo: string;
  nome: string;
  quantidade: number;
}

// Variáveis de estado de conexão
let modoOffline = true; // Inicia como offline até confirmar conexão
let servidorAtual = ''; // IP do servidor atual que está funcionando
let portaAtual = DEFAULT_PORT;
let lastDetectedServer = ''; // Último servidor detectado com sucesso
let servidorDetectionInProgress = false;

// Função para inicializar com o servidor Tailscale
const inicializarServidorTailscale = async () => {
  try {
    // Verificar se já temos um servidor configurado
    const serverIp = await AsyncStorage.getItem('@server_ip');
    
    // Se não tiver nenhum servidor configurado, usar o Tailscale IP
    if (!serverIp) {
      log('Configurando servidor Tailscale por padrão');
      const tailscaleIp = '100.77.52.45'; // IP do seu PC com Tailscale
      
      await AsyncStorage.setItem('@server_ip', tailscaleIp);
      await AsyncStorage.setItem('@server_port', DEFAULT_PORT);
      
      servidorAtual = tailscaleIp;
      portaAtual = DEFAULT_PORT;
      
      log(`Servidor Tailscale configurado: ${tailscaleIp}:${DEFAULT_PORT}`);
    }
  } catch (error) {
    log('Erro ao inicializar servidor Tailscale:', error);
  }
};

// Chamar a função de inicialização imediatamente
inicializarServidorTailscale();

// Status da conexão
export const getStatusConexao = () => {
  return !modoOffline;
};

// Função para obter a URL da API
const getApiUrl = async () => {
  try {
    // Se temos um servidor detectado e funcionando, use-o
    if (servidorAtual && portaAtual) {
      return `http://${servidorAtual}:${portaAtual}/api`;
    }
    
    // Tentar ler o IP das configurações salvas
    const serverIp = await AsyncStorage.getItem('@server_ip');
    const serverPort = await AsyncStorage.getItem('@server_port') || DEFAULT_PORT;
    
    if (serverIp) {
      servidorAtual = serverIp;
      portaAtual = serverPort;
      return `http://${serverIp}:${serverPort}/api`;
    }
    
    // Se não temos servidor configurado, e já temos um último detectado, use-o
    if (lastDetectedServer) {
      servidorAtual = lastDetectedServer;
      return `http://${lastDetectedServer}:${portaAtual}/api`;
    }
    
    // Caso não tenhamos um servidor configurado, iniciar detecção automática na próxima verificação
    return `http://auto-detect:${portaAtual}/api`;
  } catch (error) {
    console.log('[API] Erro ao obter configuração do servidor:', error);
    return `http://auto-detect:${portaAtual}/api`;
  }
};

// Função para testar conexão com um servidor específico
const testServerConnection = async (ip: string, port: string, timeout = 2000): Promise<boolean> => {
  try {
    log(`Testando servidor em: ${ip}:${port}`);
    
    // Criar um controller para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Tentar fazer uma requisição simples
    const response = await fetch(`http://${ip}:${port}/api/produtos?limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Se conseguiu conectar, armazenar como último servidor detectado
    if (response.ok) {
      log(`✅ Servidor encontrado e respondendo em ${ip}:${port}`);
      lastDetectedServer = ip;
      servidorAtual = ip;
      portaAtual = port;
      
      // Salvar configuração para uso futuro
      await AsyncStorage.setItem('@server_ip', ip);
      await AsyncStorage.setItem('@server_port', port);
      
      return true;
    }
    
    log(`❌ Servidor em ${ip}:${port} respondeu, mas com erro: ${response.status}`);
    return false;
  } catch (error) {
    // Ignorar erros de timeout (AbortError) - é esperado quando testando IPs que não respondem
    if (error instanceof Error && error.name !== 'AbortError') {
      log(`Erro ao testar servidor ${ip}:${port}: ${error.message}`);
    }
    return false;
  }
};

// Função para escanear toda a rede em busca do servidor
const scanNetwork = async (networkPrefix: string): Promise<boolean> => {
  log(`Escaneando rede ${networkPrefix}.* em busca do servidor...`);
  
  // Escanear os IPs mais prováveis primeiro (geralmente roteadores e servidores)
  const priorityIPs = [1, 2, 3, 4, 5, 100, 101, 150, 200, 254];
  
  for (const lastOctet of priorityIPs) {
    const ip = `${networkPrefix}.${lastOctet}`;
    const connected = await testServerConnection(ip, DEFAULT_PORT, 1000);
    if (connected) return true;
  }
  
  // Criar batches de IPs para processar em paralelo para agilizar a descoberta
  // mas sem sobrecarregar a rede ou o dispositivo
  const batchSize = 10;
  const startingBatch = 1;
  const endingBatch = 25; // Cobrir 250 IPs em batches
  
  for (let batchStart = startingBatch; batchStart <= endingBatch; batchStart++) {
    const batchPromises = [];
    
    // Criar um batch de promessas de teste de conexão
    for (let i = 0; i < batchSize; i++) {
      const lastOctet = (batchStart - 1) * batchSize + i + 1;
      if (lastOctet > 254 || priorityIPs.includes(lastOctet)) continue; // Pular IPs já testados ou inválidos
      
      const ip = `${networkPrefix}.${lastOctet}`;
      batchPromises.push(testServerConnection(ip, DEFAULT_PORT, 800));
    }
    
    // Executar este batch em paralelo
    const results = await Promise.all(batchPromises);
    
    // Se algum teste conectou, retornar sucesso
    if (results.some(result => result === true)) {
      return true;
    }
  }
  
  return false;
};

// Função para detectar o servidor automaticamente na rede
const detectarServidorAutomatico = async (): Promise<boolean> => {
  if (servidorDetectionInProgress) {
    log('Detecção de servidor já está em andamento');
    return false;
  }
  
  try {
    servidorDetectionInProgress = true;
    log('Iniciando detecção automática de servidores...');
    
    // Primeiro, tentar usar o servidor salvo anteriormente
    if (lastDetectedServer) {
      log(`Tentando reconectar ao último servidor conhecido: ${lastDetectedServer}`);
      const conectado = await testServerConnection(lastDetectedServer, DEFAULT_PORT);
      if (conectado) {
        log(`Reconectado ao servidor anterior: ${lastDetectedServer}`);
        servidorDetectionInProgress = false;
        return true;
      }
    }
    
    // Tentar obter o IP do próprio dispositivo
    const netInfo = await NetInfo.fetch();
    if (netInfo.details && 'ipAddress' in netInfo.details) {
      const deviceIp = netInfo.details.ipAddress;
      if (deviceIp) {
        log(`IP do dispositivo: ${deviceIp}, detectando servidores na mesma rede`);
        
        // Extrair o prefixo da rede (primeiros 3 octetos do IP)
        const ipParts = deviceIp.split('.');
        if (ipParts.length === 4) {
          const networkPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
          
          // Escanear toda a rede
          const serverEncontrado = await scanNetwork(networkPrefix);
          
          if (serverEncontrado) {
            log(`Servidor encontrado e salvo: ${servidorAtual}:${portaAtual}`);
            servidorDetectionInProgress = false;
            return true;
          }
        }
      }
    }
    
    // Redes comuns para tentar caso não tenha informações de IP
    const commonNetworks = ['192.168.1', '192.168.0', '10.0.0', '10.0.1', '172.16.0'];
    
    for (const network of commonNetworks) {
      log(`Tentando rede comum: ${network}.*`);
      const serverEncontrado = await scanNetwork(network);
      if (serverEncontrado) {
        log(`Servidor encontrado em rede comum: ${servidorAtual}:${portaAtual}`);
        servidorDetectionInProgress = false;
        return true;
      }
    }
    
    log('Detecção automática finalizada: nenhum servidor encontrado');
    servidorDetectionInProgress = false;
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro na detecção automática:', errorMessage);
    servidorDetectionInProgress = false;
    return false;
  }
};

// Verificar status da conexão
export const verificarConexao = async (): Promise<boolean> => {
  try {
    // Verificar se temos conectividade de internet primeiro
    const netInfoState = await NetInfo.fetch();
    // Garantir que isConnected é um boolean
    const isConnected: boolean = typeof netInfoState.isConnected === 'string'
      ? netInfoState.isConnected === 'true'
      : Boolean(netInfoState.isConnected);
      
    if (!isConnected) {
      log('Sem conexão com a internet, modo offline ativado');
      modoOffline = true;
      return false;
    }
    
    log('Conexão com internet detectada, verificando servidor...');
    
    // Obter URL da API configurada
    let apiUrl = await getApiUrl();
    
    // Se for modo de detecção automática
    if (apiUrl.includes('auto-detect')) {
      log('Modo de detecção automática ativado, procurando servidor na rede...');
      const servidorEncontrado = await detectarServidorAutomatico();
      
      if (servidorEncontrado) {
        apiUrl = await getApiUrl(); // Obter a nova URL após a detecção
      } else {
        log('Nenhum servidor encontrado automaticamente');
        modoOffline = true;
        return false;
      }
    }
    
    log(`Verificando conexão com o servidor em: ${apiUrl}`);
    
    // Adicionar timeout para não travar em casos de servidor indisponível
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Tentar fazer uma requisição simples
    try {
      const response = await fetch(`${apiUrl}/produtos?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Logar detalhes da resposta para diagnóstico
      log('Resposta do servidor:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      // Se a requisição foi bem-sucedida, estamos online
      const novoModoOffline = !response.ok;
      modoOffline = novoModoOffline;
      
      if (!modoOffline) {
        log('✅ Conexão estabelecida com o servidor!');
        await AsyncStorage.setItem('@ultimo_acesso_online', new Date().toISOString());
      } else {
        log('❌ Falha na conexão com o servidor, resposta não OK');
      }
      
      return !modoOffline;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Se o erro for de abort (timeout), tentar novamente com detecção automática
      if (error instanceof Error && error.name === 'AbortError') {
        log('⚠️ Timeout ao conectar com o servidor configurado, tentando detecção automática...');
        const servidorEncontrado = await detectarServidorAutomatico();
        
        if (servidorEncontrado) {
          // Tentar conectar novamente com o servidor recém-detectado
          return await verificarConexao();
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('❌ Erro ao verificar conexão:', errorMessage);
      modoOffline = true;
      log('Modo offline ativado devido ao erro de conexão');
      return false;
    }
  } catch (error) {
    // Se houve erro, estamos offline
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('❌ Erro ao verificar conexão:', errorMessage);
    modoOffline = true;
    log('Modo offline ativado devido ao erro de conexão');
    return false;
  }
};

// VALIDAÇÕES DE SEGURANÇA

// Validar código de produto (evitar duplicatas)
export const validarCodigoProduto = async (codigo: string, idExcluir?: number): Promise<boolean> => {
  try {
    // Verificar se o código é válido
    if (!codigo || codigo.trim() === '') {
      return false;
    }
    
    // Buscar produtos locais
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    // Verificar se já existe produto com este código (excluindo o ID atual se fornecido)
    const produtoExistente = produtos.find(p => 
      p.codigo === codigo && (idExcluir === undefined || p.id !== idExcluir)
    );
    
    return !produtoExistente; // Retorna true se não existir (é válido)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao validar código de produto:', errorMessage);
    return false;
  }
};

// Validar nome de produto (evitar vazio)
export const validarNomeProduto = (nome: string): boolean => {
  return nome.trim() !== '';
};

// Validar quantidade (deve ser não-negativa)
export const validarQuantidade = (quantidade: number): boolean => {
  return !isNaN(quantidade) && quantidade >= 0;
};

// Funções para interagir com a API de Produtos

export const getProdutos = async (): Promise<Produto[]> => {
  try {
    log('Buscando lista de produtos...');
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos = produtosJson ? JSON.parse(produtosJson) : [];
      log(`Produtos carregados do cache (${produtos.length})`);
      return produtos;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/produtos`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar produtos: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      log(`Produtos recebidos do servidor (${data.length})`);
      
      // Armazenar no AsyncStorage para uso offline
      await AsyncStorage.setItem('produtos', JSON.stringify(data));
      log('Produtos salvos no cache para uso offline');
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao buscar produtos:', errorMessage);
    
    // Tentar usar dados locais
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos = produtosJson ? JSON.parse(produtosJson) : [];
    log(`Usando dados em cache após erro (${produtos.length})`);
    return produtos;
  }
};

export const getProduto = async (id: number): Promise<Produto | null> => {
  try {
    log(`Buscando produto com ID: ${id}`);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      const produto = produtos.find(p => p.id === id);
      log(produto ? `Produto encontrado no cache: ${produto.nome}` : 'Produto não encontrado no cache');
      return produto || null;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${apiUrl}/produtos/${id}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          log(`Produto não encontrado no servidor (ID: ${id})`);
          return null;
        }
        throw new Error(`Erro ao buscar produto: ${response.status} ${response.statusText}`);
      }
      
      const produto = await response.json();
      log(`Produto recebido do servidor: ${produto.nome}`);
      
      // Atualizar cache local
      const produtosJson = await AsyncStorage.getItem('produtos');
      if (produtosJson) {
        const produtos: Produto[] = JSON.parse(produtosJson);
        const index = produtos.findIndex(p => p.id === id);
        if (index !== -1) {
          produtos[index] = produto;
          await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
          log('Cache local atualizado com o produto mais recente');
        }
      }
      
      return produto;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao buscar produto com ID ${id}:`, errorMessage);
    
    // Tentar usar dados locais
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    const produto = produtos.find(p => p.id === id);
    log(produto ? `Usando produto do cache após erro: ${produto.nome}` : 'Produto não encontrado no cache');
    return produto || null;
  }
};

export const getProdutoPorCodigo = async (codigo: string): Promise<Produto | null> => {
  try {
    log(`Buscando produto com código: ${codigo}`);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      const produto = produtos.find(p => p.codigo === codigo);
      log(produto ? `Produto encontrado no cache: ${produto.nome}` : 'Produto não encontrado no cache');
      return produto || null;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${apiUrl}/produtos/codigo/${codigo}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          log(`Produto não encontrado no servidor (código: ${codigo})`);
          return null;
        }
        throw new Error(`Erro ao buscar produto: ${response.status} ${response.statusText}`);
      }
      
      const produto = await response.json();
      log(`Produto recebido do servidor: ${produto.nome}`);
      
      // Atualizar cache local
      const produtosJson = await AsyncStorage.getItem('produtos');
      if (produtosJson) {
        const produtos: Produto[] = JSON.parse(produtosJson);
        const index = produtos.findIndex(p => p.codigo === codigo);
        if (index !== -1) {
          produtos[index] = produto;
          await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
          log('Cache local atualizado com o produto mais recente');
        } else {
          // Adicionar o novo produto ao cache
          produtos.push(produto);
          await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
          log('Novo produto adicionado ao cache local');
        }
      }
      
      return produto;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao buscar produto com código ${codigo}:`, errorMessage);
    
    // Tentar usar dados locais
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    const produto = produtos.find(p => p.codigo === codigo);
    log(produto ? `Usando produto do cache após erro: ${produto.nome}` : 'Produto não encontrado no cache');
    return produto || null;
  }
};

export const criarProduto = async (produto: Produto): Promise<Produto> => {
  try {
    log('Criando novo produto:', produto);
    
    // Validações de segurança
    if (!validarNomeProduto(produto.nome)) {
      throw new Error('Nome do produto é obrigatório');
    }
    
    if (!validarQuantidade(produto.quantidade)) {
      throw new Error('Quantidade deve ser um número não-negativo');
    }
    
    const codigoValido = await validarCodigoProduto(produto.codigo);
    if (!codigoValido) {
      throw new Error('Código já está em uso ou é inválido');
    }
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: salvando localmente para sincronizar depois');
      // Salvar localmente para sincronizar depois
  const produtosJson = await AsyncStorage.getItem('produtos');
  const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
  
  // Gerar ID temporário
  produto.id = Date.now();
  produto.data_criacao = new Date().toISOString();
  
  // Adicionar à lista
  produtos.push(produto);
  
  // Salvar no AsyncStorage
  await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
  log(`Produto salvo localmente. ID Temp: ${produto.id}`);
  
  // Adicionar à fila de sincronização
  const syncQueueJson = await AsyncStorage.getItem('sync_queue');
  const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
  
  syncQueue.push({
    tipo: 'criar_produto',
    dados: produto,
    data: new Date().toISOString(),
  });
  
  await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
  log('Produto adicionado à fila de sincronização');
  
  // REMOVER OU COMENTAR ESTE BLOCO:
  // Se a quantidade inicial for maior que zero, registrar movimentação
  // if (produto.quantidade > 0) {
  //   registrarMovimentacaoLocal(produto.id, 'entrada', produto.quantidade, 'Estoque inicial');
  // }
  
  return produto;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para criar produto no servidor');
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/produtos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(produto),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let mensagemErro = 'Erro ao criar produto';
        try {
          const errorData = await response.json();
          mensagemErro = errorData.error || `Erro ao criar produto: ${response.status} ${response.statusText}`;
        } catch (e) {
          mensagemErro = `Erro ao criar produto: ${response.status} ${response.statusText}`;
        }
        throw new Error(mensagemErro);
      }
      
      const novoProduto = await response.json();
      log('Produto criado com sucesso no servidor:', novoProduto);
      
      // Atualizar cache local
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      produtos.push(novoProduto);
      await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
      log('Cache local atualizado com o novo produto');
      
      return novoProduto;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao criar produto:', errorMessage);
    
    // Se o erro for de timeout ou conexão, salvar localmente e adicionar à fila
    if ((errorMessage.includes('timeout') || 
         errorMessage.includes('abort') || 
         errorMessage.includes('network') ||
         errorMessage.includes('Failed to fetch')) && 
        errorMessage !== 'Código já está em uso ou é inválido' &&
        errorMessage !== 'Nome do produto é obrigatório' &&
        errorMessage !== 'Quantidade deve ser um número não-negativo') {
      
      log('Erro de conexão ao criar produto, salvando localmente');
      
      // Gerar ID temporário
      produto.id = Date.now();
      produto.data_criacao = new Date().toISOString();
      
      // Salvar localmente
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      produtos.push(produto);
      await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
      
      // Adicionar à fila de sincronização
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      syncQueue.push({
        tipo: 'criar_produto',
        dados: produto,
        data: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
      log('Produto salvo localmente e adicionado à fila de sincronização após erro de conexão');
      
      // Registrar movimentação se necessário
      if (produto.quantidade > 0) {
        registrarMovimentacaoLocal(produto.id, 'entrada', produto.quantidade, 'Estoque inicial');
      }
      
      return produto;
    }
    
    throw error;
  }
};

export const atualizarProduto = async (id: number, produto: Produto): Promise<Produto> => {
  try {
    log(`Atualizando produto ID: ${id}`, produto);
    
    // Validações de segurança
    if (!validarNomeProduto(produto.nome)) {
      throw new Error('Nome do produto é obrigatório');
    }
    
    if (!validarQuantidade(produto.quantidade)) {
      throw new Error('Quantidade deve ser um número não-negativo');
    }
    
    const codigoValido = await validarCodigoProduto(produto.codigo, id);
    if (!codigoValido) {
      throw new Error('Código já está em uso por outro produto');
    }
    
    // Obter produto atual para detectar mudanças de quantidade
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    const produtoAtual = produtos.find(p => p.id === id);
    const quantidadeAnterior = produtoAtual ? produtoAtual.quantidade : 0;
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: salvando localmente para sincronizar depois');
      
      // Encontrar e atualizar o produto
      const index = produtos.findIndex(p => p.id === id);
      if (index === -1) {
        log(`Produto não encontrado localmente (ID: ${id})`);
        throw new Error('Produto não encontrado');
      }
      
      // Verificar mudança na quantidade
      const diferencaQuantidade = produto.quantidade - quantidadeAnterior;
      
      // Atualizar dados
      produto.id = id;
      produto.data_atualizacao = new Date().toISOString();
      produtos[index] = produto;
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
      log('Produto atualizado localmente');
      
      // Adicionar à fila de sincronização
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      syncQueue.push({
        tipo: 'atualizar_produto',
        id,
        dados: produto,
        data: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
      log('Produto adicionado à fila de sincronização para atualização');
      
      // Registrar movimentação se houver mudança na quantidade
      if (diferencaQuantidade !== 0) {
        if (diferencaQuantidade > 0) {
          registrarMovimentacaoLocal(id, 'entrada', diferencaQuantidade, 'Ajuste manual');
        } else {
          registrarMovimentacaoLocal(id, 'saida', Math.abs(diferencaQuantidade), 'Ajuste manual');
        }
      }
      
      return produto;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para atualizar produto no servidor');
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/produtos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(produto),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let mensagemErro = 'Erro ao atualizar produto';
        try {
          const errorData = await response.json();
          mensagemErro = errorData.error || `Erro ao atualizar produto: ${response.status} ${response.statusText}`;
        } catch (e) {
          mensagemErro = `Erro ao atualizar produto: ${response.status} ${response.statusText}`;
        }
        throw new Error(mensagemErro);
      }
      
      const produtoAtualizado = await response.json();
      log('Produto atualizado com sucesso no servidor:', produtoAtualizado);
      
      // Atualizar cache local
      const index = produtos.findIndex(p => p.id === id);
      if (index !== -1) {
        produtos[index] = produtoAtualizado;
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        log('Cache local atualizado com o produto modificado');
      }
      
      return produtoAtualizado;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao atualizar produto ID ${id}:`, errorMessage);
    
    // Se o erro for de conexão, salvar localmente
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('abort') || 
        errorMessage.includes('network') ||
        errorMessage.includes('Failed to fetch')) {
      
      log('Erro de conexão ao atualizar produto, salvando localmente');
      
      // Processamento offline
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      
      // Encontrar o produto
      const index = produtos.findIndex(p => p.id === id);
      if (index !== -1) {
        // Verificar mudança na quantidade
        const quantidadeAnterior = produtos[index].quantidade;
        const diferencaQuantidade = produto.quantidade - quantidadeAnterior;
        
        // Atualizar dados
        produto.id = id;
        produto.data_atualizacao = new Date().toISOString();
        produtos[index] = produto;
        
        // Salvar no AsyncStorage
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        
        // Adicionar à fila de sincronização
        const syncQueueJson = await AsyncStorage.getItem('sync_queue');
        const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
        
        syncQueue.push({
          tipo: 'atualizar_produto',
          id,
          dados: produto,
          data: new Date().toISOString(),
        });
        
        await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        // Registrar movimentação se houver mudança na quantidade
        if (diferencaQuantidade !== 0) {
          if (diferencaQuantidade > 0) {
            registrarMovimentacaoLocal(id, 'entrada', diferencaQuantidade, 'Ajuste manual');
          } else {
            registrarMovimentacaoLocal(id, 'saida', Math.abs(diferencaQuantidade), 'Ajuste manual');
          }
        }
        
        log('Produto atualizado localmente após erro de conexão');
        return produto;
      }
    }
    
    throw error;
  }
};

export const deletarProduto = async (id: number): Promise<void> => {
  try {
    log(`Excluindo produto ID: ${id}`);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: removendo localmente para sincronizar depois');
      // Remover localmente para sincronizar depois
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      
      // Verificar se o produto existe
      const index = produtos.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error('Produto não encontrado');
      }
      
      // Remover o produto
      const produtoRemovido = produtos[index];
      produtos.splice(index, 1);
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
      log('Produto removido localmente');
      
      // Adicionar à fila de sincronização
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      syncQueue.push({
        tipo: 'deletar_produto',
        id,
        data: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
      log('Exclusão adicionada à fila de sincronização');
      
      // Remover movimentações locais deste produto
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      if (movimentacoesJson) {
        const movimentacoes: Movimentacao[] = JSON.parse(movimentacoesJson);
        const novasMovimentacoes = movimentacoes.filter(m => m.produto_id !== id);
        await AsyncStorage.setItem('movimentacoes', JSON.stringify(novasMovimentacoes));
        log(`Removidas ${movimentacoes.length - novasMovimentacoes.length} movimentações do produto`);
      }
      
      return;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para excluir produto no servidor');
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/produtos/${id}`, {
        method: 'DELETE',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let mensagemErro = 'Erro ao excluir produto';
        try {
          const errorData = await response.json();
          mensagemErro = errorData.error || `Erro ao excluir produto: ${response.status} ${response.statusText}`;
        } catch (e) {
          mensagemErro = `Erro ao excluir produto: ${response.status} ${response.statusText}`;
        }
        throw new Error(mensagemErro);
      }
      
      log('Produto excluído com sucesso no servidor');
      
      // Atualizar cache local
      const produtosJson = await AsyncStorage.getItem('produtos');
      if (produtosJson) {
        const produtos: Produto[] = JSON.parse(produtosJson);
        const novoProdutos = produtos.filter(p => p.id !== id);
        await AsyncStorage.setItem('produtos', JSON.stringify(novoProdutos));
        log('Cache local atualizado após exclusão');
      }
      
      // Remover movimentações locais deste produto
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      if (movimentacoesJson) {
        const movimentacoes: Movimentacao[] = JSON.parse(movimentacoesJson);
        const novasMovimentacoes = movimentacoes.filter(m => m.produto_id !== id);
        await AsyncStorage.setItem('movimentacoes', JSON.stringify(novasMovimentacoes));
        log(`Removidas movimentações do produto localmente`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Se o erro for de conexão, salvar para sincronização posterior
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || 
          errorMessage.includes('abort') || 
          errorMessage.includes('network') ||
          errorMessage.includes('Failed to fetch')) {
        
        log('Erro de conexão ao excluir produto, processando offline');
        
        // Remover localmente
        const produtosJson = await AsyncStorage.getItem('produtos');
        const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
        
        // Verificar se o produto existe
        const index = produtos.findIndex(p => p.id === id);
        if (index === -1) {
          throw new Error('Produto não encontrado');
        }
        
        // Remover o produto
        produtos.splice(index, 1);
        
        // Salvar no AsyncStorage
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        
        // Adicionar à fila de sincronização
        const syncQueueJson = await AsyncStorage.getItem('sync_queue');
        const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
        
        syncQueue.push({
          tipo: 'deletar_produto',
          id,
          data: new Date().toISOString(),
        });
        
        await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        // Remover movimentações locais deste produto
        const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
        if (movimentacoesJson) {
          const movimentacoes: Movimentacao[] = JSON.parse(movimentacoesJson);
          const novasMovimentacoes = movimentacoes.filter(m => m.produto_id !== id);
          await AsyncStorage.setItem('movimentacoes', JSON.stringify(novasMovimentacoes));
        }
        
        log('Produto removido localmente e adicionado à fila de sincronização');
        return;
      }
      
      throw error; // Repassar outros erros
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao excluir produto ID ${id}:`, errorMessage);
    throw error;
  }
};

// Funções para interagir com a API de Movimentações

export const getMovimentacoes = async (): Promise<Movimentacao[]> => {
  try {
    log('Buscando lista de movimentações...');
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const movimentacoes = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      log(`Movimentações carregadas do cache (${movimentacoes.length})`);
      return movimentacoes;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/movimentacoes`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar movimentações: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      log(`Movimentações recebidas do servidor (${data.length})`);
      
      // Armazenar no AsyncStorage para uso offline
      await AsyncStorage.setItem('movimentacoes', JSON.stringify(data));
      log('Movimentações salvas no cache para uso offline');
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao buscar movimentações:', errorMessage);
    
    // Tentar usar dados locais
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const movimentacoes = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    log(`Usando dados em cache após erro (${movimentacoes.length})`);
    return movimentacoes;
  }
};

export const getMovimentacoesPorProduto = async (produtoId: number): Promise<Movimentacao[]> => {
  try {
    log(`Buscando movimentações do produto ID: ${produtoId}`);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      const movProduto = movimentacoes.filter(m => m.produto_id === produtoId);
      log(`Movimentações encontradas no cache (${movProduto.length})`);
      return movProduto;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/movimentacoes/produto/${produtoId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar movimentações: ${response.status} ${response.statusText}`);
      }
      
      const movimentacoes = await response.json();
      log(`Movimentações recebidas do servidor (${movimentacoes.length})`);
      
      // Armazenar no AsyncStorage para uso offline
      // Primeiro, obter todas as movimentações existentes
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const todasMovimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      
      // Remover movimentações deste produto
      const semEsseProduto = todasMovimentacoes.filter(m => m.produto_id !== produtoId);
      
      // Adicionar as movimentações atualizadas
      const novasMovimentacoes = [...semEsseProduto, ...movimentacoes];
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('movimentacoes', JSON.stringify(novasMovimentacoes));
      log('Cache local atualizado com as movimentações do produto');
      
      return movimentacoes;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao buscar movimentações do produto ID ${produtoId}:`, errorMessage);
    
    // Tentar usar dados locais
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    const movProduto = movimentacoes.filter(m => m.produto_id === produtoId);
    log(`Usando dados em cache após erro (${movProduto.length})`);
    return movProduto;
  }
};

// Função auxiliar para registrar movimentação localmente
const registrarMovimentacaoLocal = async (
  produtoId: number, 
  tipo: 'entrada' | 'saida', 
  quantidade: number, 
  notas?: string
): Promise<Movimentacao> => {
  // Criar nova movimentação
  const novaMovimentacao: Movimentacao = {
    id: Date.now(), // ID temporário
    produto_id: produtoId,
    tipo,
    quantidade,
    notas,
    data_movimentacao: new Date().toISOString()
  };
  
  // Buscar produto para dados adicionais
  const produtosJson = await AsyncStorage.getItem('produtos');
  const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
  const produto = produtos.find(p => p.id === produtoId);
  
  if (produto) {
    novaMovimentacao.produto_codigo = produto.codigo;
    novaMovimentacao.produto_nome = produto.nome;
  }
  
  // Adicionar à lista de movimentações
  const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
  const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
  movimentacoes.push(novaMovimentacao);
  
  // Salvar no AsyncStorage
  await AsyncStorage.setItem('movimentacoes', JSON.stringify(movimentacoes));
  log(`Movimentação local registrada: ${tipo} de ${quantidade} unidades do produto ${produtoId}`);
  
  // Adicionar à fila de sincronização
  const syncQueueJson = await AsyncStorage.getItem('sync_queue');
  const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
  
  syncQueue.push({
    tipo: 'criar_movimentacao',
    dados: {
      produto_id: produtoId,
      tipo,
      quantidade,
      notas
    },
    data: new Date().toISOString(),
  });
  
  await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
  log('Movimentação adicionada à fila de sincronização');
  
  return novaMovimentacao;
};

export const criarMovimentacao = async (movimentacao: Movimentacao): Promise<Movimentacao> => {
  try {
    log('Criando nova movimentação:', movimentacao);
    
    // Validações básicas
    if (!movimentacao.produto_id || movimentacao.produto_id <= 0) {
      throw new Error('ID do produto é obrigatório');
    }
    
    if (movimentacao.quantidade <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }
    
    if (movimentacao.tipo !== 'entrada' && movimentacao.tipo !== 'saida') {
      throw new Error('Tipo de movimentação deve ser "entrada" ou "saida"');
    }
    
    // Verificar se o produto existe e tem estoque suficiente
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    const produto = produtos.find(p => p.id === movimentacao.produto_id);
    
    if (!produto) {
      throw new Error('Produto não encontrado');
    }
    
    if (movimentacao.tipo === 'saida' && produto.quantidade < movimentacao.quantidade) {
      throw new Error('Quantidade insuficiente em estoque');
    }
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: processando movimentação localmente');
      
      // Registrar movimentação
      const novaMovimentacao = await registrarMovimentacaoLocal(
        movimentacao.produto_id,
        movimentacao.tipo,
        movimentacao.quantidade,
        movimentacao.notas
      );
      
      // Atualizar quantidade do produto
      const index = produtos.findIndex(p => p.id === movimentacao.produto_id);
      if (index !== -1) {
        if (movimentacao.tipo === 'entrada') {
          produtos[index].quantidade += movimentacao.quantidade;
        } else {
          produtos[index].quantidade -= movimentacao.quantidade;
          if (produtos[index].quantidade < 0) produtos[index].quantidade = 0;
        }
        
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        log(`Quantidade do produto atualizada: ${produtos[index].quantidade}`);
      }
      
      return novaMovimentacao;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para criar movimentação no servidor');
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/movimentacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movimentacao),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let mensagemErro = 'Erro ao registrar movimentação';
        try {
          const errorData = await response.json();
          mensagemErro = errorData.error || `Erro ao registrar movimentação: ${response.status} ${response.statusText}`;
        } catch (e) {
          mensagemErro = `Erro ao registrar movimentação: ${response.status} ${response.statusText}`;
        }
        throw new Error(mensagemErro);
      }
      
      const novaMovimentacao = await response.json();
      log('Movimentação criada com sucesso no servidor:', novaMovimentacao);
      
      // Atualizar cache local - movimentações
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      
      // Adicionar informações do produto
      if (produto) {
        novaMovimentacao.produto_codigo = produto.codigo;
        novaMovimentacao.produto_nome = produto.nome;
      }
      
      movimentacoes.push(novaMovimentacao);
      await AsyncStorage.setItem('movimentacoes', JSON.stringify(movimentacoes));
      log('Cache local atualizado com a nova movimentação');
      
      // Atualizar quantidade do produto no cache
      const index = produtos.findIndex(p => p.id === movimentacao.produto_id);
      if (index !== -1) {
        if (movimentacao.tipo === 'entrada') {
          produtos[index].quantidade += movimentacao.quantidade;
        } else {
          produtos[index].quantidade -= movimentacao.quantidade;
          if (produtos[index].quantidade < 0) produtos[index].quantidade = 0;
        }
        
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        log(`Quantidade do produto atualizada no cache: ${produtos[index].quantidade}`);
      }
      
      return novaMovimentacao;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao criar movimentação:', errorMessage);
    
    // Se o erro for de conexão, processar localmente
    if ((errorMessage.includes('timeout') || 
         errorMessage.includes('abort') || 
         errorMessage.includes('network') ||
         errorMessage.includes('Failed to fetch')) && 
        errorMessage !== 'ID do produto é obrigatório' &&
        errorMessage !== 'Quantidade deve ser maior que zero' &&
        errorMessage !== 'Tipo de movimentação deve ser "entrada" ou "saida"' &&
        errorMessage !== 'Produto não encontrado' &&
        errorMessage !== 'Quantidade insuficiente em estoque') {
      
      log('Erro de conexão ao criar movimentação, processando localmente');
      
      // Processar movimentação localmente
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      const produto = produtos.find(p => p.id === movimentacao.produto_id);
      
      if (!produto) {
        throw new Error('Produto não encontrado');
      }
      
      if (movimentacao.tipo === 'saida' && produto.quantidade < movimentacao.quantidade) {
        throw new Error('Quantidade insuficiente em estoque');
      }
      
      // Registrar movimentação
      const novaMovimentacao = await registrarMovimentacaoLocal(
        movimentacao.produto_id,
        movimentacao.tipo,
        movimentacao.quantidade,
        movimentacao.notas
      );
      
      // Atualizar quantidade do produto
      const index = produtos.findIndex(p => p.id === movimentacao.produto_id);
      if (index !== -1) {
        if (movimentacao.tipo === 'entrada') {
          produtos[index].quantidade += movimentacao.quantidade;
        } else {
          produtos[index].quantidade -= movimentacao.quantidade;
          if (produtos[index].quantidade < 0) produtos[index].quantidade = 0;
        }
        
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
      }
      
      return novaMovimentacao;
    }
    
    throw error;
  }
};

// Funções para interagir com a API de Configurações

export const getConfiguracoes = async (): Promise<Configuracao[]> => {
  try {
    log('Buscando lista de configurações...');
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const configuracoesJson = await AsyncStorage.getItem('configuracoes');
      const configuracoes = configuracoesJson ? JSON.parse(configuracoesJson) : [];
      log(`Configurações carregadas do cache (${configuracoes.length})`);
      return configuracoes;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${apiUrl}/configuracoes`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar configurações: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      log(`Configurações recebidas do servidor (${data.length})`);
      
      // Armazenar no AsyncStorage para uso offline
      await AsyncStorage.setItem('configuracoes', JSON.stringify(data));
      log('Configurações salvas no cache para uso offline');
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao buscar configurações:', errorMessage);
    
    // Tentar usar dados locais
    const configuracoesJson = await AsyncStorage.getItem('configuracoes');
    const configuracoes = configuracoesJson ? JSON.parse(configuracoesJson) : [];
    log(`Usando dados em cache após erro (${configuracoes.length})`);
    return configuracoes;
  }
};

export const getConfiguracao = async (chave: string): Promise<Configuracao | null> => {
  try {
    log(`Buscando configuração com chave: ${chave}`);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: usando dados locais');
      // Usar dados locais do AsyncStorage
      const configuracoesJson = await AsyncStorage.getItem('configuracoes');
      const configuracoes: Configuracao[] = configuracoesJson ? JSON.parse(configuracoesJson) : [];
      const configuracao = configuracoes.find(c => c.chave === chave);
      log(configuracao ? `Configuração encontrada no cache: ${configuracao.chave}=${configuracao.valor}` : 'Configuração não encontrada no cache');
      return configuracao || null;
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${apiUrl}/configuracoes/${chave}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          log(`Configuração não encontrada no servidor (chave: ${chave})`);
          return null;
        }
        throw new Error(`Erro ao buscar configuração: ${response.status} ${response.statusText}`);
      }
      
      const configuracao = await response.json();
      log(`Configuração recebida do servidor: ${configuracao.chave}=${configuracao.valor}`);
      
      // Atualizar cache local
      const configuracoesJson = await AsyncStorage.getItem('configuracoes');
      const configuracoes: Configuracao[] = configuracoesJson ? JSON.parse(configuracoesJson) : [];
      const index = configuracoes.findIndex(c => c.chave === chave);
      
      if (index !== -1) {
        configuracoes[index] = configuracao;
      } else {
        configuracoes.push(configuracao);
      }
      
      await AsyncStorage.setItem('configuracoes', JSON.stringify(configuracoes));
      log('Cache local atualizado com a configuração');
      
      return configuracao;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao buscar configuração com chave ${chave}:`, errorMessage);
    
    // Tentar usar dados locais
    const configuracoesJson = await AsyncStorage.getItem('configuracoes');
    const configuracoes: Configuracao[] = configuracoesJson ? JSON.parse(configuracoesJson) : [];
    const configuracao = configuracoes.find(c => c.chave === chave);
    log(configuracao ? `Usando configuração do cache após erro: ${configuracao.chave}=${configuracao.valor}` : 'Configuração não encontrada no cache');
    return configuracao || null;
  }
};

export const atualizarConfiguracao = async (chave: string, valor: string): Promise<Configuracao> => {
  try {
    log(`Atualizando configuração: ${chave}=${valor}`);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: salvando localmente para sincronizar depois');
      // Salvar localmente para sincronizar depois
      const configuracoesJson = await AsyncStorage.getItem('configuracoes');
      const configuracoes: Configuracao[] = configuracoesJson ? JSON.parse(configuracoesJson) : [];
      
      // Encontrar e atualizar a configuração
      let configuracao = configuracoes.find(c => c.chave === chave);
      
      if (configuracao) {
        log(`Atualizando configuração existente: ${chave}`);
        configuracao.valor = valor;
        configuracao.data_atualizacao = new Date().toISOString();
      } else {
        log(`Criando nova configuração localmente: ${chave}`);
        configuracao = {
          id: Date.now(),
          chave,
          valor,
          data_atualizacao: new Date().toISOString(),
        };
        configuracoes.push(configuracao);
      }
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('configuracoes', JSON.stringify(configuracoes));
      log('Configuração salva localmente');
      
      // Adicionar à fila de sincronização
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      syncQueue.push({
        tipo: 'atualizar_configuracao',
        chave,
        valor,
        data: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
      log('Configuração adicionada à fila de sincronização');
      
      return configuracao;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para atualizar configuração no servidor');
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${apiUrl}/configuracoes/${chave}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ valor }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let mensagemErro = 'Erro ao atualizar configuração';
        try {
          const errorData = await response.json();
          mensagemErro = errorData.error || `Erro ao atualizar configuração: ${response.status} ${response.statusText}`;
        } catch (e) {
          mensagemErro = `Erro ao atualizar configuração: ${response.status} ${response.statusText}`;
        }
        throw new Error(mensagemErro);
      }
      
      const configuracaoAtualizada = await response.json();
      log('Configuração atualizada com sucesso no servidor:', configuracaoAtualizada);
      
      // Atualizar cache local
      const configuracoesJson = await AsyncStorage.getItem('configuracoes');
      const configuracoes: Configuracao[] = configuracoesJson ? JSON.parse(configuracoesJson) : [];
      const index = configuracoes.findIndex(c => c.chave === chave);
      
      if (index !== -1) {
        configuracoes[index] = configuracaoAtualizada;
      } else {
        configuracoes.push(configuracaoAtualizada);
      }
      
      await AsyncStorage.setItem('configuracoes', JSON.stringify(configuracoes));
      log('Cache local atualizado com a configuração modificada');
      
      return configuracaoAtualizada;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao atualizar configuração ${chave}:`, errorMessage);
    
    // Se o erro for de conexão, processar localmente
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('abort') || 
        errorMessage.includes('network') ||
        errorMessage.includes('Failed to fetch')) {
      
      log('Erro de conexão ao atualizar configuração, processando localmente');
      
      // Processar localmente
      const configuracoesJson = await AsyncStorage.getItem('configuracoes');
      const configuracoes: Configuracao[] = configuracoesJson ? JSON.parse(configuracoesJson) : [];
      
      // Encontrar e atualizar a configuração
      let configuracao = configuracoes.find(c => c.chave === chave);
      
      if (configuracao) {
        configuracao.valor = valor;
        configuracao.data_atualizacao = new Date().toISOString();
      } else {
        configuracao = {
          id: Date.now(),
          chave,
          valor,
          data_atualizacao: new Date().toISOString(),
        };
        configuracoes.push(configuracao);
      }
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('configuracoes', JSON.stringify(configuracoes));
      
      // Adicionar à fila de sincronização
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      syncQueue.push({
        tipo: 'atualizar_configuracao',
        chave,
        valor,
        data: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
      
      log('Configuração atualizada localmente após erro de conexão');
      return configuracao;
    }
    
    throw error;
  }
};

// Função para obter dados do dashboard
export const getDashboardData = async (): Promise<DashboardData> => {
  try {
    log('Buscando dados do dashboard...');
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: gerando dashboard com dados locais');
      // Usar dados locais para criar um dashboard básico
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      
      // Calcular estatísticas básicas
      const totalProdutos = produtos.length;
      const totalItens = produtos.reduce((sum, p) => sum + p.quantidade, 0);
      const estoqueBaixo = produtos.filter(p => p.quantidade < (p.quantidade_minima || 5)).length;
      
      log(`Dashboard local: ${totalProdutos} produtos, ${totalItens} itens, ${estoqueBaixo} com estoque baixo`);
      
      // Últimas movimentações (10 mais recentes)
      const ultimasMovimentacoes = movimentacoes
        .sort((a, b) => new Date(b.data_movimentacao || '').getTime() - new Date(a.data_movimentacao || '').getTime())
        .slice(0, 10)
        .map(m => {
          const produto = produtos.find(p => p.id === m.produto_id);
          
          return {
            id: m.id,
            tipo: m.tipo,
            quantidade: m.quantidade,
            data_movimentacao: m.data_movimentacao || new Date().toISOString(),
            notas: m.notas,
            produto_codigo: m.produto_codigo || produto?.codigo || 'N/A',
            produto_nome: m.produto_nome || produto?.nome || 'Produto desconhecido',
          };
        });
      
      // Top 5 produtos por quantidade
      const topProdutos = [...produtos]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5)
        .map(p => ({
          codigo: p.codigo,
          nome: p.nome,
          quantidade: p.quantidade,
        }));
      
      return {
        total_produtos: totalProdutos,
        total_itens: totalItens,
        estoque_baixo: estoqueBaixo,
        ultimas_movimentacoes: ultimasMovimentacoes,
        top_produtos: topProdutos,
      };
    }
    
    // Fazer requisição à API
    const apiUrl = await getApiUrl();
    
    // Adicionar timeout para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${apiUrl}/dashboard`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados do dashboard: ${response.status} ${response.statusText}`);
      }
      
      const dashboardData = await response.json();
      log('Dados do dashboard recebidos com sucesso do servidor');
      return dashboardData;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Repassar para o catch externo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao buscar dados do dashboard:', errorMessage);
    
    // Criar dashboard básico com dados locais
    log('Gerando dashboard básico com dados locais após erro');
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Compilar dados básicos
    return {
      total_produtos: produtos.length,
      total_itens: produtos.reduce((sum, p) => sum + p.quantidade, 0),
      estoque_baixo: produtos.filter(p => p.quantidade < (p.quantidade_minima || 5)).length,
      ultimas_movimentacoes: movimentacoes
        .sort((a, b) => new Date(b.data_movimentacao || '').getTime() - new Date(a.data_movimentacao || '').getTime())
        .slice(0, 10)
        .map(m => {
          const produto = produtos.find(p => p.id === m.produto_id);
          
          return {
            id: m.id,
            tipo: m.tipo,
            quantidade: m.quantidade,
            data_movimentacao: m.data_movimentacao || new Date().toISOString(),
            notas: m.notas,
            produto_codigo: m.produto_codigo || produto?.codigo || 'N/A',
            produto_nome: m.produto_nome || produto?.nome || 'Produto desconhecido',
          };
        }),
      top_produtos: [...produtos]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5)
        .map(p => ({
          codigo: p.codigo,
          nome: p.nome,
          quantidade: p.quantidade,
        })),
    };
  }
};

// Função MELHORADA para sincronizar dados offline
export const sincronizarDados = async (): Promise<{
  sucesso: boolean;
  sincronizados: number;
  pendentes: number;
  mensagem: string;
}> => {
  try {
    log('Iniciando sincronização de dados offline...');
    
    // Verificar conexão
    const online = await verificarConexao();
    if (!online) {
      log('Sem conexão com o servidor. Sincronização cancelada.');
      return {
        sucesso: false,
        sincronizados: 0,
        pendentes: 0,
        mensagem: 'Sem conexão com o servidor'
      };
    }
    
    // Obter fila de sincronização
    const syncQueueJson = await AsyncStorage.getItem('sync_queue');
    const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
    
    if (syncQueue.length === 0) {
      log('Nada para sincronizar');
      return {
        sucesso: true,
        sincronizados: 0,
        pendentes: 0,
        mensagem: 'Nada para sincronizar'
      };
    }
    
    log(`Processando fila de sincronização: ${syncQueue.length} operações pendentes`);
    
    // Processar cada item da fila
    const novaFila = [];
    let sincronizados = 0;
    const apiUrl = await getApiUrl();
    
    for (const item of syncQueue) {
      try {
        log(`Sincronizando operação: ${item.tipo}`);
        
        switch (item.tipo) {
          case 'criar_produto':
            log('Enviando produto para criação no servidor');
            const produtoResponse = await fetch(`${apiUrl}/produtos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.dados),
            });
            
            if (!produtoResponse.ok) {
              // Verificar se é um erro de código duplicado
              if (produtoResponse.status === 409) {
                log('Produto com código já existente no servidor, considerando como sucesso');
                sincronizados++;
                break;
              }
              
              const errorData = await produtoResponse.json();
              log(`Erro ao criar produto no servidor: ${errorData.error || produtoResponse.statusText}`);
              throw new Error(`Erro ao criar produto: ${errorData.error || produtoResponse.statusText}`);
            }
            
            log('✅ Produto criado com sucesso no servidor');
            sincronizados++;
            break;
            
          case 'atualizar_produto':
            log(`Enviando atualização de produto ID: ${item.id}`);
            const atualizarResponse = await fetch(`${apiUrl}/produtos/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.dados),
            });
            
            if (!atualizarResponse.ok) {
              // Se o produto não existe mais no servidor, pular
              if (atualizarResponse.status === 404) {
                log('Produto não existe mais no servidor, ignorando atualização');
                sincronizados++;
                break;
              }
              
              const errorData = await atualizarResponse.json();
              log(`Erro ao atualizar produto no servidor: ${errorData.error || atualizarResponse.statusText}`);
              throw new Error(`Erro ao atualizar produto: ${errorData.error || atualizarResponse.statusText}`);
            }
            
            log('✅ Produto atualizado com sucesso no servidor');
            sincronizados++;
            break;
            
          case 'deletar_produto':
            log(`Enviando exclusão de produto ID: ${item.id}`);
            const deletarResponse = await fetch(`${apiUrl}/produtos/${item.id}`, {
              method: 'DELETE',
            });
            
            if (!deletarResponse.ok) {
              // Se o produto já não existe, consideramos como sucesso
              if (deletarResponse.status === 404) {
                log('Produto já não existe no servidor, considerando exclusão bem-sucedida');
                sincronizados++;
                break;
              }
              
              const errorData = await deletarResponse.json();
              log(`Erro ao excluir produto no servidor: ${errorData.error || deletarResponse.statusText}`);
              throw new Error(`Erro ao excluir produto: ${errorData.error || deletarResponse.statusText}`);
            }
            
            log('✅ Produto excluído com sucesso no servidor');
            sincronizados++;
            break;
            
          case 'criar_movimentacao':
            log('Enviando movimentação para criação no servidor');
            const movimentacaoResponse = await fetch(`${apiUrl}/movimentacoes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.dados),
            });
            
            if (!movimentacaoResponse.ok) {
              const errorData = await movimentacaoResponse.json();
              log(`Erro ao criar movimentação no servidor: ${errorData.error || movimentacaoResponse.statusText}`);
              throw new Error(`Erro ao criar movimentação: ${errorData.error || movimentacaoResponse.statusText}`);
            }
            
            log('✅ Movimentação criada com sucesso no servidor');
            sincronizados++;
            break;
            
          case 'atualizar_configuracao':
            log(`Enviando atualização de configuração: ${item.chave}`);
            const configResponse = await fetch(`${apiUrl}/configuracoes/${item.chave}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ valor: item.valor }),
            });
            
            if (!configResponse.ok) {
              const errorData = await configResponse.json();
              log(`Erro ao atualizar configuração no servidor: ${errorData.error || configResponse.statusText}`);
              throw new Error(`Erro ao atualizar configuração: ${errorData.error || configResponse.statusText}`);
            }
            
            log('✅ Configuração atualizada com sucesso no servidor');
            sincronizados++;
            break;
            
          default:
            // Manter itens desconhecidos na fila
            log(`Tipo de operação desconhecido: ${item.tipo}. Mantendo na fila.`);
            novaFila.push(item);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`❌ Erro ao sincronizar item ${item.tipo}:`, errorMessage);
        // Se o erro é de conexão, interromper a sincronização
        if (errorMessage.includes('Failed to fetch') || 
            errorMessage.includes('Network request failed')) {
          log('Erro de conexão detectado, interrompendo sincronização');
          // Adicionar todos os itens restantes (incluindo o atual) à nova fila
          novaFila.push(item);
          const restIndex = syncQueue.indexOf(item) + 1;
          syncQueue.slice(restIndex).forEach((i: any) => novaFila.push(i));
          break;
        }
        
        // Verificar se deve tentar novamente ou descartar
        const agora = new Date();
        const dataItem = new Date(item.data);
        const diasDiferenca = Math.floor((agora.getTime() - dataItem.getTime()) / (1000 * 60 * 60 * 24));
        
        // Descartar itens com mais de 15 dias
        if (diasDiferenca > 15) {
          log(`Item com mais de 15 dias, descartando: ${item.tipo}`);
        } else {
          // Adicionar contagem de tentativas
          const tentativas = (item.tentativas || 0) + 1;
          const itemComTentativas = { ...item, tentativas };
          
          // Se menos de 5 tentativas, manter na fila
          if (tentativas < 5) {
            novaFila.push(itemComTentativas);
          } else {
            log(`Item excedeu 5 tentativas, descartando: ${item.tipo}`);
          }
        }
      }
    }
    
    // Salvar nova fila
    await AsyncStorage.setItem('sync_queue', JSON.stringify(novaFila));
    log(`Sincronização concluída: ${sincronizados} operações realizadas, ${novaFila.length} pendentes`);
    
    // Atualizar dados locais após sincronização bem-sucedida
    if (sincronizados > 0) {
      log('Atualizando dados locais após sincronização');
      try {
        await Promise.all([
          getProdutos(),
          getMovimentacoes(),
          getConfiguracoes(),
        ]);
        log('Dados locais atualizados com sucesso');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('Erro ao atualizar dados locais após sincronização:', errorMessage);
      }
    }
    
    return {
      sucesso: true,
      sincronizados,
      pendentes: novaFila.length,
      mensagem: `${sincronizados} operações sincronizadas, ${novaFila.length} pendentes`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao sincronizar dados:', errorMessage);
    return {
      sucesso: false,
      sincronizados: 0,
      pendentes: -1,
      mensagem: `Erro na sincronização: ${errorMessage}`
    };
  }
};

// Função para definir o servidor
export const definirServidor = async (ip: string, porta: string = '8080'): Promise<boolean> => {
  try {
    log(`Definindo novo servidor: ${ip}:${porta}`);
    
    // Validar IP básico
    if (!ip || ip.trim() === '') {
      throw new Error('Endereço IP é obrigatório');
    }
    
    // Salvar configurações
    await AsyncStorage.setItem('@server_ip', ip);
    await AsyncStorage.setItem('@server_port', porta);
    
    // Resetar status offline
    modoOffline = true;
    
    // Testar a conexão com o novo servidor
    const resultado = await verificarConexao();
    
    return resultado;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao definir servidor:', errorMessage);
    throw error;
  }
};

// Obter endereço do servidor atual
export const obterEnderecoServidor = async (): Promise<{ip: string, porta: string}> => {
  try {
    // Se temos um servidor atual detectado e funcionando
    if (servidorAtual) {
      return { ip: servidorAtual, porta: portaAtual };
    }
    
    // Tentar obter do AsyncStorage
    const ip = await AsyncStorage.getItem('@server_ip') || '';
    const porta = await AsyncStorage.getItem('@server_port') || DEFAULT_PORT;
    
    // Se não temos IP salvo, mas temos último detectado
    if (!ip && lastDetectedServer) {
      return { ip: lastDetectedServer, porta };
    }
    
    return { ip, porta };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao obter endereço do servidor:', errorMessage);
    return { ip: '', porta: DEFAULT_PORT };
  }
};

export default {
  verificarConexao,
  getStatusConexao,
  getProdutos,
  getProduto,
  getProdutoPorCodigo,
  criarProduto,
  atualizarProduto,
  deletarProduto,
  getMovimentacoes,
  getMovimentacoesPorProduto,
  criarMovimentacao,
  getConfiguracoes,
  getConfiguracao,
  atualizarConfiguracao,
  getDashboardData,
  sincronizarDados,
  definirServidor,
  obterEnderecoServidor,
  validarCodigoProduto,
  validarNomeProduto,
  validarQuantidade
};