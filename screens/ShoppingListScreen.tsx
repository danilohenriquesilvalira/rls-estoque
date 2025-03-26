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
  TextInput,
  Switch,
  Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import { gerarListaCompras } from '../services/stockPrediction';

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
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
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
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          })
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
  
  // Atualizar filtro de produtos quando o texto de busca mudar
  useEffect(() => {
    if (searchText.trim() === '') {
      // Se não há texto de busca, mostrar todos os produtos originais
      setProdutos(produtosOriginais);
    } else {
      // Filtrar produtos pelo texto de busca
      const filtered = produtosOriginais.filter(produto => 
        produto.nome.toLowerCase().includes(searchText.toLowerCase()) ||
        produto.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
        (produto.fornecedor && produto.fornecedor.toLowerCase().includes(searchText.toLowerCase()))
      );
      setProdutos(filtered);
    }
  }, [searchText, produtosOriginais, mostrarSelecionados]);
  
  // Atualizar quando o toggle de selecionados mudar
  useEffect(() => {
    if (mostrarSelecionados) {
      // Mostrar apenas produtos selecionados
      const filtered = produtosOriginais.filter(produto => produto.selecionado);
      setProdutos(filtered);
    } else {
      // Aplicar apenas o filtro de texto
      if (searchText.trim() === '') {
        setProdutos(produtosOriginais);
      } else {
        const filtered = produtosOriginais.filter(produto => 
          produto.nome.toLowerCase().includes(searchText.toLowerCase()) ||
          produto.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
          (produto.fornecedor && produto.fornecedor.toLowerCase().includes(searchText.toLowerCase()))
        );
        setProdutos(filtered);
      }
    }
  }, [mostrarSelecionados, produtosOriginais, searchText]);
  
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
  
  // Renderizar item da lista
  const renderItem = ({ item }: { item: ProdutoListaCompras }) => (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }]
    }}>
      <View style={[
        styles.itemContainer,
        { backgroundColor: COLORS.card }
      ]}>
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
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: COLORS.text }]}>{item.nome}</Text>
          <Text style={[styles.itemCode, { color: COLORS.primary }]}>{item.codigo}</Text>
          
          {item.fornecedor && (
            <Text style={[styles.fornecedor, { color: COLORS.textSecondary }]}>
              Fornecedor: {item.fornecedor}
            </Text>
          )}
          
          <View style={styles.stockInfo}>
            <Text style={[styles.stockText, { color: COLORS.textSecondary }]}>
              Estoque atual: {item.quantidadeAtual} un
            </Text>
            
            <Text style={[
              styles.urgenciaText,
              { color: getUrgenciaCor(item.urgencia) }
            ]}>
              {item.urgencia === 'alta' ? 'Urgente' : 
               item.urgencia === 'media' ? 'Médio' : 'Baixo'}
            </Text>
          </View>
        </View>
        
        <View style={styles.quantityControls}>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: COLORS.error }]}
              onPress={() => {
                const novaQuantidade = Math.max(1, (item.quantidade || item.quantidadeRecomendada) - 1);
                atualizarQuantidade(item.id, novaQuantidade);
              }}
            >
              <Text style={styles.quantityButtonText}>-</Text>
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
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          {mostraPrecos && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>R$</Text>
              <TextInput
                style={[
                  styles.priceInput,
                  { 
                    backgroundColor: COLORS.ultraLightGrey,
                    borderColor: COLORS.lightGrey,
                    color: COLORS.text
                  }
                ]}
                value={String(item.precoEstimado || '')}
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
              />
            </View>
          )}
          
          {mostraPrecos && item.precoEstimado && item.precoEstimado > 0 && (
            <Text style={[styles.totalValue, { color: COLORS.primary }]}>
              Total: R$ {((item.quantidade || item.quantidadeRecomendada) * item.precoEstimado).toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
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
              styles.filtersContainer,
              { 
                backgroundColor: COLORS.card,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <TextInput
              style={[
                styles.searchInput,
                { 
                  backgroundColor: COLORS.ultraLightGrey,
                  borderColor: COLORS.lightGrey,
                  color: COLORS.text
                }
              ]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Buscar produtos..."
              placeholderTextColor={COLORS.grey}
            />
            
            <View style={styles.optionsRow}>
              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: COLORS.text }]}>
                  Mostrar preços
                </Text>
                <Switch
                  value={mostraPrecos}
                  onValueChange={setMostraPrecos}
                  trackColor={{ false: "#cccccc", true: COLORS.primaryLight }}
                  thumbColor={mostraPrecos ? COLORS.primary : "#f4f3f4"}
                />
              </View>
              
              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: COLORS.text }]}>
                  Selecionados
                </Text>
                <Switch
                  value={mostrarSelecionados}
                  onValueChange={setMostrarSelecionados}
                  trackColor={{ false: "#cccccc", true: COLORS.primaryLight }}
                  thumbColor={mostrarSelecionados ? COLORS.primary : "#f4f3f4"}
                />
              </View>
            </View>
          </Animated.View>
          
          <FlatList
            data={produtos}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
          />
          
          <Animated.View 
            style={[
              styles.totalsContainer,
              { 
                backgroundColor: COLORS.card,
                opacity: fadeAnim
              }
            ]}
          >
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: COLORS.text }]}>
                Total de itens:
              </Text>
              <Text style={[styles.totalCount, { color: COLORS.primary }]}>
                {produtosOriginais.filter(p => p.selecionado).length} itens
              </Text>
            </View>
            
            {mostraPrecos && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: COLORS.text }]}>
                  Valor estimado:
                </Text>
                <Text style={[styles.totalPrice, { color: COLORS.primary }]}>
                  R$ {totalValorEstimado.toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.info }]}
                onPress={compartilharLista}
              >
                <Text style={styles.actionButtonText}>Compartilhar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={salvarLista}
              >
                <Text style={styles.actionButtonText}>Salvar Lista</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}
    </View>
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
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    padding: 15,
    borderRadius: 8,
    margin: 15,
    marginBottom: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    marginRight: 8,
    fontSize: 14,
  },
  listContent: {
    padding: 10,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
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
  checkboxContainer: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    alignSelf: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 12,
    marginBottom: 4,
  },
  fornecedor: {
    fontSize: 12,
    marginBottom: 6,
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockText: {
    fontSize: 12,
  },
  urgenciaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quantityControls: {
    justifyContent: 'center',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityInput: {
    width: 40,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  priceInput: {
    width: 70,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  totalValue: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'right',
    fontWeight: '600',
  },
  totalsContainer: {
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  totalCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
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
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ShoppingListScreen;