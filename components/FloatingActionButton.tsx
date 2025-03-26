import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

// Define theme colors
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
};

interface ActionItem {
  icon: string;
  name: string;
  onPress: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  actions: ActionItem[];
  onMainButtonPress?: () => void;
  position?: 'bottomRight' | 'bottomLeft';
  mainButtonColor?: string;
  mainButtonIcon?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  actions,
  onMainButtonPress,
  position = 'bottomRight',
  mainButtonColor = COLORS.primary,
  mainButtonIcon = '+',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  
  // Add pulse animation when the component mounts
  useEffect(() => {
    const pulseAnimation = Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 1.15,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
    
    // Pulse twice when component mounts
    Animated.sequence([
      pulseAnimation,
      Animated.delay(300),
      pulseAnimation,
    ]).start();
  }, []);
  
  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    
    // Add scale animation when toggling
    Animated.timing(scaleAnimation, {
      toValue: isOpen ? 1 : 1.1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    
    Animated.spring(animation, {
      toValue,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    
    setIsOpen(!isOpen);
    
    if (!isOpen && onMainButtonPress) {
      onMainButtonPress();
    }
  };
  
  const opacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });
  
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  
  const mainButtonRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Semi-transparent backdrop */}
      {isOpen && (
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity }
          ]}
          pointerEvents={isOpen ? 'auto' : 'none'}
          onTouchStart={toggleMenu}
        />
      )}
      
      <View style={[styles.container, position === 'bottomLeft' ? styles.bottomLeft : styles.bottomRight]}>
        {/* Action buttons */}
        {actions.map((action, index) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [100, -10 - 65 * (actions.length - index)],
          });
          
          const scale = animation.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [0.5, 1.1, 1],
          });
          
          return (
            <Animated.View
              key={index}
              style={[
                styles.actionButton,
                {
                  transform: [
                    { translateY },
                    { scale }
                  ],
                  opacity,
                }
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.actionButtonTouchable,
                  { backgroundColor: action.color || COLORS.accent }
                ]}
                onPress={() => {
                  toggleMenu();
                  action.onPress();
                }}
              >
                <Text style={styles.actionButtonIcon}>{action.icon}</Text>
              </TouchableOpacity>
              
              <Animated.View
                style={[
                  styles.actionButtonLabel,
                  { opacity }
                ]}
              >
                <Text style={styles.actionButtonLabelText}>{action.name}</Text>
              </Animated.View>
            </Animated.View>
          );
        })}
        
        {/* Main button */}
        <Animated.View style={[
          styles.mainButtonContainer,
          { transform: [{ scale: scaleAnimation }] }
        ]}>
          <TouchableOpacity
            style={[
              styles.mainButton,
              { backgroundColor: isOpen ? COLORS.error : mainButtonColor },
              isOpen ? styles.mainButtonOpen : null,
              Platform.OS === 'ios' ? styles.iosShadow : styles.androidShadow
            ]}
            onPress={toggleMenu}
            activeOpacity={0.8}
          >
            <Animated.Text
              style={[
                styles.mainButtonIcon,
                {
                  transform: [
                    { rotate: mainButtonRotation },
                  ],
                },
              ]}
            >
              {mainButtonIcon}
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomRight: {
    right: 30,
  },
  bottomLeft: {
    left: 30,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 9,
  },
  mainButtonContainer: {
    zIndex: 10,
  },
  mainButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iosShadow: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  androidShadow: {
    elevation: 8,
  },
  mainButtonOpen: {
    // Additional styles for when the menu is open
  },
  mainButtonIcon: {
    fontSize: 30,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  actionButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9,
  },
  actionButtonTouchable: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  actionButtonIcon: {
    fontSize: 20,
    color: COLORS.white,
  },
  actionButtonLabel: {
    position: 'absolute',
    right: 65,
    backgroundColor: COLORS.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  actionButtonLabelText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FloatingActionButton;