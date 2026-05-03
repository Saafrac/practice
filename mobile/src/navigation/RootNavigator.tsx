import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";

import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { AdaptiveTestScreen } from "../screens/AdaptiveTestScreen";
import { DiagnosticTestScreen } from "../screens/DiagnosticTestScreen";
import { FinalTestScreen } from "../screens/FinalTestScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { TeacherStudentResultsScreen } from "../screens/TeacherStudentResultsScreen";
import { TestResultScreen } from "../screens/TestResultScreen";
import { useAuthStore } from "../store/authStore";
import { RoleTabs } from "./RoleTabs";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && role ? (
        <>
          <Stack.Screen name="RoleTabs">
            {() => <RoleTabs role={role} />}
          </Stack.Screen>
          <Stack.Screen
            name="DiagnosticTest"
            component={DiagnosticTestScreen}
            options={{ headerShown: true, title: "Diagnostic Test" }}
          />
          <Stack.Screen
            name="AdaptiveTest"
            component={AdaptiveTestScreen}
            options={{ headerShown: true, title: "Adaptive Test" }}
          />
          <Stack.Screen
            name="FinalTest"
            component={FinalTestScreen}
            options={{ headerShown: true, title: "Final Test" }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ headerShown: true, title: "History" }}
          />
          <Stack.Screen
            name="TeacherStudentResults"
            component={TeacherStudentResultsScreen}
            options={({ route }) => ({ headerShown: true, title: route.params.studentName })}
          />
          <Stack.Screen
            name="TestResult"
            component={TestResultScreen}
            options={{ headerShown: true, title: "Test Result" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
