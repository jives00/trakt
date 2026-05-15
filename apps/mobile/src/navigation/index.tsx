import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import type { RootStackParamList, MainTabParamList, MoreStackParamList } from "./types";

import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SearchScreen from "../screens/SearchScreen";
import ShowDetailScreen from "../screens/ShowDetailScreen";
import SeasonScreen from "../screens/SeasonScreen";
import EpisodeDetailScreen from "../screens/EpisodeDetailScreen";
import MovieDetailScreen from "../screens/MovieDetailScreen";
import ListDetailScreen from "../screens/ListDetailScreen";
import StatsYearScreen from "../screens/StatsYearScreen";
import StatsMonthScreen from "../screens/StatsMonthScreen";
import MoreMenuScreen from "../screens/MoreMenuScreen";
import ShowsScreen from "../screens/ShowsScreen";
import MoviesScreen from "../screens/MoviesScreen";
import ListsScreen from "../screens/ListsScreen";
import ProgressScreen from "../screens/ProgressScreen";
import RatingsScreen from "../screens/RatingsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import StatsScreen from "../screens/StatsScreen";
import SettingsScreen from "../screens/SettingsScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

const NAV_BG = "#1d1d1d";
const SURFACE_LOW = "#1a1c1c";
const ACCENT = "#e8002d";
const ON_SURFACE = "#e2e2e2";
const ON_SURFACE_VARIANT = "#cccccc";

function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: SURFACE_LOW },
        headerTintColor: ON_SURFACE,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: NAV_BG },
      }}
    >
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: "More" }} />
      <MoreStack.Screen name="Shows" component={ShowsScreen} options={{ title: "Shows" }} />
      <MoreStack.Screen name="Movies" component={MoviesScreen} options={{ title: "Movies" }} />
      <MoreStack.Screen name="Lists" component={ListsScreen} options={{ title: "Lists" }} />
      <MoreStack.Screen name="Progress" component={ProgressScreen} options={{ title: "Progress" }} />
      <MoreStack.Screen name="Ratings" component={RatingsScreen} options={{ title: "Ratings" }} />
      <MoreStack.Screen name="Calendar" component={CalendarScreen} options={{ title: "Calendar" }} />
      <MoreStack.Screen name="Stats" component={StatsScreen} options={{ title: "Stats" }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: SURFACE_LOW, borderTopColor: "rgba(255,255,255,0.08)" },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: ON_SURFACE_VARIANT,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⊞</Text> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◷</Text> }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⌕</Text> }}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>≡</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: SURFACE_LOW },
          headerTintColor: ON_SURFACE,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: NAV_BG },
        }}
      >
        {!token ? (
          <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <RootStack.Screen name="ShowDetail" component={ShowDetailScreen} options={{ title: "" }} />
            <RootStack.Screen name="Season" component={SeasonScreen} options={{ title: "" }} />
            <RootStack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={{ title: "" }} />
            <RootStack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ title: "" }} />
            <RootStack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: "" }} />
            <RootStack.Screen name="StatsYear" component={StatsYearScreen} options={{ title: "" }} />
            <RootStack.Screen name="StatsMonth" component={StatsMonthScreen} options={{ title: "" }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
