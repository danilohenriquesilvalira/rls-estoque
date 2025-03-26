// components/ProductAIAnalysis.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Dimensions,
  ViewStyle
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  identificarPadraoConsumo, 
  PadraoConsumo,
  encontrarProdutosSimilares,
  gerarRecomendacoes
} from '../services/productAnalysis';

interface ProductAIAnalysisProps {
  produtoId: number;
  style?: ViewStyle;
  onProdutoPress?: (produtoId: number) => void;
}

const screenWidth = Dimensions.get('window').width;

const ProductAIAnalysis: React.FC<ProductAIAnalysisProps> = ({ 
  produtoId, 
  style,
  onProdutoPress 
}) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  const [loading, setLoading] = useState(true);
  const [padraoConsumo, setPadraoConsumo] = useState<PadraoConsumo | null>(null);
  const [produtosSimilares, setProdutosSimilares] = useState<{
    id: number;
    nome: string;
    similaridade: number;
  }[]>([]);
  const [recomendacoes, setRecomendacoes] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Carregar dados de análise
  useEffect(() => {
    const carregarAnalise = async () => {
      try {
        setLoading(true);
        
        // Carregar dados em paralelo
        const [padrao, similares, sugestoes] = await Promise.all([
          identificarPadraoConsumo(produtoId),
          encontrarProdutosSimilares(produtoId),
          gerarRecomendacoes(produtoId)
        ]);
        
        setPadraoConsumo(padrao);
        setProdutosSimilares(similares.produtos);
        setRecomendacoes(sugestoes);
        
        // Iniciar animação de entrada
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }).start();
      } catch (error) {
        console.error("Erro ao carregar análise IA:", error);
      } finally {
        setLoading(false);
      }
    };
    
    carregarAnalise();
  }, [produtoId]);
  
  // Animar expansão/contração do componente
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease)
      }),
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease)
      })
    ]).start();
  }, [isExpanded, heightAnim, rotateAnim]);
  
  // Obter cor baseada no tipo de padrão
  const getPadraoColor = (tipo: string) => {
    switch (tipo) {
      case 'sazonal': return '#8E24AA'; // Roxo
      case 'regular': return '#2E7D32'; // Verde
      case 'irregular': return '#F57F17'; // Laranja
      case 'crescente': return '#1565C0'; // Azul
      case 'decrescente': return '#C62828'; // Vermelho
      default: return COLORS.grey;
    }
  };
  
  // Obter texto descritivo para o nível de confiança
  const getConfiancaText = (confianca: number) => {
    if (confianca >= 0.8) return 'Alta';
    if (confianca >= 0.5) return 'Média';
    return 'Baixa';
  };
  
  // Obter cor para a faixa de confiança
  const getConfiancaColor = (confianca: number) => {
    if (confianca >= 0.8) return COLORS.success;
    if (confianca >= 0.5) return COLORS.warning;
    return COLORS.error;
  };
  
  // Obter cor para a similaridade
  const getSimilaridadeColor = (similaridade: number) => {
    if (similaridade >= 0.8) return COLORS.success;
    if (similaridade >= 0.6) return '#1976D2'; // Azul mais claro
    if (similaridade >= 0.4) return COLORS.warning;
    return COLORS.grey;
  };
  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.card }, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
            Analisando dados com IA...
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: COLORS.card,
          opacity: fadeAnim,
          shadowColor: COLORS.shadow
        },
        style
      ]}
    >
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: COLORS.text }]}>
            Análise Inteligente
          </Text>
          <View style={styles.aiIconContainer}>
            <Text style={styles.aiIcon}>🧠</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Animated.Text 
            style={[
              styles.expandIcon,
              { color: COLORS.primary },
              {
                transform: [{
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg']
                  })
                }]
              }
            ]}
          >
            ▼
          </Animated.Text>
        </TouchableOpacity>
      </View>
      
      {padraoConsumo && (
        <View style={styles.summaryContainer}>
          <View 
            style={[
              styles.padraoBadge, 
              { backgroundColor: getPadraoColor(padraoConsumo.tipo) }
            ]}
          >
            <Text style={styles.padraoBadgeText}>
              {padraoConsumo.tipo.charAt(0).toUpperCase() + padraoConsumo.tipo.slice(1)}
            </Text>
          </View>
          
          <View style={styles.confiancaContainer}>
            <Text style={[styles.confiancaLabel, { color: COLORS.textSecondary }]}>
              Confiança: {getConfiancaText(padraoConsumo.confianca)}
            </Text>
            <View style={styles.confiancaBarContainer}>
              <View 
                style={[
                  styles.confiancaBar,
                  { 
                    width: `${padraoConsumo.confianca * 100}%`,
                    backgroundColor: getConfiancaColor(padraoConsumo.confianca)
                  }
                ]}
              />
            </View>
          </View>
        </View>
      )}
      
      <Animated.View 
        style={[
          styles.detailsContainer,
          {
            height: heightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 350] // Altura aproximada quando expandido
            }),
            opacity: heightAnim,
            overflow: 'hidden'
          }
        ]}
      >
        <ScrollView 
          contentContainerStyle={styles.detailsScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {padraoConsumo && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
                Padrão de Consumo
              </Text>
              <Text style={[styles.descriptionText, { color: COLORS.textSecondary }]}>
                {padraoConsumo.descricao}
              </Text>
              
              {(padraoConsumo.picos && padraoConsumo.picos.length > 0) && (
                <View style={styles.picosContainer}>
                  <Text style={[styles.picosTitle, { color: COLORS.text }]}>
                    Picos de consumo detectados:
                  </Text>
                  {padraoConsumo.picos.map((pico, index) => (
                    <Text key={index} style={[styles.picoText, { color: COLORS.text }]}>
                      • {pico.data}: {pico.quantidade} unidades
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
          
          {produtosSimilares.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
                Produtos com Padrão Similar
              </Text>
              
              {produtosSimilares.map((produto, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.similarProductItem,
                    { backgroundColor: COLORS.ultraLightGrey }
                  ]}
                  onPress={() => onProdutoPress && onProdutoPress(produto.id)}
                >
                  <Text style={[styles.similarProductName, { color: COLORS.text }]}>
                    {produto.nome}
                  </Text>
                  <View 
                    style={[
                      styles.similarityBadge,
                      { backgroundColor: getSimilaridadeColor(produto.similaridade) }
                    ]}
                  >
                    <Text style={styles.similarityText}>
                      {Math.round(produto.similaridade * 100)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {recomendacoes.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
                Recomendações Inteligentes
              </Text>
              
              {recomendacoes.map((recomendacao, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.recomendacaoItem,
                    { 
                      backgroundColor: recomendacao.includes('CRÍTICO') 
                        ? '#FFEBEE' // Vermelho claro
                        : recomendacao.includes('⚠️') 
                          ? '#FFF8E1' // Amarelo claro 
                          : COLORS.ultraLightGrey
                    }
                  ]}
                >
                  <Text style={[
                    styles.recomendacaoText, 
                    { 
                      color: recomendacao.includes('CRÍTICO')
                        ? COLORS.error
                        : COLORS.text
                    }
                  ]}>
                    {recomendacao}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 10,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  aiIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiIcon: {
    fontSize: 16,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  padraoBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 12,
  },
  padraoBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  confiancaContainer: {
    flex: 1,
  },
  confiancaLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  confiancaBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confiancaBar: {
    height: '100%',
    borderRadius: 4,
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailsScrollContent: {
    padding: 15,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  picosContainer: {
    marginTop: 10,
  },
  picosTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  picoText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 8,
    marginBottom: 5,
  },
  similarProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  similarProductName: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  similarityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  similarityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  recomendacaoItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recomendacaoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ProductAIAnalysis;