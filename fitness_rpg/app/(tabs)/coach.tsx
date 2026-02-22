import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useGameStore } from "@/hooks/use-game-store";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "Como posso melhorar meu streak?",
  "Que treino fazer hoje?",
  "Como emagrecer mais rápido?",
  "Estou sem motivação, me ajude!",
  "Como evitar lesões em casa?",
];

export default function CoachScreen() {
  const colors = useColors();
  const state = useGameStore();
  const { stats, hero } = state;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
        content: String(`Saudações, ${hero?.name ?? "Herói"}! ⚔️\n\nSou o Oráculo, seu guia nessa jornada épica. Analisei seu progresso: você está no nível ${stats.level} com ${stats.streak} dias de streak.\n\nComo posso ajudar você hoje?`),
    },
  ]);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const chatMutation = trpc.coach.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: String(data.reply),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: () => {
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "O Oráculo está meditando... Verifique sua conexão e tente novamente. 🔮",
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Build history for API (exclude welcome message)
    const history = newMessages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    chatMutation.mutate({
      messages: history,
      heroStats: {
        level: stats.level,
        xp: stats.xp,
        streak: stats.streak,
        totalWorkouts: stats.totalWorkouts,
        totalMinutes: stats.totalMinutes,
        goal: hero?.goal ?? "ambos",
        heroClass: hero?.heroClass ?? "Guerreiro",
        experienceLevel: hero?.experienceLevel ?? "iniciante",
      },
    });
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Text style={styles.headerEmoji}>🔮</Text>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Oráculo</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>Coach de IA personalizado</Text>
          </View>
          <View style={[styles.onlineBadge, { backgroundColor: colors.success + "22" }]}>
            <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.onlineText, { color: colors.success }]}>Online</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.role === "user"
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
            >
              {item.role === "assistant" && (
                <Text style={styles.assistantIcon}>🔮 </Text>
              )}
              <Text
                style={[
                  styles.messageText,
                  { color: item.role === "user" ? "#fff" : colors.foreground },
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={
            chatMutation.isPending ? (
              <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.xp} />
                <Text style={[styles.typingText, { color: colors.muted }]}>Oráculo está pensando...</Text>
              </View>
            ) : null
          }
        />

        {/* Quick Questions */}
        {messages.length <= 2 && (
          <View style={styles.quickContainer}>
            <Text style={[styles.quickLabel, { color: colors.muted }]}>Perguntas rápidas:</Text>
            <FlatList
              data={QUICK_QUESTIONS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => sendMessage(item)}
                  style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickBtnText, { color: colors.foreground }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte ao Oráculo..."
            placeholderTextColor={colors.muted}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
            multiline
            maxLength={500}
            style={[
              styles.textInput,
              { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border },
            ]}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || chatMutation.isPending}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  input.trim() && !chatMutation.isPending ? colors.primary : colors.border,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 18 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  headerEmoji: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  onlineBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: "700",
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  assistantIcon: {
    fontSize: 14,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
  },
  quickContainer: {
    paddingVertical: 8,
    gap: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 16,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
