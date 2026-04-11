/**
 * Top navigation bar matching the web app's header.
 * Custom SVG icons with per-item accent colors and active states.
 */
import { View, TouchableOpacity, ScrollView, Text, useColorScheme } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Icon Components ─────────────────────────────────────────────────

function SearchIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </Svg>
  );
}

function HomeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </Svg>
  );
}

function ComposeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </Svg>
  );
}

function HeartIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </Svg>
  );
}

function BookmarkIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </Svg>
  );
}

function ListIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </Svg>
  );
}

function MarketplaceIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </Svg>
  );
}

function CommunitiesIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
    </Svg>
  );
}

function ThemeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </Svg>
  );
}

function ProfileIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </Svg>
  );
}

function BellIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </Svg>
  );
}

function ChatIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </Svg>
  );
}

// ── Nav Item Colors (matching web) ───────────────────────────────────

interface NavItem {
  key: string;
  route: string;
  label: string;
  icon: (props: { color: string; size?: number }) => React.ReactNode;
  activeColor: string;      // Color when active
  activeBg: string;         // Background when active
  matchPrefix?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "search",       route: "/(tabs)/search",    label: "Search",       icon: SearchIcon,       activeColor: "#14b8a6", activeBg: "#14b8a611" },
  { key: "home",         route: "/(tabs)",            label: "Home",         icon: HomeIcon,         activeColor: "#a855f7", activeBg: "#a855f711" },
  { key: "compose",      route: "/(tabs)/compose",    label: "Compose",      icon: ComposeIcon,      activeColor: "#06b6d4", activeBg: "#06b6d411" },
  { key: "likes",        route: "/(stack)/likes",     label: "Likes",        icon: HeartIcon,        activeColor: "#ef4444", activeBg: "#ef444411" },
  { key: "bookmarks",    route: "/(stack)/bookmarks", label: "Bookmarks",    icon: BookmarkIcon,     activeColor: "#eab308", activeBg: "#eab30811" },
  { key: "lists",        route: "/(stack)/lists",     label: "Lists",        icon: ListIcon,         activeColor: "#6366f1", activeBg: "#6366f111", matchPrefix: true },
  { key: "marketplace",  route: "/(stack)/marketplace", label: "Market",    icon: MarketplaceIcon,  activeColor: "#ec4899", activeBg: "#ec489911", matchPrefix: true },
  { key: "communities",  route: "/(stack)/communities", label: "Community", icon: CommunitiesIcon,  activeColor: "#d946ef", activeBg: "#d946ef11", matchPrefix: true },
  { key: "theme",        route: "/(stack)/theme",     label: "Theme",        icon: ThemeIcon,        activeColor: "#ec4899", activeBg: "#ec489911" },
  { key: "profile",      route: "/(tabs)/profile",    label: "Profile",      icon: ProfileIcon,      activeColor: "#f97316", activeBg: "#f9731611" },
];

// Action bar items (right side — notifications, chat)
const ACTION_ITEMS: NavItem[] = [
  { key: "notifications", route: "/(tabs)/notifications", label: "Alerts",  icon: BellIcon,   activeColor: "#3b82f6", activeBg: "#3b82f611" },
  { key: "chat",          route: "/(tabs)/chat",           label: "Chat",   icon: ChatIcon,    activeColor: "#22c55e", activeBg: "#22c55e11" },
];

// ── Badge Component ──────────────────────────────────────────────────

function Badge({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: "absolute",
      top: -4,
      right: -6,
      backgroundColor: color,
      borderRadius: 10,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    }}>
      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

// ── NavBar Component ─────────────────────────────────────────────────

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();

  // Fetch unread counts
  const { data: unreadNotifs } = useQuery({
    queryKey: ["unreadNotifCount"],
    queryFn: () => api.rpc<number>("getUnreadNotificationCount"),
    enabled: !!user,
    refetchInterval: 30000,
  });

  // System theme colors (matching web's zinc palette)
  const inactiveColor = isDark ? "#a1a1aa" : "#52525b"; // zinc-400 / zinc-600
  const bgColor = isDark ? "#18181b" : "#ffffff"; // zinc-900 / white
  const borderColor = isDark ? "#27272a" : "#e4e4e7"; // zinc-800 / zinc-200
  const dividerColor = isDark ? "#3f3f46" : "#d4d4d8"; // zinc-700 / zinc-300

  function isActive(item: NavItem) {
    if (item.key === "home") return pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/index";
    if (item.matchPrefix) return pathname.includes(item.key);
    return pathname.includes(item.key);
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item);
    const color = active ? item.activeColor : inactiveColor;
    const badgeCount = item.key === "notifications" ? (unreadNotifs ?? 0) : 0;
    // Dark mode gets slightly more opaque active bg for visibility
    const activeBg = isDark ? item.activeColor + "22" : item.activeBg;

    return (
      <TouchableOpacity
        key={item.key}
        onPress={() => router.push(item.route as any)}
        activeOpacity={0.6}
        style={{
          padding: 6,
          borderRadius: 8,
          backgroundColor: active ? activeBg : "transparent",
          position: "relative",
        }}
      >
        {item.icon({ color, size: 22 })}
        <Badge count={badgeCount} color={item.activeColor} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      backgroundColor: bgColor,
    }}>
      {/* Main nav — scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: "row", gap: 2, alignItems: "center" }}
        style={{ flex: 1 }}
      >
        {NAV_ITEMS.map(renderNavItem)}
      </ScrollView>

      {/* Divider */}
      <View style={{ width: 1, height: 20, backgroundColor: dividerColor, marginHorizontal: 6 }} />

      {/* Action items (notifications, chat) */}
      <View style={{ flexDirection: "row", gap: 2 }}>
        {ACTION_ITEMS.map(renderNavItem)}
      </View>
    </View>
  );
}
