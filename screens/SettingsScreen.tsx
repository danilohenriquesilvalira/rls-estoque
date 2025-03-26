import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
  Animated,
  Easing,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const staggerAnimations = useRef<Animated.Value[]>([]).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  
  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const savedSettings = await AsyncStorage.getItem('@app_settings');
        
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
    
    // Initialize stagger animations for each section
    const numberOfSections = 5; // Appearance, General, Products, Data, About
    staggerAnimations.length = 0;
    
    for (let i = 0; i < numberOfSections; i++) {
      staggerAnimations.push(new Animated.Value(0));
    }
    
    // Start entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.stagger(
        100,
        staggerAnimations.map(anim => 
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true
          })
        )
      )
    ]).start();
  }, []);
  
  // Modal animation
  useEffect(() => {
    if (aboutModalVisible) {
      // Reset and start modal animation
      modalAnim.setValue(0);
      Animated.spring(modalAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true
      }).start();
    }
  }, [aboutModalVisible]);
  
  // Save settings
  const saveSettings = async (newSettings: SettingsType) => {
    try {
      await AsyncStorage.setItem('@app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    }
  };
  
  // Update a specific setting
  const updateSetting = (key: keyof SettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };
  
  // Clear all data
  const clearAllData = () => {
    Alert.alert(
      "Limpar Todos os Dados",
      "Tem certeza que deseja remover todos os produtos e configurações? Esta ação não pode ser desfeita.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Limpar",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear only product data, not settings
              await AsyncStorage.removeItem('produtos');
              await AsyncStorage.removeItem('productHistory');
              
              Alert.alert(
                "Dados Removidos",
                "Todos os dados de produtos foram removidos com sucesso.",
                [{ text: "OK" }]
              );
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Erro', 'Não foi possível limpar os dados');
            }
          },
        },
      ]
    );
  };
  
  // Close about modal with animation
  const closeAboutModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start(() => {
      setAboutModalVisible(false);
    });
  };
  
  // About modal content
  const renderAboutModal = () => (
    <Modal
      visible={aboutModalVisible}
      transparent={true}
      animationType="none"
      onRequestClose={closeAboutModal}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.modalContent,
            { 
              backgroundColor: COLORS.card,
              opacity: modalAnim,
              transform: [
                { scale: modalAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                }) },
                { translateY: modalAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0]
                }) }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalHeader}
          >
            <View style={styles.companyLogo}>
              <Text style={styles.logoText}>
                RLS AUTOMAÇÃO
              </Text>
            </View>
          </LinearGradient>
          
          <View style={styles.modalBody}>
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
              onPress={closeAboutModal}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
  
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
            title="Configurações" 
            showLogo={false} 
            showBack={true} 
            onBack={() => navigation.goBack()} 
          />
        </LinearGradient>
        
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
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Header 
          title="Configurações" 
          showLogo={false} 
          showBack={true} 
          onBack={() => navigation.goBack()} 
        />
      </LinearGradient>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance Section */}
        <Animated.View style={[
          styles.section, 
          { 
            backgroundColor: COLORS.card,
            opacity: staggerAnimations[0],
            transform: [
              { translateY: staggerAnimations[0].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              }) },
              { scale: staggerAnimations[0].interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1]
              }) }
            ]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Aparência
            </Text>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>🎨</Text>
            </View>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: COLORS.text }]}>
              Tema
            </Text>
            <ThemeToggle />
          </View>
        </Animated.View>
        
        {/* General Settings */}
        <Animated.View style={[
          styles.section, 
          { 
            backgroundColor: COLORS.card,
            opacity: staggerAnimations[1],
            transform: [
              { translateY: staggerAnimations[1].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              }) },
              { scale: staggerAnimations[1].interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1]
              }) }
            ]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Gerais
            </Text>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>⚙️</Text>
            </View>
          </View>
          
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
        </Animated.View>
        
        {/* Products Settings */}
        <Animated.View style={[
          styles.section, 
          { 
            backgroundColor: COLORS.card,
            opacity: staggerAnimations[2],
            transform: [
              { translateY: staggerAnimations[2].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              }) },
              { scale: staggerAnimations[2].interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1]
              }) }
            ]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Produtos
            </Text>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          
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
        </Animated.View>
        
        {/* Data Management */}
        <Animated.View style={[
          styles.section, 
          { 
            backgroundColor: COLORS.card,
            opacity: staggerAnimations[3],
            transform: [
              { translateY: staggerAnimations[3].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              }) },
              { scale: staggerAnimations[3].interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1]
              }) }
            ]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Dados
            </Text>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>💾</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={clearAllData}
          >
            <LinearGradient
              colors={[COLORS.error, '#D32F2F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dangerActionGradient}
            >
              <Text style={styles.dangerActionText}>
                Limpar Todos os Dados
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert(
              'Exportar Dados',
              'Em breve você poderá exportar seus dados. Aguarde as próximas atualizações!'
            )}
          >
            <LinearGradient
              colors={[COLORS.info, '#0277BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>
                Exportar Dados (Em breve)
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Server Configuration */}
        <Animated.View style={[
          styles.section, 
          { 
            backgroundColor: COLORS.card,
            opacity: staggerAnimations[3],
            transform: [
              { translateY: staggerAnimations[3].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              }) },
              { scale: staggerAnimations[3].interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1]
              }) }
            ]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Servidor
            </Text>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>🖥️</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ServerConfig')}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>
                Configurar Servidor PostgreSQL
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Diagnostic')}
          >
            <LinearGradient
              colors={[COLORS.accent, '#F57C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>
                Diagnóstico de Conexão
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        
        {/* About Section */}
        <Animated.View style={[
          styles.section, 
          { 
            backgroundColor: COLORS.card,
            opacity: staggerAnimations[4],
            transform: [
              { translateY: staggerAnimations[4].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              }) },
              { scale: staggerAnimations[4].interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1]
              }) }
            ]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Sobre
            </Text>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>ℹ️</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setAboutModalVisible(true)}
          >
            <View style={styles.infoActionButton}>
              <Text style={[styles.infoActionText, { color: COLORS.primary }]}>
                Sobre o Aplicativo
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert(
              'RLS Automação Industrial',
              'Aplicativo de gestão de estoque para a RLS Automação Industrial.\n\nVersão: ' + settings.version
            )}
          >
            <View style={styles.infoActionButton}>
              <Text style={[styles.infoActionText, { color: COLORS.primary }]}>
                Versão do Aplicativo
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      
      {renderAboutModal()}
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  section: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconText: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingLabelContainer: {
    flex: 1,
    paddingRight: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 3,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 16,
  },
  actionButton: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
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
  actionGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerActionGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dangerActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoActionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  infoActionText: {
    fontSize: 16,
    fontWeight: '500',
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
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
    alignItems: 'center',
  },
  companyLogo: {
    marginBottom: 5,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  versionInfo: {
    fontSize: 14,
    marginBottom: 24,
  },
  contactSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  contactButton: {
    paddingVertical: 10,
  },
  contactButtonText: {
    fontSize: 16,
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;