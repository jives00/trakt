import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  watched: boolean;
  releaseDate?: string | null;
  releaseDateLabel?: string;
  onMark: (watchedAt: string) => void;
  onRemoveLatest?: (id: number) => void;
  onRemoveAll?: () => void;
  latestEntryId?: number | null;
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WatchActionSheet({ visible, onClose, watched, releaseDate, releaseDateLabel = "Release Date", onMark, onRemoveLatest, onRemoveAll, latestEntryId }: Props) {
  const [pickingDate, setPickingDate] = useState(false);
  const [dateInput, setDateInput] = useState(getTodayString());

  function handleClose() {
    setPickingDate(false);
    setDateInput(getTodayString());
    onClose();
  }

  function handleConfirmDate() {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      onMark(dateInput);
      handleClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>{watched ? "Watch Options" : "Mark as Watched"}</Text>

        {pickingDate ? (
          <View style={s.dateRow}>
            <TextInput
              style={s.dateInput}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="rgba(240,240,246,0.3)"
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmDate}>
              <Text style={s.confirmBtnText}>{watched ? "Add" : "Confirm"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={s.option} onPress={() => { onMark(getTodayString()); handleClose(); }}>
              <Text style={s.optionText}>{watched ? "Add Watch (Today)" : "Today"}</Text>
            </TouchableOpacity>

            {releaseDate ? (
              <TouchableOpacity style={s.option} onPress={() => { onMark(releaseDate); handleClose(); }}>
                <Text style={s.optionText}>{watched ? `Add Watch (${releaseDateLabel})` : releaseDateLabel}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={s.option} onPress={() => setPickingDate(true)}>
              <Text style={s.optionText}>Pick Date</Text>
            </TouchableOpacity>

            {watched && (onRemoveLatest || onRemoveAll) ? <View style={s.separator} /> : null}

            {watched && onRemoveLatest && latestEntryId ? (
              <TouchableOpacity style={s.option} onPress={() => { onRemoveLatest(latestEntryId); handleClose(); }}>
                <Text style={[s.optionText, s.destructive]}>Remove Latest</Text>
              </TouchableOpacity>
            ) : null}

            {watched && onRemoveAll ? (
              <TouchableOpacity style={s.option} onPress={() => { onRemoveAll(); handleClose(); }}>
                <Text style={[s.optionText, s.destructive]}>Remove All</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}

        <View style={{ height: 16 }} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#1e2029",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: "800", color: "#f0f0f6", paddingHorizontal: 20, paddingVertical: 14 },
  option: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  optionText: { fontSize: 15, color: "#f0f0f6" },
  destructive: { color: "#e8002d" },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },
  dateRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  dateInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: "#12141b", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", color: "#f0f0f6", fontSize: 14 },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#e8002d", justifyContent: "center" },
  confirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
