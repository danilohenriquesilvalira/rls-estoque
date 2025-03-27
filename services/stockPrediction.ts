// services/stockPrediction.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, parseISO, differenceInDays, differenceInMonths, getMonth, getYear, subDays, isAfter, isBefore, isSameMonth } from 'date-fns';

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
  fornecedor?: string; // Adicionado fornecedor à interface
  categoria?: string;  // Adicionado categoria à interface
  localizacao?: string;
}

interface PredictionResult {
  diasRestantes: number | null;
  dataEstimadaEsgotamento: string | null;
  consumoDiario: number;
  confianca: 'alta' | 'media' | 'baixa';
  necessidadeCompra: boolean;
  quantidadeRecomendada: number;
  previsaoMensal?: { [mes: string]: number }; // Nova propriedade para previsão mensal
  custoEstimadoCompra?: number; // Nova propriedade para custo estimado
  probabilidadeEsgotamento?: number; // Nova propriedade para probabilidade
  alertaPrioridade?: number; // 1-10, onde 10 é máxima prioridade
}

// Nova interface para análise de temporalidade
interface TemporalidadeConsumo {
  sazonalidade: boolean;
  fatoresSazonais: { [mes: number]: number };
  ciclos: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'irregular';
  tendencia: 'crescente' | 'decrescente' | 'estavel';
  taxaVariacao: number; // Percentual de variação da tendência
}

// Nova interface para cenários preditivos
interface CenarioPreditivo {
  tipo: 'otimista' | 'realista' | 'pessimista';
  diasRestantes: number | null;
  dataEsgotamento: string | null;
  probabilidade: number; // 0-1
  desvioEsperado: number; // Desvio padrão do erro
}

/**
 * Calcula estatísticas de consumo e previsões para um produto
 * Versão aprimorada com análise de sazonalidade e múltiplos cenários
 * 
 * @param produtoId ID do produto para analisar
 * @param dias Número de dias para analisar no histórico (padrão: 90)
 * @returns Objeto com previsões e recomendações
 */
export const preverEsgotamentoEstoque = async (produtoId: number, dias: number = 90): Promise<PredictionResult> => {
  try {
    // Carregar dados do produto
    const produtosJson = await AsyncStorage.getItem('produtos');
    if (!produtosJson) {
      throw new Error('Dados de produtos não encontrados');
    }
    
    const produtos: Produto[] = JSON.parse(produtosJson);
    const produto = produtos.find(p => p.id === produtoId);
    
    if (!produto) {
      throw new Error('Produto não encontrado');
    }
    
    // Carregar histórico de movimentações
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const todasMovimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Filtrar movimentações relevantes para este produto e período
    const dataLimite = subDays(new Date(), dias);
    
    const movimentacoesFiltradas = todasMovimentacoes.filter(mov => {
      if (mov.produto_id !== produtoId) return false;
      if (!mov.data_movimentacao) return false;
      
      const dataMovimentacao = parseISO(mov.data_movimentacao);
      return isAfter(dataMovimentacao, dataLimite);
    });
    
    // Se não houver movimentações suficientes, tentar obter movimentações mais antigas
    if (movimentacoesFiltradas.length < 5) {
      // Buscar movimentações de até 6 meses atrás
      const dataLimiteExtendida = subDays(new Date(), 180);
      
      const movimentacoesExtendidas = todasMovimentacoes.filter(mov => {
        if (mov.produto_id !== produtoId) return false;
        if (!mov.data_movimentacao) return false;
        
        const dataMovimentacao = parseISO(mov.data_movimentacao);
        return isAfter(dataMovimentacao, dataLimiteExtendida);
      });
      
      // Se ainda não houver movimentações suficientes
      if (movimentacoesExtendidas.length < 3) {
        const minQuantity = produto.quantidade_minima || 5; // Usar valor padrão se undefined
        return {
          diasRestantes: null,
          dataEstimadaEsgotamento: null,
          consumoDiario: 0,
          confianca: 'baixa',
          necessidadeCompra: produto.quantidade <= minQuantity,
          quantidadeRecomendada: produto.quantidade <= minQuantity ? 
            Math.max(minQuantity * 2 - produto.quantidade, 0) : 0,
          alertaPrioridade: produto.quantidade <= minQuantity ? 8 : 2,
          probabilidadeEsgotamento: produto.quantidade <= minQuantity ? 0.8 : 0.2
        };
      }
      
      // Usar dados estendidos se necessário
      if (movimentacoesFiltradas.length < 5) {
        movimentacoesFiltradas.push(...movimentacoesExtendidas.filter(
          mov => !movimentacoesFiltradas.some(m => m.id === mov.id)
        ));
      }
    }
    
    // Agrupar movimentações por mês para analisar sazonalidade
    const saidasPorMes = new Map<string, number>(); // formato YYYY-MM
    
    movimentacoesFiltradas
      .filter(mov => mov.tipo === 'saida' && mov.data_movimentacao)
      .forEach(mov => {
        const dataMovimentacao = parseISO(mov.data_movimentacao!);
        const mesAno = format(dataMovimentacao, 'yyyy-MM');
        
        if (saidasPorMes.has(mesAno)) {
          saidasPorMes.set(mesAno, (saidasPorMes.get(mesAno) || 0) + mov.quantidade);
        } else {
          saidasPorMes.set(mesAno, mov.quantidade);
        }
      });
    
    // NOVA FUNCIONALIDADE: Analisar temporalidade e sazonalidade
    const temporalidade = analisarTemporalidade(saidasPorMes);
    
    // Calcular saídas totais no período para média geral
    const saidasTotais = movimentacoesFiltradas
      .filter(mov => mov.tipo === 'saida')
      .reduce((sum, mov) => sum + mov.quantidade, 0);
    
    // Calcular consumo médio diário (base)
    const consumoDiarioBase = saidasTotais / dias;
    
    // NOVA FUNCIONALIDADE: Aplicar ajuste sazonal se detectado
    let consumoDiario = consumoDiarioBase;
    const hoje = new Date();
    const mesAtual = getMonth(hoje) + 1; // 1-12
    
    if (temporalidade.sazonalidade) {
      // Ajustar consumo diário baseado no fator sazonal do mês atual
      const fatorSazonal = temporalidade.fatoresSazonais[mesAtual] || 1;
      consumoDiario = consumoDiarioBase * fatorSazonal;
    }
    
    // NOVA FUNCIONALIDADE: Aplicar ajuste de tendência
    if (temporalidade.tendencia !== 'estavel') {
      // Ajustar consumo baseado na tendência (crescente ou decrescente)
      const ajusteTendencia = 1 + (temporalidade.taxaVariacao / 100);
      consumoDiario *= ajusteTendencia;
    }
    
    // Se o consumo for zero, não há previsão de esgotamento
    if (consumoDiario <= 0) {
      return {
        diasRestantes: null,
        dataEstimadaEsgotamento: null,
        consumoDiario: 0,
        confianca: 'alta',
        necessidadeCompra: false,
        quantidadeRecomendada: 0,
        previsaoMensal: {},
        alertaPrioridade: 1,
        probabilidadeEsgotamento: 0.05
      };
    }
    
    // NOVA FUNCIONALIDADE: Calcular cenários preditivos (otimista, realista, pessimista)
    const cenarios = calcularCenariosPreditivos(produto.quantidade, consumoDiario, temporalidade);
    
    // Usar o cenário realista como base
    const cenarioRealista = cenarios.find(c => c.tipo === 'realista') || cenarios[0];
    const diasRestantes = cenarioRealista.diasRestantes;
    const dataEsgotamento = cenarioRealista.dataEsgotamento;
    
    // NOVA FUNCIONALIDADE: Gerar previsão mensal para os próximos 6 meses
    const previsaoMensal: { [mes: string]: number } = {};
    
    for (let i = 0; i < 6; i++) {
      const dataFutura = addDays(hoje, 30 * i);
      const mesFuturo = getMonth(dataFutura) + 1; // 1-12
      const mesAnoFuturo = format(dataFutura, 'yyyy-MM');
      
      // Aplicar fator sazonal se disponível
      const fatorSazonal = temporalidade.sazonalidade ? 
        (temporalidade.fatoresSazonais[mesFuturo] || 1) : 1;
      
      // Ajustar para tendência
      const ajusteTendencia = temporalidade.tendencia !== 'estavel' ? 
        (1 + (temporalidade.taxaVariacao * i / 100)) : 1;
      
      const consumoMensal = Math.round(consumoDiarioBase * 30 * fatorSazonal * ajusteTendencia);
      previsaoMensal[mesAnoFuturo] = consumoMensal;
    }
    
    // Determinar nível de confiança com mais precisão
    let confianca: 'alta' | 'media' | 'baixa';
    
    if (movimentacoesFiltradas.length > 15 && temporalidade.ciclos !== 'irregular') {
      confianca = 'alta';
    } else if (movimentacoesFiltradas.length > 8) {
      confianca = 'media';
    } else {
      confianca = 'baixa';
    }
    
    // NOVA FUNCIONALIDADE: Calcular necessidade de compra com mais parâmetros
    // Considerar tempo de reposição estimado (assumindo 14 dias como padrão)
    const tempoReposicaoEstimado = 14;
    const estoqueSeguranca = Math.ceil(consumoDiario * tempoReposicaoEstimado * 1.2); // 20% a mais como margem
    
    // Necessidade imediata se estoque atual <= estoque segurança ou dias restantes <= tempo reposição + 7 dias de margem
    const necessidadeCompra = 
      produto.quantidade <= estoqueSeguranca || 
      (diasRestantes !== null && diasRestantes <= (tempoReposicaoEstimado + 7));
    
    // NOVA FUNCIONALIDADE: Cálculo mais sofisticado da quantidade recomendada
    // Considerar consumo projetado para os próximos 2 meses com fatores sazonais
    let consumoProjetado = 0;
    
    // Projetar consumo para os próximos 60 dias considerando sazonalidade e tendência
    for (let i = 0; i < 60; i++) {
      const dataFutura = addDays(hoje, i);
      const mesFuturo = getMonth(dataFutura) + 1;
      
      // Aplicar fator sazonal
      const fatorSazonal = temporalidade.sazonalidade ? 
        (temporalidade.fatoresSazonais[mesFuturo] || 1) : 1;
      
      // Aplicar tendência
      const ajusteTendencia = temporalidade.tendencia !== 'estavel' ? 
        (1 + (temporalidade.taxaVariacao * i / 6000)) : 1; // Suavizar efeito da tendência ao nível diário
      
      consumoProjetado += consumoDiarioBase * fatorSazonal * ajusteTendencia;
    }
    
    // Calcular quantidade a comprar baseada no consumo projetado, estoque atual e estoque de segurança
    const quantidadeBaseRecomendada = Math.ceil(consumoProjetado - produto.quantidade + estoqueSeguranca);
    
    // Garantir que a quantidade seja pelo menos o necessário para chegar ao estoque mínimo
    const estoqueMinimo = produto.quantidade_minima || Math.ceil(consumoDiario * 30);
    const quantidadeParaMinimo = Math.max(0, estoqueMinimo - produto.quantidade);
    
    const quantidadeRecomendada = Math.max(quantidadeBaseRecomendada, quantidadeParaMinimo);
    
    // NOVA FUNCIONALIDADE: Estimar custo da compra (assumindo preço médio unitário de R$ 30)
    // Em uma implementação real, isso viria de uma tabela de preços ou histórico de compras
    const precoMedioUnitario = 30;
    const custoEstimadoCompra = quantidadeRecomendada * precoMedioUnitario;
    
    // NOVA FUNCIONALIDADE: Calcular probabilidade de esgotamento com base nos cenários
    const cenarioPessimista = cenarios.find(c => c.tipo === 'pessimista');
    const probabilidadeEsgotamento = cenarioPessimista ? 
      // Se dias no cenário pessimista < 30, alta probabilidade de esgotamento
      (cenarioPessimista.diasRestantes !== null && cenarioPessimista.diasRestantes < 30 ? 
        (1 - cenarioPessimista.diasRestantes / 30) * cenarioPessimista.probabilidade : 
        cenarioPessimista.probabilidade * 0.5) : 0.5;
    
    // NOVA FUNCIONALIDADE: Definir prioridade de alerta (1-10)
    let alertaPrioridade = 5; // Valor padrão médio
    
    if (diasRestantes !== null) {
      if (diasRestantes <= 7) {
        alertaPrioridade = 10; // Urgência máxima - menos de uma semana
      } else if (diasRestantes <= 14) {
        alertaPrioridade = 9; // Alta urgência - menos de duas semanas
      } else if (diasRestantes <= tempoReposicaoEstimado) {
        alertaPrioridade = 8; // Urgente - menos que o tempo de reposição
      } else if (diasRestantes <= 30) {
        alertaPrioridade = 7; // Atenção - menos de um mês
      } else if (diasRestantes <= 60) {
        alertaPrioridade = 5; // Moderado - menos de dois meses
      } else {
        alertaPrioridade = 3; // Baixo - mais de dois meses
      }
    } else {
      // Sem estimativa de esgotamento
      if (produto.quantidade <= estoqueSeguranca) {
        alertaPrioridade = 6; // Prioridade média-alta se abaixo do estoque de segurança
      } else if (produto.quantidade_minima && produto.quantidade <= produto.quantidade_minima * 1.2) {
        alertaPrioridade = 4; // Prioridade média se próximo do mínimo
      } else {
        alertaPrioridade = 2; // Baixa prioridade
      }
    }
    
    // Ajustar prioridade com base na confiança
    if (confianca === 'baixa') {
      alertaPrioridade = Math.min(alertaPrioridade + 1, 10); // Aumentar prioridade por precaução
    }
    
    return {
      diasRestantes,
      dataEstimadaEsgotamento: dataEsgotamento,
      consumoDiario,
      confianca,
      necessidadeCompra,
      quantidadeRecomendada: Math.max(0, quantidadeRecomendada),
      previsaoMensal,
      custoEstimadoCompra,
      probabilidadeEsgotamento,
      alertaPrioridade
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
 * NOVA FUNÇÃO: Analisar padrões temporais nas movimentações
 * Identifica sazonalidade, ciclos e tendências
 */
function analisarTemporalidade(saidasPorMes: Map<string, number>): TemporalidadeConsumo {
  // Converter para array para facilitar análise
  const arraySaidas = Array.from(saidasPorMes.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mesAno, quantidade]) => ({ 
      mesAno,
      mes: parseInt(mesAno.substring(5, 7)), // 1-12
      ano: parseInt(mesAno.substring(0, 4)),
      quantidade 
    }));
  
  if (arraySaidas.length < 3) {
    // Dados insuficientes para análise
    return {
      sazonalidade: false,
      fatoresSazonais: {},
      ciclos: 'irregular',
      tendencia: 'estavel',
      taxaVariacao: 0
    };
  }
  
  // Calcular média geral
  const totalSaidas = arraySaidas.reduce((sum, item) => sum + item.quantidade, 0);
  const mediaGeral = totalSaidas / arraySaidas.length;
  
  // Agrupar por mês para detectar sazonalidade
  const dadosPorMes = new Map<number, number[]>(); // mes -> [quantidades]
  
  arraySaidas.forEach(item => {
    if (!dadosPorMes.has(item.mes)) {
      dadosPorMes.set(item.mes, []);
    }
    dadosPorMes.get(item.mes)?.push(item.quantidade);
  });
  
  // Calcular média para cada mês
  const mediasPorMes = new Map<number, number>();
  dadosPorMes.forEach((quantidades, mes) => {
    const mediaMes = quantidades.reduce((sum, q) => sum + q, 0) / quantidades.length;
    mediasPorMes.set(mes, mediaMes);
  });
  
  // Calcular fatores sazonais (relação entre média do mês e média geral)
  const fatoresSazonais: { [mes: number]: number } = {};
  let maxVariacao = 0;
  
  mediasPorMes.forEach((mediaMes, mes) => {
    const fator = mediaMes / mediaGeral;
    fatoresSazonais[mes] = fator;
    
    // Calcular máxima variação para determinar se há sazonalidade significativa
    maxVariacao = Math.max(maxVariacao, Math.abs(fator - 1));
  });
  
  // Determinar se há sazonalidade significativa (variação >20%)
  const sazonalidade = maxVariacao > 0.2 && mediasPorMes.size >= 3;
  
  // Detectar ciclos
  let ciclos: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'irregular';
  
  // Analisar autocorrelação para detectar ciclos (versão simplificada)
  const valores = arraySaidas.map(item => item.quantidade);
  
  if (arraySaidas.length >= 12) {
    // Verificar correlação com deslocamento de 1, 3, 6 e 12 meses
    const corr1 = calcularAutocorrelacao(valores, 1);
    const corr3 = calcularAutocorrelacao(valores, 3);
    const corr6 = calcularAutocorrelacao(valores, 6);
    const corr12 = arraySaidas.length >= 13 ? calcularAutocorrelacao(valores, 12) : 0;
    
    // Determinar ciclo baseado na maior correlação
    const maxCorr = Math.max(corr1, corr3, corr6, corr12);
    if (maxCorr < 0.3) {
      ciclos = 'irregular';
    } else if (maxCorr === corr1) {
      ciclos = 'mensal';
    } else if (maxCorr === corr3) {
      ciclos = 'trimestral';
    } else if (maxCorr === corr6) {
      ciclos = 'semestral';
    } else {
      ciclos = 'anual';
    }
  } else if (sazonalidade) {
    // Se temos sazonalidade mas poucos dados, assumir ciclo anual
    ciclos = 'anual';
  } else {
    ciclos = 'irregular';
  }
  
  // Analisar tendência (crescente, decrescente ou estável)
  let tendencia: 'crescente' | 'decrescente' | 'estavel';
  
  // Divisão em dois períodos para comparação
  const meio = Math.floor(arraySaidas.length / 2);
  const primeiraParte = arraySaidas.slice(0, meio);
  const segundaParte = arraySaidas.slice(meio);
  
  const mediaPrimeira = primeiraParte.reduce((sum, item) => sum + item.quantidade, 0) / primeiraParte.length;
  const mediaSegunda = segundaParte.reduce((sum, item) => sum + item.quantidade, 0) / segundaParte.length;
  
  // Calcular percentual de variação
  let taxaVariacao = 0;
  if (mediaPrimeira > 0) {
    taxaVariacao = ((mediaSegunda - mediaPrimeira) / mediaPrimeira) * 100;
  }
  
  // Determinar tendência baseada na taxa de variação
  if (taxaVariacao > 10) {
    tendencia = 'crescente';
  } else if (taxaVariacao < -10) {
    tendencia = 'decrescente';
  } else {
    tendencia = 'estavel';
  }
  
  return {
    sazonalidade,
    fatoresSazonais,
    ciclos,
    tendencia,
    taxaVariacao
  };
}

/**
 * NOVA FUNÇÃO: Calcular autocorrelação para detectar ciclicidade
 */
function calcularAutocorrelacao(valores: number[], lag: number): number {
  if (valores.length <= lag) return 0;
  
  // Média da série
  const media = valores.reduce((sum, val) => sum + val, 0) / valores.length;
  
  // Calcular autocorrelação
  let numerador = 0;
  let denominador = 0;
  
  for (let i = 0; i < valores.length - lag; i++) {
    numerador += (valores[i] - media) * (valores[i + lag] - media);
  }
  
  for (let i = 0; i < valores.length; i++) {
    denominador += Math.pow(valores[i] - media, 2);
  }
  
  if (denominador === 0) return 0;
  return numerador / denominador;
}

/**
 * NOVA FUNÇÃO: Calcular cenários preditivos (otimista, realista, pessimista)
 */
function calcularCenariosPreditivos(
  quantidadeAtual: number, 
  consumoDiario: number,
  temporalidade: TemporalidadeConsumo
): CenarioPreditivo[] {
  if (consumoDiario <= 0) {
    return [
      {
        tipo: 'realista',
        diasRestantes: null,
        dataEsgotamento: null,
        probabilidade: 1,
        desvioEsperado: 0
      }
    ];
  }
  
  // Calcular cenário realista (base)
  const diasRestantesBase = Math.floor(quantidadeAtual / consumoDiario);
  const dataEsgotamentoBase = addDays(new Date(), diasRestantesBase);
  
  // Ajustar consumo para cenários otimista e pessimista
  // Otimista: -20% no consumo diário
  const consumoDiarioOtimista = consumoDiario * 0.8;
  const diasRestantesOtimista = Math.floor(quantidadeAtual / consumoDiarioOtimista);
  const dataEsgotamentoOtimista = addDays(new Date(), diasRestantesOtimista);
  
  // Pessimista: +30% no consumo diário
  const consumoDiarioPessimista = consumoDiario * 1.3;
  const diasRestantesPessimista = Math.floor(quantidadeAtual / consumoDiarioPessimista);
  const dataEsgotamentoPessimista = addDays(new Date(), diasRestantesPessimista);
  
  // Calcular desvio padrão presumido com base na sazonalidade e ciclos
  let desvioBase = 0.1; // 10% de desvio base
  
  if (temporalidade.sazonalidade) {
    // Maior variabilidade se houver sazonalidade
    desvioBase = 0.15;
  }
  
  if (temporalidade.ciclos === 'irregular') {
    // Ainda maior se for irregular
    desvioBase = 0.2;
  }
  
  // Ajustar probabilidades inversamente com a distância temporal
  // Quanto mais no futuro, menor a certeza
  let probRealista = 0.6;
  let probOtimista = 0.2;
  let probPessimista = 0.2;
  
  // Ajustar baseado no horizonte de tempo
  if (diasRestantesBase > 90) {
    // Previsões longas têm mais incerteza
    probRealista = 0.5;
    probOtimista = 0.25;
    probPessimista = 0.25;
  } else if (diasRestantesBase < 30) {
    // Previsões curtas são mais precisas
    probRealista = 0.7;
    probOtimista = 0.15;
    probPessimista = 0.15;
  }
  
  return [
    {
      tipo: 'realista',
      diasRestantes: diasRestantesBase,
      dataEsgotamento: format(dataEsgotamentoBase, 'yyyy-MM-dd'),
      probabilidade: probRealista,
      desvioEsperado: desvioBase * consumoDiario
    },
    {
      tipo: 'otimista',
      diasRestantes: diasRestantesOtimista,
      dataEsgotamento: format(dataEsgotamentoOtimista, 'yyyy-MM-dd'),
      probabilidade: probOtimista,
      desvioEsperado: desvioBase * 0.7 * consumoDiario
    },
    {
      tipo: 'pessimista',
      diasRestantes: diasRestantesPessimista,
      dataEsgotamento: format(dataEsgotamentoPessimista, 'yyyy-MM-dd'),
      probabilidade: probPessimista,
      desvioEsperado: desvioBase * 1.5 * consumoDiario
    }
  ];
}

/**
 * Identifica tendências nos dados de movimentação (crescimento, declínio ou estabilidade)
 * Versão aprimorada com análise de sazonalidade e previsão baseada em séries temporais
 */
export const analisarTendenciaConsumo = async (produtoId: number, dias: number = 90): Promise<{
  tendencia: 'crescimento' | 'declinio' | 'estavel';
  percentualMudanca: number;
  descricao: string;
  previsaoFutura?: { periodo: string; consumo: number }[]; // Nova propriedade
  confianca: 'alta' | 'media' | 'baixa'; // Nova propriedade
  fatorSazonal?: boolean; // Nova propriedade
}> => {
  try {
    // Carregar histórico de movimentações
    const movimentacoesJson = await AsyncStorage.getItem('movimentacoes');
    const todasMovimentacoes: Movimentacao[] = movimentacoesJson ? JSON.parse(movimentacoesJson) : [];
    
    // Filtrar movimentações deste produto
    const movimentacoesProduto = todasMovimentacoes.filter(
      mov => mov.produto_id === produtoId && mov.data_movimentacao && mov.tipo === 'saida'
    );
    
    // Ordenar por data
    movimentacoesProduto.sort((a, b) => {
      return parseISO(a.data_movimentacao!).getTime() - parseISO(b.data_movimentacao!).getTime();
    });
    
    // Se não houver movimentações suficientes
    if (movimentacoesProduto.length < 5) {
      return {
        tendencia: 'estavel',
        percentualMudanca: 0,
        descricao: 'Dados insuficientes para análise de tendência',
        confianca: 'baixa'
      };
    }
    
    // NOVA FUNCIONALIDADE: Agrupar por períodos (semanas ou meses) para análise mais robusta
    // Escolher intervalo baseado na quantidade de dados
    const agruparPorSemana = movimentacoesProduto.length >= 20;
    
    const consumoPorPeriodo = new Map<string, number>();
    
    movimentacoesProduto.forEach(mov => {
      const data = parseISO(mov.data_movimentacao!);
      const chave = agruparPorSemana ? 
        `${format(data, 'yyyy')}-W${Math.floor(getMonth(data) * 4.33 + data.getDate() / 7)}` : 
        format(data, 'yyyy-MM');
      
      if (consumoPorPeriodo.has(chave)) {
        consumoPorPeriodo.set(chave, (consumoPorPeriodo.get(chave) || 0) + mov.quantidade);
      } else {
        consumoPorPeriodo.set(chave, mov.quantidade);
      }
    });
    
    // Converter para array ordenado
    const periodos = Array.from(consumoPorPeriodo.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodo, quantidade]) => ({ periodo, quantidade }));
    
    // NOVA FUNCIONALIDADE: Detectar sazonalidade (versão simplificada)
    const dadosPorMes = new Map<number, number[]>(); // Mês -> [quantidades]
    
    movimentacoesProduto.forEach(mov => {
      const data = parseISO(mov.data_movimentacao!);
      const mes = getMonth(data) + 1; // 1-12
      
      if (!dadosPorMes.has(mes)) {
        dadosPorMes.set(mes, []);
      }
      
      dadosPorMes.get(mes)?.push(mov.quantidade);
    });
    
    // Calcular média para cada mês
    const mediasPorMes = new Map<number, number>();
    let totalMovimentacoes = 0;
    let totalQuantidade = 0;
    
    dadosPorMes.forEach((quantidades, mes) => {
      const total = quantidades.reduce((sum, q) => sum + q, 0);
      const media = total / quantidades.length;
      mediasPorMes.set(mes, media);
      
      totalMovimentacoes += quantidades.length;
      totalQuantidade += total;
    });
    
    const mediaGeral = totalQuantidade / totalMovimentacoes;
    
    // Verificar se há variação significativa entre meses (>30%)
    let maxVariacao = 0;
    let fatorSazonal = false;
    
    mediasPorMes.forEach(media => {
      const variacao = Math.abs(media - mediaGeral) / mediaGeral;
      maxVariacao = Math.max(maxVariacao, variacao);
    });
    
    if (maxVariacao > 0.3 && mediasPorMes.size >= 3) {
      fatorSazonal = true;
    }
    
    // Regressão linear simples para tendência geral
    let somX = 0;
    let somY = 0;
    let somXY = 0;
    let somX2 = 0;
    
    periodos.forEach((data, index) => {
      somX += index;
      somY += data.quantidade;
      somXY += index * data.quantidade;
      somX2 += index * index;
    });
    
    const n = periodos.length;
    const xMean = somX / n;
    const yMean = somY / n;
    
    let inclinacao = 0;
    if (somX2 - n * xMean * xMean !== 0) {
      inclinacao = (somXY - n * xMean * yMean) / (somX2 - n * xMean * xMean);
    }
    
    // Verificar tendências comparando primeiro e segundo período
    const meio = Math.floor(periodos.length / 2);
    const primeiraParte = periodos.slice(0, meio);
    const segundaParte = periodos.slice(meio);
    
    const somaPrimeira = primeiraParte.reduce((sum, p) => sum + p.quantidade, 0);
    const somaSegunda = segundaParte.reduce((sum, p) => sum + p.quantidade, 0);
    
    const mediaPrimeira = somaPrimeira / primeiraParte.length;
    const mediaSegunda = somaSegunda / segundaParte.length;
    
    // Calcular variação percentual
    let percentualMudanca = 0;
    if (mediaPrimeira > 0) {
      percentualMudanca = ((mediaSegunda - mediaPrimeira) / mediaPrimeira) * 100;
    }
    
    // Determinar tendência com base na variação e inclinação
    let tendencia: 'crescimento' | 'declinio' | 'estavel';
    let descricao = '';
    
    if (percentualMudanca >= 10 || inclinacao > 0) {
      tendencia = 'crescimento';
      descricao = `Aumento de ${Math.abs(percentualMudanca).toFixed(1)}% no consumo`;
    } else if (percentualMudanca <= -10 || inclinacao < 0) {
      tendencia = 'declinio';
      descricao = `Redução de ${Math.abs(percentualMudanca).toFixed(1)}% no consumo`;
    } else {
      tendencia = 'estavel';
      descricao = `Consumo estável nos últimos ${agruparPorSemana ? 'dias' : 'meses'}`;
    }
    
    // NOVA FUNCIONALIDADE: Calcular previsão para períodos futuros
    const previsaoFutura: { periodo: string; consumo: number }[] = [];
    
    // Usar últimos 3 períodos para calcular taxa média de mudança
    const ultimosPeriodos = periodos.slice(-3);
    
    if (ultimosPeriodos.length >= 2) {
      let somaVariacoes = 0;
      
      for (let i = 1; i < ultimosPeriodos.length; i++) {
        const anterior = ultimosPeriodos[i - 1].quantidade;
        const atual = ultimosPeriodos[i].quantidade;
        
        if (anterior > 0) {
          somaVariacoes += (atual / anterior) - 1;
        }
      }
      
      const taxaMediaVariacao = somaVariacoes / (ultimosPeriodos.length - 1);
      
      // Gerar previsões para os próximos 3 períodos
      let ultimoValor = ultimosPeriodos[ultimosPeriodos.length - 1].quantidade;
      const hoje = new Date();
      
      for (let i = 1; i <= 3; i++) {
        // Calcular próximo período
        const proximoMes = agruparPorSemana ? 
          addDays(hoje, i * 7) : 
          new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        
        const nomePeriodo = agruparPorSemana ? 
          `${format(proximoMes, 'yyyy')}-W${Math.floor(getMonth(proximoMes) * 4.33 + proximoMes.getDate() / 7)}` : 
          format(proximoMes, 'yyyy-MM');
        
        // Aplicar taxa de variação para obter valor previsto
        ultimoValor = ultimoValor * (1 + taxaMediaVariacao);
        
        // Ajuste sazonal se detectado
        if (fatorSazonal) {
          const mes = getMonth(proximoMes) + 1;
          const fator = (mediasPorMes.get(mes) || mediaGeral) / mediaGeral;
          ultimoValor *= fator;
        }
        
        previsaoFutura.push({
          periodo: nomePeriodo,
          consumo: Math.max(0, Math.round(ultimoValor))
        });
      }
    }
    
    // Calcular nível de confiança baseado na quantidade e qualidade dos dados
    let confianca: 'alta' | 'media' | 'baixa';
    
    if (periodos.length >= 6 && !fatorSazonal) {
      confianca = 'alta';
    } else if (periodos.length >= 4 || (periodos.length >= 3 && !fatorSazonal)) {
      confianca = 'media';
    } else {
      confianca = 'baixa';
    }
    
    // Adicionar informação sazonal na descrição
    if (fatorSazonal) {
      descricao += `. Detectada sazonalidade significativa (variação de ${Math.round(maxVariacao * 100)}% entre meses)`;
    }
    
    // Adicionar qualificador de confiança
    if (confianca === 'baixa') {
      descricao += '. Confiança baixa devido a poucos dados históricos';
    }
    
    return {
      tendencia,
      percentualMudanca: Math.round(percentualMudanca * 10) / 10, // Arredondar para 1 casa decimal
      descricao,
      previsaoFutura: previsaoFutura.length > 0 ? previsaoFutura : undefined,
      confianca,
      fatorSazonal
    };
  } catch (error) {
    console.error('Erro ao analisar tendência de consumo:', error);
    return {
      tendencia: 'estavel',
      percentualMudanca: 0,
      descricao: 'Não foi possível analisar a tendência de consumo',
      confianca: 'baixa'
    };
  }
};

/**
 * Identifica produtos que precisam ser reordenados com prioridade
 * Versão aprimorada com múltiplos critérios de priorização e agrupamento estratégico
 */
export const getProdutosPrioritarios = async (): Promise<{
  id: number;
  codigo: string;
  nome: string;
  diasRestantes: number | null;
  urgencia: 'alta' | 'media' | 'baixa';
  quantidadeRecomendada: number;
  valorReposicao?: number; // Valor estimado para reposição
  fornecedor?: string; // Informação do fornecedor
  tempoReposicao?: number; // Tempo estimado de reposição em dias
  categoria?: string; // Categoria do produto
  grupoCompra?: string; // Agrupamento para compra estratégica
}[]> => {
  try {
    // Carregar todos os produtos
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
    if (produtos.length === 0) return [];
    
    // NOVA FUNCIONALIDADE: Identificar fornecedores comuns para agrupamento estratégico
    const produtosPorFornecedor = new Map<string, number[]>();
    
    produtos.forEach(produto => {
      if (!produto.id) return;
      
      const fornecedor = produto.fornecedor || 'Não especificado';
      
      if (!produtosPorFornecedor.has(fornecedor)) {
        produtosPorFornecedor.set(fornecedor, []);
      }
      
      produtosPorFornecedor.get(fornecedor)?.push(produto.id);
    });
    
    // Analisar cada produto
    const produtosAnalisados = await Promise.all(produtos.map(async (produto) => {
      if (!produto.id) return null;
      
      // Obter previsão avançada
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
        urgencia = produto.quantidade === 0 ? 'alta' : 'media';
      }
      
      // NOVA FUNCIONALIDADE: Estimar valor de reposição
      // Em implementação real, isso viria de histórico de compras
      const precoMedioEstimado = 30; // Preço médio unitário estimado
      const valorReposicao = previsao.quantidadeRecomendada * precoMedioEstimado;
      
      // NOVA FUNCIONALIDADE: Estimar tempo de reposição
      // Em implementação real, isso viria de histórico de fornecedor
      // Aqui vamos simular variação por fornecedor
      let tempoReposicao = 10; // Padrão 10 dias
      
      if (produto.fornecedor) {
        // Simulando tempos diferentes por fornecedor - usando valor hash baseado no nome do fornecedor
        const hash = produto.fornecedor.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
        tempoReposicao = 7 + (hash % 10); // Entre 7 e 16 dias
      }
      
      // NOVA FUNCIONALIDADE: Determinar grupo de compra
      // Agrupar produtos do mesmo fornecedor que precisam ser repostos
      const fornecedor = produto.fornecedor || 'Não especificado';
      const produtosDoFornecedor = produtosPorFornecedor.get(fornecedor) || [];
      
      // Só agrupa se houver pelo menos 3 produtos do mesmo fornecedor
      let grupoCompra: string | undefined;
      
      if (produtosDoFornecedor.length >= 3 && previsao.necessidadeCompra) {
        grupoCompra = `${fornecedor}-${format(new Date(), 'yyyyMMdd')}`;
      }
      
      return {
        id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        diasRestantes: previsao.diasRestantes,
        urgencia,
        quantidadeRecomendada: previsao.quantidadeRecomendada,
        valorReposicao,
        fornecedor: produto.fornecedor,
        tempoReposicao,
        categoria: produto.categoria,
        grupoCompra
      };
    }));
    
    // Remover itens nulos e ordenar por critérios múltiplos
    const filteredItems = produtosAnalisados.filter(item => item !== null) as Array<{
      id: number;
      codigo: string;
      nome: string;
      diasRestantes: number | null;
      urgencia: 'alta' | 'media' | 'baixa';
      quantidadeRecomendada: number;
      valorReposicao?: number;
      fornecedor?: string;
      tempoReposicao?: number;
      categoria?: string;
      grupoCompra?: string;
    }>;
    
    // NOVA FUNCIONALIDADE: Ordenação multi-critério mais sofisticada
    // Definir pesos para os diferentes critérios
    const urgenciaPeso: {[key: string]: number} = { alta: 0, media: 1, baixa: 2 };
    
    return filteredItems.sort((a, b) => {
      // Primeiro por urgência
      const urgenciaComp = urgenciaPeso[a.urgencia] - urgenciaPeso[b.urgencia];
      if (urgenciaComp !== 0) return urgenciaComp;
      
      // Se mesma urgência, ordenar por tempo restante
      if (a.diasRestantes === null && b.diasRestantes === null) {
        // Se ambos não têm previsão, ordenar por grupos de compra
        if (a.grupoCompra && b.grupoCompra) {
          return a.grupoCompra.localeCompare(b.grupoCompra);
        }
        
        // Então por fornecedor, para facilitar pedidos agrupados
        if (a.fornecedor && b.fornecedor) {
          return a.fornecedor.localeCompare(b.fornecedor);
        }
        
        // Por fim, por categoria
        if (a.categoria && b.categoria) {
          return a.categoria.localeCompare(b.categoria);
        }
        
        return 0;
      }
      
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      
      // Ordenar por dias restantes (menos dias primeiro)
      return a.diasRestantes - b.diasRestantes;
    }).filter(item => item.urgencia !== 'baixa' || item.quantidadeRecomendada > 0);
  } catch (error) {
    console.error('Erro ao obter produtos prioritários:', error);
    return [];
  }
};

/**
 * Gera uma lista de compras inteligente
 * Versão aprimorada com agrupamento estratégico e otimização de compras
 */
export const gerarListaCompras = async (): Promise<{
  produtos: {
    id: number;
    codigo: string;
    nome: string;
    quantidadeAtual: number;
    quantidadeRecomendada: number;
    urgencia: 'alta' | 'media' | 'baixa';
    valorEstimado?: number;
    fornecedor?: string;
    categoria?: string;
    grupoCompra?: string;
    loteEconomico?: number; // Novo campo: quantidade ótima de compra
  }[];
  totalItens: number;
  agrupamentoFornecedor: { // Novo agrupamento por fornecedor
    [fornecedor: string]: {
      produtos: number[]; // IDs
      valorTotal: number;
      urgenciaMaxima: 'alta' | 'media' | 'baixa';
    }
  };
  valorTotal: number; // Novo campo: valor total da lista
  economiaEstimada?: number; // Novo campo: economia estimada com agrupamento
}> => {
  try {
    const produtosPrioritarios = await getProdutosPrioritarios();
    
    // Carregar detalhes completos de cada produto
    const produtosJson = await AsyncStorage.getItem('produtos');
    if (!produtosJson) {
      throw new Error('Produtos não encontrados');
    }
    
    const todosProdutos: Produto[] = JSON.parse(produtosJson);
    
    // Lista para armazenar produtos da lista de compras
    const produtosLista: Array<{
      id: number;
      codigo: string;
      nome: string;
      quantidadeAtual: number;
      quantidadeRecomendada: number;
      urgencia: 'alta' | 'media' | 'baixa';
      valorEstimado?: number;
      fornecedor?: string;
      categoria?: string;
      grupoCompra?: string;
      loteEconomico?: number;
    }> = [];
    
    // Processar cada produto prioritário
    await Promise.all(produtosPrioritarios.map(async (prodPrioritario) => {
      const produtoCompleto = todosProdutos.find(p => p.id === prodPrioritario.id);
      if (!produtoCompleto) return null;
      
      // NOVA FUNCIONALIDADE: Calcular lote econômico de compra
      // Fórmula simplificada de EOQ (Economic Order Quantity)
      // EOQ = sqrt(2 * D * S / H)
      // Onde: D = demanda anual, S = custo de pedido, H = custo de manutenção
      
      // Estimar demanda anual através de análise de tendência
      const analise = await analisarTendenciaConsumo(prodPrioritario.id, 90);
      
      // Estimar demanda anual (mensal * 12)
      let demandaAnual = prodPrioritario.quantidadeRecomendada * 4; // Simplificação: qtd recomendada * 4 = anual
      
      // Ajustar com base na tendência
      if (analise.tendencia === 'crescimento') {
        demandaAnual *= (1 + analise.percentualMudanca / 100);
      } else if (analise.tendencia === 'declinio') {
        demandaAnual *= (1 - analise.percentualMudanca / 200); // Redução mais conservadora
      }
      
      // Parâmetros estimados para EOQ
      const custoMedioPedido = 100; // Custo fixo por pedido
      const custoManutencaoEstoque = 0.2; // 20% do valor do item por ano
      const valorUnitario = 30; // Valor médio unitário
      
      // Calcular EOQ
      const custoManutencaoAnual = valorUnitario * custoManutencaoEstoque;
      const loteEconomico = Math.ceil(
        Math.sqrt((2 * demandaAnual * custoMedioPedido) / custoManutencaoAnual)
      );
      
      // Ajustar lote econômico para ser pelo menos a quantidade recomendada
      const loteEconomicoFinal = Math.max(loteEconomico, prodPrioritario.quantidadeRecomendada);
      
      // Verificar se o produto deve ser incluído na lista
      if (prodPrioritario.quantidadeRecomendada > 0 || prodPrioritario.urgencia !== 'baixa') {
        produtosLista.push({
          id: prodPrioritario.id,
          codigo: produtoCompleto.codigo,
          nome: produtoCompleto.nome,
          quantidadeAtual: produtoCompleto.quantidade,
          quantidadeRecomendada: prodPrioritario.quantidadeRecomendada,
          urgencia: prodPrioritario.urgencia,
          valorEstimado: prodPrioritario.quantidadeRecomendada * valorUnitario,
          fornecedor: produtoCompleto.fornecedor,
          categoria: produtoCompleto.categoria,
          grupoCompra: prodPrioritario.grupoCompra,
          loteEconomico: loteEconomicoFinal
        });
      }
    }));
    
    // NOVA FUNCIONALIDADE: Agrupar por fornecedor para análise consolidada
    const agrupamentoFornecedor: {
      [fornecedor: string]: {
        produtos: number[];
        valorTotal: number;
        urgenciaMaxima: 'alta' | 'media' | 'baixa';
      }
    } = {};
    
    // Montar agrupamento por fornecedor
    produtosLista.forEach(produto => {
      const fornecedor = produto.fornecedor || 'Não especificado';
      
      if (!agrupamentoFornecedor[fornecedor]) {
        agrupamentoFornecedor[fornecedor] = {
          produtos: [],
          valorTotal: 0,
          urgenciaMaxima: 'baixa'
        };
      }
      
      agrupamentoFornecedor[fornecedor].produtos.push(produto.id);
      agrupamentoFornecedor[fornecedor].valorTotal += (produto.valorEstimado || 0);
      
      // Atualizar urgência máxima
      const urgenciaPeso = { alta: 3, media: 2, baixa: 1 };
      const urgenciaAtual = urgenciaPeso[agrupamentoFornecedor[fornecedor].urgenciaMaxima];
      const urgenciaProduto = urgenciaPeso[produto.urgencia];
      
      if (urgenciaProduto > urgenciaAtual) {
        agrupamentoFornecedor[fornecedor].urgenciaMaxima = produto.urgencia;
      }
    });
    
    // NOVA FUNCIONALIDADE: Estimar economia com compras agrupadas
    let valorTotalSemAgrupamento = 0;
    let valorTotalComAgrupamento = 0;
    
    // Valor sem agrupamento: Cada produto com seu próprio pedido
    valorTotalSemAgrupamento = produtosLista.reduce((sum, p) => sum + (p.valorEstimado || 0) + 100, 0);
    
    // Valor com agrupamento: Um pedido por fornecedor
    valorTotalComAgrupamento = Object.values(agrupamentoFornecedor).reduce(
      (sum, grupo) => sum + grupo.valorTotal + 100, // +100 = custo fixo por pedido
      0
    );
    
    const economiaEstimada = valorTotalSemAgrupamento - valorTotalComAgrupamento;
    
    return {
      produtos: produtosLista,
      totalItens: produtosLista.length,
      agrupamentoFornecedor,
      valorTotal: valorTotalComAgrupamento,
      economiaEstimada: economiaEstimada > 0 ? economiaEstimada : undefined
    };
  } catch (error) {
    console.error('Erro ao gerar lista de compras:', error);
    return {
      produtos: [],
      totalItens: 0,
      agrupamentoFornecedor: {},
      valorTotal: 0
    };
  }
};