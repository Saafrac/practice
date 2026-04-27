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
import { UserRole } from "../types/auth";

const roleOptions: UserRole[] = ["student", "teacher", "admin"];

export function RegisterScreen() {
  const navigation = useNavigation<any>();
  const register = useAuthStore((state) => state.register);
  const clearError = useAuthStore((state) => state.clearError);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");

  const localError = useMemo(() => {
    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      return "Fill in all fields.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    return null;
  }, [confirmPassword, email, fullName, password]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    }
  }, [isAuthenticated]);

  const onSubmit = async () => {
    if (localError) {
      return;
    }
    await register({
      full_name: fullName.trim(),
      email: email.trim(),
      password,
      role,
    });
  };

  return (
    <GradientScreen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Create account</Text>
          <Text style={styles.title}>Adaptive English Test AI</Text>
          <Text style={styles.description}>Register once and continue with your role dashboard.</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor="#8A94B8"
            style={styles.input}
            autoCapitalize="words"
          />
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
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor="#8A94B8"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.roleRow}>
            {roleOptions.map((item) => {
              const selected = role === item;
              return (
                <Pressable
                  key={item}
                  style={[styles.roleChip, selected && styles.roleChipSelected]}
                  onPress={() => setRole(item)}
                >
                  <Text style={[styles.roleChipLabel, selected && styles.roleChipLabelSelected]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          {!localError && error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title={isLoading ? "Creating account..." : "Register"}
            onPress={onSubmit}
            disabled={isLoading || Boolean(localError)}
          />
          {isLoading ? <ActivityIndicator color="#4458FF" /> : null}

          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.switchText}>Already have an account? Sign in</Text>
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
    gap: 20,
  },
  header: {
    gap: 10,
  },
  kicker: {
    color: "#C7D2FE",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },
  description: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    gap: 12,
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
  roleRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#D7DEFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipSelected: {
    borderColor: "#4458FF",
    backgroundColor: "#EEF1FF",
  },
  roleChipLabel: {
    color: "#667085",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  roleChipLabelSelected: {
    color: "#2537D6",
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
