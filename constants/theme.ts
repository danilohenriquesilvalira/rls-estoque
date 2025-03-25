// constants/theme.ts - Arquivo com as configurações visuais do aplicativo

// Cores principais da identidade visual
export const COLORS = {
  // Cores primárias
  primary: '#1565C0',        // Azul escuro para elementos primários
  primaryDark: '#0D47A1',    // Azul mais escuro para detalhes
  primaryLight: '#42A5F5',   // Azul claro para elementos secundários
  
  // Cores de acentuação
  accent: '#FF6F00',         // Laranja para botões de ação importantes
  accentLight: '#FFA726',    // Laranja claro para botões secundários
  
  // Cores de feedback
  success: '#2E7D32',        // Verde para confirmações
  warning: '#F57F17',        // Amarelo para alertas
  error: '#C62828',          // Vermelho para erros
  info: '#0288D1',           // Azul para informações
  
  // Cores neutras
  white: '#FFFFFF',
  black: '#212121',
  grey: '#757575',
  lightGrey: '#EEEEEE',
  ultraLightGrey: '#F5F5F5',
  
  // Backgrounds
  background: '#F5F7FA',     // Fundo principal do app
  card: '#FFFFFF',           // Fundo de cards
  statusBar: '#0D47A1',      // Cor da barra de status
  
  // Cores de estoque
  lowStock: '#FFCDD2',       // Vermelho claro para estoque baixo
  mediumStock: '#E3F2FD',    // Azul muito claro para estoque médio
  highStock: '#DCEDC8',      // Verde claro para estoque alto
};

// Tamanhos de texto
export const SIZES = {
  // Tamanhos de fonte
  xs: 10,
  small: 12,
  medium: 14,
  large: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 30,
  
  // Espaçamentos
  spacing_xs: 5,
  spacing_sm: 10,
  spacing_md: 15,
  spacing_lg: 20,
  spacing_xl: 25,
  
  // Bordas
  radius_sm: 5,
  radius_md: 10, 
  radius_lg: 15,
  radius_xl: 20,
};

// Estilos de texto comuns
export const FONTS = {
  h1: {
    fontSize: SIZES.title,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  h2: {
    fontSize: SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  h3: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  h4: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  body1: {
    fontSize: SIZES.large,
    color: COLORS.black,
  },
  body2: {
    fontSize: SIZES.medium,
    color: COLORS.black,
  },
  body3: {
    fontSize: SIZES.small,
    color: COLORS.grey,
  },
  button: {
    fontSize: SIZES.medium,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  caption: {
    fontSize: SIZES.small,
    color: COLORS.grey,
  },
};

// Estilos comuns de sombra
export const SHADOW = {
  small: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
};

// Estilos de componentes comuns
export const COMMON_STYLES = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius_md,
    padding: SIZES.spacing_md,
    marginBottom: SIZES.spacing_md,
    ...SHADOW.small,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius_md,
    padding: SIZES.spacing_md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...FONTS.button,
  },
  input: {
    backgroundColor: COLORS.ultraLightGrey,
    borderRadius: SIZES.radius_sm,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    padding: SIZES.spacing_md,
    fontSize: SIZES.medium,
    color: COLORS.black,
  },
  label: {
    ...FONTS.body2,
    marginBottom: SIZES.spacing_xs,
    marginTop: SIZES.spacing_sm,
  },
  section: {
    marginBottom: SIZES.spacing_lg,
  },
  sectionTitle: {
    ...FONTS.h4,
    marginBottom: SIZES.spacing_sm,
  },
};

export default {
  COLORS,
  SIZES,
  FONTS,
  SHADOW,
  COMMON_STYLES
};