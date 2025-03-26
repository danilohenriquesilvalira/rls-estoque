import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image,
  Animated,
  Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// Define colors directly here to avoid dependencies
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
  transparent?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showLogo = true,
  showBack = false,
  onBack,
  rightComponent,
  transparent = false
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0;
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(-30)).current;
  const backButtonAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Animate the title and logo when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      })
    ]).start();
    
    // If back button is shown, animate it
    if (showBack) {
      Animated.spring(backButtonAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim, translateAnim, backButtonAnim, showBack]);

  return (
    <View style={[
      styles.container, 
      { paddingTop: statusBarHeight },
      transparent ? styles.transparentContainer : {}
    ]}>
      {/* Status Bar */}
      <StatusBar 
        backgroundColor="transparent" 
        translucent 
        barStyle="light-content" 
      />
      
      {!transparent && (
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            {/* Left side - Back Button or Space */}
            <View style={styles.leftContainer}>
              {showBack ? (
                <Animated.View
                  style={{
                    transform: [
                      { scale: backButtonAnim },
                      { rotate: backButtonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-45deg', '0deg']
                      }) }
                    ],
                    opacity: backButtonAnim
                  }}
                >
                  <TouchableOpacity 
                    onPress={onBack} 
                    style={styles.backButton}
                  >
                    <View style={styles.backIconContainer}>
                      <Text style={styles.backIcon}>←</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <View style={styles.spacer} />
              )}
            </View>

            {/* Center - Logo or Title */}
            <Animated.View 
              style={[
                styles.centerContainer, 
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: translateAnim }]
                }
              ]}
            >
              {showLogo ? (
                <View style={styles.logoContainer}>
                  <Image 
                    source={require('../assets/Logo_RLS.png')} 
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <Text style={styles.title}>{title}</Text>
              )}
            </Animated.View>

            {/* Right side - Optional Component or Space */}
            <View style={styles.rightContainer}>
              {rightComponent ? rightComponent : <View style={styles.spacer} />}
            </View>
          </View>
        </LinearGradient>
      )}
      
      {transparent && (
        <View style={styles.content}>
          {/* Left side - Back Button or Space */}
          <View style={styles.leftContainer}>
            {showBack ? (
              <TouchableOpacity 
                onPress={onBack} 
                style={styles.backButton}
              >
                <View style={[styles.backIconContainer, styles.transparentBackButton]}>
                  <Text style={styles.backIcon}>←</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.spacer} />
            )}
          </View>

          {/* Center - Logo or Title */}
          <View style={styles.centerContainer}>
            {showLogo ? (
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/Logo_RLS.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <Text style={[styles.title, styles.transparentTitle]}>{title}</Text>
            )}
          </View>

          {/* Right side - Optional Component or Space */}
          <View style={styles.rightContainer}>
            {rightComponent ? rightComponent : <View style={styles.spacer} />}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  transparentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  gradient: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  content: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  transparentBackButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
  logo: {
    width: 120,
    height: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  transparentTitle: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  spacer: {
    width: 40,
  },
});

export default Header;