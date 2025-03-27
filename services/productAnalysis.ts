// services/productAnalysis.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseISO, isAfter, format, differenceInDays, subDays, addDays, startOfMonth, endOfMonth, isSameMonth, getMonth, getYear } from 'date-fns';

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
  fornecedor?: string;
  categoria?: string;
  localizacao?: string;
}

// Interface para padrões de consumo identificados
export interface PadraoConsumo {
  tipo: 'sazonal' | 'regular' | 'irregular' | 'crescente' | 'decrescente';
  confianca: number; // 0 a 1
  descricao: string;
  periodoAnalisado: { inicio: string; fim: string };
  mediaConsumo: number;
  picos?: { data: string; quantidade: number }[];
  menorConsumo?: { data: string; quantidade: number }[];
  previsaoPorMes?: { mes: string; quantidade: number }[]; // Nova propriedade para previsão futura
  sazonalidadeIdentificada?: { mes: number; fator: number }[]; // Nova propriedade para fatores de sazonalidade
}

// Interface para categoria de produto com similaridade
export interface CategoriaProduto {
  nome: string;
  produtosIds: number[];
  similaridadeConsumo: number; // 0 a 1
  padraoPredominante: string;
}

// Interface para relatório de anomalias
export interface AnomaliaEstoque {
  produtoId: number;
  tipo: 'movimentacao_suspeita' | 'estoque_inconsistente' | 'divergencia_inventario';
  dataDeteccao: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta';
  sugestaoCorrecao?: string;
  impactoFinanceiro?: number; // Novo campo para estimar impacto financeiro
}

// Nova interface para correlação entre produtos
export interface CorrelacaoProdutos {
  produtoA: number; // ID do primeiro produto
  produtoB: number; // ID do segundo produto
  coeficienteCorrelacao: number; // -1 a 1
  tipo: 'positiva' | 'negativa' | 'neutra';
  confianca: number; // 0 a 1
  descricao: string;
}

/**
 * Identifica padrões de consumo para um produto específico
 * Versão aprimorada com detecção de sazonalidade e previsão futura
 */
export const identificarPadraoConsumo = async (produtoId: number, dias: number = 180): Promise<PadraoConsumo> => {
  try {
    // Carregar histórico de movimentações do produto
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const todasMovimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Filtrar movimentações do produto específico
    const dataLimite = subDays(new Date(), dias);
    const movimentacoesFiltradasSaida = todasMovimentacoes.filter(mov => {
      if (mov.produto_id !== produtoId || mov.tipo !== 'saida') return false;
      if (!mov.data_movimentacao) return false;
      
      const dataMov = parseISO(mov.data_movimentacao);
      return isAfter(dataMov, dataLimite);
    });
    
    // Se não houver movimentações suficientes, retornar padrão irregular
    if (movimentacoesFiltradasSaida.length < 5) {
      return {
        tipo: 'irregular',
        confianca: 0.3,
        descricao: 'Dados insuficientes para análise precisa',
        periodoAnalisado: {
          inicio: format(dataLimite, 'yyyy-MM-dd'),
          fim: format(new Date(), 'yyyy-MM-dd')
        },
        mediaConsumo: 0
      };
    }
    
    // Ordenar movimentações por data
    movimentacoesFiltradasSaida.sort((a, b) => {
      if (!a.data_movimentacao || !b.data_movimentacao) return 0;
      return parseISO(a.data_movimentacao).getTime() - parseISO(b.data_movimentacao).getTime();
    });
    
    // Agrupar movimentações por mês
    const consumoPorMes = new Map<string, number>();
    
    movimentacoesFiltradasSaida.forEach(mov => {
      if (!mov.data_movimentacao) return;
      
      const dataMov = parseISO(mov.data_movimentacao);
      const mesAno = format(dataMov, 'yyyy-MM');
      
      if (consumoPorMes.has(mesAno)) {
        consumoPorMes.set(mesAno, (consumoPorMes.get(mesAno) || 0) + mov.quantidade);
      } else {
        consumoPorMes.set(mesAno, mov.quantidade);
      }
    });
    
    // Converter para array para análise
    const consumoArray = Array.from(consumoPorMes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mesAno, quantidade]) => ({ mesAno, quantidade }));
    
    // Calcular média de consumo
    const totalConsumo = consumoArray.reduce((sum, item) => sum + item.quantidade, 0);
    const mediaConsumo = totalConsumo / consumoArray.length;
    
    // Detectar tendência de crescimento/decrescimento
    let tendencia = 0;
    for (let i = 1; i < consumoArray.length; i++) {
      if (consumoArray[i].quantidade > consumoArray[i-1].quantidade) {
        tendencia++;
      } else if (consumoArray[i].quantidade < consumoArray[i-1].quantidade) {
        tendencia--;
      }
    }
    
    // Calcular variação (para determinar regularidade)
    const variacao = consumoArray.reduce((sum, item) => {
      return sum + Math.abs(item.quantidade - mediaConsumo);
    }, 0) / consumoArray.length;
    
    const coeficienteVariacao = variacao / mediaConsumo;
    
    // Identificar picos (valores acima de 1.5x a média)
    const picos = consumoArray
      .filter(item => item.quantidade > mediaConsumo * 1.5)
      .map(item => ({
        data: item.mesAno,
        quantidade: item.quantidade
      }));
    
    // Identificar períodos de baixo consumo (valores abaixo de 0.5x a média)
    const menorConsumo = consumoArray
      .filter(item => item.quantidade < mediaConsumo * 0.5)
      .map(item => ({
        data: item.mesAno,
        quantidade: item.quantidade
      }));
    
    // NOVA FUNCIONALIDADE: Análise de sazonalidade por mês do ano
    const dadosPorMes: Map<number, number[]> = new Map();
    
    // Agrupar consumo por mês do ano (Jan, Fev, etc) para detectar sazonalidade
    consumoArray.forEach(item => {
      const mes = parseInt(item.mesAno.substring(5, 7));
      if (!dadosPorMes.has(mes)) {
        dadosPorMes.set(mes, []);
      }
      dadosPorMes.get(mes)?.push(item.quantidade);
    });
    
    // Calcular média para cada mês
    const mediasPorMes: Map<number, number> = new Map();
    dadosPorMes.forEach((valores, mes) => {
      const total = valores.reduce((sum, valor) => sum + valor, 0);
      mediasPorMes.set(mes, total / valores.length);
    });
    
    // Calcular fatores de sazonalidade: relação entre média do mês e média geral
    const fatoresSazonalidade: { mes: number; fator: number }[] = [];
    mediasPorMes.forEach((media, mes) => {
      if (mediaConsumo > 0) {
        fatoresSazonalidade.push({
          mes,
          fator: media / mediaConsumo
        });
      }
    });
    
    // Ordenar fatores por mês
    fatoresSazonalidade.sort((a, b) => a.mes - b.mes);
    
    // Verificar se há sazonalidade significativa
    const temSazonalidade = fatoresSazonalidade.some(f => f.fator > 1.3 || f.fator < 0.7);
    
    // NOVA FUNCIONALIDADE: Gerar previsão para os próximos 6 meses
    const previsaoPorMes: { mes: string; quantidade: number }[] = [];
    const hoje = new Date();
    
    for (let i = 1; i <= 6; i++) {
      const dataFutura = addDays(hoje, 30 * i);
      const mesFuturo = getMonth(dataFutura) + 1; // Mês de 1-12
      const mesAnoFuturo = format(dataFutura, 'yyyy-MM');
      
      // Aplicar fator de sazonalidade se disponível, ou tendência
      const fatorSazonal = fatoresSazonalidade.find(f => f.mes === mesFuturo)?.fator || 1;
      
      let quantidadePrevista = mediaConsumo * fatorSazonal;
      
      // Aplicar tendência (crescimento/decrescimento)
      if (consumoArray.length >= 3) {
        const taxaCrescimento = tendencia / consumoArray.length;
        quantidadePrevista *= (1 + (taxaCrescimento * 0.1 * i));
      }
      
      previsaoPorMes.push({
        mes: mesAnoFuturo,
        quantidade: Math.round(Math.max(0, quantidadePrevista))
      });
    }
    
    // Determinar o tipo de padrão
    let tipo: 'sazonal' | 'regular' | 'irregular' | 'crescente' | 'decrescente';
    let confianca = 0.5; // confiança padrão
    let descricao = '';
    
    if (temSazonalidade && fatoresSazonalidade.length >= 4) {
      tipo = 'sazonal';
      
      // Calcular confiança baseada na consistência dos dados
      const consistenciaSazonal = Math.min(
        1, 
        dadosPorMes.size / 12 // Quantos meses diferentes temos dados?
      );
      
      confianca = 0.6 + (consistenciaSazonal * 0.3);
      
      // Identificar meses com maior e menor consumo
      const mesesOrdenados = [...fatoresSazonalidade]
        .sort((a, b) => b.fator - a.fator);
      
      const mesMaior = mesesOrdenados[0].mes;
      const mesMenor = mesesOrdenados[mesesOrdenados.length - 1].mes;
      
      const nomeMesMaior = format(new Date(2023, mesMaior - 1, 1), 'MMMM');
      const nomeMesMenor = format(new Date(2023, mesMenor - 1, 1), 'MMMM');
      
      descricao = `Padrão sazonal identificado com pico em ${nomeMesMaior} e menor consumo em ${nomeMesMenor}`;
    } else if (tendencia > consumoArray.length * 0.5) {
      tipo = 'crescente';
      confianca = 0.7 + (tendencia / consumoArray.length) * 0.3;
      
      // Calcular taxa de crescimento
      const primeiros = consumoArray.slice(0, Math.ceil(consumoArray.length / 2));
      const ultimos = consumoArray.slice(Math.ceil(consumoArray.length / 2));
      
      const mediaPrimeiros = primeiros.reduce((sum, item) => sum + item.quantidade, 0) / primeiros.length;
      const mediaUltimos = ultimos.reduce((sum, item) => sum + item.quantidade, 0) / ultimos.length;
      
      const taxaCrescimento = (mediaUltimos / mediaPrimeiros - 1) * 100;
      
      descricao = `Consumo em tendência crescente de ${taxaCrescimento.toFixed(1)}% (${Math.round(confianca * 100)}% de confiança)`;
    } else if (tendencia < -consumoArray.length * 0.5) {
      tipo = 'decrescente';
      confianca = 0.7 + (Math.abs(tendencia) / consumoArray.length) * 0.3;
      
      // Calcular taxa de decréscimo
      const primeiros = consumoArray.slice(0, Math.ceil(consumoArray.length / 2));
      const ultimos = consumoArray.slice(Math.ceil(consumoArray.length / 2));
      
      const mediaPrimeiros = primeiros.reduce((sum, item) => sum + item.quantidade, 0) / primeiros.length;
      const mediaUltimos = ultimos.reduce((sum, item) => sum + item.quantidade, 0) / ultimos.length;
      
      const taxaDecrescimo = (1 - mediaUltimos / mediaPrimeiros) * 100;
      
      descricao = `Consumo em tendência decrescente de ${taxaDecrescimo.toFixed(1)}% (${Math.round(confianca * 100)}% de confiança)`;
    } else if (coeficienteVariacao < 0.2) {
      tipo = 'regular';
      confianca = 0.8;
      descricao = 'Consumo regular e previsível';
    } else if (picos.length >= 2 || menorConsumo.length >= 2) {
      tipo = 'sazonal';
      confianca = 0.6 + (picos.length * 0.05);
      descricao = 'Padrão sazonal identificado com variações periódicas';
    } else {
      tipo = 'irregular';
      confianca = 0.4;
      descricao = 'Consumo irregular sem padrão claro identificado';
    }
    
    return {
      tipo,
      confianca,
      descricao,
      periodoAnalisado: {
        inicio: format(dataLimite, 'yyyy-MM-dd'),
        fim: format(new Date(), 'yyyy-MM-dd')
      },
      mediaConsumo,
      picos: picos.length > 0 ? picos : undefined,
      menorConsumo: menorConsumo.length > 0 ? menorConsumo : undefined,
      previsaoPorMes, // Nova propriedade
      sazonalidadeIdentificada: temSazonalidade ? fatoresSazonalidade : undefined // Nova propriedade
    };
  } catch (error) {
    console.error('Erro ao identificar padrão de consumo:', error);
    
    // Retornar um resultado padrão em caso de erro
    return {
      tipo: 'irregular',
      confianca: 0.1,
      descricao: 'Erro na análise de dados',
      periodoAnalisado: {
        inicio: format(subDays(new Date(), dias), 'yyyy-MM-dd'),
        fim: format(new Date(), 'yyyy-MM-dd')
      },
      mediaConsumo: 0
    };
  }
};

/**
 * Detecta possíveis anomalias em movimentações de estoque
 * Versão aprimorada com detecção de fraude e estimativa de impacto financeiro
 */
export const detectarAnomalias = async (): Promise<AnomaliaEstoque[]> => {
  try {
    // Carregar movimentações e produtos
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const produtosJson = await AsyncStorage.getItem('produtos');
    
    const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    const anomalias: AnomaliaEstoque[] = [];
    
    // Análise 1: Detectar movimentações muito acima do padrão histórico
    for (const produto of produtos) {
      if (!produto.id) continue;
      
      // Obter movimentações deste produto
      const movProduto = movimentacoes.filter(m => m.produto_id === produto.id);
      
      // Pular produtos com poucas movimentações
      if (movProduto.length < 5) continue;
      
      // Calcular média e desvio padrão das movimentações de saída
      const saidasQuantidades = movProduto
        .filter(m => m.tipo === 'saida')
        .map(m => m.quantidade);
      
      if (saidasQuantidades.length < 3) continue;
      
      const mediaSaidas = saidasQuantidades.reduce((sum, qty) => sum + qty, 0) / saidasQuantidades.length;
      const variancia = saidasQuantidades.reduce((sum, qty) => sum + Math.pow(qty - mediaSaidas, 2), 0) / saidasQuantidades.length;
      const desvioPadrao = Math.sqrt(variancia);
      
      // Detectar anomalias (movimentações > média + 3*desvio_padrão)
      const limiteAnomalia = mediaSaidas + 3 * desvioPadrao;
      
      const movimentacoesAnomalas = movProduto.filter(m => 
        m.tipo === 'saida' && m.quantidade > limiteAnomalia && m.quantidade > 5
      );
      
      // Adicionar anomalias encontradas
      movimentacoesAnomalas.forEach(mov => {
        if (!mov.data_movimentacao) return;
        
        // NOVA FUNCIONALIDADE: Estimar impacto financeiro
        // Vamos assumir um valor médio por unidade como 30 para a estimativa
        const valorMedioEstimado = 30;
        const impactoFinanceiro = Math.round((mov.quantidade - mediaSaidas) * valorMedioEstimado);
        
        anomalias.push({
          produtoId: produto.id!,
          tipo: 'movimentacao_suspeita',
          dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
          descricao: `Movimentação anômala de ${mov.quantidade} unidades (${Math.round(mov.quantidade / mediaSaidas * 100)}% acima da média) em ${format(parseISO(mov.data_movimentacao), 'dd/MM/yyyy')}`,
          severidade: mov.quantidade > limiteAnomalia * 1.5 ? 'alta' : 'media',
          sugestaoCorrecao: 'Verificar se houve erro de registro ou movimentação não autorizada',
          impactoFinanceiro
        });
      });
      
      // Análise 2: Verificar inconsistências de estoque (estoque negativo ou discrepâncias)
      const movimentacoesPorData = [...movProduto].sort((a, b) => {
        if (!a.data_movimentacao || !b.data_movimentacao) return 0;
        return parseISO(a.data_movimentacao).getTime() - parseISO(b.data_movimentacao).getTime();
      });
      
      let estoqueCalculado = 0;
      let ultimaData = '';
      
      for (const mov of movimentacoesPorData) {
        if (!mov.data_movimentacao) continue;
        
        if (mov.tipo === 'entrada') {
          estoqueCalculado += mov.quantidade;
        } else {
          estoqueCalculado -= mov.quantidade;
        }
        
        // Verificar estoque negativo após uma operação
        if (estoqueCalculado < 0) {
          // NOVA FUNCIONALIDADE: Estimar impacto financeiro de estoque negativo
          const impactoFinanceiro = Math.abs(estoqueCalculado) * 30; // Valor estimado
          
          anomalias.push({
            produtoId: produto.id!,
            tipo: 'estoque_inconsistente',
            dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
            descricao: `Estoque calculado ficou negativo (${estoqueCalculado}) após movimentação em ${format(parseISO(mov.data_movimentacao), 'dd/MM/yyyy')}`,
            severidade: 'alta',
            sugestaoCorrecao: 'Verificar se todas as entradas foram registradas corretamente',
            impactoFinanceiro
          });
          
          // Corrigir o estoque calculado para continuar a análise
          estoqueCalculado = 0;
        }
        
        ultimaData = mov.data_movimentacao;
      }
      
      // Verificar divergência entre estoque calculado e estoque atual
      const diferencaEstoque = Math.abs(estoqueCalculado - produto.quantidade);
      if (diferencaEstoque > 5 && diferencaEstoque > produto.quantidade * 0.1) {
        // NOVA FUNCIONALIDADE: Estimar impacto financeiro
        const impactoFinanceiro = diferencaEstoque * 30; // Valor médio estimado
        
        anomalias.push({
          produtoId: produto.id!,
          tipo: 'divergencia_inventario',
          dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
          descricao: `Divergência de ${diferencaEstoque} unidades entre estoque calculado (${estoqueCalculado}) e estoque atual (${produto.quantidade})`,
          severidade: diferencaEstoque > produto.quantidade * 0.2 ? 'alta' : 'media',
          sugestaoCorrecao: 'Realizar inventário físico para reconciliação de estoque',
          impactoFinanceiro
        });
      }
    }
    
    // NOVA FUNCIONALIDADE: Detecção de possível fraude baseada em padrões temporais
    // Verificar movimentações em horários não usuais
    const movimentacoesHorarioSuspeito = movimentacoes.filter(mov => {
      if (!mov.data_movimentacao) return false;
      
      const dataHora = parseISO(mov.data_movimentacao);
      const hora = dataHora.getHours();
      
      // Movimentações em horários suspeitos (22h - 6h)
      return (hora >= 22 || hora < 6);
    });
    
    // Agrupar movimentações suspeitas por produto
    const produtosComMovimentacoesSuspeitas = new Map<number, Movimentacao[]>();
    
    movimentacoesHorarioSuspeito.forEach(mov => {
      if (!produtosComMovimentacoesSuspeitas.has(mov.produto_id)) {
        produtosComMovimentacoesSuspeitas.set(mov.produto_id, []);
      }
      produtosComMovimentacoesSuspeitas.get(mov.produto_id)?.push(mov);
    });
    
    // Analisar produtos com movimentações suspeitas
    produtosComMovimentacoesSuspeitas.forEach((movSuspeitas, prodId) => {
      if (movSuspeitas.length >= 3) { // Se houver um padrão (3+ ocorrências)
        const produto = produtos.find(p => p.id === prodId);
        if (!produto) return;
        
        const produtoNome = produto.nome;
        const totalUnidades = movSuspeitas.reduce((sum, m) => sum + m.quantidade, 0);
        const impactoFinanceiro = totalUnidades * 30; // Valor médio estimado
        
        anomalias.push({
          produtoId: prodId,
          tipo: 'movimentacao_suspeita',
          dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
          descricao: `Padrão suspeito: ${movSuspeitas.length} movimentações fora do horário comercial para o produto ${produtoNome}`,
          severidade: 'alta',
          sugestaoCorrecao: 'Investigar movimentações realizadas fora do horário normal de operação',
          impactoFinanceiro
        });
      }
    });
    
    return anomalias;
  } catch (error) {
    console.error('Erro ao detectar anomalias:', error);
    return [];
  }
};

/**
 * Encontra produtos com padrões de consumo similares
 * Versão aprimorada com análise de correlação e detecção de substitutos
 */
export const encontrarProdutosSimilares = async (produtoId: number): Promise<{
  produtos: {
    id: number;
    nome: string;
    similaridade: number; // 0 a 1
    potencialSubstituto?: boolean; // Novo campo para indicar substituto
  }[];
  padraoReferencia: string;
}> => {
  try {
    // Analisar padrão do produto de referência
    const padraoProduto = await identificarPadraoConsumo(produtoId);
    
    // Carregar todos os produtos
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    // Carregar todas as movimentações
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Analisar cada produto para similaridade
    const produtosSimilares = [];
    
    for (const produto of produtos) {
      // Pular o próprio produto ou produtos sem ID
      if (!produto.id || produto.id === produtoId) continue;
      
      // Analisar o padrão deste produto
      const padrao = await identificarPadraoConsumo(produto.id);
      
      // Calcular similaridade baseada no tipo de padrão e média de consumo
      let similaridade = 0;
      
      // Similaridade de tipo de padrão (30% do score)
      if (padrao.tipo === padraoProduto.tipo) {
        similaridade += 0.3;
      }
      
      // Similaridade de média de consumo (40% do score)
      const maxMedia = Math.max(padrao.mediaConsumo, padraoProduto.mediaConsumo);
      const minMedia = Math.min(padrao.mediaConsumo, padraoProduto.mediaConsumo);
      
      if (maxMedia > 0) {
        const similaridadeMedia = minMedia / maxMedia;
        similaridade += similaridadeMedia * 0.4;
      }
      
      // Similaridade de sazonalidade (30% do score)
      const temPicos = !!padrao.picos && padrao.picos.length > 0;
      const produtoRefTemPicos = !!padraoProduto.picos && padraoProduto.picos.length > 0;
      
      if (temPicos === produtoRefTemPicos) {
        similaridade += 0.15;
        
        // Verificar se os picos coincidem em períodos similares
        if (temPicos && produtoRefTemPicos && padrao.picos && padraoProduto.picos) {
          const picosProduto = new Set(padrao.picos.map(p => p.data.substring(0, 7))); // Ano-mês
          const picosProdutoRef = new Set(padraoProduto.picos.map(p => p.data.substring(0, 7)));
          
          let coincidencias = 0;
          
          for (const pico of picosProduto) {
            if (picosProdutoRef.has(pico)) {
              coincidencias++;
            }
          }
          
          const maxCoincidencias = Math.min(picosProduto.size, picosProdutoRef.size);
          if (maxCoincidencias > 0) {
            similaridade += (coincidencias / maxCoincidencias) * 0.15;
          }
        }
      }
      
      // NOVA FUNCIONALIDADE: Analisar correlação inversa para detectar produtos substitutos
      let potencialSubstituto = false;
      
      // Verificar se quando um produto aumenta o consumo, o outro diminui
      const movProdutoRef = movimentacoes.filter(m => m.produto_id === produtoId && m.tipo === 'saida' && m.data_movimentacao);
      const movProduto = movimentacoes.filter(m => m.produto_id === produto.id && m.tipo === 'saida' && m.data_movimentacao);
      
      if (movProdutoRef.length >= 5 && movProduto.length >= 5) {
        // Agrupar por mês para análise de correlação
        const consumoPorMesProdutoRef = new Map<string, number>();
        const consumoPorMesProduto = new Map<string, number>();
        
        // Preencher dados do produto de referência
        movProdutoRef.forEach(mov => {
          if (!mov.data_movimentacao) return;
          const data = parseISO(mov.data_movimentacao);
          const mesAno = format(data, 'yyyy-MM');
          
          if (consumoPorMesProdutoRef.has(mesAno)) {
            consumoPorMesProdutoRef.set(mesAno, (consumoPorMesProdutoRef.get(mesAno) || 0) + mov.quantidade);
          } else {
            consumoPorMesProdutoRef.set(mesAno, mov.quantidade);
          }
        });
        
        // Preencher dados do produto comparado
        movProduto.forEach(mov => {
          if (!mov.data_movimentacao) return;
          const data = parseISO(mov.data_movimentacao);
          const mesAno = format(data, 'yyyy-MM');
          
          if (consumoPorMesProduto.has(mesAno)) {
            consumoPorMesProduto.set(mesAno, (consumoPorMesProduto.get(mesAno) || 0) + mov.quantidade);
          } else {
            consumoPorMesProduto.set(mesAno, mov.quantidade);
          }
        });
        
        // Meses em comum para análise
        const mesesComuns = [...consumoPorMesProdutoRef.keys()].filter(mes => consumoPorMesProduto.has(mes));
        
        if (mesesComuns.length >= 4) { // Precisamos de pelo menos 4 meses de dados
          const dadosProdutoRef: number[] = [];
          const dadosProduto: number[] = [];
          
          mesesComuns.forEach(mes => {
            dadosProdutoRef.push(consumoPorMesProdutoRef.get(mes) || 0);
            dadosProduto.push(consumoPorMesProduto.get(mes) || 0);
          });
          
          // Calcular correlação
          const correlacao = calcularCorrelacao(dadosProdutoRef, dadosProduto);
          
          // Se correlação negativa forte, provavelmente é um substituto
          if (correlacao < -0.6) {
            potencialSubstituto = true;
            // Produtos substitutos também são similares em termos de função
            similaridade = Math.max(similaridade, 0.7);
          }
        }
      }
      
      // Adicionar apenas produtos com similaridade significativa
      if (similaridade > 0.4) {
        produtosSimilares.push({
          id: produto.id,
          nome: produto.nome,
          similaridade: Math.min(similaridade, 1), // Limitar a 1
          potencialSubstituto
        });
      }
    }
    
    // Ordenar por similaridade
    produtosSimilares.sort((a, b) => b.similaridade - a.similaridade);
    
    return {
      produtos: produtosSimilares.slice(0, 5), // Retornar apenas os 5 mais similares
      padraoReferencia: padraoProduto.descricao
    };
  } catch (error) {
    console.error('Erro ao encontrar produtos similares:', error);
    return {
      produtos: [],
      padraoReferencia: 'Erro na análise'
    };
  }
};

/**
 * Gera recomendações personalizadas baseadas na análise dos dados
 * Versão aprimorada com análise de tendências e recomendações contextuais
 */
export const gerarRecomendacoes = async (produtoId: number): Promise<string[]> => {
  try {
    // Carregar dados do produto
    const produtosJson = await AsyncStorage.getItem('produtos');
    if (!produtosJson) {
      throw new Error('Produtos não encontrados');
    }
    
    const produtos: Produto[] = JSON.parse(produtosJson);
    const produto = produtos.find(p => p.id === produtoId);
    
    if (!produto) {
      throw new Error('Produto não encontrado');
    }
    
    // Analisar padrão de consumo
    const padrao = await identificarPadraoConsumo(produtoId);
    
    // Encontrar produtos similares
    const similares = await encontrarProdutosSimilares(produtoId);
    
    // Carregar anomalias de estoque
    const anomalias = await detectarAnomalias();
    const anomaliasProduto = anomalias.filter(a => a.produtoId === produtoId);
    
    // Gerar recomendações baseadas nas análises
    const recomendacoes: string[] = [];
    
    // NOVA FUNCIONALIDADE: Recomendações baseadas nas previsões futuras
    if (padrao.previsaoPorMes && padrao.previsaoPorMes.length > 0) {
      const proximosMeses = padrao.previsaoPorMes.slice(0, 3); // Próximos 3 meses
      const consumoTotal = proximosMeses.reduce((sum, m) => sum + m.quantidade, 0);
      
      if (consumoTotal > produto.quantidade) {
        recomendacoes.push(`⚠️ Alerta de Estoque: A previsão para os próximos 3 meses indica consumo de ${consumoTotal} unidades, mas você tem apenas ${produto.quantidade} em estoque.`);
      }
      
      // Recomendar melhor momento para compra
      if (padrao.tipo === 'sazonal' && padrao.sazonalidadeIdentificada) {
        const mesesBaixoConsumo = padrao.sazonalidadeIdentificada
          .filter(s => s.fator < 0.8)
          .map(s => format(new Date(2023, s.mes - 1, 1), 'MMMM'));
        
        if (mesesBaixoConsumo.length > 0) {
          recomendacoes.push(`💡 Compra Estratégica: Considere comprar este produto nos meses de ${mesesBaixoConsumo.join(', ')}, quando o consumo é historicamente mais baixo e os preços podem ser mais favoráveis.`);
        }
      }
    }
    
    // Recomendações baseadas no padrão de consumo
    switch (padrao.tipo) {
      case 'sazonal':
        recomendacoes.push('📊 Ajuste os níveis de estoque de acordo com a sazonalidade identificada, aumentando antes dos períodos de pico.');
        
        if (padrao.sazonalidadeIdentificada && padrao.sazonalidadeIdentificada.length > 0) {
          // Verificar se algum período sazonal está próximo
          const hoje = new Date();
          const mesAtual = getMonth(hoje) + 1;
          
          const fatorMesAtual = padrao.sazonalidadeIdentificada.find(s => s.mes === mesAtual)?.fator || 1;
          
          if (fatorMesAtual > 1.2) {
            recomendacoes.push(`⚠️ Período de Alta Demanda: O mês atual possui tendência de consumo ${Math.round((fatorMesAtual - 1) * 100)}% acima da média anual. Mantenha o estoque reforçado.`);
          }
        }
        
        if (padrao.picos && padrao.picos.length > 0) {
          // Verificar se algum pico está próximo (nos próximos 2 meses)
          const mesesPico = padrao.picos.map(p => p.data.substring(5, 7)); // Mês (MM)
          const mesAtual = format(new Date(), 'MM');
          const mesSeguinte = format(addDays(new Date(), 30), 'MM');
          
          if (mesesPico.includes(mesAtual) || mesesPico.includes(mesSeguinte)) {
            recomendacoes.push('⚠️ Atenção: Um período de alta demanda histórica está se aproximando. Considere aumentar o estoque preventivamente.');
          }
        }
        
        break;
        
      case 'crescente':
        recomendacoes.push('📈 Tendência de aumento no consumo identificada. Considere revisar o estoque mínimo para acompanhar o crescimento.');
        
        const aumentoPercentual = Math.round((padrao.confianca - 0.5) * 200);
        
        // Nova recomendação mais específica
        const novoEstoqueMinimo = Math.ceil((produto.quantidade_minima || 5) * (1 + aumentoPercentual/100));
        recomendacoes.push(`🔢 Recomendamos aumentar o estoque mínimo de ${produto.quantidade_minima || 5} para ${novoEstoqueMinimo} unidades para adequar-se à tendência de crescimento.`);
        
        break;
        
      case 'decrescente':
        recomendacoes.push('📉 Tendência de redução no consumo identificada. Considere diminuir as compras para evitar estoque excessivo.');
        
        if (padrao.confianca > 0.7) {
          // Calcular taxa de redução
          const reducaoPercentual = Math.round((padrao.confianca - 0.5) * 200);
          
          // Verificar se há excesso de estoque
          if (produto.quantidade > (produto.quantidade_minima || 5) * 2) {
            recomendacoes.push(`⚠️ Alerta de Excesso: Com a tendência de queda de ${reducaoPercentual}%, seu estoque atual de ${produto.quantidade} unidades pode ser excessivo. Considere pausar compras até reduzir o nível.`);
          }
          
          recomendacoes.push('🔎 A queda consistente no consumo sugere reavaliação da relevância deste produto no catálogo.');
        }
        
        break;
        
      case 'regular':
        // Calcular estoque ideal baseado no tempo de reposição e consumo médio
        const tempoReposicaoDias = 15; // Tempo estimado de reposição em dias
        const consumoDiario = padrao.mediaConsumo / 30;
        const estoqueSeguranca = Math.ceil(consumoDiario * tempoReposicaoDias * 1.5); // 50% a mais como margem
        const estoqueIdeal = Math.ceil(padrao.mediaConsumo * 2); // 2 meses de estoque
        
        if (produto.quantidade < estoqueIdeal * 0.7) {
          recomendacoes.push(`📊 O padrão de consumo é constante e previsível. Recomendamos:
- Estoque mínimo: ${estoqueSeguranca} unidades (cobre o tempo de reposição)
- Estoque ideal: ${estoqueIdeal} unidades (cobertura de 2 meses)
- Ponto de pedido: ${Math.ceil(estoqueSeguranca * 1.2)} unidades`);
        } else {
          recomendacoes.push('✅ O consumo regular permite uma gestão de estoque previsível. Mantenha o estoque atual que está adequado.');
        }
        
        break;
        
      case 'irregular':
        recomendacoes.push('⚠️ Consumo irregular dificulta previsões precisas. Monitore mais de perto e mantenha uma margem de segurança maior.');
        
        if (padrao.confianca < 0.4) {
          // NOVA FUNCIONALIDADE: Análise contextual mais profunda
          recomendacoes.push('🔍 Avalie se fatores externos estão influenciando a irregularidade no consumo deste produto. Considere:');
          recomendacoes.push('- Verificar se há correlação com eventos sazonais ou campanhas de marketing');
          recomendacoes.push('- Analisar se fornecedores instáveis afetam a disponibilidade do produto');
          recomendacoes.push('- Considerar se produtos similares estão competindo pelo mesmo consumo');
        }
        
        break;
    }
    
    // NOVA FUNCIONALIDADE: Analisar anomalias específicas deste produto
    if (anomaliasProduto.length > 0) {
      const anomaliasRecentes = anomaliasProduto.filter(a => {
        const dataDeteccao = parseISO(a.dataDeteccao);
        const diasAtras = differenceInDays(new Date(), dataDeteccao);
        return diasAtras <= 30; // Anomalias nos últimos 30 dias
      });
      
      if (anomaliasRecentes.length > 0) {
        const anomaliaUrgente = anomaliasRecentes.find(a => a.severidade === 'alta');
        
        if (anomaliaUrgente) {
          recomendacoes.push(`🚨 ALERTA: Detectamos uma anomalia de severidade alta recentemente. ${anomaliaUrgente.descricao}`);
          
          if (anomaliaUrgente.impactoFinanceiro && anomaliaUrgente.impactoFinanceiro > 0) {
            recomendacoes.push(`💰 Impacto financeiro estimado: R$ ${anomaliaUrgente.impactoFinanceiro.toFixed(2)}`);
          }
          
          if (anomaliaUrgente.sugestaoCorrecao) {
            recomendacoes.push(`🔧 Recomendação: ${anomaliaUrgente.sugestaoCorrecao}`);
          }
        } else {
          recomendacoes.push(`⚠️ Atenção: Detectamos ${anomaliasRecentes.length} anomalias de baixa/média severidade nos últimos 30 dias. Monitore a situação.`);
        }
      }
    }
    
    // Recomendações baseadas em produtos similares
    if (similares.produtos.length > 0) {
      // Verificar se há substitutos
      const substitutos = similares.produtos.filter(p => p.potencialSubstituto);
      
      if (substitutos.length > 0) {
        const nomesSubstitutos = substitutos.map(p => p.nome).join(', ');
        recomendacoes.push(`🔄 Produtos Substitutos: Identificamos que ${nomesSubstitutos} ${substitutos.length === 1 ? 'parece ser um substituto' : 'parecem ser substitutos'} para este produto. O consumo deles aumenta quando o deste diminui.`);
      }
      
      const maisSimlar = similares.produtos[0];
      
      // Verificar se produtos similares têm movimentações recentes que possam indicar tendências
      const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
      const movimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
      
      const ultimasMovSimilar = movimentacoes
        .filter(m => m.produto_id === maisSimlar.id)
        .sort((a, b) => {
          if (!a.data_movimentacao || !b.data_movimentacao) return 0;
          return parseISO(b.data_movimentacao).getTime() - parseISO(a.data_movimentacao).getTime();
        })
        .slice(0, 5);
      
      if (ultimasMovSimilar.length > 0) {
        const saidasRecentes = ultimasMovSimilar.filter(m => m.tipo === 'saida');
        const entradasRecentes = ultimasMovSimilar.filter(m => m.tipo === 'entrada');
        
        if (saidasRecentes.length > 3 && entradasRecentes.length === 0) {
          recomendacoes.push(`🔄 O produto similar "${maisSimlar.nome}" (${Math.round(maisSimlar.similaridade * 100)}% de similaridade) teve saídas recentes sem reposição. Isto pode indicar uma tendência que também afetará este produto.`);
        }
      }
      
      // NOVA FUNCIONALIDADE: Recomendação de compra conjunta mais detalhada
      if (similares.produtos.length >= 3 && similares.produtos[0].similaridade > 0.7) {
        const produtosNomes = similares.produtos.slice(0, 3).map(p => p.nome).join(', ');
        
        // Verificar quais desses produtos também estão com estoque baixo
        const produtosSimiliaresBaixoEstoque = similares.produtos.slice(0, 3)
          .filter(p => {
            const produtoSimilar = produtos.find(prod => prod.id === p.id);
            return produtoSimilar && produtoSimilar.quantidade <= (produtoSimilar.quantidade_minima || 5);
          });
        
        if (produtosSimiliaresBaixoEstoque.length > 0) {
          const nomesProdutosBaixoEstoque = produtosSimiliaresBaixoEstoque.map(p => p.nome).join(', ');
          recomendacoes.push(`💡 Oportunidade de Compra Conjunta: ${nomesProdutosBaixoEstoque} ${produtosSimiliaresBaixoEstoque.length === 1 ? 'está' : 'estão'} com estoque baixo. Fazer um pedido conjunto pode otimizar custos de transporte e possibilitar negociação de melhores preços.`);
        } else {
          recomendacoes.push(`🔄 Produtos Similares: Considere agrupar compras deste produto com ${produtosNomes} para otimizar logística e custos.`);
        }
      }
    }
    
    // Inserir um conselho específico baseado no produto e mais contextualizado
    if (produto.quantidade < (produto.quantidade_minima || 5) && padrao.mediaConsumo > 0) {
      const diasEstimados = Math.floor(produto.quantidade / (padrao.mediaConsumo / 30));
      
      if (diasEstimados < 14) {
        // NOVA FUNCIONALIDADE: Recomendação mais detalhada e urgente
        recomendacoes.unshift(`🚨 CRÍTICO: O estoque atual durará aproximadamente apenas ${diasEstimados} dias. Recomendamos:
1. Reposição imediata de pelo menos ${Math.ceil(padrao.mediaConsumo * 1.5) - produto.quantidade} unidades
2. Verificar disponibilidade com fornecedor ${produto.fornecedor || 'habitual'}
3. Considerar fonte alternativa se o prazo de entrega for superior a ${diasEstimados - 2} dias`);
      }
    }
    
    return recomendacoes;
  } catch (error) {
    console.error('Erro ao gerar recomendações:', error);
    return [
      'Não foi possível analisar completamente os dados deste produto.',
      'Recomendamos revisar manualmente o histórico de consumo para tomar decisões de estoque.'
    ];
  }
};

/**
 * Agrupa produtos por categorias de comportamento similar
 * Versão aprimorada com detecção de subcategorias e clusters mais precisos
 */
export const agruparProdutosPorCategoria = async (): Promise<CategoriaProduto[]> => {
  try {
    // Carregar todos os produtos
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    // Se não houver produtos suficientes, não faz sentido agrupar
    if (produtos.length < 5) {
      return [];
    }
    
    // Mapear categorias já definidas
    const categoriasExistentes = new Map<string, number[]>();
    
    for (const produto of produtos) {
      if (!produto.id || !produto.categoria) continue;
      
      if (categoriasExistentes.has(produto.categoria)) {
        categoriasExistentes.get(produto.categoria)?.push(produto.id);
      } else {
        categoriasExistentes.set(produto.categoria, [produto.id]);
      }
    }
    
    // Categorias existentes com 2 ou mais produtos
    const categorias: CategoriaProduto[] = [];
    
    for (const [categoria, produtosIds] of categoriasExistentes.entries()) {
      if (produtosIds.length < 2) continue;
      
      // Analisar padrão de cada produto na categoria
      const padroes = await Promise.all(
        produtosIds.map(id => identificarPadraoConsumo(id))
      );
      
      // Contar os tipos de padrão para determinar o predominante
      const contagem = new Map<string, number>();
      
      padroes.forEach(padrao => {
        const contAtual = contagem.get(padrao.tipo) || 0;
        contagem.set(padrao.tipo, contAtual + 1);
      });
      
      let padraoPredominante = '';
      let maxContagem = 0;
      
      for (const [tipo, count] of contagem.entries()) {
        if (count > maxContagem) {
          maxContagem = count;
          padraoPredominante = tipo;
        }
      }
      
      // Calcular similaridade (porcentagem de produtos com mesmo padrão)
      const similaridade = maxContagem / padroes.length;
      
      categorias.push({
        nome: categoria,
        produtosIds,
        similaridadeConsumo: similaridade,
        padraoPredominante
      });
    }
    
    // NOVA FUNCIONALIDADE: Subagrupamento para categorias grandes
    // Dividir categorias grandes em subclusters mais homogêneos
    const categoriasComSubgrupos: CategoriaProduto[] = [];
    
    for (const categoria of categorias) {
      if (categoria.produtosIds.length >= 8) { // Categorias grandes
        // Buscar correlações entre produtos da mesma categoria
        const subgrupos = await criarSubgrupos(categoria.produtosIds, categoria.nome);
        
        if (subgrupos.length > 1) {
          // Adicionar subgrupos em vez da categoria original
          categoriasComSubgrupos.push(...subgrupos);
        } else {
          // Manter categoria original
          categoriasComSubgrupos.push(categoria);
        }
      } else {
        // Manter categoria original para categorias menores
        categoriasComSubgrupos.push(categoria);
      }
    }
    
    // Identificar grupos de produtos com comportamento similar (para produtos sem categoria)
    const produtosSemCategoria = produtos.filter(p => p.id && !p.categoria).map(p => p.id) as number[];
    
    if (produtosSemCategoria.length >= 3) {
      const grupos = await identificarGruposComportamentoSimilar(produtosSemCategoria);
      
      // Adicionar os grupos identificados à lista de categorias
      categoriasComSubgrupos.push(...grupos);
    }
    
    // Ordenar por similaridade
    return categoriasComSubgrupos.sort((a, b) => b.similaridadeConsumo - a.similaridadeConsumo);
  } catch (error) {
    console.error('Erro ao agrupar produtos por categoria:', error);
    return [];
  }
};

/**
 * NOVA FUNCIONALIDADE: Análise de correlações entre produtos
 * Identifica como o consumo de diferentes produtos está relacionado
 */
export const analisarCorrelacoesProdutos = async (): Promise<CorrelacaoProdutos[]> => {
  try {
    // Carregar dados necessários
    const produtosJson = await AsyncStorage.getItem('produtos');
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    
    if (!produtosJson || !movimentacoesJson) {
      throw new Error('Dados indisponíveis');
    }
    
    const produtos: Produto[] = JSON.parse(produtosJson);
    const movimentacoes: Movimentacao[] = JSON.parse(movimentacoesJson);
    
    // Filtrar produtos com movimentações suficientes para análise
    const produtosComMovimentacoes = new Map<number, Movimentacao[]>();
    
    produtos.forEach(produto => {
      if (!produto.id) return;
      
      const movsProduto = movimentacoes.filter(
        m => m.produto_id === produto.id && m.tipo === 'saida' && m.data_movimentacao
      );
      
      if (movsProduto.length >= 5) {
        produtosComMovimentacoes.set(produto.id, movsProduto);
      }
    });
    
    // Se não houver produtos suficientes, não podemos calcular correlações
    if (produtosComMovimentacoes.size < 2) {
      return [];
    }
    
    // Agrupar movimentações por mês para cada produto
    const consumoPorMes = new Map<number, Map<string, number>>();
    
    produtosComMovimentacoes.forEach((movs, produtoId) => {
      const consumoMensal = new Map<string, number>();
      
      movs.forEach(mov => {
        if (!mov.data_movimentacao) return;
        
        const data = parseISO(mov.data_movimentacao);
        const mesAno = format(data, 'yyyy-MM');
        
        if (consumoMensal.has(mesAno)) {
          consumoMensal.set(mesAno, (consumoMensal.get(mesAno) || 0) + mov.quantidade);
        } else {
          consumoMensal.set(mesAno, mov.quantidade);
        }
      });
      
      consumoPorMes.set(produtoId, consumoMensal);
    });
    
    // Calcular correlações entre pares de produtos
    const correlacoes: CorrelacaoProdutos[] = [];
    const produtosIds = Array.from(produtosComMovimentacoes.keys());
    
    for (let i = 0; i < produtosIds.length; i++) {
      for (let j = i + 1; j < produtosIds.length; j++) {
        const produtoIdA = produtosIds[i];
        const produtoIdB = produtosIds[j];
        
        const consumoA = consumoPorMes.get(produtoIdA);
        const consumoB = consumoPorMes.get(produtoIdB);
        
        if (!consumoA || !consumoB) continue;
        
        // Encontrar meses comuns
        const mesesComuns = Array.from(consumoA.keys()).filter(mes => consumoB.has(mes));
        
        if (mesesComuns.length < 4) continue; // Precisamos de pelo menos 4 meses para uma análise significativa
        
        // Extrair dados para calcular correlação
        const valoresA: number[] = [];
        const valoresB: number[] = [];
        
        mesesComuns.forEach(mes => {
          valoresA.push(consumoA.get(mes) || 0);
          valoresB.push(consumoB.get(mes) || 0);
        });
        
        // Calcular coeficiente de correlação
        const coeficiente = calcularCorrelacao(valoresA, valoresB);
        
        // Determinar tipo de correlação
        let tipo: 'positiva' | 'negativa' | 'neutra';
        let confianca = Math.abs(coeficiente);
        let descricao = '';
        
        if (coeficiente > 0.6) {
          tipo = 'positiva';
          descricao = 'Forte correlação positiva: estes produtos tendem a ser consumidos juntos';
        } else if (coeficiente < -0.6) {
          tipo = 'negativa';
          descricao = 'Correlação negativa: um produto tende a substituir o outro';
        } else if (Math.abs(coeficiente) > 0.3) {
          tipo = coeficiente > 0 ? 'positiva' : 'negativa';
          descricao = `Correlação ${coeficiente > 0 ? 'positiva' : 'negativa'} moderada`;
        } else {
          tipo = 'neutra';
          confianca = 0.2;
          descricao = 'Sem correlação significativa entre estes produtos';
        }
        
        // Adicionar apenas correlações significativas
        if (Math.abs(coeficiente) > 0.4) {
          const produtoA = produtos.find(p => p.id === produtoIdA);
          const produtoB = produtos.find(p => p.id === produtoIdB);
          
          correlacoes.push({
            produtoA: produtoIdA,
            produtoB: produtoIdB,
            coeficienteCorrelacao: coeficiente,
            tipo,
            confianca,
            descricao: `${descricao} (${produtoA?.nome} e ${produtoB?.nome})`
          });
        }
      }
    }
    
    // Ordenar por força da correlação (absoluta)
    return correlacoes.sort((a, b) => Math.abs(b.coeficienteCorrelacao) - Math.abs(a.coeficienteCorrelacao));
  } catch (error) {
    console.error('Erro ao analisar correlações entre produtos:', error);
    return [];
  }
};

/**
 * Função auxiliar para identificar grupos de produtos com comportamento similar
 */
async function identificarGruposComportamentoSimilar(produtosIds: number[]): Promise<CategoriaProduto[]> {
  // Matriz de similaridade
  const similaridadeMatrix: Map<number, Map<number, number>> = new Map();
  
  // Calcular similaridade entre cada par de produtos
  for (let i = 0; i < produtosIds.length; i++) {
    const idA = produtosIds[i];
    
    // Analisar o produto A
    const padraoA = await identificarPadraoConsumo(idA);
    
    // Inicializar mapa para este produto
    similaridadeMatrix.set(idA, new Map());
    
    for (let j = i + 1; j < produtosIds.length; j++) {
      const idB = produtosIds[j];
      
      // Analisar o produto B
      const padraoB = await identificarPadraoConsumo(idB);
      
      // Calcular similaridade entre A e B
      let similaridade = 0;
      
      // Similaridade de tipo (50%)
      if (padraoA.tipo === padraoB.tipo) {
        similaridade += 0.5;
      }
      
      // Similaridade de média (30%)
      const maxMedia = Math.max(padraoA.mediaConsumo, padraoB.mediaConsumo);
      const minMedia = Math.min(padraoA.mediaConsumo, padraoB.mediaConsumo);
      
      if (maxMedia > 0) {
        similaridade += (minMedia / maxMedia) * 0.3;
      }
      
      // Similaridade de confiança (20%)
      const difConfianca = Math.abs(padraoA.confianca - padraoB.confianca);
      similaridade += (1 - difConfianca) * 0.2;
      
      // Armazenar similaridade
      similaridadeMatrix.get(idA)?.set(idB, similaridade);
      
      // Inicializar o outro lado da matriz se necessário
      if (!similaridadeMatrix.has(idB)) {
        similaridadeMatrix.set(idB, new Map());
      }
      
      similaridadeMatrix.get(idB)?.set(idA, similaridade);
    }
  }
  
  // Algoritmo de agrupamento
  const grupos: CategoriaProduto[] = [];
  const produtosAgrupados = new Set<number>();
  
  // Limiar mínimo de similaridade para considerar dois produtos similares
  const limiarSimilaridade = 0.7;
  
  // Para cada produto ainda não agrupado
  for (const id of produtosIds) {
    if (produtosAgrupados.has(id)) continue;
    
    // Encontrar produtos similares a este
    const similares = produtosIds.filter(outroId => {
      if (id === outroId || produtosAgrupados.has(outroId)) return false;
      
      const similaridade = similaridadeMatrix.get(id)?.get(outroId) || 0;
      return similaridade >= limiarSimilaridade;
    });
    
    // Se encontramos pelo menos 2 similares, temos um grupo
    if (similares.length >= 2) {
      const grupoIds = [id, ...similares];
      
      // Determinar o padrão predominante
      const padroesGrupo = await Promise.all(
        grupoIds.map(pid => identificarPadraoConsumo(pid))
      );
      
      const contagem = new Map<string, number>();
      
      padroesGrupo.forEach(padrao => {
        const contAtual = contagem.get(padrao.tipo) || 0;
        contagem.set(padrao.tipo, contAtual + 1);
      });
      
      let padraoPredominante = '';
      let maxContagem = 0;
      
      for (const [tipo, count] of contagem.entries()) {
        if (count > maxContagem) {
          maxContagem = count;
          padraoPredominante = tipo;
        }
      }
      
      // Similaridade média do grupo
      let somaSimil = 0;
      let contSimil = 0;
      
      for (let i = 0; i < grupoIds.length; i++) {
        for (let j = i + 1; j < grupoIds.length; j++) {
          somaSimil += similaridadeMatrix.get(grupoIds[i])?.get(grupoIds[j]) || 0;
          contSimil++;
        }
      }
      
      const similaridadeMedia = contSimil > 0 ? somaSimil / contSimil : 0;
      
      // Gerar um nome para o grupo baseado no padrão
      const nomeGrupo = `Grupo ${padraoPredominante[0].toUpperCase()}${padraoPredominante.substring(1)}`;
      
      grupos.push({
        nome: nomeGrupo,
        produtosIds: grupoIds,
        similaridadeConsumo: similaridadeMedia,
        padraoPredominante
      });
      
      // Marcar todos os produtos deste grupo como agrupados
      grupoIds.forEach(gid => produtosAgrupados.add(gid));
    }
  }
  
  return grupos;
}

/**
 * NOVA FUNCIONALIDADE: Criar subgrupos dentro de uma categoria grande
 */
async function criarSubgrupos(produtosIds: number[], categoriaPai: string): Promise<CategoriaProduto[]> {
  // Usar técnica similar ao agrupamento, mas com limiar menor por já serem da mesma categoria
  const limiarSimilaridade = 0.6; // Mais flexível por já serem da mesma categoria
  
  // Matriz de similaridade
  const similaridadeMatrix: Map<number, Map<number, number>> = new Map();
  
  // Calcular similaridade entre cada par de produtos
  for (let i = 0; i < produtosIds.length; i++) {
    const idA = produtosIds[i];
    
    // Analisar o produto A
    const padraoA = await identificarPadraoConsumo(idA);
    
    // Inicializar mapa para este produto
    similaridadeMatrix.set(idA, new Map());
    
    for (let j = i + 1; j < produtosIds.length; j++) {
      const idB = produtosIds[j];
      
      // Analisar o produto B
      const padraoB = await identificarPadraoConsumo(idB);
      
      // Calcular similaridade entre A e B com ênfase no padrão de consumo
      let similaridade = 0;
      
      // Similaridade de tipo (60%)
      if (padraoA.tipo === padraoB.tipo) {
        similaridade += 0.6;
      }
      
      // Similaridade de média (20%)
      const maxMedia = Math.max(padraoA.mediaConsumo, padraoB.mediaConsumo);
      const minMedia = Math.min(padraoA.mediaConsumo, padraoB.mediaConsumo);
      
      if (maxMedia > 0) {
        similaridade += (minMedia / maxMedia) * 0.2;
      }
      
      // Similaridade de sazonalidade (20%)
      if (padraoA.sazonalidadeIdentificada && padraoB.sazonalidadeIdentificada) {
        let similaridadeSazonal = 0;
        
        for (let mes = 1; mes <= 12; mes++) {
          const fatorA = padraoA.sazonalidadeIdentificada.find(s => s.mes === mes)?.fator || 1;
          const fatorB = padraoB.sazonalidadeIdentificada.find(s => s.mes === mes)?.fator || 1;
          
          const diferenca = Math.abs(fatorA - fatorB);
          similaridadeSazonal += (1 - diferenca);
        }
        
        similaridade += (similaridadeSazonal / 12) * 0.2;
      }
      
      // Armazenar similaridade
      similaridadeMatrix.get(idA)?.set(idB, similaridade);
      
      // Inicializar o outro lado da matriz se necessário
      if (!similaridadeMatrix.has(idB)) {
        similaridadeMatrix.set(idB, new Map());
      }
      
      similaridadeMatrix.get(idB)?.set(idA, similaridade);
    }
  }
  
  // Aplicar algoritmo de clusterização hierárquica (versão simplificada)
  const subgrupos: CategoriaProduto[] = [];
  const produtosAgrupados = new Set<number>();
  
  while (produtosAgrupados.size < produtosIds.length) {
    // Encontrar par de maior similaridade entre produtos não agrupados
    let maxSimilaridade = 0;
    let parMaisSimilar: [number, number] | null = null;
    
    for (let i = 0; i < produtosIds.length; i++) {
      const idA = produtosIds[i];
      if (produtosAgrupados.has(idA)) continue;
      
      for (let j = i + 1; j < produtosIds.length; j++) {
        const idB = produtosIds[j];
        if (produtosAgrupados.has(idB)) continue;
        
        const similaridade = similaridadeMatrix.get(idA)?.get(idB) || 0;
        
        if (similaridade > maxSimilaridade) {
          maxSimilaridade = similaridade;
          parMaisSimilar = [idA, idB];
        }
      }
    }
    
    if (!parMaisSimilar || maxSimilaridade < limiarSimilaridade) {
      // Se não encontramos pares suficientemente similares, colocamos os produtos restantes em um subgrupo genérico
      const produtosRestantes = produtosIds.filter(id => !produtosAgrupados.has(id));
      
      if (produtosRestantes.length > 0) {
        subgrupos.push({
          nome: `${categoriaPai} - Diversos`,
          produtosIds: produtosRestantes,
          similaridadeConsumo: 0.4, // Similaridade baixa por ser grupo genérico
          padraoPredominante: 'misto'
        });
        
        produtosRestantes.forEach(id => produtosAgrupados.add(id));
      }
      
      break;
    }
    
    // Iniciar um novo subgrupo com o par mais similar
    const [idA, idB] = parMaisSimilar;
    const sementesGrupo = [idA, idB];
    produtosAgrupados.add(idA);
    produtosAgrupados.add(idB);
    
    // Encontrar outros produtos similares para este grupo
    const outrosProdutosSimilares = produtosIds.filter(id => {
      if (produtosAgrupados.has(id)) return false;
      
      // Calcular similaridade média com os produtos no grupo
      let somaSimil = 0;
      for (const idNoGrupo of sementesGrupo) {
        somaSimil += similaridadeMatrix.get(id)?.get(idNoGrupo) || 0;
      }
      
      const similMedia = somaSimil / sementesGrupo.length;
      return similMedia >= limiarSimilaridade;
    });
    
    // Adicionar outros produtos ao grupo
    outrosProdutosSimilares.forEach(id => {
      sementesGrupo.push(id);
      produtosAgrupados.add(id);
    });
    
    // Determinar padrão predominante para este subgrupo
    const padroesGrupo = await Promise.all(
      sementesGrupo.map(id => identificarPadraoConsumo(id))
    );
    
    const contagemTipos = new Map<string, number>();
    padroesGrupo.forEach(padrao => {
      const contAtual = contagemTipos.get(padrao.tipo) || 0;
      contagemTipos.set(padrao.tipo, contAtual + 1);
    });
    
    let padraoPredominante = '';
    let maxContagem = 0;
    
    for (const [tipo, contagem] of contagemTipos.entries()) {
      if (contagem > maxContagem) {
        maxContagem = contagem;
        padraoPredominante = tipo;
      }
    }
    
    // Calcular similaridade média do grupo
    let somaSimil = 0;
    let contSimil = 0;
    
    for (let i = 0; i < sementesGrupo.length; i++) {
      for (let j = i + 1; j < sementesGrupo.length; j++) {
        somaSimil += similaridadeMatrix.get(sementesGrupo[i])?.get(sementesGrupo[j]) || 0;
        contSimil++;
      }
    }
    
    const similaridadeMedia = contSimil > 0 ? somaSimil / contSimil : 0;
    
    // Adicionar subgrupo
    subgrupos.push({
      nome: `${categoriaPai} - ${padraoPredominante[0].toUpperCase()}${padraoPredominante.slice(1)}`,
      produtosIds: sementesGrupo,
      similaridadeConsumo: similaridadeMedia,
      padraoPredominante
    });
  }
  
  return subgrupos;
}

/**
 * FUNÇÃO AUXILIAR: Calcula o coeficiente de correlação de Pearson entre dois arrays
 */
function calcularCorrelacao(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }
  
  // Calcular médias
  const mediaX = x.reduce((sum, val) => sum + val, 0) / x.length;
  const mediaY = y.reduce((sum, val) => sum + val, 0) / y.length;
  
  // Calcular desvios e produtos
  let numerador = 0;
  let denominadorX = 0;
  let denominadorY = 0;
  
  for (let i = 0; i < x.length; i++) {
    const desvioX = x[i] - mediaX;
    const desvioY = y[i] - mediaY;
    
    numerador += desvioX * desvioY;
    denominadorX += desvioX * desvioX;
    denominadorY += desvioY * desvioY;
  }
  
  // Verificar se o denominador é zero
  if (denominadorX === 0 || denominadorY === 0) {
    return 0;
  }
  
  // Calcular coeficiente de correlação de Pearson
  return numerador / Math.sqrt(denominadorX * denominadorY);
}