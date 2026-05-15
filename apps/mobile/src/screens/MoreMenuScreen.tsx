import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MoreStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MoreStackParamList, "MoreMenu">;

const ITEMS: { label: string; screen: keyof MoreStackParamList }[] = [
  { label: "Lists", screen: "Lists" },
  { label: "Progress", screen: "Progress" },
  { label: "Calendar", screen: "Calendar" },
  { label: "Stats", screen: "Stats" },
  { label: "Settings", screen: "Settings" },
];

export default function MoreMenuScreen({ navigation }: Props) {
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={s.row}
          onPress={() => navigation.navigate(item.screen as never)}
        >
          <Text style={s.label}>{item.label}</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  content: { paddingTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  label: { color: "#e2e2e2", fontSize: 16 },
  chevron: { color: "#888", fontSize: 20 },
});
