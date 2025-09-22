import { api } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface TypoSuggestion {
  original: string;
  corrected: string;
  confidence: number;
}

interface TypoDetectingTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  multiline?: boolean;
  numberOfLines?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  mainDataType?: string;
}

export default function TypoDetectingTextInput({
  value,
  onChangeText,
  placeholder,
  style,
  multiline = false,
  numberOfLines = 1,
  onBlur,
  onFocus,
  mainDataType,
}: TypoDetectingTextInputProps) {
  console.log('[DEBUG] TypoDetectingTextInput: mainDataType=', mainDataType);
  const [suggestions, setSuggestions] = useState<TypoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-20));
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-side cache to avoid repeated API calls
  const cache = useRef<Map<string, TypoSuggestion[]>>(new Map());

  // Track if we've hit API limits
  const [apiLimitReached, setApiLimitReached] = useState(false);

  // Animate suggestions in/out
  React.useEffect(() => {
    if (showSuggestions && suggestions.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSuggestions, suggestions]);

  // Debounced typo checking with aggressive caching for free tier
  const checkTypo = useCallback(async (text: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      if (text.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Skip very short texts to save API calls
      if (text.trim().length < 4) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Check client-side cache first
      const cachedResult = cache.current.get(text);
      if (cachedResult !== undefined) {
        console.log('Using cached typo check result for:', text);
        if (cachedResult.length > 0) {
          setSuggestions(cachedResult);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
        return;
      }

      // Don't make API calls if limit is reached
      if (apiLimitReached) {
        console.log('API limit reached, skipping typo check for:', text);
        return;
      }

      setIsChecking(true);
      try {
        console.log('Checking typo for:', text);
        const result = await api.checkTypo(text);
        console.log('Typo check result:', result);

        // Check if API limit was reached
        if (result.limit_reached) {
          setApiLimitReached(true);
          console.log('API limit reached, will use cached results only');
          return;
        }

        // Cache the result
        const suggestions = result.suggestions || [];
        cache.current.set(text, suggestions);

        // Limit cache size to 100 entries (increased for free tier)
        if (cache.current.size > 100) {
          const firstKey = cache.current.keys().next().value;
          if (firstKey) {
            cache.current.delete(firstKey);
          }
        }

        if (suggestions.length > 0) {
          console.log('Found suggestions:', suggestions);
          setSuggestions(suggestions);
          setShowSuggestions(true);
        } else {
          console.log('No suggestions found');
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Typo check failed:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsChecking(false);
      }
    }, 3000); // Increased debounce time to 3 seconds to let users finish typing
  }, [apiLimitReached]);

  const handleTextChange = (text: string) => {
    // Update the text immediately - let user type naturally
    onChangeText(text);

    // Check for typos (including for main questions)
    if (text.length > 3) {
      checkTypo(text);
    } else {
      // Clear suggestions for very short text
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };


  const handleSuggestionPress = (suggestion: TypoSuggestion) => {
    // Replace the original word with the corrected one
    const correctedText = value.replace(suggestion.original, suggestion.corrected);
    onChangeText(correctedText);

    // Remove this specific suggestion but keep others visible
    const newSuggestions = suggestions.filter(s =>
      s.original !== suggestion.original || s.corrected !== suggestion.corrected
    );
    setSuggestions(newSuggestions);

    // Only hide suggestions if none are left
    if (newSuggestions.length === 0) {
      setShowSuggestions(false);
    }
  };

    const handleBlur = () => {
    console.log('[DEBUG] handleBlur EVENT TRIGGERED');
    setShowSuggestions(false);
    onBlur?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          style={[styles.input, style]}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onBlur={handleBlur}
          onFocus={onFocus}
          placeholderTextColor="#9CA3AF"
        />
        {isChecking && (
          <View style={styles.checkingIndicator}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#4A90E2" />
            <Text style={styles.checkingText}>Checking...</Text>
          </View>
        )}


      </View>

      <Animated.View
        style={[
          styles.suggestionsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {showSuggestions && suggestions.length > 0 && (
          <>
            <View style={styles.suggestionsHeader}>
              <Ionicons name="bulb-outline" size={16} color="#4A90E2" />
              <Text style={styles.suggestionsTitle}>Typo suggestions</Text>
            </View>
            {suggestions.map((suggestion, index) => (
              <View key={index} style={styles.suggestionItem}>
                <TouchableOpacity
                  style={styles.suggestionContent}
                  onPress={() => handleSuggestionPress(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.originalText}>{suggestion.original}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
                  <Text style={styles.correctedText}>{suggestion.corrected}</Text>
                </TouchableOpacity>
                <View style={styles.suggestionActions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleSuggestionPress(suggestion)}
                  >
                    <Ionicons name="checkmark" size={14} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => {
                      // Remove this specific suggestion
                      const newSuggestions = suggestions.filter((_, i) => i !== index);
                      setSuggestions(newSuggestions);
                      if (newSuggestions.length === 0) {
                        setShowSuggestions(false);
                      }
                    }}
                  >
                    <Ionicons name="close" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  checkingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0F9FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    zIndex: 1,
  },
  checkingText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
    marginBottom: 4,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  originalText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  correctedText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 4,
  },
  confidenceBadge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#CCE5FF',
  },
  confidenceText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  formatButtonText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
    marginLeft: 4,
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  approveButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
  },
});
