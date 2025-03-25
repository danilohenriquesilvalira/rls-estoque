// services/api.ts - Cliente para conectar com a API backend (VERSÃO CORRIGIDA)

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfoMock from '../utils/netInfoMock';

// Usar o mock em vez da importação real
const NetInfo = NetInfoMock;

// CONFIGURAÇÃO: Modifique estas variáveis
// ATENÇÃO: Substitua pelo IP real da sua máquina na rede
// Use o IP que outros dispositivos usam para acessar seu computador
const DEFAULT_SERVER_IP = '192.168.1.85'; // ⚠️ ALTERE PARA SEU IP REAL!
const DEFAULT_PORT = '8080';

// Função para obter a URL da API
const getApiUrl = async () => {
  try {
    // Tentar ler o IP das configurações salvas primeiro
    const serverIp = await AsyncStorage.getItem('@server_ip') || DEFAULT_SERVER_IP;
    const serverPort = await AsyncStorage.getItem('@server_port') || DEFAULT_PORT;
    return `http://${serverIp}:${serverPort}/api`;
  } catch (error) {
    console.log('[API] Erro ao obter configuração do servidor:', error);
    return `http://${DEFAULT_SERVER_IP}:${DEFAULT_PORT}/api`;
  }
};

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

// Flag para controlar o modo offline
let modoOffline = true; // Inicia como offline até confirmar conexão

// Status da conexão
export const getStatusConexao = () => {
  return !modoOffline;
};

// Verificar status da conexão
export const verificarConexao = async (): Promise<boolean> => {
  try {
    // Verificar se temos conectividade de internet primeiro
    const netInfoState = await NetInfo.fetch();
    if (!netInfoState.isConnected) {
      log('Sem conexão com a internet, modo offline ativado');
      modoOffline = true;
      return false;
    }

    const apiUrl = await getApiUrl();
    log(`Verificando conexão com o servidor em: ${apiUrl}`);
    
    // Adicionar timeout para não travar em casos de servidor indisponível
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Tentar fazer uma requisição simples
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
    modoOffline = !response.ok;
    
    if (!modoOffline) {
      log('✅ Conexão estabelecida com o servidor!');
      await AsyncStorage.setItem('@ultimo_acesso_online', new Date().toISOString());
    } else {
      log('❌ Falha na conexão com o servidor, resposta não OK');
    }
    
    return !modoOffline;
  } catch (error) {
    // Se houve erro, estamos offline
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('❌ Erro ao verificar conexão:', errorMessage);
    modoOffline = true;
    log('Modo offline ativado devido ao erro de conexão');
    return false;
  }
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
    const response = await fetch(`${apiUrl}/produtos`);
    
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
    const response = await fetch(`${apiUrl}/produtos/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        log(`Produto não encontrado no servidor (ID: ${id})`);
        return null;
      }
      throw new Error(`Erro ao buscar produto: ${response.status} ${response.statusText}`);
    }
    
    const produto = await response.json();
    log(`Produto recebido do servidor: ${produto.nome}`);
    return produto;
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
    const response = await fetch(`${apiUrl}/produtos/codigo/${codigo}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        log(`Produto não encontrado no servidor (código: ${codigo})`);
        return null;
      }
      throw new Error(`Erro ao buscar produto: ${response.status} ${response.statusText}`);
    }
    
    const produto = await response.json();
    log(`Produto recebido do servidor: ${produto.nome}`);
    return produto;
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
      
      return produto;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para criar produto no servidor');
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/produtos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(produto),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ao criar produto: ${response.status} ${response.statusText}`);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao criar produto:', errorMessage);
    throw error;
  }
};

export const atualizarProduto = async (id: number, produto: Produto): Promise<Produto> => {
  try {
    log(`Atualizando produto ID: ${id}`, produto);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: salvando localmente para sincronizar depois');
      // Salvar localmente para sincronizar depois
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      
      // Encontrar e atualizar o produto
      const index = produtos.findIndex(p => p.id === id);
      if (index === -1) {
        log(`Produto não encontrado localmente (ID: ${id})`);
        throw new Error('Produto não encontrado');
      }
      
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
      
      return produto;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para atualizar produto no servidor');
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/produtos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(produto),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ao atualizar produto: ${response.status} ${response.statusText}`);
    }
    
    const produtoAtualizado = await response.json();
    log('Produto atualizado com sucesso no servidor:', produtoAtualizado);
    
    // Atualizar cache local
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    const index = produtos.findIndex(p => p.id === id);
    if (index !== -1) {
      produtos[index] = produtoAtualizado;
      await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
      log('Cache local atualizado com o produto modificado');
    }
    
    return produtoAtualizado;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao atualizar produto ID ${id}:`, errorMessage);
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
      
      // Remover o produto
      const novoProdutos = produtos.filter(p => p.id !== id);
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('produtos', JSON.stringify(novoProdutos));
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
      
      return;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para excluir produto no servidor');
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/produtos/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ao excluir produto: ${response.status} ${response.statusText}`);
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
    const response = await fetch(`${apiUrl}/movimentacoes`);
    
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
    const response = await fetch(`${apiUrl}/movimentacoes/produto/${produtoId}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar movimentações: ${response.status} ${response.statusText}`);
    }
    
    const movimentacoes = await response.json();
    log(`Movimentações recebidas do servidor (${movimentacoes.length})`);
    return movimentacoes;
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

export const criarMovimentacao = async (movimentacao: Movimentacao): Promise<Movimentacao> => {
  try {
    log('Criando nova movimentação:', movimentacao);
    
    // Verificar se estamos offline
    if (modoOffline) {
      log('Modo offline: salvando localmente para sincronizar depois');
      // Salvar localmente para sincronizar depois
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      
      // Gerar ID temporário
      movimentacao.id = Date.now();
      movimentacao.data_movimentacao = new Date().toISOString();
      
      // Adicionar à lista
      movimentacoes.push(movimentacao);
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('movimentacoes', JSON.stringify(movimentacoes));
      log(`Movimentação salva localmente. ID Temp: ${movimentacao.id}`);
      
      // Atualizar quantidade do produto
      const produtosJson = await AsyncStorage.getItem('produtos');
      const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
      
      const produto = produtos.find(p => p.id === movimentacao.produto_id);
      if (produto) {
        log(`Atualizando quantidade do produto ID: ${produto.id}, Nome: ${produto.nome}`);
        log(`Quantidade anterior: ${produto.quantidade}`);
        
        if (movimentacao.tipo === 'entrada') {
          produto.quantidade += movimentacao.quantidade;
          log(`Nova quantidade após entrada (+${movimentacao.quantidade}): ${produto.quantidade}`);
        } else {
          produto.quantidade -= movimentacao.quantidade;
          if (produto.quantidade < 0) produto.quantidade = 0;
          log(`Nova quantidade após saída (-${movimentacao.quantidade}): ${produto.quantidade}`);
        }
        
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        log('Quantidade do produto atualizada no cache local');
      } else {
        log(`Produto não encontrado no cache (ID: ${movimentacao.produto_id})`);
      }
      
      // Adicionar à fila de sincronização
      const syncQueueJson = await AsyncStorage.getItem('sync_queue');
      const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
      
      syncQueue.push({
        tipo: 'criar_movimentacao',
        dados: movimentacao,
        data: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
      log('Movimentação adicionada à fila de sincronização');
      
      return movimentacao;
    }
    
    // Fazer requisição à API
    log('Enviando requisição para criar movimentação no servidor');
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/movimentacoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(movimentacao),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ao registrar movimentação: ${response.status} ${response.statusText}`);
    }
    
    const novaMovimentacao = await response.json();
    log('Movimentação criada com sucesso no servidor:', novaMovimentacao);
    
    // Atualizar cache local
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    movimentacoes.push(novaMovimentacao);
    await AsyncStorage.setItem('movimentacoes', JSON.stringify(movimentacoes));
    log('Cache local atualizado com a nova movimentação');
    
    // Também atualizar a quantidade do produto no cache
    const produtosJson = await AsyncStorage.getItem('produtos');
    if (produtosJson) {
      const produtos: Produto[] = JSON.parse(produtosJson);
      const index = produtos.findIndex(p => p.id === movimentacao.produto_id);
      
      if (index !== -1) {
        log(`Atualizando quantidade do produto no cache: ${produtos[index].nome}`);
        log(`Quantidade anterior: ${produtos[index].quantidade}`);
        
        if (movimentacao.tipo === 'entrada') {
          produtos[index].quantidade += movimentacao.quantidade;
          log(`Nova quantidade após entrada: ${produtos[index].quantidade}`);
        } else {
          produtos[index].quantidade -= movimentacao.quantidade;
          if (produtos[index].quantidade < 0) produtos[index].quantidade = 0;
          log(`Nova quantidade após saída: ${produtos[index].quantidade}`);
        }
        
        await AsyncStorage.setItem('produtos', JSON.stringify(produtos));
        log('Quantidade do produto atualizada no cache local');
      }
    }
    
    return novaMovimentacao;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao criar movimentação:', errorMessage);
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
    const response = await fetch(`${apiUrl}/configuracoes`);
    
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
    const response = await fetch(`${apiUrl}/configuracoes/${chave}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        log(`Configuração não encontrada no servidor (chave: ${chave})`);
        return null;
      }
      throw new Error(`Erro ao buscar configuração: ${response.status} ${response.statusText}`);
    }
    
    const configuracao = await response.json();
    log(`Configuração recebida do servidor: ${configuracao.chave}=${configuracao.valor}`);
    return configuracao;
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
    const response = await fetch(`${apiUrl}/configuracoes/${chave}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valor }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ao atualizar configuração: ${response.status} ${response.statusText}`);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao atualizar configuração ${chave}:`, errorMessage);
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
            produto_codigo: produto?.codigo || 'N/A',
            produto_nome: produto?.nome || 'Produto desconhecido',
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
    const response = await fetch(`${apiUrl}/dashboard`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados do dashboard: ${response.status} ${response.statusText}`);
    }
    
    const dashboardData = await response.json();
    log('Dados do dashboard recebidos com sucesso do servidor');
    return dashboardData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao buscar dados do dashboard:', errorMessage);
    
    // Criar dashboard básico com dados locais
    log('Gerando dashboard básico com dados locais após erro');
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    return {
      total_produtos: produtos.length,
      total_itens: produtos.reduce((sum, p) => sum + p.quantidade, 0),
      estoque_baixo: produtos.filter(p => p.quantidade < (p.quantidade_minima || 5)).length,
      ultimas_movimentacoes: [],
      top_produtos: [],
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
          const itemComTentativas = {...item, tentativas};
          
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
    await AsyncStorage.setItem('@server_ip', ip);
    await AsyncStorage.setItem('@server_port', porta);
    
    // Testar a conexão com o novo servidor
    const resultado = await verificarConexao();
    
    return resultado;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao definir servidor:', errorMessage);
    return false;
  }
};

// Obter endereço do servidor atual
export const obterEnderecoServidor = async (): Promise<{ip: string, porta: string}> => {
  try {
    const ip = await AsyncStorage.getItem('@server_ip') || DEFAULT_SERVER_IP;
    const porta = await AsyncStorage.getItem('@server_port') || DEFAULT_PORT;
    return { ip, porta };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Erro ao obter endereço do servidor:', errorMessage);
    return { ip: DEFAULT_SERVER_IP, porta: DEFAULT_PORT };
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
  obterEnderecoServidor
};