import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  style?: object;
  showLabel?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ style, showLabel = true }) => {
  const { isDark, toggleTheme, theme } = useTheme();
  const { COLORS } = theme;
  
  // Animation values
  const [animatedValue] = React.useState(new Animated.Value(isDark ? 1 : 0));
  const moonRotation = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const sunRotation = useRef(new Animated.Value(isDark ? 0 : 1)).current;
  
  // Effect for animating the toggle when theme changes
  React.useEffect(() => {
    // Track animation
    Animated.timing(animatedValue, {
      toValue: isDark ? 1 : 0,
      duration: 350,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();
    
    // Icon animations
    if (isDark) {
      Animated.timing(moonRotation, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }).start();
      
      Animated.timing(sunRotation, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sunRotation, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }).start();
      
      Animated.timing(moonRotation, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [isDark, animatedValue, moonRotation, sunRotation]);
  
  // Animated interpolations
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 48],
  });
  
  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.lightGrey, COLORS.primaryDark],
  });
  
  const moonScale = moonRotation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  
  const sunScale = sunRotation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  
  const moonOpacity = moonRotation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });
  
  const sunOpacity = sunRotation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <Text style={[styles.label, { color: COLORS.textSecondary }]}>
          {isDark ? 'Escuro' : 'Claro'}
        </Text>
      )}
      
      <TouchableOpacity
        onPress={toggleTheme}
        activeOpacity={0.8}
        style={styles.toggleContainer}
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
            {/* Sun icon */}
            <Animated.Text style={[
              styles.icon,
              { 
                transform: [{ scale: sunScale }],
                opacity: sunOpacity 
              }
            ]}>
              ☀️
            </Animated.Text>
            
            {/* Moon icon */}
            <Animated.Text style={[
              styles.icon,
              styles.moonIcon,
              { 
                transform: [{ scale: moonScale }],
                opacity: moonOpacity
              }
            ]}>
              🌙
            </Animated.Text>
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
  toggleContainer: {
    padding: 4,
  },
  label: {
    marginRight: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  track: {
    width: 72,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    padding: 3,
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
    shadowRadius: 3,
    elevation: 4,
  },
  icon: {
    fontSize: 14,
    position: 'absolute',
  },
  moonIcon: {
    position: 'absolute',
  },
});

export default ThemeToggle;