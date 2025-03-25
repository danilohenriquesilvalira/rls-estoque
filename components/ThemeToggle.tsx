import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  style?: object;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ style }) => {
  const { isDark, toggleTheme, theme } = useTheme();
  const { COLORS } = theme;
  
  // Criação do valor de animação
  const [animatedValue] = React.useState(new Animated.Value(isDark ? 1 : 0));
  
  // Efeito para animar o toggle quando o tema muda
  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isDark ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [isDark]);
  
  // Interpolações animadas
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 48],
  });
  
  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.lightGrey, COLORS.primaryDark],
  });

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: COLORS.textSecondary }]}>
        {isDark ? 'Escuro' : 'Claro'}
      </Text>
      
      <TouchableOpacity
        onPress={toggleTheme}
        activeOpacity={0.8}
      >
        <Animated.View style={[
          styles.track,
          { backgroundColor }
        ]}>
          <Animated.View style={[
            styles.thumb,
            { transform: [{ translateX }] },
            { backgroundColor: COLORS.white }
          ]}>
            <Text style={styles.icon}>
              {isDark ? '🌙' : '☀️'}
            </Text>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    marginRight: 10,
    fontSize: 14,
  },
  track: {
    width: 70,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  icon: {
    fontSize: 14,
  },
});

export default ThemeToggle;