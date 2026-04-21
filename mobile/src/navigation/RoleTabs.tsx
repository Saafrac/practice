import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AdminDashboardScreen } from "../screens/AdminDashboardScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { StudentHomeScreen } from "../screens/StudentHomeScreen";
import { TeacherDashboardScreen } from "../screens/TeacherDashboardScreen";
import { colors } from "../theme/colors";
import { UserRole } from "../types/auth";

const Tab = createBottomTabNavigator();

type RoleTabsProps = {
  role: UserRole;
};

function getDashboardComponent(role: UserRole) {
  switch (role) {
    case "teacher":
      return TeacherDashboardScreen;
    case "admin":
      return AdminDashboardScreen;
    case "student":
    default:
      return StudentHomeScreen;
  }
}

export function RoleTabs({ role }: RoleTabsProps) {
  const DashboardComponent = getDashboardComponent(role);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: "#FFFFFF",
        },
        tabBarIcon: ({ color, size }) => {
          const iconName = route.name === "Profile" ? "person-outline" : "grid-outline";
          return <Ionicons color={color} name={iconName} size={size} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardComponent}
        options={{ title: role === "student" ? "Home" : "Dashboard" }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
