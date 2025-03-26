// services/productAnalysis.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseISO, isAfter, format, differenceInDays, subDays } from 'date-fns';

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
}

/**
 * Identifica padrões de consumo para um produto específico
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
    
    // Determinar o tipo de padrão
    let tipo: 'sazonal' | 'regular' | 'irregular' | 'crescente' | 'decrescente';
    let confianca = 0.5; // confiança padrão
    let descricao = '';
    
    if (tendencia > consumoArray.length * 0.5) {
      tipo = 'crescente';
      confianca = 0.7 + (tendencia / consumoArray.length) * 0.3;
      descricao = `Consumo em tendência crescente (${Math.round(confianca * 100)}% de confiança)`;
    } else if (tendencia < -consumoArray.length * 0.5) {
      tipo = 'decrescente';
      confianca = 0.7 + (Math.abs(tendencia) / consumoArray.length) * 0.3;
      descricao = `Consumo em tendência decrescente (${Math.round(confianca * 100)}% de confiança)`;
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
      menorConsumo: menorConsumo.length > 0 ? menorConsumo : undefined
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
        
        anomalias.push({
          produtoId: produto.id!,
          tipo: 'movimentacao_suspeita',
          dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
          descricao: `Movimentação anômala de ${mov.quantidade} unidades (${Math.round(mov.quantidade / mediaSaidas * 100)}% acima da média) em ${format(parseISO(mov.data_movimentacao), 'dd/MM/yyyy')}`,
          severidade: mov.quantidade > limiteAnomalia * 1.5 ? 'alta' : 'media',
          sugestaoCorrecao: 'Verificar se houve erro de registro ou movimentação não autorizada'
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
          anomalias.push({
            produtoId: produto.id!,
            tipo: 'estoque_inconsistente',
            dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
            descricao: `Estoque calculado ficou negativo (${estoqueCalculado}) após movimentação em ${format(parseISO(mov.data_movimentacao), 'dd/MM/yyyy')}`,
            severidade: 'alta',
            sugestaoCorrecao: 'Verificar se todas as entradas foram registradas corretamente'
          });
          
          // Corrigir o estoque calculado para continuar a análise
          estoqueCalculado = 0;
        }
        
        ultimaData = mov.data_movimentacao;
      }
      
      // Verificar divergência entre estoque calculado e estoque atual
      const diferencaEstoque = Math.abs(estoqueCalculado - produto.quantidade);
      if (diferencaEstoque > 5 && diferencaEstoque > produto.quantidade * 0.1) {
        anomalias.push({
          produtoId: produto.id!,
          tipo: 'divergencia_inventario',
          dataDeteccao: format(new Date(), 'yyyy-MM-dd'),
          descricao: `Divergência de ${diferencaEstoque} unidades entre estoque calculado (${estoqueCalculado}) e estoque atual (${produto.quantidade})`,
          severidade: diferencaEstoque > produto.quantidade * 0.2 ? 'alta' : 'media',
          sugestaoCorrecao: 'Realizar inventário físico para reconciliação de estoque'
        });
      }
    }
    
    return anomalias;
  } catch (error) {
    console.error('Erro ao detectar anomalias:', error);
    return [];
  }
};

/**
 * Encontra produtos com padrões de consumo similares
 */
export const encontrarProdutosSimilares = async (produtoId: number): Promise<{
  produtos: {
    id: number;
    nome: string;
    similaridade: number; // 0 a 1
  }[];
  padraoReferencia: string;
}> => {
  try {
    // Analisar padrão do produto de referência
    const padraoProduto = await identificarPadraoConsumo(produtoId);
    
    // Carregar todos os produtos
    const produtosJson = await AsyncStorage.getItem('produtos');
    const produtos: Produto[] = produtosJson ? JSON.parse(produtosJson) : [];
    
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
      
      // Adicionar apenas produtos com similaridade significativa
      if (similaridade > 0.4) {
        produtosSimilares.push({
          id: produto.id,
          nome: produto.nome,
          similaridade: Math.min(similaridade, 1) // Limitar a 1
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
 */
export const gerarRecomendacoes = async (produtoId: number): Promise<string[]> => {
  try {
    // Carregar dados do produto
    const produtoJson = await AsyncStorage.getItem(`produto_${produtoId}`);
    if (!produtoJson) {
      throw new Error('Produto não encontrado');
    }
    
    const produto: Produto = JSON.parse(produtoJson);
    
    // Analisar padrão de consumo
    const padrao = await identificarPadraoConsumo(produtoId);
    
    // Encontrar produtos similares
    const similares = await encontrarProdutosSimilares(produtoId);
    
    // Gerar recomendações baseadas nas análises
    const recomendacoes: string[] = [];
    
    // Recomendações baseadas no padrão de consumo
    switch (padrao.tipo) {
      case 'sazonal':
        recomendacoes.push('Ajustar níveis de estoque de acordo com a sazonalidade identificada, aumentando antes dos períodos de pico.');
        
        if (padrao.picos && padrao.picos.length > 0) {
          // Verificar se algum pico está próximo (nos próximos 2 meses)
          const mesesPico = padrao.picos.map(p => p.data.substring(5, 7)); // Mês (MM)
          const mesAtual = format(new Date(), 'MM');
          const mesSeguinte = format(subDays(new Date(), -30), 'MM');
          
          if (mesesPico.includes(mesAtual) || mesesPico.includes(mesSeguinte)) {
            recomendacoes.push('⚠️ Atenção: Um período de alta demanda histórica está se aproximando. Considere aumentar o estoque preventivamente.');
          }
        }
        
        break;
        
      case 'crescente':
        recomendacoes.push('Tendência de aumento no consumo identificada. Considere revisar o estoque mínimo para acompanhar o crescimento.');
        
        const aumentoPercentual = Math.round((padrao.confianca - 0.5) * 200);
        recomendacoes.push(`Recomendamos um aumento de aproximadamente ${aumentoPercentual}% no estoque mínimo para os próximos meses.`);
        
        break;
        
      case 'decrescente':
        recomendacoes.push('Tendência de redução no consumo identificada. Considere diminuir as compras para evitar estoque excessivo.');
        
        if (padrao.confianca > 0.7) {
          recomendacoes.push('A queda consistente no consumo sugere reavaliação da relevância deste produto no catálogo.');
        }
        
        break;
        
      case 'regular':
        const estoqueIdeal = Math.ceil(padrao.mediaConsumo * 2); // 2 meses de estoque
        
        if (produto.quantidade < estoqueIdeal * 0.7) {
          recomendacoes.push(`O padrão de consumo é constante. Recomendamos manter um estoque mínimo de ${estoqueIdeal} unidades para garantir disponibilidade.`);
        } else {
          recomendacoes.push('O consumo regular permite uma gestão de estoque previsível. Mantenha o estoque atual que está adequado.');
        }
        
        break;
        
      case 'irregular':
        recomendacoes.push('Consumo irregular dificulta previsões precisas. Monitore mais de perto e mantenha uma margem de segurança maior.');
        
        if (padrao.confianca < 0.4) {
          recomendacoes.push('Avalie se fatores externos estão influenciando a irregularidade no consumo deste produto.');
        }
        
        break;
    }
    
    // Recomendações baseadas em produtos similares
    if (similares.produtos.length > 0) {
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
          recomendacoes.push(`O produto "${maisSimlar.nome}" (comportamento semelhante) teve saídas recentes sem reposição. Isto pode indicar uma tendência a monitorar.`);
        }
      }
      
      // Recomendar agrupamento para compras
      if (similares.produtos.length >= 3 && similares.produtos[0].similaridade > 0.7) {
        const produtosNomes = similares.produtos.slice(0, 3).map(p => p.nome).join(', ');
        recomendacoes.push(`Considere agrupar compras deste produto com ${produtosNomes} para otimizar logística e custos.`);
      }
    }
    
    // Inserir um conselho específico baseado no produto
    if (produto.quantidade < 5 && padrao.mediaConsumo > 0) {
      const diasEstimados = Math.floor(produto.quantidade / (padrao.mediaConsumo / 30));
      
      if (diasEstimados < 14) {
        recomendacoes.unshift(`⚠️ CRÍTICO: O estoque atual durará aproximadamente apenas ${diasEstimados} dias. Recomendamos reposição imediata.`);
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
    
    // Identificar grupos de produtos com comportamento similar (para produtos sem categoria)
    const produtosSemCategoria = produtos.filter(p => p.id && !p.categoria).map(p => p.id) as number[];
    
    if (produtosSemCategoria.length >= 3) {
      const grupos = await identificarGruposComportamentoSimilar(produtosSemCategoria);
      
      // Adicionar os grupos identificados à lista de categorias
      categorias.push(...grupos);
    }
    
    // Ordenar por similaridade
    return categorias.sort((a, b) => b.similaridadeConsumo - a.similaridadeConsumo);
  } catch (error) {
    console.error('Erro ao agrupar produtos por categoria:', error);
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