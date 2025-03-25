import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { RootStackParamList } from '../App';

// Definição do tipo para as propriedades de navegação
type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

// Interface para o produto
interface Product {
  code: string;
  name: string;
  description?: string;
  quantity: number;
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
  statusBar: '#0D47A1',
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Carregar dados resumidos do estoque
  useEffect(() => {
    const loadInventorySummary = async () => {
      try {
        setLoading(true);
        const jsonValue = await AsyncStorage.getItem('products');
        
        if (jsonValue != null) {
          const products: Product[] = JSON.parse(jsonValue);
          setTotalProducts(products.length);
          
          // Contar produtos com estoque baixo (menos de 5 unidades)
          const lowStock = products.filter(p => p.quantity < 5).length;
          setLowStockCount(lowStock);

          // Contar total de itens em estoque
          const total = products.reduce((sum, product) => sum + product.quantity, 0);
          setTotalItems(total);

          // Registrar horário da atualização
          setLastUpdate(new Date().toLocaleTimeString());
        } else {
          // Nenhum produto encontrado
          setTotalProducts(0);
          setLowStockCount(0);
          setTotalItems(0);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      } catch (error) {
        console.error("Erro ao carregar resumo do estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    // Executar ao montar o componente
    loadInventorySummary();

    // Configurar um ouvinte de foco para atualizar quando a tela receber foco
    const unsubscribe = navigation.addListener('focus', () => {
      loadInventorySummary();
    });

    // Limpeza ao desmontar
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.statusBar} barStyle="light-content" />
      
      {/* Header com Logo */}
      <Header showLogo={true} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Banner de boas-vindas */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            Bem-vindo ao Sistema de Gestão
          </Text>
          <Text style={styles.welcomeText}>
            Controle seu estoque com facilidade e eficiência
          </Text>
        </View>
        
        {/* Cartões de resumo */}
        <View style={styles.dashboardContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Resumo do Estoque</Text>
            <Text style={styles.updateText}>Atualizado: {lastUpdate}</Text>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : (
            <View style={styles.cardsContainer}>
              <View style={[styles.card, styles.cardPrimary]}>
                <Text style={styles.cardValue}>{totalProducts}</Text>
                <Text style={styles.cardLabel}>Produtos</Text>
              </View>
              
              <View style={[styles.card, styles.cardSuccess]}>
                <Text style={styles.cardValue}>{totalItems}</Text>
                <Text style={styles.cardLabel}>Itens Total</Text>
              </View>
              
              <View style={[styles.card, lowStockCount > 0 ? styles.cardWarning : styles.cardGrey]}>
                <Text style={styles.cardValue}>{lowStockCount}</Text>
                <Text style={styles.cardLabel}>Est. Baixo</Text>
              </View>
            </View>
          )}
        </View>
        
        {/* Menu principal */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu Principal</Text>
          
          <View style={styles.menuGrid}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('Scanner')}
            >
              <View style={[styles.menuIconBg, {backgroundColor: COLORS.primary}]}>
                <Text style={styles.menuIcon}>📷</Text>
              </View>
              <Text style={styles.menuText}>Escanear QR</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('ProductList')}
            >
              <View style={[styles.menuIconBg, {backgroundColor: COLORS.accent}]}>
                <Text style={styles.menuIcon}>📋</Text>
              </View>
              <Text style={styles.menuText}>Produtos</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('AddProduct')}
            >
              <View style={[styles.menuIconBg, {backgroundColor: COLORS.success}]}>
                <Text style={styles.menuIcon}>➕</Text>
              </View>
              <Text style={styles.menuText}>Adicionar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('Dashboard')}
            >
              <View style={[styles.menuIconBg, {backgroundColor: COLORS.info}]}>
                <Text style={styles.menuIcon}>📊</Text>
              </View>
              <Text style={styles.menuText}>Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ações rápidas */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>📦</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Registrar Nova Entrada</Text>
              <Text style={styles.actionDescription}>Adicione novos produtos ao estoque</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>⚙️</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Configurações</Text>
              <Text style={styles.actionDescription}>Personalize o aplicativo</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>RLS Automação Industrial © {new Date().getFullYear()}</Text>
          <Text style={styles.versionText}>Versão 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const windowWidth = Dimensions.get('window').width;
const cardWidth = (windowWidth - 60) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  welcomeCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 5,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  dashboardContainer: {
    padding: 15,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  updateText: {
    fontSize: 12,
    color: COLORS.grey,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    width: cardWidth,
    height: 100,
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPrimary: {
    backgroundColor: COLORS.primary,
  },
  cardSuccess: {
    backgroundColor: COLORS.success,
  },
  cardWarning: {
    backgroundColor: COLORS.warning,
  },
  cardGrey: {
    backgroundColor: COLORS.grey,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  cardLabel: {
    fontSize: 12,
    color: COLORS.white,
    marginTop: 5,
  },
  menuSection: {
    padding: 15,
    marginBottom: 15,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  menuItem: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuIcon: {
    fontSize: 24,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 5,
  },
  quickActionsContainer: {
    padding: 15,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.ultraLightGrey,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionDescription: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 3,
  },
  loader: {
    marginVertical: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.grey,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 3,
  },
});