import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAdminAuthenticated } from '../services/api';
import { syncLocationsFromServer } from '../utils/locationStore';

const NavigationContext = createContext();

const defaultLiveLocation = {
  id: 'live_user_location',
  name: 'You Are Here 📍',
  lat: 26.4970,
  lng: 80.2666,
  category: 'Live GPS',
  isLiveUser: true
};

const getInitialLocation = () => {
  try {
    const saved = localStorage.getItem('csjmu_last_gps_location');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.lat && parsed.lng) {
        return {
          id: 'live_user_location',
          name: 'My Live GPS Location 📍',
          lat: parsed.lat,
          lng: parsed.lng,
          heading: parsed.heading || 45,
          isLiveUser: true
        };
      }
    }
  } catch (e) {}
  return defaultLiveLocation;
};

export function NavigationProvider({ children }) {
  const [currentLocation, setCurrentLocation] = useState(getInitialLocation);
  const [destination, setDestination] = useState(null);
  const [shortestRoute, setShortestRoute] = useState(null);
  const [navMode, setNavMode] = useState('hidden'); // 'hidden' | 'preview' | 'active'
  const [isNavigatingLive, setIsNavigatingLive] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(() => isAdminAuthenticated());
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceLang, setVoiceLang] = useState(() => {
    try {
      return localStorage.getItem('csjmu_voice_lang') || 'hi-IN';
    } catch (e) {
      return 'hi-IN';
    }
  });
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [activeFloor, setActiveFloor] = useState('G');

  const toggleVoice = (overrideVal) => {
    setVoiceEnabled(prev => {
      const nextVal = typeof overrideVal === 'boolean' ? overrideVal : !prev;
      if (!nextVal && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return nextVal;
    });
  };

  const toggleVoiceLang = () => {
    setVoiceLang(prev => {
      const next = prev.startsWith('hi') ? 'en-IN' : 'hi-IN';
      try {
        localStorage.setItem('csjmu_voice_lang', next);
      } catch (e) {}
      return next;
    });
  };

  const cycleVoiceRate = () => {
    setVoiceRate(prev => {
      if (prev === 1.0) return 1.2;
      if (prev === 1.2) return 0.8;
      return 1.0;
    });
  };

  const speakInstruction = (englishText, hindiText) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const isHindi = voiceLang.startsWith('hi');
      const textToSpeak = isHindi ? (hindiText || englishText) : englishText;
      if (!textToSpeak) return;

      setLastSpokenText(textToSpeak);

      const cleanText = textToSpeak
        .replace(/[*#_`]/g, '')
        .replace(/[📍🏛️📚☕🏢💧🚻🚀🎤🚗🚌🧭🚶📷❌✅•🙏🌿➔]/g, '')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
      utterance.rate = voiceRate;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        if (isHindi) {
          const hindiVoice = voices.find(v => 
            (v.lang.includes('hi') || v.lang.includes('HI') || v.name.toLowerCase().includes('hindi')) &&
            (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('swara') || v.name.toLowerCase().includes('google') || v.name.includes('हिन्दी'))
          ) || voices.find(v => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi'));
          if (hindiVoice) utterance.voice = hindiVoice;
        } else {
          const engVoice = voices.find(v => 
            v.lang.includes('en-IN') || v.name.toLowerCase().includes('india') || v.lang.includes('en_IN')
          ) || voices.find(v => v.lang.startsWith('en'));
          if (engVoice) utterance.voice = engVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error:", e);
    }
  };

  const replayLastInstruction = () => {
    if (lastSpokenText) {
      speakInstruction(lastSpokenText, lastSpokenText);
    }
  };

  useEffect(() => {
    if (!voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [voiceEnabled]);

  useEffect(() => {
    // Initial sync of persistent server locations
    syncLocationsFromServer();

    const handleAuthChange = () => {
      setIsAdminMode(isAdminAuthenticated());
    };
    window.addEventListener('csjmu_admin_auth_changed', handleAuthChange);
    return () => window.removeEventListener('csjmu_admin_auth_changed', handleAuthChange);
  }, []);

  return (
    <NavigationContext.Provider value={{
      currentLocation, setCurrentLocation,
      destination, setDestination,
      shortestRoute, setShortestRoute,
      navMode, setNavMode,
      isNavigatingLive, setIsNavigatingLive,
      isAdminMode, setIsAdminMode,
      voiceEnabled, setVoiceEnabled, toggleVoice,
      voiceLang, setVoiceLang, toggleVoiceLang,
      voiceRate, setVoiceRate, cycleVoiceRate,
      speakInstruction, replayLastInstruction, lastSpokenText,
      activeFloor, setActiveFloor,
      defaultLiveLocation
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
