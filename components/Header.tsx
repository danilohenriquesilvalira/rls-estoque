import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Defina as cores e estilos diretamente aqui para evitar dependências
const COLORS = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  statusBar: '#0D47A1',
  transparent: 'transparent',
};

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showLogo = true,
  showBack = false,
  onBack,
  rightComponent
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0;

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      {/* Barra de Status */}
      <StatusBar backgroundColor="transparent" translucent barStyle="light-content" />
      
      <View style={styles.content}>
        {/* Lado esquerdo - Botão Voltar ou Espaço */}
        <View style={styles.leftContainer}>
          {showBack ? (
            <TouchableOpacity 
              onPress={onBack} 
              style={styles.backButton}
            >
              <View style={styles.backIconContainer}>
                <Text style={styles.backIcon}>←</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Centro - Logo ou Título */}
        <View style={styles.centerContainer}>
          {showLogo ? (
            <View style={styles.logoContainer}>
              {/* Usar imagem do logo se disponível, se não, usar texto */}
              <Text style={styles.logoText}>RLS AUTOMAÇÃO</Text>
            </View>
          ) : (
            <Text style={styles.title}>{title}</Text>
          )}
        </View>

        {/* Lado direito - Componente opcional ou Espaço */}
        <View style={styles.rightContainer}>
          {rightComponent ? rightComponent : <View style={styles.spacer} />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  content: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  leftContainer: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  spacer: {
    width: 40,
  },
});

export default Header;