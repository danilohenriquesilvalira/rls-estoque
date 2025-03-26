// services/stockPrediction.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';

interface Movimentacao {
  id?: number;
  produto_id: number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  data_movimentacao?: string;
}

interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  quantidade: number;
  quantidade_minima?: number;
}

interface PredictionResult {
  diasRestantes: number | null;
  dataEstimadaEsgotamento: string | null;
  consumoDiario: number;
  confianca: 'alta' | 'media' | 'baixa';
  necessidadeCompra: boolean;
  quantidadeRecomendada: number;
}

/**
 * Calcula estatísticas de consumo e previsões para um produto
 * 
 * @param produtoId ID do produto para analisar
 * @param dias Número de dias para analisar no histórico (padrão: 30)
 * @returns Objeto com previsões e recomendações
 */
export const preverEsgotamentoEstoque = async (produtoId: number, dias: number = 30): Promise<PredictionResult> => {
  try {
    // Carregar dados do produto
    const produtoJson = await AsyncStorage.getItem(`produto_${produtoId}`);
    if (!produtoJson) {
      throw new Error('Produto não encontrado');
    }
    
    const produto: Produto = JSON.parse(produtoJson);
    
    // Carregar histórico de movimentações
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const todasMovimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Filtrar movimentações relevantes para este produto e período
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    
    const movimentacoesFiltradas = todasMovimentacoes.filter(mov => {
      if (mov.produto_id !== produtoId) return false;
      if (!mov.data_movimentacao) return false;
      
      const dataMovimentacao = parseISO(mov.data_movimentacao);
      return dataMovimentacao >= dataLimite;
    });
    
    // Se não houver movimentações suficientes, retornar confiança baixa
    if (movimentacoesFiltradas.length < 3) {
      return {
        diasRestantes: null,
        dataEstimadaEsgotamento: null,
        consumoDiario: 0,
        confianca: 'baixa',
        necessidadeCompra: produto.quantidade <= (produto.quantidade_minima || 5),
        quantidadeRecomendada: 0
      };
    }
    
    // Calcular saídas totais no período
    const saidasTotais = movimentacoesFiltradas
      .filter(mov => mov.tipo === 'saida')
      .reduce((sum, mov) => sum + mov.quantidade, 0);
    
    // Calcular consumo médio diário
    const consumoDiario = saidasTotais / dias;
    
    // Se o consumo for zero, não há previsão de esgotamento
    if (consumoDiario === 0) {
      return {
        diasRestantes: null,
        dataEstimadaEsgotamento: null,
        consumoDiario: 0,
        confianca: 'alta',
        necessidadeCompra: false,
        quantidadeRecomendada: 0
      };
    }
    
    // Calcular dias restantes até esgotamento
    const diasRestantes = Math.floor(produto.quantidade / consumoDiario);
    
    // Data estimada de esgotamento
    const dataEsgotamento = addDays(new Date(), diasRestantes);
    const dataFormatada = format(dataEsgotamento, 'yyyy-MM-dd');
    
    // Determinar nível de confiança
    let confianca: 'alta' | 'media' | 'baixa' = 'media';
    
    if (movimentacoesFiltradas.length > 10 && dias >= 30) {
      confianca = 'alta';
    } else if (movimentacoesFiltradas.length < 5) {
      confianca = 'baixa';
    }
    
    // Calcular necessidade de compra e quantidade recomendada
    const nivelMinimo = produto.quantidade_minima || Math.ceil(consumoDiario * 7); // 1 semana de buffer
    const necessidadeCompra = diasRestantes <= 14; // Alerta com 2 semanas de antecedência
    
    // A quantidade recomendada é para cobrir 30 dias de consumo + buffer
    const quantidadeRecomendada = Math.ceil(consumoDiario * 30) - produto.quantidade + nivelMinimo;
    
    return {
      diasRestantes,
      dataEstimadaEsgotamento: dataFormatada,
      consumoDiario,
      confianca,
      necessidadeCompra,
      quantidadeRecomendada: quantidadeRecomendada > 0 ? quantidadeRecomendada : 0
    };
  } catch (error) {
    console.error('Erro ao calcular previsão de estoque:', error);
    return {
      diasRestantes: null,
      dataEstimadaEsgotamento: null,
      consumoDiario: 0,
      confianca: 'baixa',
      necessidadeCompra: false,
      quantidadeRecomendada: 0
    };
  }
};

/**
 * Identifica tendências nos dados de movimentação (crescimento, declínio ou estabilidade)
 */
export const analisarTendenciaConsumo = async (produtoId: number, dias: number = 90): Promise<{
  tendencia: 'crescimento' | 'declinio' | 'estavel';
  percentualMudanca: number;
  descricao: string;
}> => {
  try {
    // Carregar histórico de movimentações
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const todasMovimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Filtrar movimentações deste produto
    const movimentacoesProduto = todasMovimentacoes.filter(
      mov => mov.produto_id === produtoId && mov.data_movimentacao
    );
    
    // Dividir o período em duas partes para comparação
    const hoje = new Date();
    const metadePeriodo = dias / 2;
    
    const primeiroPeriodoInicio = addDays(hoje, -dias);
    const primeiroPeriodoFim = addDays(hoje, -metadePeriodo);
    
    const segundoPeriodoInicio = primeiroPeriodoFim;
    const segundoPeriodoFim = hoje;
    
    // Calcular saídas em cada período
    const saidasPrimeiroPeriodo = movimentacoesProduto
      .filter(mov => {
        if (!mov.data_movimentacao || mov.tipo !== 'saida') return false;
        const data = parseISO(mov.data_movimentacao);
        return data >= primeiroPeriodoInicio && data < primeiroPeriodoFim;
      })
      .reduce((sum, mov) => sum + mov.quantidade, 0);
    
    const saidasSegundoPeriodo = movimentacoesProduto
      .filter(mov => {
        if (!mov.data_movimentacao || mov.tipo !== 'saida') return false;
        const data = parseISO(mov.data_movimentacao);
        return data >= segundoPeriodoInicio && data <= segundoPeriodoFim;
      })
      .reduce((sum, mov) => sum + mov.quantidade, 0);
    
    // Calcular variação percentual
    let percentualMudanca = 0;
    if (saidasPrimeiroPeriodo > 0) {
      percentualMudanca = ((saidasSegundoPeriodo - saidasPrimeiroPeriodo) / saidasPrimeiroPeriodo) * 100;
    }
    
    // Determinar tendência
    let tendencia: 'crescimento' | 'declinio' | 'estavel' = 'estavel';
    let descricao = '';
    
    if (percentualMudanca >= 10) {
      tendencia = 'crescimento';
      descricao = `Aumento de ${percentualMudanca.toFixed(1)}% no consumo nos últimos ${metadePeriodo} dias`;
    } else if (percentualMudanca <= -10) {
      tendencia = 'declinio';
      descricao = `Redução de ${Math.abs(percentualMudanca).toFixed(1)}% no consumo nos últimos ${metadePeriodo} dias`;
    } else {
      descricao = `Consumo estável nos últimos ${dias} dias`;
    }
    
    return {
      tendencia,
      percentualMudanca,
      descricao
    };
  } catch (error) {
    console.error('Erro ao analisar tendência de consumo:', error);
    return {
      tendencia: 'estavel',
      percentualMudanca: 0,
      descricao: 'Não foi possível analisar a tendência de consumo'
    };
  }
};

/**
 * Identifica produtos que precisam ser reordenados com prioridade
 */
export const getProdutosPrioritarios = async (): Promise<{
  id: number;
  codigo: string;
  nome: string;
  diasRestantes: number | null;
  urgencia: 'alta' | 'media' | 'baixa';
  quantidadeRecomendada: number;
}[]> => {
  try {
    // Carregar todos os produtos
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    if (produtos.length === 0) return [];
    
    // Analisar cada produto
    const produtosAnalisados = await Promise.all(produtos.map(async (produto) => {
      if (!produto.id) return null;
      
      const previsao = await preverEsgotamentoEstoque(produto.id);
      
      // Determinar urgência
      let urgencia: 'alta' | 'media' | 'baixa' = 'baixa';
      
      if (previsao.diasRestantes !== null) {
        if (previsao.diasRestantes <= 7) {
          urgencia = 'alta';
        } else if (previsao.diasRestantes <= 14) {
          urgencia = 'media';
        }
      } else if (produto.quantidade <= (produto.quantidade_minima || 5)) {
        urgencia = 'alta';
      }
      
      return {
        id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        diasRestantes: previsao.diasRestantes,
        urgencia,
        quantidadeRecomendada: previsao.quantidadeRecomendada
      };
    }));
    
    // Remover itens nulos e ordenar por urgência e dias restantes
    const filteredItems = produtosAnalisados.filter(item => item !== null) as Array<{
      id: number;
      codigo: string;
      nome: string;
      diasRestantes: number | null;
      urgencia: 'alta' | 'media' | 'baixa';
      quantidadeRecomendada: number;
    }>;
    
    // Definir o critério de ordenação
    const urgenciaPeso: {[key: string]: number} = { alta: 0, media: 1, baixa: 2 };
    
    return filteredItems.sort((a, b) => {
      // Primeiro por urgência
      const urgenciaComp = urgenciaPeso[a.urgencia] - urgenciaPeso[b.urgencia];
      if (urgenciaComp !== 0) return urgenciaComp;
      
      // Depois por dias restantes
      if (a.diasRestantes === null && b.diasRestantes === null) return 0;
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    }).filter(item => item.urgencia !== 'baixa' || item.quantidadeRecomendada > 0);
  } catch (error) {
    console.error('Erro ao obter produtos prioritários:', error);
    return [];
  }
};

/**
 * Gera uma lista de compras inteligente
 */
export const gerarListaCompras = async (): Promise<{
  produtos: {
    id: number;
    codigo: string;
    nome: string;
    quantidadeAtual: number;
    quantidadeRecomendada: number;
    urgencia: 'alta' | 'media' | 'baixa';
  }[];
  totalItens: number;
}> => {
  try {
    const produtosPrioritarios = await getProdutosPrioritarios();
    
    // Carregar detalhes completos de cada produto
    const produtosCompletos = await Promise.all(produtosPrioritarios.map(async (produto) => {
      const produtoJson = await AsyncStorage.getItem(`produto_${produto.id}`);
      if (!produtoJson) return null;
      
      const produtoCompleto: Produto = JSON.parse(produtoJson);
      
      return {
        id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        quantidadeAtual: produtoCompleto.quantidade,
        quantidadeRecomendada: produto.quantidadeRecomendada,
        urgencia: produto.urgencia
      };
    }));
    
    // Filtrar itens válidos
    const produtosLista = produtosCompletos.filter(item => 
      item !== null && item.quantidadeRecomendada > 0
    ) as Array<{
      id: number;
      codigo: string;
      nome: string;
      quantidadeAtual: number;
      quantidadeRecomendada: number;
      urgencia: 'alta' | 'media' | 'baixa';
    }>;
    
    return {
      produtos: produtosLista,
      totalItens: produtosLista.length
    };
  } catch (error) {
    console.error('Erro ao gerar lista de compras:', error);
    return {
      produtos: [],
      totalItens: 0
    };
  }
};