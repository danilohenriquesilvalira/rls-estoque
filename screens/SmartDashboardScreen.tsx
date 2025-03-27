// screens/SmartDashboardScreen.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, subDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, formatDistanceToNow, addDays } from 'date-fns';
import { pt } from 'date-fns/locale/pt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { getProdutos, getMovimentacoes, verificarConexao } from '../services/api';
import { preverEsgotamentoEstoque, getProdutosPrioritarios } from '../services/stockPrediction';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

type SmartDashboardScreenProps = {
  navigation: NativeStackNavigationProp<any, 'SmartDashboard'>;
};

// Interface para produto
interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  quantidade_minima?: number;
}

// Interface para movimentação
interface Movimentacao {
  id?: number;
  produto_id: number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  notas?: string;
  data_movimentacao?: string;
  produto_codigo?: string;
  produto_nome?: string;
}

// Interface para produto prioritário
interface ProdutoPrioritario {
  id: number;
  codigo: string;
  nome: string;
  diasRestantes: number | null;
  urgencia: 'alta' | 'media' | 'baixa';
  quantidadeRecomendada: number;
}

// Interface para insights
interface Insight {
  tipo: 'info' | 'warning' | 'success' | 'danger';
  titulo: string;
  descricao: string;
  acao?: string;
  navegacao?: string;
}

const screenWidth = Dimensions.get('window').width;

const SmartDashboardScreen: React.FC<SmartDashboardScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [produtosPrioritarios, setProdutosPrioritarios] = useState<ProdutoPrioritario[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [analyzingData, setAnalyzingData] = useState(false);
  
  // Dados dos gráficos
  const [movimentacoesPorDia, setMovimentacoesPorDia] = useState<{
    labels: string[];
    entradas: number[];
    saidas: number[];
  }>({ labels: [], entradas: [], saidas: [] });
  
  const [distribuicaoEstoque, setDistribuicaoEstoque] = useState<{
    labels: string[];
    data: number[];
    colors: string[];
  }>({ labels: [], data: [], colors: [] });
  
  // Dados de tendência 
  const [tendenciaEstoque, setTendenciaEstoque] = useState<{
    porcentagem: number;
    direcao: 'up' | 'down' | 'stable';
    comparadoA: string;
  }>({ porcentagem: 0, direcao: 'stable', comparadoA: '7 dias atrás' });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinValue = useRef(new Animated.Value(0)).current;
  
  // Iniciar animação de pulso
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Spin animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  
  // Criar spin interpolation para ícones de loading
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  // Refresh data
  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };
  
  // Gerar insights baseados nos dados
  const gerarInsights = (
    produtosData: Produto[], 
    movimentacoesData: Movimentacao[], 
    produtosPrioritariosData: ProdutoPrioritario[]
  ) => {
    const insightsGerados: Insight[] = [];
    
    // Insight sobre produtos sem movimentação
    const hoje = new Date();
    const trintaDiasAtras = subDays(hoje, 30);
    
    const produtosComMovimentacao = new Set(
      movimentacoesData
        .filter(m => m.data_movimentacao && parseISO(m.data_movimentacao) >= trintaDiasAtras)
        .map(m => m.produto_id)
    );
    
    const produtosSemMovimentacao = produtosData.filter(
      p => p.id && !produtosComMovimentacao.has(p.id) && p.quantidade > 0
    );
    
    if (produtosSemMovimentacao.length > 0) {
      insightsGerados.push({
        tipo: 'warning',
        titulo: `${produtosSemMovimentacao.length} produtos sem movimento`,
        descricao: `Existem ${produtosSemMovimentacao.length} produtos sem movimentação nos últimos 30 dias.`,
        acao: 'Ver lista',
        navegacao: 'StockList'
      });
    }
    
    // Insight sobre produtos urgentes
    const produtosUrgentes = produtosPrioritariosData.filter(p => p.urgencia === 'alta');
    if (produtosUrgentes.length > 0) {
      insightsGerados.push({
        tipo: 'danger',
        titulo: `${produtosUrgentes.length} produtos requerem atenção imediata`,
        descricao: `Existem ${produtosUrgentes.length} produtos com urgência alta que precisam ser adquiridos.`,
        acao: 'Gerar lista de compras',
        navegacao: 'ShoppingList'
      });
    }
    
    // Insight sobre tendência de estoque
    const entradasRecentes = movimentacoesData
      .filter(m => m.tipo === 'entrada' && m.data_movimentacao && parseISO(m.data_movimentacao) >= trintaDiasAtras)
      .reduce((sum, m) => sum + m.quantidade, 0);
      
    const saidasRecentes = movimentacoesData
      .filter(m => m.tipo === 'saida' && m.data_movimentacao && parseISO(m.data_movimentacao) >= trintaDiasAtras)
      .reduce((sum, m) => sum + m.quantidade, 0);
    
    const balanco = entradasRecentes - saidasRecentes;
    
    if (balanco < 0) {
      insightsGerados.push({
        tipo: 'info',
        titulo: 'Tendência de queda no estoque',
        descricao: `O estoque tem reduzido nos últimos 30 dias. Consumo excede reposição em ${Math.abs(balanco)} unidades.`,
        acao: 'Analisar movimentações',
        navegacao: 'History'
      });
    } else if (balanco > 100) {
      insightsGerados.push({
        tipo: 'success',
        titulo: 'Crescimento saudável do estoque',
        descricao: `O estoque está crescendo. Adicionadas ${balanco} unidades a mais do que foram removidas.`,
      });
    }
    
    // Calcular percentual de estoque
    const totalAtual = produtosData.reduce((sum, p) => sum + p.quantidade, 0);
    const totalMinimo = produtosData.reduce((sum, p) => sum + (p.quantidade_minima || 0), 0);
    
    // Verificar quais produtos estão acima do dobro da quantidade mínima
    const produtosExcesso = produtosData.filter(
      p => p.quantidade_minima && p.quantidade > p.quantidade_minima * 2.5
    );
    
    if (produtosExcesso.length > 3) {
      insightsGerados.push({
        tipo: 'info',
        titulo: `${produtosExcesso.length} produtos com excesso de estoque`,
        descricao: 'Considere ajustar os níveis de compra para otimizar o capital investido em estoque.',
        acao: 'Ver detalhes',
        navegacao: 'StockList'
      });
    }
    
    setInsights(insightsGerados);
  };
  
  // Simular cálculo de tendência de estoque
  const calcularTendenciaEstoque = (
    produtosData: Produto[], 
    movimentacoesData: Movimentacao[],
    timeRange: '7d' | '30d' | '90d'
  ) => {
    // Exemplo simples: comparar entradas vs saídas no período
    const hoje = new Date();
    let diasAtras: Date;
    
    switch (timeRange) {
      case '7d':
        diasAtras = subDays(hoje, 7);
        break;
      case '30d':
        diasAtras = subDays(hoje, 30);
        break;
      case '90d':
        diasAtras = subDays(hoje, 90);
        break;
    }
    
    const movimentacoesRecentes = movimentacoesData.filter(
      m => m.data_movimentacao && parseISO(m.data_movimentacao) >= diasAtras
    );
    
    const entradasRecentes = movimentacoesRecentes
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.quantidade, 0);
      
    const saidasRecentes = movimentacoesRecentes
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + m.quantidade, 0);
    
    // Calcular porcentagem de variação
    let porcentagem = 0;
    let direcao: 'up' | 'down' | 'stable' = 'stable';
    
    if (saidasRecentes > 0) {
      porcentagem = Math.round((entradasRecentes - saidasRecentes) / saidasRecentes * 100);
      
      if (porcentagem > 5) {
        direcao = 'up';
      } else if (porcentagem < -5) {
        direcao = 'down';
      }
    } else if (entradasRecentes > 0) {
      porcentagem = 100;
      direcao = 'up';
    }
    
    let periodoTexto = '';
    switch (timeRange) {
      case '7d':
        periodoTexto = '7 dias atrás';
        break;
      case '30d':
        periodoTexto = '30 dias atrás';
        break;
      case '90d':
        periodoTexto = '3 meses atrás';
        break;
    }
    
    setTendenciaEstoque({
      porcentagem: Math.abs(porcentagem),
      direcao,
      comparadoA: periodoTexto
    });
  };
  
  // Carregar dados para o dashboard
  const loadData = async (showLoadingScreen = true) => {
    try {
      if (showLoadingScreen) {
        setLoading(true);
      }
      
      // Verificar conexão com o servidor
      const connected = await verificarConexao();
      setIsOnline(connected);
      
      // Carregar produtos
      const produtosData = await getProdutos();
      setProdutos(produtosData);
      
      // Carregar movimentações
      const movimentacoesData = await getMovimentacoes();
      setMovimentos(movimentacoesData);
      
      // Processar dados para os gráficos
      processarDadosGraficos(produtosData, movimentacoesData, selectedTimeRange);
      
      // Simular análise de dados com IA
      setAnalyzingData(true);
      
      // Carregar produtos prioritários
      const prioritarios = await getProdutosPrioritarios();
      setProdutosPrioritarios(prioritarios);
      
      // Calcular tendência do estoque
      calcularTendenciaEstoque(produtosData, movimentacoesData, selectedTimeRange);
      
      // Gerar insights
      gerarInsights(produtosData, movimentacoesData, prioritarios);
      
      // Simular análise de IA concluída
      setTimeout(() => {
        setAnalyzingData(false);
      }, 1500);
      
      setLastUpdate(new Date());
      
      // Iniciar animações
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
      
    } catch (error) {
      console.error("Erro ao carregar dados para o dashboard:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados do dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Processar dados para os gráficos
  const processarDadosGraficos = (
    produtosData: Produto[], 
    movimentacoesData: Movimentacao[],
    timeRange: '7d' | '30d' | '90d'
  ) => {
    // Definir intervalo de datas com base na seleção
    const hoje = new Date();
    let dataInicial: Date;
    
    switch (timeRange) {
      case '7d':
        dataInicial = subDays(hoje, 7);
        break;
      case '30d':
        dataInicial = subDays(hoje, 30);
        break;
      case '90d':
        dataInicial = subDays(hoje, 90);
        break;
    }
    
    // Gerar array de dias no intervalo
    const diasIntervalo = eachDayOfInterval({
      start: dataInicial,
      end: hoje
    });
    
    // Inicializar arrays de dados
    const labels: string[] = [];
    const entradas: number[] = [];
    const saidas: number[] = [];
    
    // Para cada dia no intervalo, calcular total de entradas e saídas
    diasIntervalo.forEach(dia => {
      const diaFormatado = format(dia, 'dd/MM');
      labels.push(diaFormatado);
      
      // Filtrar movimentações do dia
      const movimentacoesDia = movimentacoesData.filter(mov => {
        if (!mov.data_movimentacao) return false;
        const dataMov = parseISO(mov.data_movimentacao);
        return (
          dataMov.getDate() === dia.getDate() &&
          dataMov.getMonth() === dia.getMonth() &&
          dataMov.getFullYear() === dia.getFullYear()
        );
      });
      
      // Calcular total de entradas e saídas do dia
      const totalEntradas = movimentacoesDia
        .filter(mov => mov.tipo === 'entrada')
        .reduce((sum, mov) => sum + mov.quantidade, 0);
        
      const totalSaidas = movimentacoesDia
        .filter(mov => mov.tipo === 'saida')
        .reduce((sum, mov) => sum + mov.quantidade, 0);
        
      entradas.push(totalEntradas);
      saidas.push(totalSaidas);
    });
    
    // Se o intervalo for muito grande, reduzir o número de labels
    if (timeRange === '30d' || timeRange === '90d') {
      // Reduzir para mostrar apenas alguns pontos
      const labelsReduzidos: string[] = [];
      const entradasReduzidas: number[] = [];
      const saidasReduzidas: number[] = [];
      
      const intervalo = timeRange === '30d' ? 5 : 15; // A cada 5 ou 15 dias
      
      labels.forEach((label, index) => {
        if (index % intervalo === 0 || index === labels.length - 1) {
          labelsReduzidos.push(label);
          entradasReduzidas.push(entradas[index]);
          saidasReduzidas.push(saidas[index]);
        }
      });
      
      setMovimentacoesPorDia({
        labels: labelsReduzidos,
        entradas: entradasReduzidas,
        saidas: saidasReduzidas
      });
    } else {
      setMovimentacoesPorDia({ labels, entradas, saidas });
    }
    
    // Dados para o gráfico de pizza de distribuição de estoque
    // Agrupar produtos por faixas de quantidade
    const faixasEstoque = [
      { label: 'Crítico (0-5)', min: 0, max: 5, color: '#C62828' },
      { label: 'Baixo (6-15)', min: 6, max: 15, color: '#F57F17' },
      { label: 'Normal (16-40)', min: 16, max: 40, color: '#0D47A1' },
      { label: 'Alto (41+)', min: 41, max: Infinity, color: '#2E7D32' }
    ];
    
    const contagem = faixasEstoque.map(faixa => ({
      label: faixa.label,
      count: produtosData.filter(
        p => p.quantidade >= faixa.min && p.quantidade <= faixa.max
      ).length,
      color: faixa.color
    }));
    
    // Filtrar faixas sem produtos
    const faixasComProdutos = contagem.filter(f => f.count > 0);
    
    setDistribuicaoEstoque({
      labels: faixasComProdutos.map(f => f.label),
      data: faixasComProdutos.map(f => f.count),
      colors: faixasComProdutos.map(f => f.color)
    });
  };
  
  // Carregar dados quando o componente montar
  useEffect(() => {
    loadData();
    
    // Recarregar ao voltar para esta tela
    const unsubscribe = navigation.addListener('focus', () => loadData());
    return unsubscribe;
  }, [navigation, selectedTimeRange]);
  
  // Obter cores para os gráficos
  const chartConfig = {
    backgroundGradientFrom: COLORS.card,
    backgroundGradientTo: COLORS.card,
    color: (opacity = 1) => `rgba(21, 101, 192, ${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "5",
      strokeWidth: "1",
    }
  };
  
  // Formatar cor de urgência
  const getUrgenciaColor = (urgencia: 'alta' | 'media' | 'baixa') => {
    switch (urgencia) {
      case 'alta': return COLORS.error;
      case 'media': return COLORS.warning;
      case 'baixa': return COLORS.success;
      default: return COLORS.grey;
    }
  };
  
  // Obter ícone de urgência
  const getUrgenciaIcon = (urgencia: 'alta' | 'media' | 'baixa') => {
    switch (urgencia) {
      case 'alta': return 'error';
      case 'media': return 'warning';
      case 'baixa': return 'info';
      default: return 'help';
    }
  };
  
  // Obter ícone para tipo de insight
  const getInsightIcon = (tipo: 'info' | 'warning' | 'success' | 'danger') => {
    switch (tipo) {
      case 'info': return 'info';
      case 'warning': return 'warning';
      case 'success': return 'check-circle';
      case 'danger': return 'error';
      default: return 'help';
    }
  };
  
  // Obter cor para tipo de insight
  const getInsightColor = (tipo: 'info' | 'warning' | 'success' | 'danger') => {
    switch (tipo) {
      case 'info': return '#2196F3';
      case 'warning': return '#FF9800';
      case 'success': return '#4CAF50';
      case 'danger': return '#F44336';
      default: return COLORS.grey;
    }
  };
  
  // Formatar data
  const formatarData = (dataString: string | undefined): string => {
    if (!dataString) return "N/A";
    
    try {
      return format(parseISO(dataString), "dd/MM/yyyy", { locale: pt });
    } catch (error) {
      return "Data inválida";
    }
  };
  
  // Formatar texto para dias restantes
  const formatarDiasRestantes = (dias: number | null): string => {
    if (dias === null) return "Indeterminado";
    if (dias <= 0) return "Esgotado";
    return `${dias} dias`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Dashboard Inteligente" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialIcons name="sync" size={48} color={COLORS.primary} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: COLORS.grey }]}>A carregar e analisar dados...</Text>
          
          <View style={styles.loadingProgressContainer}>
            <View style={styles.loadingBar}>
              <Animated.View 
                style={[
                  styles.loadingProgress,
                  { width: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })}
                ]} 
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Dashboard Inteligente" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {!isOnline && (
          <Animated.View style={[
            styles.offlineBanner,
            { 
              opacity: fadeAnim,
              backgroundColor: COLORS.error
            }
          ]}>
            <MaterialIcons name="cloud-off" size={18} color="#FFF" />
            <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
          </Animated.View>
        )}
        
        {/* Status da IA */}
        <Animated.View style={[
          styles.aiStatusContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card
          }
        ]}>
          <View style={styles.aiStatusHeader}>
            <MaterialIcons name="analytics" size={20} color={COLORS.primary} />
            <Text style={[styles.aiStatusTitle, { color: COLORS.text }]}>Análise Inteligente</Text>
            
            {analyzingData ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <MaterialIcons name="autorenew" size={20} color={COLORS.primary} />
              </Animated.View>
            ) : (
              <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
            )}
          </View>
          
          <View style={styles.aiStatusContent}>
            <Text style={[styles.aiStatusText, { color: COLORS.textSecondary }]}>
              {analyzingData 
                ? "A analisar padrões de estoque e consumo..." 
                : "Análise completa com recomendações disponíveis"}
            </Text>
            
            <View style={styles.aiProgressContainer}>
              <View style={styles.aiProgressBar}>
                <Animated.View 
                  style={[
                    styles.aiProgressFill,
                    { 
                      width: analyzingData ? '70%' : '100%',
                      backgroundColor: analyzingData ? COLORS.warning : COLORS.success
                    }
                  ]} 
                />
              </View>
              <Text style={styles.aiProgressText}>
                {analyzingData ? "70%" : "100%"}
              </Text>
            </View>
          </View>
        </Animated.View>
        
        {/* Tendência de Estoque */}
        <Animated.View style={[
          styles.tendenciaContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card
          }
        ]}>
          <View style={styles.tendenciaHeader}>
            <MaterialIcons 
              name={tendenciaEstoque.direcao === 'up' 
                ? "trending-up" 
                : tendenciaEstoque.direcao === 'down' 
                  ? "trending-down" 
                  : "trending-flat"} 
              size={24} 
              color={tendenciaEstoque.direcao === 'up' 
                ? COLORS.success 
                : tendenciaEstoque.direcao === 'down' 
                  ? COLORS.error 
                  : COLORS.grey} 
            />
            <Text style={[styles.tendenciaTitulo, { color: COLORS.text }]}>
              Tendência de Estoque
            </Text>
          </View>
          
          <View style={styles.tendenciaContent}>
            <View style={styles.tendenciaValor}>
              <Text style={[
                styles.tendenciaPorcentagem,
                { 
                  color: tendenciaEstoque.direcao === 'up' 
                    ? COLORS.success 
                    : tendenciaEstoque.direcao === 'down' 
                      ? COLORS.error 
                      : COLORS.grey
                }
              ]}>
                {tendenciaEstoque.porcentagem}%
              </Text>
              
              <MaterialIcons 
                name={tendenciaEstoque.direcao === 'up' 
                  ? "arrow-upward" 
                  : tendenciaEstoque.direcao === 'down' 
                    ? "arrow-downward" 
                    : "remove"} 
                size={20} 
                color={tendenciaEstoque.direcao === 'up' 
                  ? COLORS.success 
                  : tendenciaEstoque.direcao === 'down' 
                    ? COLORS.error 
                    : COLORS.grey} 
              />
            </View>
            
            <Text style={[styles.tendenciaDescricao, { color: COLORS.textSecondary }]}>
              {tendenciaEstoque.direcao === 'up' 
                ? `Crescimento de ${tendenciaEstoque.porcentagem}% comparado a ${tendenciaEstoque.comparadoA}`
                : tendenciaEstoque.direcao === 'down'
                  ? `Diminuição de ${tendenciaEstoque.porcentagem}% comparado a ${tendenciaEstoque.comparadoA}`
                  : `Estoque estável comparado a ${tendenciaEstoque.comparadoA}`}
            </Text>
          </View>
        </Animated.View>
        
        {/* Seletor de período */}
        <Animated.View style={[
          styles.timeSelector,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card
          }
        ]}>
          <View style={styles.periodHeader}>
            <MaterialIcons name="date-range" size={20} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Período de Análise</Text>
          </View>
          
          <View style={styles.timeButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.timeButton,
                selectedTimeRange === '7d' && [styles.activeTimeButton, { backgroundColor: COLORS.primary }]
              ]}
              onPress={() => setSelectedTimeRange('7d')}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTimeRange === '7d' && styles.activeTimeButtonText
              ]}>7 dias</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.timeButton,
                selectedTimeRange === '30d' && [styles.activeTimeButton, { backgroundColor: COLORS.primary }]
              ]}
              onPress={() => setSelectedTimeRange('30d')}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTimeRange === '30d' && styles.activeTimeButtonText
              ]}>30 dias</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.timeButton,
                selectedTimeRange === '90d' && [styles.activeTimeButton, { backgroundColor: COLORS.primary }]
              ]}
              onPress={() => setSelectedTimeRange('90d')}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTimeRange === '90d' && styles.activeTimeButtonText
              ]}>90 dias</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Resumo de estoque */}
        <Animated.View style={[
          styles.summaryContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <MaterialIcons name="inventory" size={22} color="#FFF" />
              </View>
              <Text style={styles.summaryValue}>{produtos.length}</Text>
              <Text style={styles.summaryLabel}>Produtos</Text>
            </LinearGradient>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <LinearGradient
              colors={['#43A047', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <MaterialIcons name="bar-chart" size={22} color="#FFF" />
              </View>
              <Text style={styles.summaryValue}>
                {produtos.reduce((sum, p) => sum + p.quantidade, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Unidades</Text>
            </LinearGradient>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <LinearGradient
              colors={produtosPrioritarios.some(p => p.urgencia === 'alta') ? 
                ['#E53935', '#C62828'] : ['#9E9E9E', '#757575']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardGradient}
            >
              <View style={styles.summaryIconContainer}>
                <MaterialIcons name="error" size={22} color="#FFF" />
              </View>
              <Text style={styles.summaryValue}>
                {produtosPrioritarios.filter(p => p.urgencia === 'alta').length}
              </Text>
              <Text style={styles.summaryLabel}>Urgentes</Text>
            </LinearGradient>
          </View>
        </Animated.View>
        
        {/* Insights da IA */}
        {insights.length > 0 && (
          <Animated.View style={[
            styles.insightsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: COLORS.card,
            }
          ]}>
            <View style={styles.insightsHeader}>
              <MaterialIcons name="lightbulb" size={22} color={COLORS.accent} />
              <Text style={[styles.insightsTitle, { color: COLORS.text }]}>
                Insights & Recomendações
              </Text>
            </View>
            
            {insights.map((insight, index) => (
              <Animated.View 
                key={index}
                style={[
                  styles.insightCard,
                  { transform: [{ scale: index === 0 ? pulseAnim : 1 }] }
                ]}
              >
                <View style={[
                  styles.insightIconContainer,
                  { backgroundColor: `${getInsightColor(insight.tipo)}20` }
                ]}>
                  <MaterialIcons 
                    name={getInsightIcon(insight.tipo)} 
                    size={24} 
                    color={getInsightColor(insight.tipo)} 
                  />
                </View>
                
                <View style={styles.insightContent}>
                  <Text style={[
                    styles.insightTitle, 
                    { color: COLORS.text }
                  ]}>
                    {insight.titulo}
                  </Text>
                  
                  <Text style={[
                    styles.insightDescription,
                    { color: COLORS.textSecondary }
                  ]}>
                    {insight.descricao}
                  </Text>
                  
                  {insight.acao && (
                    <TouchableOpacity
                      style={[
                        styles.insightAction,
                        { borderColor: getInsightColor(insight.tipo) }
                      ]}
                      onPress={() => {
                        if (insight.navegacao) {
                          navigation.navigate(insight.navegacao);
                        }
                      }}
                    >
                      <Text style={[
                        styles.insightActionText,
                        { color: getInsightColor(insight.tipo) }
                      ]}>
                        {insight.acao}
                      </Text>
                      <MaterialIcons 
                        name="arrow-forward" 
                        size={16} 
                        color={getInsightColor(insight.tipo)} 
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        )}
        
        {/* Gráfico de Movimentações */}
        <Animated.View style={[
          styles.chartCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <View style={styles.chartHeader}>
            <MaterialIcons name="swap-horiz" size={22} color={COLORS.primary} />
            <Text style={[styles.chartTitle, { color: COLORS.text }]}>
              Movimentações de Estoque
            </Text>
          </View>
          
          {movimentacoesPorDia.labels.length > 0 ? (
            <LineChart
              data={{
                labels: movimentacoesPorDia.labels,
                datasets: [
                  {
                    data: movimentacoesPorDia.entradas,
                    color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                    strokeWidth: 2
                  },
                  {
                    data: movimentacoesPorDia.saidas,
                    color: (opacity = 1) => `rgba(198, 40, 40, ${opacity})`,
                    strokeWidth: 2
                  }
                ],
                legend: ["Entradas", "Saídas"]
              }}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                ...chartConfig,
                propsForDots: {
                  r: "4",
                  strokeWidth: "1",
                }
              }}
              bezier
              style={styles.chart}
              fromZero
            />
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialIcons name="error-outline" size={48} color={COLORS.lightGrey} />
              <Text style={[styles.noDataText, { color: COLORS.grey }]}>
                Sem dados de movimentação para o período selecionado
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Distribuição de Estoque */}
        <Animated.View style={[
          styles.chartCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <View style={styles.chartHeader}>
            <MaterialIcons name="pie-chart" size={22} color={COLORS.primary} />
            <Text style={[styles.chartTitle, { color: COLORS.text }]}>
              Distribuição do Estoque
            </Text>
          </View>
          
          {distribuicaoEstoque.labels.length > 0 ? (
            <PieChart
              data={distribuicaoEstoque.labels.map((label, index) => ({
                name: label,
                population: distribuicaoEstoque.data[index],
                color: distribuicaoEstoque.colors[index],
                legendFontColor: COLORS.text,
                legendFontSize: 12
              }))}
              width={screenWidth - 40}
              height={220}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              center={[10, 0]}
              absolute
            />
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialIcons name="error-outline" size={48} color={COLORS.lightGrey} />
              <Text style={[styles.noDataText, { color: COLORS.grey }]}>
                Sem dados de estoque disponíveis
              </Text>
            </View>
          )}
        </Animated.View>
        
        {/* Produtos Prioritários */}
        <Animated.View style={[
          styles.priorityCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor: COLORS.card,
          }
        ]}>
          <View style={styles.chartHeader}>
            <MaterialIcons name="priority-high" size={22} color={COLORS.error} />
            <Text style={[styles.chartTitle, { color: COLORS.text }]}>
              Produtos Prioritários
            </Text>
          </View>
          
          {produtosPrioritarios.length > 0 ? (
            <>
              {produtosPrioritarios
                .filter((p, index) => showFullAnalysis || index < 3)
                .map((produto, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.priorityItem}
                  onPress={() => {
                    // Navegar para detalhes do produto
                    const produtoCompleto = produtos.find(p => p.id === produto.id);
                    if (produtoCompleto) {
                      navigation.navigate('ProductDetail', { product: produtoCompleto });
                    }
                  }}
                >
                  <View style={[
                    styles.priorityBadge,
                    { backgroundColor: getUrgenciaColor(produto.urgencia) }
                  ]}>
                    <MaterialIcons 
                      name={getUrgenciaIcon(produto.urgencia)} 
                      size={18} 
                      color="#FFF" 
                    />
                  </View>
                  
                  <View style={styles.priorityInfo}>
                    <Text style={[styles.priorityName, { color: COLORS.text }]}>
                      {produto.nome}
                    </Text>
                    <View style={styles.priorityCodeContainer}>
                      <MaterialIcons name="qr-code" size={12} color={COLORS.primary} />
                      <Text style={[styles.priorityCode, { color: COLORS.primary }]}>
                        {produto.codigo}
                      </Text>
                    </View>
                    
                    <View style={styles.priorityProgress}>
                      <View style={styles.priorityProgressBar}>
                        <Animated.View 
                          style={[
                            styles.priorityProgressFill,
                            { 
                              backgroundColor: getUrgenciaColor(produto.urgencia),
                              width: produto.diasRestantes === null ? '100%' : `${Math.min(100, (produto.diasRestantes / 30) * 100)}%`
                            }
                          ]}
                        />
                      </View>
                      
                      <View style={styles.priorityDetails}>
                        <View style={styles.priorityDetailItem}>
                          <MaterialIcons name="schedule" size={14} color={COLORS.grey} />
                          <Text style={[styles.priorityDetailText, { color: COLORS.textSecondary }]}>
                            {formatarDiasRestantes(produto.diasRestantes)}
                          </Text>
                        </View>
                        
                        {produto.quantidadeRecomendada > 0 && (
                          <View style={styles.priorityDetailItem}>
                            <MaterialIcons name="add-shopping-cart" size={14} color={getUrgenciaColor(produto.urgencia)} />
                            <Text style={[
                              styles.priorityDetailText,
                              { color: getUrgenciaColor(produto.urgencia) }
                            ]}>
                              Comprar: {produto.quantidadeRecomendada} unid.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              {produtosPrioritarios.length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowFullAnalysis(!showFullAnalysis)}
                >
                  <Text style={[styles.showMoreText, { color: COLORS.primary }]}>
                    {showFullAnalysis ? 'Mostrar menos' : `Ver mais ${produtosPrioritarios.length - 3} produtos`}
                  </Text>
                  <MaterialIcons 
                    name={showFullAnalysis ? "expand-less" : "expand-more"} 
                    size={18} 
                    color={COLORS.primary} 
                  />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.generateListButton, { backgroundColor: COLORS.primary }]}
                onPress={() => navigation.navigate('ShoppingList')}
              >
                <MaterialIcons name="shopping-cart" size={18} color="#FFF" />
                <Text style={styles.generateListText}>Gerar Lista de Compras</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialIcons name="check-circle" size={48} color={COLORS.success} />
              <Text style={[styles.noDataText, { color: COLORS.grey }]}>
                Não há produtos prioritários no momento
              </Text>
            </View>
          )}
        </Animated.View>
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: COLORS.grey }]}>
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <MaterialIcons name="refresh" size={16} color={COLORS.primary} />
            <Text style={[styles.refreshText, { color: COLORS.primary }]}>
              Atualizar dados
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  loadingProgressContainer: {
    width: '80%',
    marginTop: 20,
  },
  loadingBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#1565C0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  offlineBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  offlineText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    marginLeft: 8,
  },
  aiStatusContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  aiStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  aiStatusContent: {
    marginTop: 4,
  },
  aiStatusText: {
    fontSize: 14,
    marginBottom: 12,
  },
  aiProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiProgressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    flex: 1,
    marginRight: 10,
  },
  aiProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  aiProgressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#757575',
  },
  tendenciaContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tendenciaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tendenciaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tendenciaContent: {
    marginTop: 4,
  },
  tendenciaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tendenciaPorcentagem: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
  },
  tendenciaDescricao: {
    fontSize: 14,
  },
  timeSelector: {
    borderRadius: 16,
    padding: 15,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  timeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 25,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeTimeButton: {
    borderWidth: 0,
  },
  timeButtonText: {
    fontWeight: '500',
  },
  activeTimeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    width: '31%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  summaryCardGradient: {
    padding: 15,
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    opacity: 0.9,
  },
  insightsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 13,
    marginBottom: 10,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  insightActionText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
  priorityCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  priorityItem: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 10,
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
  priorityBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  priorityInfo: {
    flex: 1,
  },
  priorityName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  priorityCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityCode: {
    fontSize: 12,
    marginLeft: 4,
  },
  priorityProgress: {
    marginTop: 4,
  },
  priorityProgressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  priorityProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  priorityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  priorityDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  priorityDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 5,
  },
  showMoreText: {
    fontWeight: '600',
    marginRight: 4,
  },
  generateListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 25,
    marginTop: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  generateListText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default SmartDashboardScreen;