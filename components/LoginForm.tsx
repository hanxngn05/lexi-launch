import { useAuth } from "@/context/auth";
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from "react";
import { Animated, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LoginForm() {
  const { signInWithGoogle } = useAuth();
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const [googleIconLoaded, setGoogleIconLoaded] = useState(true);

  useEffect(() => {
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 3,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.logoContainer,
            { transform: [{ scale: bounceAnim }] },
          ]}
        >
          <Image source={require("../assets/images/lexi_icon.png")} style={styles.logo} />
          <Text style={styles.underLogoText}>Your campus, connected</Text>
        </Animated.View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.googleButton}
          activeOpacity={0.85}
          onPress={signInWithGoogle}
        >
          {googleIconLoaded ? (
            <Image
              source={require("../assets/images/google_icon.png")}
              style={styles.googleIcon}
              onError={(_e: any) => setGoogleIconLoaded(false)}
            />
          ) : (
            <Ionicons name="logo-google" size={24} color="#EA4335" style={{ marginRight: 12 }} />
          )}
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F6FF',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F6FF',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: 4,
  },
  underLogoText: {
    fontSize: 15,
    color: '#4A90E2',
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginTop: 0,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    backgroundColor: '#F0F6FF',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F6FF',
    borderRadius: 32,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  googleIcon: {
    width: 26,
    height: 26,
    marginRight: 14,
    resizeMode: 'contain',
  },
  googleButtonText: {
    fontSize: 20,
    color: '#222',
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
});
