// services/api.ts - Cliente para conectar com a API backend

import AsyncStorage from '@react-native-async-storage/async-storage';

// URL base da API
const API_URL = 'http://192.168.1.85:8080/api'; // IP do computador na rede local
const DEBUG = true; // Ativar/desativar logs de depuração

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
let modoOffline = false;

// Verificar status da conexão
export const verificarConexao = async (): Promise<boolean> => {
  try {
    log('Verificando conexão com o servidor...');
    
    // Tentar fazer uma requisição simples
    const response = await fetch(`${API_URL}/configuracoes/versao_app`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Se a requisição foi bem-sucedida, estamos online
    modoOffline = !response.ok;
    
    if (!modoOffline) {
      log('Conexão estabelecida com o servidor!');
    } else {
      log('Falha na conexão com o servidor, resposta não OK');
    }
    
    return !modoOffline;
  } catch (error) {
    // Se houve erro, estamos offline
    log('Erro ao verificar conexão:', error);
    modoOffline = true;
    log('Modo offline ativado');
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
    const response = await fetch(`${API_URL}/produtos`);
    
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
    log('Erro ao buscar produtos:', error);
    
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
    const response = await fetch(`${API_URL}/produtos/${id}`);
    
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
    log(`Erro ao buscar produto com ID ${id}:`, error);
    
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
    const response = await fetch(`${API_URL}/produtos/codigo/${codigo}`);
    
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
    log(`Erro ao buscar produto com código ${codigo}:`, error);
    
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
    const response = await fetch(`${API_URL}/produtos`, {
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
    log('Erro ao criar produto:', error);
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
    const response = await fetch(`${API_URL}/produtos/${id}`, {
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
    log(`Erro ao atualizar produto ID ${id}:`, error);
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
    const response = await fetch(`${API_URL}/produtos/${id}`, {
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
    log(`Erro ao excluir produto ID ${id}:`, error);
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
    const response = await fetch(`${API_URL}/movimentacoes`);
    
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
    log('Erro ao buscar movimentações:', error);
    
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
    const response = await fetch(`${API_URL}/movimentacoes/produto/${produtoId}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar movimentações: ${response.status} ${response.statusText}`);
    }
    
    const movimentacoes = await response.json();
    log(`Movimentações recebidas do servidor (${movimentacoes.length})`);
    return movimentacoes;
  } catch (error) {
    log(`Erro ao buscar movimentações do produto ID ${produtoId}:`, error);
    
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
    const response = await fetch(`${API_URL}/movimentacoes`, {
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
    log('Erro ao criar movimentação:', error);
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
    const response = await fetch(`${API_URL}/configuracoes`);
    
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
    log('Erro ao buscar configurações:', error);
    
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
    const response = await fetch(`${API_URL}/configuracoes/${chave}`);
    
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
    log(`Erro ao buscar configuração com chave ${chave}:`, error);
    
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
    const response = await fetch(`${API_URL}/configuracoes/${chave}`, {
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
    log(`Erro ao atualizar configuração ${chave}:`, error);
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
    const response = await fetch(`${API_URL}/dashboard`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados do dashboard: ${response.status} ${response.statusText}`);
    }
    
    const dashboardData = await response.json();
    log('Dados do dashboard recebidos com sucesso do servidor');
    return dashboardData;
  } catch (error) {
    log('Erro ao buscar dados do dashboard:', error);
    
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

// Função para sincronizar dados offline
export const sincronizarDados = async (): Promise<void> => {
  try {
    log('Iniciando sincronização de dados offline...');
    
    // Verificar conexão
    const online = await verificarConexao();
    if (!online) {
      log('Sem conexão com o servidor. Sincronização cancelada.');
      throw new Error('Sem conexão com o servidor');
    }
    
    // Obter fila de sincronização
    const syncQueueJson = await AsyncStorage.getItem('sync_queue');
    const syncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : [];
    
    if (syncQueue.length === 0) {
      log('Nada para sincronizar');
      return; // Nada para sincronizar
    }
    
    log(`Processando fila de sincronização: ${syncQueue.length} operações pendentes`);
    
    // Processar cada item da fila
    const novaFila = [];
    let sincronizados = 0;
    
    for (const item of syncQueue) {
      try {
        log(`Sincronizando operação: ${item.tipo}`);
        
        switch (item.tipo) {
          case 'criar_produto':
            log('Enviando produto para criação no servidor');
            await fetch(`${API_URL}/produtos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.dados),
            });
            sincronizados++;
            break;
            
          case 'atualizar_produto':
            log(`Enviando atualização de produto ID: ${item.id}`);
            await fetch(`${API_URL}/produtos/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.dados),
            });
            sincronizados++;
            break;
            
          case 'deletar_produto':
            log(`Enviando exclusão de produto ID: ${item.id}`);
            await fetch(`${API_URL}/produtos/${item.id}`, {
              method: 'DELETE',
            });
            sincronizados++;
            break;
            
          case 'criar_movimentacao':
            log('Enviando movimentação para criação no servidor');
            await fetch(`${API_URL}/movimentacoes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.dados),
            });
            sincronizados++;
            break;
            
          case 'atualizar_configuracao':
            log(`Enviando atualização de configuração: ${item.chave}`);
            await fetch(`${API_URL}/configuracoes/${item.chave}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ valor: item.valor }),
            });
            sincronizados++;
            break;
            
          default:
            // Manter itens desconhecidos na fila
            log(`Tipo de operação desconhecido: ${item.tipo}. Mantendo na fila.`);
            novaFila.push(item);
        }
      } catch (error) {
        log(`Erro ao sincronizar item ${item.tipo}:`, error);
        novaFila.push(item); // Manter na fila para tentar novamente
      }
    }
    
    // Salvar nova fila
    await AsyncStorage.setItem('sync_queue', JSON.stringify(novaFila));
    log(`Sincronização concluída: ${sincronizados} operações realizadas, ${novaFila.length} pendentes`);
    
    // Atualizar dados locais
    log('Atualizando dados locais após sincronização');
    await Promise.all([
      getProdutos(),
      getMovimentacoes(),
      getConfiguracoes(),
    ]);
    
    log('Dados locais atualizados com sucesso');
  } catch (error) {
    log('Erro ao sincronizar dados:', error);
    throw error;
  }
};

export default {
  verificarConexao,
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
};