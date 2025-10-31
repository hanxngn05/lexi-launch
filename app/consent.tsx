import { useAuth } from '@/context/auth';
import { api } from '@/utils/api';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ConsentScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const alreadyConsented = Boolean((user as any)?.consent_given);

  const handleAgree = async () => {
    if (!user?.email) return;
    try {
      const res = await api.setUserConsent(user.email, true);
      if (res.success) {
        router.replace('/workspace/lexi');
      } else {
        Alert.alert('Error', 'Could not save your consent. Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Consent required',
      'You cannot participate in Lexi without accepting the consent.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {alreadyConsented && (
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBrand}>
          <Image source={require('../assets/images/lexi_icon.png')} style={styles.brandLogo} />
          <View>
            <Text style={styles.brandTitle}>Lexi Consent</Text>
            <Text style={styles.brandSubtitle}>Help map languages at Wellesley</Text>
          </View>
        </View>
        <View style={styles.card}>
        <Text style={styles.title}>Consent to participate</Text>
        <Text style={styles.paragraph}>
          You are being asked to take part in a research study for collecting information about languages used on campus. For the purposes of this project, a task involves answering a few short questions on a language that you heard around campus. Please read this consent form carefully, and ask any questions you may have before signing up for participation.
        </Text>
        <Text style={styles.paragraph}>
          Questions should be directed to the project advisors, Yoolim Kim &lt;ykim6@wellesley.edu&gt;, Catherine Delcourt &lt;cdelcour@wellesley.edu&gt;, and Christine Bassem &lt;cbassem@wellesley.edu&gt;.
        </Text>
        <Text style={styles.section}>What is this project about?</Text>
        <Text style={styles.paragraph}>
          The purpose of this study is to understand the use of different languages on campus, and strengthen communities with shared languages.
        </Text>
        <Text style={styles.section}>What we will ask you to do?</Text>
        <Text style={styles.paragraph}>
          By completing this form and joining our Slack workspace (Lexi in Wellesley) using your Wellesley email, you agree to participate in this study. Once the study starts, you will be asked to submit information about languages that you recognize around campus.
        </Text>
        <Text style={styles.paragraph}>
          Only actions directly related to the Lexi in Wellesley Slack workspace will be collected by this application, such as messages sent in the general channel, and direct messages to the account. No data regarding your general activities on Slack, not related to the Lexi in Wellesley workspace, will be collected without your knowledge.
        </Text>
        <Text style={styles.section}>Risks and benefits.</Text>
        <Text style={styles.paragraph}>
          There are no specific risks attached with this application. There are research benefits for the fields of computer science and linguistics.
        </Text>
        <Text style={styles.section}>What about my data?</Text>
        <Text style={styles.paragraph}>
          Usage data will be collected by the application constantly, and will be stored in a password-protected database only accessible by the project advisors and senior researchers working on the project.
        </Text>
        <Text style={styles.section}>Taking part is voluntary.</Text>
        <Text style={styles.paragraph}>
          Taking part in this study is completely voluntary. You may decide to not complete any tasks after joining or to leave the workspace. This will not affect your current or future relationship with Wellesley College.
        </Text>
        <Text style={styles.section}>How do I provide my consent?</Text>
        <Text style={styles.paragraph}>
          By tapping “I Agree” below, you provide us consent to include you in the study, and collect your participatory data.
        </Text>

        {!alreadyConsented && (
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.decline]} onPress={handleDecline}>
              <Text style={[styles.buttonText, { color: '#EF4444' }]}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.agree]} onPress={handleAgree}>
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>I Agree</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  closeText: {
    color: '#111827',
    fontWeight: '600',
  },
  container: {
    padding: 20,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 8,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  decline: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
  },
  agree: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
