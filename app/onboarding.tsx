import { useAuth } from "@/context/auth";
import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from "@expo-google-fonts/poppins";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";
import { api } from '../utils/api';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [name, setName] = React.useState(user?.name || "");
  const [role, setRole] = React.useState<'user' | 'developer' | null>(null);
  const [step, setStep] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [slideAnim] = React.useState(new Animated.Value(50));

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Redirect if user already has a role
  React.useEffect(() => {
    if (user?.role) {
      if (user.role === 'developer') {
        router.replace('/developer-home');
      } else {
        router.replace('/home');
      }
    }
  }, [user, router]);

  const handleSubmit = async () => {
    if (!name.trim() || !role) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await api.saveUser({
        email: user?.email || '',
        name: name.trim(),
        role: role,
      });

      if (result.success && result.user) {
        // Use the user data returned from the save operation
        const updatedUser = {
          ...user!,
          id: result.user.id, // Use the database ID instead of Google ID
          name: name.trim(),
          role: role,
        };
        setUser(updatedUser);

        // Redirect based on role
        if (role === 'developer') {
          router.replace('/developer-home');
        } else {
          router.replace('/home');
        }
      } else {
        setError('Failed to save user data');
      }
    } catch (err) {
      console.error('Error saving user data:', err);
      setError('Error saving user data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 0 && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError("");
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(step + 1);
  };

  const handleBack = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(step - 1);
    setError("");
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Elements */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>L</Text>
            </View>
          </View>
          <Text style={styles.title}>Welcome to Lexi!</Text>
          <Text style={styles.subtitle}>Your campus, connected.</Text>
        </View>

        {step === 0 && (
          <Animated.View style={[styles.step, { opacity: fadeAnim }]}>
            <View style={styles.stepHeader}>
              <Ionicons name="person-outline" size={32} color="#4A90E2" />
              <Text style={styles.stepTitle}>What's your name?</Text>
              <Text style={styles.stepDescription}>
                Let's personalize your experience
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoFocus
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity
              style={[styles.fullWidthButton, !name.trim() && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={!name.trim()}
            >
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {step === 1 && (
          <Animated.View style={[styles.step, { opacity: fadeAnim }]}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.stepHeader}>
              <Ionicons name="people-outline" size={32} color="#4A90E2" />
              <Text style={styles.stepTitle}>Choose your role</Text>
              <Text style={styles.stepDescription}>
                This helps us tailor your experience
              </Text>
            </View>

            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'user' && styles.roleButtonSelected]}
                onPress={() => setRole('user')}
              >
                <View style={styles.roleButtonContent}>
                  <View style={styles.roleIcon}>
                    <Ionicons name="person-outline" size={24} color={role === 'user' ? '#4A90E2' : '#666'} />
                  </View>
                  <View style={styles.roleText}>
                    <Text style={[styles.roleButtonText, role === 'user' && styles.roleButtonTextSelected]}>
                      Regular User
                    </Text>
                    <Text style={[styles.roleButtonSubtext, role === 'user' && styles.roleButtonSubtextSelected]}>
                      Join workspaces to see what's happening on campus
                    </Text>
                  </View>
                  {role === 'user' && (
                    <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, role === 'developer' && styles.roleButtonSelected]}
                onPress={() => setRole('developer')}
              >
                <View style={styles.roleButtonContent}>
                  <View style={styles.roleIcon}>
                    <Ionicons name="code-outline" size={24} color={role === 'developer' ? '#4A90E2' : '#666'} />
                  </View>
                  <View style={styles.roleText}>
                    <Text style={[styles.roleButtonText, role === 'developer' && styles.roleButtonTextSelected]}>
                      Developer
                    </Text>
                    <Text style={[styles.roleButtonSubtext, role === 'developer' && styles.roleButtonSubtextSelected]}>
                      Create and manage workspaces for the community
                    </Text>
                  </View>
                  {role === 'developer' && (
                    <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color="#4A90E2" />
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, !role && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={!role || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Get Started</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {error ? (
          <Animated.View style={[styles.errorContainer, { opacity: fadeAnim }]}>
            <Ionicons name="alert-circle-outline" size={20} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FF',
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#D9E7FF',
    top: -50,
    left: -50,
    opacity: 0.5,
  },
  circle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#D9E7FF',
    bottom: -100,
    right: -100,
    opacity: 0.5,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#E6F2FF',
    top: '30%',
    left: '70%',
    opacity: 0.4,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  header: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 36,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    textAlign: 'center',
  },
  step: {
    flex: 1,
    justifyContent: 'center',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#EAEAEA',
  },
  roleButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#E6F2FF',
  },
  roleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  roleText: {
    flex: 1,
  },
  roleButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#666',
    marginBottom: 4,
  },
  roleButtonTextSelected: {
    color: '#4A90E2',
  },
  roleButtonSubtext: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
  },
  roleButtonSubtextSelected: {
    color: '#4A90E2',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    backgroundColor: '#4A90E2',
    borderRadius: 25,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 8,
  },
  fullWidthButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 25,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#A9C9FF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 25,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#4A90E2',
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 10,
  },
  secondaryButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 25,
    padding: 12,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    marginLeft: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
