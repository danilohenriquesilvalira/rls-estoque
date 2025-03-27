// screens/ShoppingListScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Share,
  Animated,
  Easing,
  TextInput,
  Switch,
  Platform,
  SafeAreaView,
  ScrollView,
  Dimensions
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import { gerarListaCompras } from '../services/stockPrediction';
import { MaterialIcons } from '@expo/vector-icons';

type ShoppingListScreenProps = {
  navigation: NativeStackNavigationProp<any, 'ShoppingList'>;
};

interface ProdutoListaCompras {
  id: number;
  codigo: string;
  nome: string;
  quantidadeAtual: number;
  quantidadeRecomendada: number;
  urgencia: 'alta' | 'media' | 'baixa';
  quantidade?: number; // Quantidade que o usuário decidiu comprar
  selecionado?: boolean; // Se o produto está selecionado na lista
  precoEstimado?: number; // Preço estimado do produto
  fornecedor?: string; // Fornecedor preferencial
}

// Screen dimensions
const { width: screenWidth } = Dimensions.get('window');

const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { COLORS } = theme;
  
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<ProdutoListaCompras[]>([]);
  const [produtosOriginais, setProdutosOriginais] = useState<ProdutoListaCompras[]>([]);
  const [searchText, setSearchText] = useState('');
  const [mostrarSelecionados, setMostrarSelecionados] = useState(false);
  const [mostraPrecos, setMostraPrecos] = useState(false);
  
  const [totalValorEstimado, setTotalValorEstimado] = useState(0);
  const [fornecedoresList, setFornecedoresList] = useState<string[]>([]);
  const [fornecedorFiltrado, setFornecedorFiltrado] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const listItemAnims = useRef<Animated.Value[]>([]).current;
  const filterSlideAnim = useRef(new Animated.Value(-100)).current;
  
  useEffect(() => {
    const loadShoppingList = async () => {
      try {
        setLoading(true);
        
        // Gerar lista de compras usando o serviço de previsão
        const listaCompras = await gerarListaCompras();
        
        if (listaCompras.produtos.length > 0) {
          // Carregar detalhes adicionais para cada produto (fornecedor, preço)
          const produtosDetalhados = await Promise.all(
            listaCompras.produtos.map(async (produto) => {
              // Buscar informações detalhadas do produto
              const produtoJson = await AsyncStorage.getItem(`produto_${produto.id}`);
              const produtoDetalhado = produtoJson ? JSON.parse(produtoJson) : {};
              
              // Buscar preço histórico
              const precoJson = await AsyncStorage.getItem(`preco_${produto.id}`);
              const precoHistorico = precoJson ? JSON.parse(precoJson) : { preco: 0 };
              
              return {
                ...produto,
                quantidade: produto.quantidadeRecomendada, // Inicialmente igual à quantidade recomendada
                selecionado: true, // Inicialmente todos selecionados
                precoEstimado: precoHistorico.preco || 0,
                fornecedor: produtoDetalhado.fornecedor || ''
              };
            })
          );
          
          setProdutos(produtosDetalhados);
          setProdutosOriginais(produtosDetalhados);
          
          // Preparar animações para cada item
          produtosDetalhados.forEach(() => {
            listItemAnims.push(new Animated.Value(0));
          });
          
          // Extrair lista de fornecedores únicos
          const fornecedores = [...new Set(
            produtosDetalhados
              .map(p => p.fornecedor)
              .filter(f => f && f.trim() !== '')
          )];
          
          setFornecedoresList(fornecedores);
          
          // Calcular valor total estimado
          calcularTotalEstimado(produtosDetalhados);
        } else {
          // Se não houver produtos na lista
          setProdutos([]);
          setProdutosOriginais([]);
        }
        
        // Iniciar animações
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.stagger(
            50,
            listItemAnims.map(anim => 
              Animated.spring(anim, {
                toValue: 1,
                friction: 8,
                tension: 50,
                useNativeDriver: true,
              })
            )
          )
        ]).start();
        
      } catch (error) {
        console.error("Erro ao carregar lista de compras:", error);
        Alert.alert("Erro", "Não foi possível gerar a lista de compras");
      } finally {
        setLoading(false);
      }
    };
    
    loadShoppingList();
  }, []);
  
  // Atualizar filtro de produtos quando os critérios mudarem
  useEffect(() => {
    let filteredProducts = [...produtosOriginais];
    
    // Filtrar por texto de busca
    if (searchText.trim() !== '') {
      filteredProducts = filteredProducts.filter(produto => 
        produto.nome.toLowerCase().includes(searchText.toLowerCase()) ||
        produto.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
        (produto.fornecedor && produto.fornecedor.toLowerCase().includes(searchText.toLowerCase()))
      );
    }
    
    // Filtrar por selecionados
    if (mostrarSelecionados) {
      filteredProducts = filteredProducts.filter(produto => produto.selecionado);
    }
    
    // Filtrar por fornecedor
    if (fornecedorFiltrado) {
      filteredProducts = filteredProducts.filter(produto => produto.fornecedor === fornecedorFiltrado);
    }
    
    setProdutos(filteredProducts);
  }, [searchText, produtosOriginais, mostrarSelecionados, fornecedorFiltrado]);
  
  // Calcular valor total estimado
  const calcularTotalEstimado = (produtosLista: ProdutoListaCompras[]) => {
    const total = produtosLista
      .filter(p => p.selecionado)
      .reduce((sum, produto) => {
        const quantidade = produto.quantidade || produto.quantidadeRecomendada;
        const preco = produto.precoEstimado || 0;
        return sum + (quantidade * preco);
      }, 0);
    
    setTotalValorEstimado(total);
  };
  
  // Atualizar quantidade de um produto
  const atualizarQuantidade = (id: number, quantidade: number) => {
    const novosProdutos = produtosOriginais.map(produto => {
      if (produto.id === id) {
        return { ...produto, quantidade };
      }
      return produto;
    });
    
    setProdutosOriginais(novosProdutos);
    
    // Recalcular total estimado
    calcularTotalEstimado(novosProdutos);
  };
  
  // Atualizar preço estimado de um produto
  const atualizarPrecoEstimado = (id: number, preco: number) => {
    const novosProdutos = produtosOriginais.map(produto => {
      if (produto.id === id) {
        return { ...produto, precoEstimado: preco };
      }
      return produto;
    });
    
    setProdutosOriginais(novosProdutos);
    
    // Salvar preço no AsyncStorage para uso futuro
    AsyncStorage.setItem(`preco_${id}`, JSON.stringify({ preco }))
      .catch(error => console.error("Erro ao salvar preço:", error));
    
    // Recalcular total estimado
    calcularTotalEstimado(novosProdutos);
  };
  
  // Alternar seleção de um produto
  const toggleProdutoSelecionado = (id: number) => {
    const novosProdutos = produtosOriginais.map(produto => {
      if (produto.id === id) {
        return { ...produto, selecionado: !produto.selecionado };
      }
      return produto;
    });
    
    setProdutosOriginais(novosProdutos);
    
    // Recalcular total estimado
    calcularTotalEstimado(novosProdutos);
  };
  
  // Compartilhar a lista de compras
  const compartilharLista = async () => {
    try {
      // Criar texto da lista de compras
      let textoLista = "Lista de Compras - Estoque\n\n";
      
      // Agrupar por fornecedor se houver fornecedores cadastrados
      if (fornecedoresList.length > 0) {
        // Produtos com fornecedor definido
        fornecedoresList.forEach(fornecedor => {
          const produtosFornecedor = produtosOriginais
            .filter(p => p.selecionado && p.fornecedor === fornecedor);
          
          if (produtosFornecedor.length > 0) {
            textoLista += `\n# ${fornecedor.toUpperCase()}\n`;
            
            produtosFornecedor.forEach(produto => {
              textoLista += `- ${produto.nome} (${produto.codigo}) - ${produto.quantidade || produto.quantidadeRecomendada} unidades`;
              if (mostraPrecos && produto.precoEstimado && produto.precoEstimado > 0) {
                textoLista += ` - R$ ${(produto.precoEstimado * (produto.quantidade || produto.quantidadeRecomendada)).toFixed(2)}`;
              }
              textoLista += "\n";
            });
          }
        });
        
        // Produtos sem fornecedor definido
        const produtosSemFornecedor = produtosOriginais
          .filter(p => p.selecionado && (!p.fornecedor || p.fornecedor.trim() === ''));
        
        if (produtosSemFornecedor.length > 0) {
          textoLista += "\n# FORNECEDOR NÃO DEFINIDO\n";
          
          produtosSemFornecedor.forEach(produto => {
            textoLista += `- ${produto.nome} (${produto.codigo}) - ${produto.quantidade || produto.quantidadeRecomendada} unidades`;
            if (mostraPrecos && produto.precoEstimado && produto.precoEstimado > 0) {
              textoLista += ` - R$ ${(produto.precoEstimado * (produto.quantidade || produto.quantidadeRecomendada)).toFixed(2)}`;
            }
            textoLista += "\n";
          });
        }
      } else {
        // Lista simples sem agrupar por fornecedor
        produtosOriginais
          .filter(p => p.selecionado)
          .forEach(produto => {
            textoLista += `- ${produto.nome} (${produto.codigo}) - ${produto.quantidade || produto.quantidadeRecomendada} unidades`;
            if (mostraPrecos && produto.precoEstimado && produto.precoEstimado > 0) {
              textoLista += ` - R$ ${(produto.precoEstimado * (produto.quantidade || produto.quantidadeRecomendada)).toFixed(2)}`;
            }
            textoLista += "\n";
          });
      }
      
      // Adicionar total se mostraPrecos estiver ativado
      if (mostraPrecos && totalValorEstimado > 0) {
        textoLista += `\nValor total estimado: R$ ${totalValorEstimado.toFixed(2)}`;
      }
      
      // Compartilhar usando a API do React Native
      await Share.share({
        message: textoLista,
        title: "Lista de Compras - Estoque"
      });
      
    } catch (error) {
      console.error("Erro ao compartilhar lista:", error);
      Alert.alert("Erro", "Não foi possível compartilhar a lista de compras");
    }
  };
  
  // Salvar lista atual como lista oficial
  const salvarLista = async () => {
    try {
      // Filtrar apenas produtos selecionados
      const listaSelecionados = produtosOriginais
        .filter(p => p.selecionado)
        .map(p => ({
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          quantidade: p.quantidade || p.quantidadeRecomendada,
          precoEstimado: p.precoEstimado || 0,
          fornecedor: p.fornecedor || ''
        }));
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('lista_compras', JSON.stringify({
        data: new Date().toISOString(),
        produtos: listaSelecionados,
        valorTotal: totalValorEstimado
      }));
      
      Alert.alert(
        "Sucesso",
        "Lista de compras salva com sucesso!",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Erro ao salvar lista:", error);
      Alert.alert("Erro", "Não foi possível salvar a lista de compras");
    }
  };
  
  // Obter cor da urgência
  const getUrgenciaCor = (urgencia: 'alta' | 'media' | 'baixa') => {
    switch (urgencia) {
      case 'alta': return COLORS.error;
      case 'media': return COLORS.warning;
      case 'baixa': return COLORS.success;
      default: return COLORS.grey;
    }
  };
  
  // Toggle filtros com animação
  const toggleFiltros = () => {
    if (mostrarFiltros) {
      // Esconder filtros
      Animated.timing(filterSlideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start(() => setMostrarFiltros(false));
    } else {
      // Mostrar filtros
      setMostrarFiltros(true);
      Animated.timing(filterSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    }
  };
  
  // Renderizar painel de filtros
  const renderFiltrosPanel = () => {
    if (!mostrarFiltros) return null;
    
    return (
      <Animated.View 
        style={[
          styles.filtrosPanel,
          { 
            backgroundColor: COLORS.card,
            transform: [{ translateY: filterSlideAnim }],
            opacity: filterSlideAnim.interpolate({
              inputRange: [-100, 0],
              outputRange: [0, 1],
            })
          }
        ]}
      >
        <View style={styles.filtrosPanelHeader}>
          <MaterialIcons name="filter-list" size={20} color={COLORS.primary} />
          <Text style={[styles.filtrosPanelTitle, { color: COLORS.text }]}>Filtros</Text>
        </View>
        
        <View style={styles.filtrosPanelContent}>
          <View style={styles.filtroItem}>
            <Text style={[styles.filtroLabel, { color: COLORS.text }]}>Mostrar apenas selecionados</Text>
            <Switch
              value={mostrarSelecionados}
              onValueChange={setMostrarSelecionados}
              trackColor={{ false: "#cccccc", true: COLORS.primaryLight }}
              thumbColor={mostrarSelecionados ? COLORS.primary : "#f4f3f4"}
            />
          </View>
          
          <View style={styles.filtroItem}>
            <Text style={[styles.filtroLabel, { color: COLORS.text }]}>Mostrar preços</Text>
            <Switch
              value={mostraPrecos}
              onValueChange={setMostraPrecos}
              trackColor={{ false: "#cccccc", true: COLORS.primaryLight }}
              thumbColor={mostraPrecos ? COLORS.primary : "#f4f3f4"}
            />
          </View>
          
          {fornecedoresList.length > 0 && (
            <View style={styles.filtroFornecedores}>
              <Text style={[styles.filtroLabel, { color: COLORS.text, marginBottom: 10 }]}>Filtrar por fornecedor:</Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fornecedoresList}>
                <TouchableOpacity
                  style={[
                    styles.fornecedorChip,
                    !fornecedorFiltrado && styles.fornecedorChipActive,
                    { borderColor: COLORS.primary }
                  ]}
                  onPress={() => setFornecedorFiltrado(null)}
                >
                  <Text style={[
                    styles.fornecedorChipText,
                    !fornecedorFiltrado && { color: COLORS.primary, fontWeight: 'bold' }
                  ]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                
                {fornecedoresList.map((fornecedor, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.fornecedorChip,
                      fornecedorFiltrado === fornecedor && styles.fornecedorChipActive,
                      { borderColor: COLORS.primary }
                    ]}
                    onPress={() => setFornecedorFiltrado(fornecedorFiltrado === fornecedor ? null : fornecedor)}
                  >
                    <Text style={[
                      styles.fornecedorChipText,
                      fornecedorFiltrado === fornecedor && { color: COLORS.primary, fontWeight: 'bold' }
                    ]}>
                      {fornecedor}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.fecharFiltrosButton, { backgroundColor: COLORS.lightGrey }]}
          onPress={toggleFiltros}
        >
          <Text style={[styles.fecharFiltrosText, { color: COLORS.text }]}>Fechar</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  
  // Renderizar item da lista
  const renderItem = ({ item, index }: { item: ProdutoListaCompras, index: number }) => {
    // Usar animação existente para este item ou criar nova
    const itemAnim = index < listItemAnims.length 
      ? listItemAnims[index] 
      : new Animated.Value(1);
      
    return (
      <Animated.View style={{
        opacity: itemAnim,
        transform: [
          { 
            translateY: itemAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0]
            }) 
          }
        ]
      }}>
        <View style={[
          styles.itemCard,
          { backgroundColor: COLORS.card }
        ]}>
          <View style={styles.itemCardHeader}>
            <TouchableOpacity
              style={[
                styles.checkboxContainer,
                { borderColor: getUrgenciaCor(item.urgencia) }
              ]}
              onPress={() => toggleProdutoSelecionado(item.id)}
            >
              <View style={[
                styles.checkbox,
                item.selecionado && { 
                  backgroundColor: getUrgenciaCor(item.urgencia),
                  borderColor: getUrgenciaCor(item.urgencia)
                }
              ]}>
                {item.selecionado && (
                  <MaterialIcons name="check" size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: COLORS.text }]}>{item.nome}</Text>
              <View style={styles.itemMetaInfo}>
                <View style={styles.codigoContainer}>
                  <MaterialIcons name="qr-code" size={12} color={COLORS.primary} />
                  <Text style={[styles.codigoText, { color: COLORS.primary }]}>{item.codigo}</Text>
                </View>
                
                <View style={[
                  styles.urgenciaTag,
                  { backgroundColor: getUrgenciaCor(item.urgencia) + '30' }
                ]}>
                  <MaterialIcons 
                    name={
                      item.urgencia === 'alta' ? "error" : 
                      item.urgencia === 'media' ? "warning" : "check-circle"
                    } 
                    size={12} 
                    color={getUrgenciaCor(item.urgencia)} 
                  />
                  <Text style={[styles.urgenciaText, { color: getUrgenciaCor(item.urgencia) }]}>
                    {item.urgencia === 'alta' ? 'Urgente' : 
                     item.urgencia === 'media' ? 'Médio' : 'Baixo'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.itemCardBody}>
            <View style={styles.estoqueInfo}>
              <View style={styles.estoqueAtual}>
                <Text style={[styles.estoqueLabel, { color: COLORS.textSecondary }]}>
                  Estoque atual:
                </Text>
                <Text style={[styles.estoqueValue, { color: COLORS.text }]}>
                  {item.quantidadeAtual} unid.
                </Text>
              </View>
              
              {item.fornecedor && (
                <View style={styles.fornecedorInfo}>
                  <MaterialIcons name="business" size={12} color={COLORS.textSecondary} />
                  <Text style={[styles.fornecedorText, { color: COLORS.textSecondary }]}>
                    {item.fornecedor}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.quantityContainer}>
              <Text style={[styles.quantityLabel, { color: COLORS.textSecondary }]}>
                Quantidade a comprar:
              </Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={[styles.quantityButton, { backgroundColor: COLORS.error }]}
                  onPress={() => {
                    const novaQuantidade = Math.max(1, (item.quantidade || item.quantidadeRecomendada) - 1);
                    atualizarQuantidade(item.id, novaQuantidade);
                  }}
                >
                  <MaterialIcons name="remove" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                
                <TextInput
                  style={[
                    styles.quantityInput,
                    { 
                      backgroundColor: COLORS.ultraLightGrey,
                      borderColor: COLORS.lightGrey,
                      color: COLORS.text
                    }
                  ]}
                  value={String(item.quantidade || item.quantidadeRecomendada)}
                  onChangeText={(text) => {
                    const quantidade = parseInt(text);
                    if (!isNaN(quantidade) && quantidade > 0) {
                      atualizarQuantidade(item.id, quantidade);
                    }
                  }}
                  keyboardType="numeric"
                />
                
                <TouchableOpacity
                  style={[styles.quantityButton, { backgroundColor: COLORS.success }]}
                  onPress={() => {
                    const novaQuantidade = (item.quantidade || item.quantidadeRecomendada) + 1;
                    atualizarQuantidade(item.id, novaQuantidade);
                  }}
                >
                  <MaterialIcons name="add" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            
            {mostraPrecos && (
              <View style={styles.precoContainer}>
                <Text style={[styles.precoLabel, { color: COLORS.textSecondary }]}>
                  Preço unitário:
                </Text>
                <View style={styles.precoInputContainer}>
                  <Text style={[styles.precoSymbol, { color: COLORS.text }]}>R$</Text>
                  <TextInput
                    style={[
                      styles.precoInput,
                      { 
                        backgroundColor: COLORS.ultraLightGrey,
                        borderColor: COLORS.lightGrey,
                        color: COLORS.text
                      }
                    ]}
                    value={item.precoEstimado ? item.precoEstimado.toString() : ''}
                    onChangeText={(text) => {
                      // Substituir vírgula por ponto
                      const cleanedText = text.replace(',', '.');
                      const preco = parseFloat(cleanedText);
                      if (!isNaN(preco) && preco >= 0) {
                        atualizarPrecoEstimado(item.id, preco);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={COLORS.grey}
                  />
                </View>
              </View>
            )}
            
            {mostraPrecos && item.precoEstimado && item.precoEstimado > 0 && (
              <View style={styles.totalContainer}>
                <Text style={[styles.totalLabel, { color: COLORS.textSecondary }]}>
                  Total:
                </Text>
                <Text style={[styles.totalValue, { color: COLORS.primary }]}>
                  R$ {((item.quantidade || item.quantidadeRecomendada) * item.precoEstimado).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Header 
            title="Lista de Compras" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.grey }]}>
            Gerando lista de compras inteligente...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Lista de Compras" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      {produtos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="shopping-cart" size={60} color={COLORS.lightGrey} />
          <Text style={[styles.emptyTitle, { color: COLORS.text }]}>
            Lista de Compras Vazia
          </Text>
          <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
            Não há produtos recomendados para compra no momento.
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: COLORS.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.emptyButtonText}>Voltar ao Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Animated.View 
            style={[
              styles.controlBar,
              { 
                backgroundColor: COLORS.card,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={COLORS.grey} style={styles.searchIcon} />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: COLORS.text }
                ]}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar produtos..."
                placeholderTextColor={COLORS.grey}
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => setSearchText('')}
                >
                  <MaterialIcons name="close" size={20} color={COLORS.grey} />
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                mostrarFiltros && { backgroundColor: COLORS.primary }
              ]}
              onPress={toggleFiltros}
            >
              <MaterialIcons 
                name="filter-list" 
                size={24} 
                color={mostrarFiltros ? COLORS.white : COLORS.primary} 
              />
            </TouchableOpacity>
          </Animated.View>
          
          {renderFiltrosPanel()}
          
          <Animated.View 
            style={[
              styles.statsBar,
              { 
                backgroundColor: COLORS.card,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.statsItem}>
              <MaterialIcons name="shopping-basket" size={20} color={COLORS.primary} />
              <Text style={[styles.statsValue, { color: COLORS.text }]}>
                {produtosOriginais.filter(p => p.selecionado).length}
              </Text>
              <Text style={[styles.statsLabel, { color: COLORS.textSecondary }]}>
                Itens
              </Text>
            </View>
            
            {mostraPrecos && (
              <View style={styles.statsItem}>
                <MaterialIcons name="attach-money" size={20} color={COLORS.success} />
                <Text style={[styles.statsValue, { color: COLORS.text }]}>
                  R$ {totalValorEstimado.toFixed(2)}
                </Text>
                <Text style={[styles.statsLabel, { color: COLORS.textSecondary }]}>
                  Total
                </Text>
              </View>
            )}
            
            <View style={styles.statsItem}>
              <MaterialIcons 
                name="business" 
                size={20} 
                color={COLORS.info} 
              />
              <Text style={[styles.statsValue, { color: COLORS.text }]}>
                {fornecedoresList.length}
              </Text>
              <Text style={[styles.statsLabel, { color: COLORS.textSecondary }]}>
                Fornecedores
              </Text>
            </View>
          </Animated.View>
          
          <FlatList
            data={produtos}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
          
          <Animated.View 
            style={[
              styles.actionsBar,
              { 
                backgroundColor: COLORS.card,
                opacity: fadeAnim
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.info }]}
              onPress={compartilharLista}
            >
              <MaterialIcons name="share" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Compartilhar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.success }]}
              onPress={salvarLista}
            >
              <MaterialIcons name="save" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Salvar Lista</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
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
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  emptyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearSearchButton: {
    padding: 4,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#F0F0F0',
  },
  filtrosPanel: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
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
  filtrosPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filtrosPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  filtrosPanelContent: {
    marginBottom: 16,
  },
  filtroItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filtroLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  filtroFornecedores: {
    marginTop: 8,
  },
  fornecedoresList: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  fornecedorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  fornecedorChipActive: {
    backgroundColor: '#E3F2FD',
  },
  fornecedorChipText: {
    fontSize: 14,
  },
  fecharFiltrosButton: {
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  fecharFiltrosText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
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
  statsItem: {
    alignItems: 'center',
    flex: 1,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statsLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
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
  itemCardHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemMetaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  codigoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  codigoText: {
    fontSize: 12,
    marginLeft: 4,
  },
  urgenciaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  urgenciaText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  itemCardBody: {
    padding: 16,
  },
  estoqueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  estoqueAtual: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estoqueLabel: {
    fontSize: 14,
    marginRight: 4,
  },
  estoqueValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  fornecedorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fornecedorText: {
    fontSize: 12,
    marginLeft: 4,
  },
  quantityContainer: {
    marginBottom: 12,
  },
  quantityLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quantityInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
  },
  precoContainer: {
    marginBottom: 12,
  },
  precoLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  precoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  precoSymbol: {
    fontSize: 16,
    marginRight: 8,
  },
  precoInput: {
    width: 100,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'right',
    paddingHorizontal: 8,
    fontSize: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ShoppingListScreen;