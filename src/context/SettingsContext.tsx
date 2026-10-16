import React, { createContext, useEffect, useState, useCallback } from 'react';
import type { SettingsState } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface SettingsContextType {
  settings: SettingsState;
  updateSettings: (settings: Partial<SettingsState>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('settings');
      if (stored) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<SettingsState>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export { SettingsContext };