import "./global.css";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./src/contexts/AuthContext";
import Navigation from "./src/navigation";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
