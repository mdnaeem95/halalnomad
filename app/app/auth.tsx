import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../src/hooks/useAuth';
import { useTheme } from '../src/hooks/useTheme';
import { signInSchema, signUpSchema, SignInInput, SignUpInput } from '../src/lib/schemas';
import { AppDialog } from '../src/components/AppDialog';
import { AppColors, borderRadius, spacing, typography } from '../src/constants/theme';
import { track, EVENTS } from '../src/lib/analytics';

type Mode = 'signin' | 'signup' | 'verify';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  // Allow callers to land on a specific mode via ?mode=signup.
  // Default is signin so existing entry paths (place verify CTA, etc.)
  // keep their current behaviour.
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = params.mode === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  // Bump on form reset / mode switch so uncontrolled TextInputs remount
  // and visibly clear (defaultValue is only read on first render).
  const [inputResetKey, setInputResetKey] = useState(0);

  useEffect(() => {
    // Fires every time the auth modal is opened — captures all entry
    // paths (place verify CTA, profile sign-in, add-place gate, etc.)
    track(EVENTS.AUTH_PROMPT_SHOWN);
  }, []);

  const [dialog, setDialog] = useState<{
    visible: boolean;
    variant: 'success' | 'error' | 'confirm' | 'info';
    title: string;
    message: string;
  }>({ visible: false, variant: 'info', title: '', message: '' });

  // Sign In form
  const signInForm = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // Sign Up form
  const signUpForm = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  function showDialog(variant: typeof dialog.variant, title: string, message: string) {
    setDialog({ visible: true, variant, title, message });
  }

  async function onSignIn(data: SignInInput) {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      router.back();
    } catch (err: any) {
      showDialog('error', 'Sign in failed', err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  }

  async function onSignUp(data: SignUpInput) {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password, data.displayName);
      setVerifyEmail(data.email);
      setVerifyPassword(data.password);
      setMode('verify');
    } catch (err: any) {
      showDialog('error', 'Sign up failed', err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignInAfterVerify() {
    setIsLoading(true);
    try {
      await signIn(verifyEmail, verifyPassword);
      router.back();
    } catch {
      showDialog(
        'info',
        'Not verified yet',
        'Please check your inbox and tap the verification link first, then try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    signInForm.reset();
    signUpForm.reset();
    setInputResetKey((k) => k + 1);
  }

  // Verification pending screen
  if (mode === 'verify') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={40} color={c.primary} />
          </View>

          <Text style={styles.title}>Check your email</Text>

          <Text style={styles.subtitle}>
            We sent a verification link to
          </Text>
          <Text style={styles.emailHighlight}>{verifyEmail}</Text>
          <Text style={styles.subtitle}>
            Tap the link in the email to verify your account, then come back here and sign in.
          </Text>

          <Pressable
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignInAfterVerify}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Signing in...' : "I've verified — Sign me in"}
            </Text>
          </Pressable>

          <Pressable style={styles.switchButton} onPress={() => setMode('signin')}>
            <Text style={styles.switchText}>Back to sign in</Text>
          </Pressable>
        </View>

        <AppDialog
          visible={dialog.visible}
          onClose={() => setDialog((d) => ({ ...d, visible: false }))}
          variant={dialog.variant}
          title={dialog.title}
          message={dialog.message}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {mode === 'signin' ? 'Welcome back' : 'Join HalalNomad'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'signin'
            ? 'Sign in to contribute and track your points.'
            : 'Help Muslim travellers find Halal food worldwide.'}
        </Text>

        {mode === 'signup' ? (
          <>
            <Controller
              control={signUpForm.control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  key={`signup-displayName-${inputResetKey}`}
                  style={[styles.input, signUpForm.formState.errors.displayName && styles.inputError]}
                  placeholder="Display name"
                  defaultValue={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                  placeholderTextColor={c.textTertiary}
                />
              )}
            />
            {signUpForm.formState.errors.displayName && (
              <Text style={styles.errorText}>{signUpForm.formState.errors.displayName.message}</Text>
            )}

            <Controller
              control={signUpForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  key={`signup-email-${inputResetKey}`}
                  style={[styles.input, signUpForm.formState.errors.email && styles.inputError]}
                  placeholder="Email"
                  defaultValue={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  placeholderTextColor={c.textTertiary}
                />
              )}
            />
            {signUpForm.formState.errors.email && (
              <Text style={styles.errorText}>{signUpForm.formState.errors.email.message}</Text>
            )}

            <Controller
              control={signUpForm.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  key={`signup-password-${inputResetKey}`}
                  style={[styles.input, signUpForm.formState.errors.password && styles.inputError]}
                  placeholder="Password"
                  defaultValue={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  placeholderTextColor={c.textTertiary}
                />
              )}
            />
            {signUpForm.formState.errors.password && (
              <Text style={styles.errorText}>{signUpForm.formState.errors.password.message}</Text>
            )}
          </>
        ) : (
          <>
            <Controller
              control={signInForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  key={`signin-email-${inputResetKey}`}
                  style={[styles.input, signInForm.formState.errors.email && styles.inputError]}
                  placeholder="Email"
                  defaultValue={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  placeholderTextColor={c.textTertiary}
                />
              )}
            />
            {signInForm.formState.errors.email && (
              <Text style={styles.errorText}>{signInForm.formState.errors.email.message}</Text>
            )}

            <Controller
              control={signInForm.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  key={`signin-password-${inputResetKey}`}
                  style={[styles.input, signInForm.formState.errors.password && styles.inputError]}
                  placeholder="Password"
                  defaultValue={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="current-password"
                  placeholderTextColor={c.textTertiary}
                />
              )}
            />
            {signInForm.formState.errors.password && (
              <Text style={styles.errorText}>{signInForm.formState.errors.password.message}</Text>
            )}
          </>
        )}

        <Pressable
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={
            mode === 'signin'
              ? signInForm.handleSubmit(onSignIn)
              : signUpForm.handleSubmit(onSignUp)
          }
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading
              ? 'Loading...'
              : mode === 'signin'
              ? 'Sign In'
              : 'Create Account'}
          </Text>
        </Pressable>

        <Pressable style={styles.switchButton} onPress={switchMode}>
          <Text style={styles.switchText}>
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>

      <AppDialog
        visible={dialog.visible}
        onClose={() => setDialog((d) => ({ ...d, visible: false }))}
        variant={dialog.variant}
        title={dialog.title}
        message={dialog.message}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.primaryLight + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: c.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailHighlight: {
    ...typography.label,
    color: c.primary,
    fontSize: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
    width: '100%',
  },
  inputError: {
    borderColor: c.error,
  },
  errorText: {
    ...typography.caption,
    color: c.error,
    alignSelf: 'flex-start',
  },
  primaryButton: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
    width: '100%',
  },
  primaryButtonText: {
    ...typography.label,
    color: c.textOnPrimary,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  switchText: {
    ...typography.bodySmall,
    color: c.primary,
    fontWeight: '600',
  },
});
