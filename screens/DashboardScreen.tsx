import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions
} from 'react-native';
import Header from '../components/Header';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { getProdutos, getMovimentacoes, verificarConexao } from '../services/api';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

// Interface para o produto
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

// Definir cores do tema
const COLORS = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  accent: '#FF6F00',
  success: '#2E7D32',
  warning: '#F57F17',
  error: '#C62828',
  info: '#0288D1',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  background: '#F5F7FA',
};

const DashboardScreen = ({ navigation }: DashboardScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalItens: 0,
    estoqueBaixo: 0
  });

  // Carregar dados para o dashboard
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Verificar conexão
        const connected = await verificarConexao();
        setIsOnline(connected);

        // Carregar produtos
        const produtosData = await getProdutos();
        setProdutos(produtosData);
        
        // Carregar movimentações
        const movimentacoesData = await getMovimentacoes();
        setMovimentos(movimentacoesData);
        
        // Calcular estatísticas
        const totalProdutos = produtosData.length;
        const totalItens = produtosData.reduce((sum, p) => sum + p.quantidade, 0);
        const estoqueBaixo = produtosData.filter(p => p.quantidade < (p.quantidade_minima || 5)).length;
        
        setStats({
          totalProdutos,
          totalItens,
          estoqueBaixo
        });
        
        setLastUpdate(new Date());
      } catch (error) {
        console.error("Erro ao carregar dados para o dashboard:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados do dashboard");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Atualizar ao voltar para a tela
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  // Obter Top 5 produtos por quantidade
  const getTopProdutos = () => {
    return [...produtos]
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  };

  // Obter últimas movimentações
  const getUltimasMovimentacoes = () => {
    return [...movimentos]
      .sort((a, b) => {
        const dateA = new Date(a.data_movimentacao || new Date().toISOString());
        const dateB = new Date(b.data_movimentacao || new Date().toISOString());
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
  };

  // Função para formatar data
  const formatarData = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Dashboard" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Dashboard" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>Modo Offline - Exibindo dados locais</Text>
          </View>
        )}
        
        {/* Resumo em Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.totalProdutos}</Text>
            <Text style={styles.summaryLabel}>Produtos</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.totalItens}</Text>
            <Text style={styles.summaryLabel}>Unidades</Text>
          </View>
          
          <View style={[styles.summaryCard, stats.estoqueBaixo > 0 ? styles.warningCard : {}]}>
            <Text style={styles.summaryValue}>{stats.estoqueBaixo}</Text>
            <Text style={styles.summaryLabel}>Est. Baixo</Text>
          </View>
        </View>

        {/* Status do Estoque */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Status do Estoque</Text>
          
          <View style={styles.statusBars}>
            <View style={styles.statusBar}>
              <Text style={styles.statusLabel}>Estoque Baixo</Text>
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.barFill, 
                    { 
                      width: `${(stats.estoqueBaixo / stats.totalProdutos * 100) || 0}%`,
                      backgroundColor: COLORS.error
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.estoqueBaixo}</Text>
            </View>
            
            <View style={styles.statusBar}>
              <Text style={styles.statusLabel}>Estoque Normal</Text>
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.barFill, 
                    { 
                      width: `${((stats.totalProdutos - stats.estoqueBaixo) / stats.totalProdutos * 100) || 0}%`,
                      backgroundColor: COLORS.success
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusValue}>{stats.totalProdutos - stats.estoqueBaixo}</Text>
            </View>
          </View>
        </View>

        {/* Top 5 Produtos */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top 5 Produtos por Quantidade</Text>
          
          {getTopProdutos().length === 0 ? (
            <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
          ) : (
            getTopProdutos().map((produto, index) => (
              <View key={index} style={styles.productItem}>
                <View style={styles.productRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{produto.nome}</Text>
                  <Text style={styles.productCode}>{produto.codigo}</Text>
                </View>
                <View style={styles.productQuantity}>
                  <Text style={styles.quantityText}>{produto.quantidade}</Text>
                  <Text style={styles.quantityLabel}>unid.</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Últimas Movimentações */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Últimas Movimentações</Text>
          
          {getUltimasMovimentacoes().length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma movimentação registrada</Text>
          ) : (
            getUltimasMovimentacoes().map((movimento, index) => (
              <View key={index} style={styles.movementItem}>
                <View style={[
                  styles.movementType,
                  { backgroundColor: movimento.tipo === 'entrada' ? COLORS.success : COLORS.error }
                ]}>
                  <Text style={styles.typeText}>{movimento.tipo === 'entrada' ? '+' : '-'}</Text>
                </View>
                <View style={styles.movementInfo}>
                  <Text style={styles.movementName}>
                    {movimento.produto_nome || `Produto ID: ${movimento.produto_id}`}
                  </Text>
                  <Text style={styles.movementDetails}>
                    {movimento.tipo === 'entrada' ? 'Entrada' : 'Saída'} de {movimento.quantidade} unid. • {formatarData(movimento.data_movimentacao)}
                  </Text>
                </View>
              </View>
            ))
          )}
          
          {movimentos.length > 5 && (
            <TouchableOpacity 
              style={styles.viewMoreButton}
              onPress={() => navigation.navigate('ProductList')}
            >
              <Text style={styles.viewMoreText}>Ver Mais</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.grey,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  offlineBanner: {
    backgroundColor: COLORS.error,
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  offlineText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '500',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    width: '31%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  warningCard: {
    backgroundColor: COLORS.warning,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 5,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.black,
  },
  statusBars: {
    marginTop: 10,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusLabel: {
    width: 100,
    fontSize: 14,
    color: COLORS.black,
  },
  barContainer: {
    flex: 1,
    height: 15,
    backgroundColor: COLORS.lightGrey,
    borderRadius: 7.5,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 7.5,
  },
  statusValue: {
    width: 30,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ultraLightGrey,
  },
  productRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
  },
  productCode: {
    fontSize: 12,
    color: COLORS.grey,
  },
  productQuantity: {
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityLabel: {
    fontSize: 10,
    color: COLORS.grey,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ultraLightGrey,
  },
  movementType: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  typeText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  movementInfo: {
    flex: 1,
  },
  movementName: {
    fontSize: 14,
    fontWeight: '500',
  },
  movementDetails: {
    fontSize: 12,
    color: COLORS.grey,
  },
  viewMoreButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  viewMoreText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey,
    fontStyle: 'italic',
    padding: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.grey,
    fontStyle: 'italic',
  },
});

export default DashboardScreen;