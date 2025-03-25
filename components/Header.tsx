import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar
} from 'react-native';

// Defina as cores e estilos diretamente aqui para evitar dependências
const COLORS = {
  primary: '#1565C0',
  white: '#FFFFFF',
  statusBar: '#0D47A1',
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
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.statusBar} barStyle="light-content" />
      
      <View style={styles.content}>
        {/* Lado esquerdo - Botão Voltar ou Espaço */}
        <View style={styles.leftContainer}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Centro - Logo ou Título */}
        <View style={styles.centerContainer}>
          {showLogo ? (
            <View style={styles.logoContainer}>
              {/* Logo Texto como Fallback */}
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
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: COLORS.white,
    fontSize: 24,
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
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  spacer: {
    width: 40,
  },
});

export default Header;