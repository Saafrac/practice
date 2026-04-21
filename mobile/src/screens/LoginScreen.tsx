import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { GradientScreen } from "../components/GradientScreen";
import { useAuthStore } from "../store/authStore";

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const login = useAuthStore((state) => state.login);
  const clearError = useAuthStore((state) => state.clearError);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [email, setEmail] = useState("alex@adaptive.test");
  const [password, setPassword] = useState("Student123!");

  const localError = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return "Enter email and password.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    return null;
  }, [email, password]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async () => {
    if (localError) {
      return;
    }
    await login({
      email: email.trim(),
      password,
    });
  };

  return (
    <GradientScreen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Stage 3 Auth</Text>
          <Text style={styles.title}>Adaptive English Test AI</Text>
          <Text style={styles.description}>
            Sign in with your account to open the correct dashboard by role.
          </Text>
        </View>

        <View style={styles.card}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8A94B8"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#8A94B8"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />

          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          {!localError && error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title={isLoading ? "Signing in..." : "Sign in"}
            onPress={onSubmit}
            disabled={isLoading || Boolean(localError)}
          />
          {isLoading ? <ActivityIndicator color="#4458FF" /> : null}

          <Pressable onPress={() => navigation.navigate("Register")}>
            <Text style={styles.switchText}>No account yet? Create one</Text>
          </Pressable>
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 24,
  },
  header: {
    gap: 12,
  },
  kicker: {
    color: "#C7D2FE",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  description: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    gap: 12,
    padding: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7DEFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#182033",
    fontSize: 15,
  },
  error: {
    color: "#E53935",
    fontSize: 13,
    fontWeight: "600",
  },
  switchText: {
    color: "#4458FF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
  },
});
