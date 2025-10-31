import { useAuth } from "@/context/auth";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "../utils/api";

export default function LoginForm() {
  const { requestOtp, verifyOtp, isLoading, setUser } = useAuth();
  const router = useRouter();
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'profile'>('email');
  const [helper, setHelper] = useState<string>('');
  const [name, setName] = useState('');
  // First-time profile asks for name and anchor story; consent handled on dedicated page
  const [anchorAnswer, setAnchorAnswer] = useState('');
  const codeHiddenRef = useRef<TextInput | null>(null);

  useEffect(() => {
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 3,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRequestCode = async () => {
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      setHelper('Please enter a valid email address.');
      setStep('email');
      return;
    }
    // Move to code entry immediately for better UX
    setStep('code');
    setHelper('Sending code…');
    const ok = await requestOtp(emailTrimmed);
    setHelper(ok ? 'Your code was sent. Please check your email.' : 'Code generated. Email delivery may be blocked; use the server log code.');
  };

  const onVerify = async () => {
    const result = await verifyOtp(email.trim(), code.trim());
    if (!result.success) {
      setHelper('Invalid or expired code. Please check the server log or resend the code.');
      return;
    }
    if (result.needsProfile) {
      setStep('profile');
      setHelper('Welcome! Please enter your name to complete setup.');
    }
  };

  const onCompleteProfile = async () => {
    const fullName = name.trim();
    if (!fullName) {
      setHelper('Please enter your name.');
      return;
    }
    try {
      const result = await api.createUserProfile(email.trim(), fullName, { consent: false, anchor_answer: anchorAnswer.trim() ? [anchorAnswer.trim()] : [] });
      if (result?.success && result?.user) {
        setHelper('Profile saved. Redirecting...');
        setUser(result.user);
        router.replace('/consent');
      } else {
        setHelper('Failed to save profile. Please try again.');
      }
    } catch (e) {
      setHelper('Network error. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.logoContainer,
            { transform: [{ scale: bounceAnim }] },
          ]}
        >
          <Image source={require("../assets/images/lexi_icon.png")} style={styles.logo} />
          <Text style={styles.title}>Sign in to Lexi</Text>
          <Text style={styles.underLogoText}>Your campus, connected</Text>
        </Animated.View>

        {/* OTP login */}
        <View style={styles.panel}>
          {step === 'email' ? (
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@wellesley.edu"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={onRequestCode}>
                <Text style={styles.primaryText}>{isLoading ? 'Sending…' : 'Send code'}</Text>
              </TouchableOpacity>
              <Text style={styles.helperSmall}>We’ll email a 6‑digit code to verify it’s you.</Text>
            </View>
          ) : step === 'code' ? (
            <View>
              {helper ? <Text style={styles.helper}>{helper}</Text> : null}
              <Text style={styles.label}>Enter 6‑digit code</Text>
              <Pressable onPress={() => codeHiddenRef.current?.focus()} style={styles.otpBoxesContainer}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const char = code[i] || '';
                  const isActive = i === code.length && code.length < 6;
                  return (
                    <View key={i} style={[styles.otpBox, isActive && styles.otpBoxActive]}>
                      <Text style={styles.otpChar}>{char}</Text>
                    </View>
                  );
                })}
              </Pressable>
              {/* Hidden input to capture numeric code */}
              <TextInput
                ref={codeHiddenRef}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.hiddenInput}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={onVerify} disabled={isLoading || code.length !== 6}>
                <Text style={styles.primaryText}>{isLoading ? 'Verifying…' : 'Verify & continue'}</Text>
              </TouchableOpacity>
              <View style={styles.linksRow}>
                <TouchableOpacity style={styles.linkButton} onPress={onRequestCode}>
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>
                <Text style={{ color: '#9CA3AF' }}>·</Text>
                <TouchableOpacity style={styles.linkButton} onPress={() => { setCode(''); setStep('email'); setHelper(''); }}>
                  <Text style={styles.linkText}>Change email</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperSmall}>Tip: Check spam if you don’t see it in a minute.</Text>
            </View>
          ) : (
            <View>
              {helper ? <Text style={styles.helper}>{helper}</Text> : null}
              <Text style={styles.label}>Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                autoCapitalize="words"
                autoFocus
                style={styles.input}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />
              <Text style={styles.label}>Briefly share your "language story"</Text>
              <TextInput
                value={anchorAnswer}
                onChangeText={setAnchorAnswer}
                placeholder="In 1–2 sentences, tell us how you learned the language, how you use it, what it means to you, etc."
                autoCapitalize="sentences"
                style={[styles.input, { minHeight: 100 }]}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={onCompleteProfile} disabled={isLoading || name.trim().length === 0}>
                <Text style={styles.primaryText}>{isLoading ? 'Saving…' : 'Save & continue'}</Text>
              </TouchableOpacity>
              <Text style={styles.helperSmall}>You can update your profile later.</Text>
            </View>
          )}
        </View>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
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
    paddingTop: 0,
    backgroundColor: '#F0F6FF',
  },
  panel: {
    width: '88%',
    marginTop: 24,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '88%',
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
  title: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '800',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  codeInput: {
    letterSpacing: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  otpBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: '#2563EB',
  },
  otpChar: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  label: {
    marginBottom: 8,
    color: '#111',
    fontWeight: '600',
  },
  helper: {
    color: '#374151',
    marginBottom: 8,
  },
  helperSmall: {
    color: '#6B7280',
    marginTop: 6,
    fontSize: 12,
  },
  linkButton: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  linkText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 16,
  },
});
