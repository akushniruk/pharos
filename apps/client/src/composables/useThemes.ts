import { ref, computed, onMounted, readonly } from 'vue';
import type {
  ThemeName,
  PredefinedTheme,
  ThemeState,
  ThemeManagerState
} from '../types/theme';
import { PREDEFINED_THEME_NAMES } from '../types/theme';

// Predefined themes - dark (default) and light
const PREDEFINED_THEMES: Record<ThemeName, PredefinedTheme> = {
  dark: {
    name: 'dark',
    displayName: 'Dark',
    description: 'Near-black with warm amber accent',
    cssClass: 'theme-dark',
    preview: { primary: '#0a0a0b', secondary: '#111113', accent: '#fbbf24' },
    colors: {
      primary: '#fbbf24',
      primaryHover: '#fcd34d',
      primaryLight: 'rgba(251, 191, 36, 0.1)',
      primaryDark: '#d97706',
      bgPrimary: '#0a0a0b',
      bgSecondary: '#111113',
      bgTertiary: '#1a1a1d',
      bgQuaternary: '#232326',
      textPrimary: '#e8e8e6',
      textSecondary: '#a0a0a0',
      textTertiary: '#6b6b6b',
      textQuaternary: '#4a4a4a',
      borderPrimary: '#1e1e21',
      borderSecondary: '#2a2a2d',
      borderTertiary: '#363639',
      accentSuccess: '#3d9a6d',
      accentWarning: '#c8873a',
      accentError: '#c75450',
      accentInfo: '#5b8fc9',
      shadow: 'rgba(0, 0, 0, 0.4)',
      shadowLg: 'rgba(0, 0, 0, 0.6)',
      hoverBg: 'rgba(255, 255, 255, 0.04)',
      activeBg: 'rgba(255, 255, 255, 0.07)',
      focusRing: '#f59e0b'
    }
  },
  light: {
    name: 'light',
    displayName: 'Light',
    description: 'Off-white with warm amber accent',
    cssClass: 'theme-light',
    preview: { primary: '#fafaf9', secondary: '#f4f4f2', accent: '#fbbf24' },
    colors: {
      primary: '#fbbf24',
      primaryHover: '#d97706',
      primaryLight: 'rgba(251, 191, 36, 0.1)',
      primaryDark: '#b45309',
      bgPrimary: '#fafaf9',
      bgSecondary: '#f4f4f2',
      bgTertiary: '#eaeae8',
      bgQuaternary: '#ddddd9',
      textPrimary: '#1a1a1b',
      textSecondary: '#3a3a3c',
      textTertiary: '#6b6b6d',
      textQuaternary: '#9a9a9c',
      borderPrimary: '#e4e4e1',
      borderSecondary: '#d4d4d1',
      borderTertiary: '#bbbbb8',
      accentSuccess: '#2d8659',
      accentWarning: '#b5762f',
      accentError: '#b94440',
      accentInfo: '#4a7db5',
      shadow: 'rgba(0, 0, 0, 0.06)',
      shadowLg: 'rgba(0, 0, 0, 0.12)',
      hoverBg: 'rgba(0, 0, 0, 0.03)',
      activeBg: 'rgba(0, 0, 0, 0.06)',
      focusRing: '#d97706'
    }
  }
};

export function useThemes() {
  // State
  const state = ref<ThemeState>({
    currentTheme: 'dark',
    customThemes: [],
    isCustomTheme: false,
    isLoading: false,
    error: null
  });

  const managerState = ref<ThemeManagerState>({
    isOpen: false,
    activeTab: 'predefined',
    previewTheme: null,
    editingTheme: null
  });

  // Computed
  const currentThemeData = computed(() => {
    return PREDEFINED_THEMES[state.value.currentTheme as ThemeName];
  });

  const predefinedThemes = computed(() => Object.values(PREDEFINED_THEMES));

  // Set and apply a theme
  const setTheme = (theme: ThemeName | string) => {
    const validName = PREDEFINED_THEME_NAMES.includes(theme as ThemeName)
      ? (theme as ThemeName)
      : 'dark';

    applyPredefinedTheme(validName);

    state.value.currentTheme = validName;
    state.value.isCustomTheme = false;

    localStorage.setItem('theme', validName);
  };

  const applyPredefinedTheme = (themeName: ThemeName) => {
    // Remove all theme classes
    document.documentElement.className = document.documentElement.className
      .replace(/theme-[\w-]+/g, '');

    const themeData = PREDEFINED_THEMES[themeName];
    if (themeData) {
      document.documentElement.classList.add(themeData.cssClass);

      if (themeName === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // Initialization
  const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme && PREDEFINED_THEME_NAMES.includes(savedTheme as ThemeName)) {
      setTheme(savedTheme as ThemeName);
    } else {
      // Default to dark
      setTheme('dark');
    }
  };

  // Manager state helpers
  const openThemeManager = () => {
    managerState.value.isOpen = true;
  };

  const closeThemeManager = () => {
    managerState.value.isOpen = false;
    managerState.value.previewTheme = null;
    managerState.value.editingTheme = null;
  };

  const setActiveTab = (tab: ThemeManagerState['activeTab']) => {
    managerState.value.activeTab = tab;
  };

  const previewTheme = (theme: ThemeName) => {
    managerState.value.previewTheme = theme;
    applyPredefinedTheme(theme);
  };

  const cancelPreview = () => {
    managerState.value.previewTheme = null;
    applyPredefinedTheme(state.value.currentTheme as ThemeName);
  };

  const applyPreview = () => {
    if (managerState.value.previewTheme && typeof managerState.value.previewTheme === 'string') {
      setTheme(managerState.value.previewTheme);
      managerState.value.previewTheme = null;
    }
  };

  // Initialize on mount
  onMounted(() => {
    initializeTheme();
  });

  return {
    // State
    state: readonly(state),
    managerState,

    // Computed
    currentThemeData,
    predefinedThemes,

    // Core functions
    setTheme,
    initializeTheme,

    // Manager functions
    openThemeManager,
    closeThemeManager,
    setActiveTab,
    previewTheme,
    cancelPreview,
    applyPreview
  };
}
