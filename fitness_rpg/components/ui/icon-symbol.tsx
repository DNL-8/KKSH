// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navigation tabs
  "house.fill":                             "home",
  "flame.fill":                             "local-fire-department",
  "chart.bar.fill":                         "bar-chart",
  "brain.head.profile":                     "psychology",
  "person.fill":                            "person",
  // Workout / exercise icons
  "bolt.fill":                              "bolt",
  "checkmark.circle.fill":                  "check-circle",
  "checkmark.circle":                       "radio-button-unchecked",
  "xmark.circle.fill":                      "cancel",
  "play.fill":                              "play-arrow",
  "pause.fill":                             "pause",
  "stop.fill":                              "stop",
  "arrow.clockwise":                        "refresh",
  "timer":                                  "timer",
  "dumbbell.fill":                          "fitness-center",
  "figure.run":                             "directions-run",
  "figure.walk":                            "directions-walk",
  "heart.fill":                             "favorite",
  "star.fill":                              "star",
  "star":                                   "star-border",
  "trophy.fill":                            "emoji-events",
  "shield.fill":                            "shield",
  "lock.fill":                              "lock",
  "lock.open.fill":                         "lock-open",
  "chevron.right":                          "chevron-right",
  "chevron.left":                           "chevron-left",
  "chevron.down":                           "expand-more",
  "chevron.up":                             "expand-less",
  "info.circle":                            "info",
  "gear":                                   "settings",
  "calendar":                               "calendar-today",
  "clock.fill":                             "access-time",
  "paperplane.fill":                        "send",
  "chevron.left.forwardslash.chevron.right":"code",
  "sparkles":                               "auto-awesome",
  "flame":                                  "local-fire-department",
  "arrow.up.right":                         "trending-up",
  "minus.circle.fill":                      "remove-circle",
  "plus.circle.fill":                       "add-circle",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
