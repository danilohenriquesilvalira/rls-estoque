import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';

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
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  actions,
  onMainButtonPress,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  
  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    
    Animated.spring(animation, {
      toValue,
      friction: 6,
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

  return (
    <>
      {/* Backdrop semi-transparente */}
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
      
      <View style={styles.container}>
        {/* Botões de ação */}
        {actions.map((action, index) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [100, -10 - 60 * (actions.length - index)],
          });
          
          return (
            <Animated.View
              key={index}
              style={[
                styles.actionButton,
                {
                  transform: [{ translateY }],
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
        
        {/* Botão principal */}
        <TouchableOpacity
          style={[
            styles.mainButton,
            isOpen ? styles.mainButtonOpen : null
          ]}
          onPress={toggleMenu}
          activeOpacity={0.7}
        >
          <Animated.Text
            style={[
              styles.mainButtonIcon,
              {
                transform: [
                  {
                    rotate: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '45deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    alignItems: 'center',
    zIndex: 10,
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
  mainButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 10,
  },
  mainButtonOpen: {
    backgroundColor: COLORS.error,
  },
  mainButtonIcon: {
    fontSize: 30,
    color: COLORS.white,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonIcon: {
    fontSize: 20,
    color: COLORS.white,
  },
  actionButtonLabel: {
    position: 'absolute',
    right: 65,
    backgroundColor: COLORS.white,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonLabelText: {
    color: COLORS.black,
    fontSize: 14,
  },
});

export default FloatingActionButton;