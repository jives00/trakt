import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import type {
  RootStackParamList, MainTabParamList,
  DashboardStackParamList, HistoryStackParamList, DiscoverStackParamList, MoreStackParamList,
} from "./types";

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
import ListsScreen from "../screens/ListsScreen";
import ProgressScreen from "../screens/ProgressScreen";
import CalendarScreen from "../screens/CalendarScreen";
import StatsScreen from "../screens/StatsScreen";
import SettingsScreen from "../screens/SettingsScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

const NAV_BG = "#1c1e26";
const SURFACE_LOW = "#1e2029";
const ACCENT = "#e8002d";
const ON_SURFACE = "#f0f0f6";
const ON_SURFACE_VARIANT = "#d7d8e2";

const DETAIL_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: SURFACE_LOW },
  headerTintColor: ON_SURFACE,
  headerTitleStyle: { fontWeight: "700" as const },
  contentStyle: { backgroundColor: NAV_BG },
};

function DetailScreens({ Stack }: { Stack: ReturnType<typeof createNativeStackNavigator<any>> }) {
  return (
    <>
      <Stack.Screen name="ShowDetail" component={ShowDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="Season" component={SeasonScreen} options={{ title: "" }} />
      <Stack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="StatsYear" component={StatsYearScreen} options={{ title: "" }} />
      <Stack.Screen name="StatsMonth" component={StatsMonthScreen} options={{ title: "" }} />
    </>
  );
}

function DashboardNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false, ...DETAIL_SCREEN_OPTIONS, contentStyle: { backgroundColor: NAV_BG } }}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStack.Screen name="ShowDetail" component={ShowDetailScreen} options={{ headerShown: true, title: "" }} />
      <DashboardStack.Screen name="Season" component={SeasonScreen} options={{ headerShown: true, title: "" }} />
      <DashboardStack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={{ headerShown: true, title: "" }} />
      <DashboardStack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ headerShown: true, title: "" }} />
      <DashboardStack.Screen name="ListDetail" component={ListDetailScreen} options={{ headerShown: true, title: "" }} />
      <DashboardStack.Screen name="StatsYear" component={StatsYearScreen} options={{ headerShown: true, title: "" }} />
      <DashboardStack.Screen name="StatsMonth" component={StatsMonthScreen} options={{ headerShown: true, title: "" }} />
    </DashboardStack.Navigator>
  );
}

function HistoryNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false, ...DETAIL_SCREEN_OPTIONS, contentStyle: { backgroundColor: NAV_BG } }}>
      <HistoryStack.Screen name="HistoryHome" component={HistoryScreen} />
      <HistoryStack.Screen name="ShowDetail" component={ShowDetailScreen} options={{ headerShown: true, title: "" }} />
      <HistoryStack.Screen name="Season" component={SeasonScreen} options={{ headerShown: true, title: "" }} />
      <HistoryStack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={{ headerShown: true, title: "" }} />
      <HistoryStack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ headerShown: true, title: "" }} />
      <HistoryStack.Screen name="ListDetail" component={ListDetailScreen} options={{ headerShown: true, title: "" }} />
      <HistoryStack.Screen name="StatsYear" component={StatsYearScreen} options={{ headerShown: true, title: "" }} />
      <HistoryStack.Screen name="StatsMonth" component={StatsMonthScreen} options={{ headerShown: true, title: "" }} />
    </HistoryStack.Navigator>
  );
}

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false, ...DETAIL_SCREEN_OPTIONS, contentStyle: { backgroundColor: NAV_BG } }}>
      <DiscoverStack.Screen name="DiscoverHome" component={SearchScreen} />
      <DiscoverStack.Screen name="ShowDetail" component={ShowDetailScreen} options={{ headerShown: true, title: "" }} />
      <DiscoverStack.Screen name="Season" component={SeasonScreen} options={{ headerShown: true, title: "" }} />
      <DiscoverStack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={{ headerShown: true, title: "" }} />
      <DiscoverStack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ headerShown: true, title: "" }} />
      <DiscoverStack.Screen name="ListDetail" component={ListDetailScreen} options={{ headerShown: true, title: "" }} />
      <DiscoverStack.Screen name="StatsYear" component={StatsYearScreen} options={{ headerShown: true, title: "" }} />
      <DiscoverStack.Screen name="StatsMonth" component={StatsMonthScreen} options={{ headerShown: true, title: "" }} />
    </DiscoverStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ ...DETAIL_SCREEN_OPTIONS }}>
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: "More" }} />
      <MoreStack.Screen name="Lists" component={ListsScreen} options={{ title: "Lists" }} />
      <MoreStack.Screen name="Progress" component={ProgressScreen} options={{ title: "Progress" }} />
      <MoreStack.Screen name="Calendar" component={CalendarScreen} options={{ title: "Calendar" }} />
      <MoreStack.Screen name="Stats" component={StatsScreen} options={{ title: "Stats" }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <MoreStack.Screen name="ShowDetail" component={ShowDetailScreen} options={{ title: "" }} />
      <MoreStack.Screen name="Season" component={SeasonScreen} options={{ title: "" }} />
      <MoreStack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={{ title: "" }} />
      <MoreStack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ title: "" }} />
      <MoreStack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: "" }} />
      <MoreStack.Screen name="StatsYear" component={StatsYearScreen} options={{ title: "" }} />
      <MoreStack.Screen name="StatsMonth" component={StatsMonthScreen} options={{ title: "" }} />
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
        sceneContainerStyle: { backgroundColor: NAV_BG },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>âŠž</Text> }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate("Dashboard", { screen: "DashboardHome" } as never);
            }
          },
        })}
      />
      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 26, lineHeight: 26, includeFontPadding: false, marginTop: -2 }}>â±</Text> }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate("History", { screen: "HistoryHome" } as never);
            }
          },
        })}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 30, lineHeight: 30, includeFontPadding: false }}>âŒ•</Text> }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate("Discover", { screen: "DiscoverHome" } as never);
            }
          },
        })}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 32, lineHeight: 32, includeFontPadding: false }}>â‰¡</Text> }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate("More", { screen: "MoreMenu" } as never);
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <RootStack.Screen name="Login" component={LoginScreen} />
        ) : (
          <RootStack.Screen name="Main" component={MainTabs} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
