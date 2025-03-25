import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definição dos temas
export const lightTheme = {
  mode: 'light',
  COLORS: {
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
    card: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    border: '#EEEEEE',
    statusBar: '#0D47A1',
    tabBar: '#FFFFFF',
    tabBarActive: '#1565C0',
    tabBarInactive: '#757575',
    shadow: '#000000',
    lowStock: '#FFCDD2',
    mediumStock: '#E3F2FD',
    highStock: '#DCEDC8',
  },
  SHADOWS: {
    small: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
      elevation: 4,
    },
    large: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  }
};

export const darkTheme = {
  mode: 'dark',
  COLORS: {
    primary: '#1976D2',
    primaryDark: '#0D47A1',
    primaryLight: '#42A5F5',
    accent: '#FFB74D',
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    info: '#29B6F6',
    white: '#FFFFFF',
    black: '#212121',
    grey: '#9E9E9E',
    lightGrey: '#424242',
    ultraLightGrey: '#303030',
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#BDBDBD',
    border: '#424242',
    statusBar: '#000000',
    tabBar: '#1E1E1E',
    tabBarActive: '#42A5F5',
    tabBarInactive: '#9E9E9E',
    shadow: '#000000',
    lowStock: '#C62828',
    mediumStock: '#303F9F',
    highStock: '#2E7D32',
  },
  SHADOWS: {
    small: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
      elevation: 4,
    },
    large: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 6,
    },
  }
};

// Tipo para o tema
export type ThemeType = typeof lightTheme;

// Interface do contexto
interface ThemeContextProps {
  theme: ThemeType;
  isDark: boolean;
  toggleTheme: () => void;
  setDarkTheme: () => void;
  setLightTheme: () => void;
}

// Criar o contexto com valor padrão
const ThemeContext = createContext<ThemeContextProps>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
  setDarkTheme: () => {},
  setLightTheme: () => {},
});

// Hook personalizado para usar o tema
export const useTheme = () => useContext(ThemeContext);

// Provedor do tema
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>(lightTheme);
  const deviceTheme = useColorScheme();
  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar preferência de tema do usuário
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@theme_preference');
        
        if (savedTheme) {
          setTheme(savedTheme === 'dark' ? darkTheme : lightTheme);
        } else if (deviceTheme) {
          // Se não houver preferência salva, use o tema do dispositivo
          setTheme(deviceTheme === 'dark' ? darkTheme : lightTheme);
        }
      } catch (error) {
        console.error('Erro ao carregar tema:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemePreference();
  }, [deviceTheme]);

  // Alternar entre os temas
  const toggleTheme = () => {
    const newTheme = theme.mode === 'dark' ? lightTheme : darkTheme;
    setTheme(newTheme);
    saveThemePreference(newTheme.mode);
  };

  // Definir tema escuro
  const setDarkTheme = () => {
    setTheme(darkTheme);
    saveThemePreference('dark');
  };

  // Definir tema claro
  const setLightTheme = () => {
    setTheme(lightTheme);
    saveThemePreference('light');
  };

  // Salvar preferência de tema
  const saveThemePreference = async (mode: string) => {
    try {
      await AsyncStorage.setItem('@theme_preference', mode);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
    }
  };

  // Só renderize os filhos depois de carregar o tema
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme.mode === 'dark',
        toggleTheme,
        setDarkTheme,
        setLightTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;