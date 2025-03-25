import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Image,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import ThemeToggle from '../components/ThemeToggle';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any, 'Settings'>;
};

interface SettingsType {
  notifications: boolean;
  lowStockAlerts: boolean;
  autoGenerateCode: boolean;
  quickScan: boolean;
  version: string;
}

const defaultSettings: SettingsType = {
  notifications: true,
  lowStockAlerts: true,
  autoGenerateCode: true,
  quickScan: false,
  version: '1.0.0',
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { theme, toggleTheme } = useTheme();
  const { COLORS, SHADOWS } = theme;
  
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [loading, setLoading] = useState<boolean>(true);
  const [aboutModalVisible, setAboutModalVisible] = useState<boolean>(false);
  
  // Carregar configurações
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const savedSettings = await AsyncStorage.getItem('@app_settings');
        
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Salvar configurações
  const saveSettings = async (newSettings: SettingsType) => {
    try {
      await AsyncStorage.setItem('@app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    }
  };
  
  // Atualizar uma configuração específica
  const updateSetting = (key: keyof SettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };
  
  // Limpar todos os dados
  const clearAllData = () => {
    Alert.alert(
      'Limpar Todos os Dados',
      'Tem certeza que deseja remover todos os produtos e configurações? Esta ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Limpar somente dados de produtos, não configurações
              await AsyncStorage.removeItem('products');
              await AsyncStorage.removeItem('productHistory');
              
              Alert.alert(
                'Dados Removidos',
                'Todos os dados de produtos foram removidos com sucesso.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Erro ao limpar dados:', error);
              Alert.alert('Erro', 'Não foi possível limpar os dados');
            }
          },
        },
      ]
    );
  };
  
  // Conteúdo do About Modal
  const renderAboutModal = () => (
    <Modal
      visible={aboutModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setAboutModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          { backgroundColor: COLORS.card }
        ]}>
          <View style={styles.companyLogo}>
            <Text style={[styles.logoText, { color: COLORS.primary }]}>
              RLS AUTOMAÇÃO
            </Text>
          </View>
          
          <Text style={[styles.aboutTitle, { color: COLORS.text }]}>
            Sobre o Aplicativo
          </Text>
          
          <Text style={[styles.aboutText, { color: COLORS.textSecondary }]}>
            O RLS Estoque é um aplicativo para gestão de estoque desenvolvido para a RLS Automação Industrial.
          </Text>
          
          <Text style={[styles.versionInfo, { color: COLORS.textSecondary }]}>
            Versão {settings.version}
          </Text>
          
          <View style={styles.contactSection}>
            <Text style={[styles.contactTitle, { color: COLORS.text }]}>
              Contato
            </Text>
            
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Linking.openURL('mailto:contato@rlsautomacao.com.br')}
            >
              <Text style={[styles.contactButtonText, { color: COLORS.primary }]}>
                contato@rlsautomacao.com.br
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Linking.openURL('tel:+5500000000000')}
            >
              <Text style={[styles.contactButtonText, { color: COLORS.primary }]}>
                (00) 0000-0000
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.closeButton,
              { backgroundColor: COLORS.primary }
            ]}
            onPress={() => setAboutModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
  
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <Header title="Configurações" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
            Carregando configurações...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <Header title="Configurações" showLogo={false} showBack={true} onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollContainer}>
        {/* Tema */}
        <View style={[styles.section, { backgroundColor: COLORS.card, ...SHADOWS.small }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            Aparência
          </Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: COLORS.text }]}>
              Tema
            </Text>
            <ThemeToggle />
          </View>
        </View>
        
        {/* Gerais */}
        <View style={[styles.section, { backgroundColor: COLORS.card, ...SHADOWS.small }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            Gerais
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>
                Receber notificações
              </Text>
              <Text style={[styles.settingDescription, { color: COLORS.textSecondary }]}>
                Notificações sobre o estoque
              </Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting('notifications', value)}
              trackColor={{ false: COLORS.lightGrey, true: COLORS.primaryLight }}
              thumbColor={settings.notifications ? COLORS.primary : COLORS.grey}
            />
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>
                Alertas de estoque baixo
              </Text>
              <Text style={[styles.settingDescription, { color: COLORS.textSecondary }]}>
                Notificar quando um produto atingir o nível mínimo
              </Text>
            </View>
            <Switch
              value={settings.lowStockAlerts}
              onValueChange={(value) => updateSetting('lowStockAlerts', value)}
              trackColor={{ false: COLORS.lightGrey, true: COLORS.primaryLight }}
              thumbColor={settings.lowStockAlerts ? COLORS.primary : COLORS.grey}
            />
          </View>
        </View>
        
        {/* Produtos */}
        <View style={[styles.section, { backgroundColor: COLORS.card, ...SHADOWS.small }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            Produtos
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>
                Gerar códigos automaticamente
              </Text>
              <Text style={[styles.settingDescription, { color: COLORS.textSecondary }]}>
                Gerar códigos sequenciais para novos produtos
              </Text>
            </View>
            <Switch
              value={settings.autoGenerateCode}
              onValueChange={(value) => updateSetting('autoGenerateCode', value)}
              trackColor={{ false: COLORS.lightGrey, true: COLORS.primaryLight }}
              thumbColor={settings.autoGenerateCode ? COLORS.primary : COLORS.grey}
            />
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>
                Escaneamento rápido
              </Text>
              <Text style={[styles.settingDescription, { color: COLORS.textSecondary }]}>
                Processar automaticamente ao escanear
              </Text>
            </View>
            <Switch
              value={settings.quickScan}
              onValueChange={(value) => updateSetting('quickScan', value)}
              trackColor={{ false: COLORS.lightGrey, true: COLORS.primaryLight }}
              thumbColor={settings.quickScan ? COLORS.primary : COLORS.grey}
            />
          </View>
        </View>
        
        {/* Dados */}
        <View style={[styles.section, { backgroundColor: COLORS.card, ...SHADOWS.small }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            Dados
          </Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={clearAllData}
          >
            <Text style={[styles.actionButtonText, { color: COLORS.error }]}>
              Limpar Todos os Dados
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert(
              'Exportar Dados',
              'Em breve você poderá exportar seus dados. Aguarde as próximas atualizações!'
            )}
          >
            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
              Exportar Dados (Em breve)
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Sobre */}
        <View style={[styles.section, { backgroundColor: COLORS.card, ...SHADOWS.small }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            Sobre
          </Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setAboutModalVisible(true)}
          >
            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
              Sobre o Aplicativo
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert(
              'RLS Automação Industrial',
              'Aplicativo de gestão de estoque para a RLS Automação Industrial.\n\nVersão: ' + settings.version
            )}
          >
            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
              Versão do Aplicativo
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <TouchableOpacity
  style={styles.actionButton}
  onPress={() => navigation.navigate('ServerConfig')}
>
  <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
    Configurar Servidor PostgreSQL
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={styles.actionButton}
  onPress={() => navigation.navigate('Diagnostic')}
>
  <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
    Diagnóstico de Conexão
  </Text>
</TouchableOpacity>
      {renderAboutModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  section: {
    borderRadius: 10,
    marginBottom: 15,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabelContainer: {
    flex: 1,
    paddingRight: 10,
  },
  settingLabel: {
    fontSize: 16,
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 3,
  },
  separator: {
    height: 1,
    marginVertical: 5,
    backgroundColor: '#E0E0E0',
  },
  actionButton: {
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: 16,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  companyLogo: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  aboutText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  versionInfo: {
    fontSize: 12,
    marginBottom: 20,
  },
  contactSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  contactButton: {
    paddingVertical: 8,
  },
  contactButtonText: {
    fontSize: 14,
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;