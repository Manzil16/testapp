import { useState } from "react";
import { useRouter } from "expo-router";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  PressableScale,
  ScreenContainer,
  Colors,
  Spacing,
  Radius,
  Shadows,
  Typography,
} from "@/src/components";

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_SECTIONS: { title: string; items: FaqItem[] }[] = [
  {
    title: "Getting Started",
    items: [
      {
        q: "How do I book a charger?",
        a: 'Open the Discover tab, find a charger near you on the map or list, tap it to view details, then press "Book this charger". Select your start time, target battery level, and confirm your booking. The host will approve within 24 hours.',
      },
      {
        q: "Do I need to verify my account before booking?",
        a: "Yes. To book a charger you need a verified email, verified phone number, and a payment method saved. Head to Profile → Account Details to complete these steps.",
      },
      {
        q: "How do I add my vehicle?",
        a: "Go to Profile → Vehicle Profile, then tap Add Vehicle. Enter your car make, model, battery capacity, and typical charging efficiency. This powers the trip planner and energy estimates.",
      },
    ],
  },
  {
    title: "Bookings & Payments",
    items: [
      {
        q: "When am I charged?",
        a: "When you book, an authorisation hold is placed on your card — no money is taken yet. Once your session ends, you're only charged for the actual kWh delivered, not the estimate. Any remaining hold is released automatically.",
      },
      {
        q: "Can I cancel a booking?",
        a: "Yes. Cancellations made more than 2 hours before the session start receive a full refund. Cancellations within 2 hours are charged 50%. Open the booking in the Bookings tab and tap Cancel.",
      },
      {
        q: "What if the host doesn't respond?",
        a: "If the host doesn't approve or decline within 24 hours, the booking expires automatically and your payment hold is released in full.",
      },
      {
        q: "What is the platform fee?",
        a: "VehicleGrid charges a 10% platform fee on top of the charger's advertised rate per kWh. This is shown clearly in the checkout before you confirm.",
      },
    ],
  },
  {
    title: "Charging Sessions",
    items: [
      {
        q: "What is the grace period?",
        a: "After a booking is approved, you have 15 minutes after the scheduled start time to arrive and signal your arrival. If you don't, the booking is marked as missed and no refund is issued.",
      },
      {
        q: "How do I signal arrival?",
        a: "Open the booking in the Bookings tab when you arrive, then tap 'I've Arrived'. This starts the grace period clock and lets the host know you're there.",
      },
      {
        q: "Can I end a session early?",
        a: "Yes. Open the active booking and tap 'End session early'. You'll only be charged for the kWh actually delivered up to that point.",
      },
    ],
  },
  {
    title: "Hosting a Charger",
    items: [
      {
        q: "How do I list my charger?",
        a: "Switch to the Host role in your profile, then go to My Chargers → Add Charger. Fill in the address, connector specs, power output, and pricing. Your listing goes through a quick admin review before going live.",
      },
      {
        q: "When do I get paid?",
        a: "Payouts are processed after each completed session. You receive 90% of the session subtotal (before platform fee). Funds are transferred to your connected Stripe account within 2 business days.",
      },
      {
        q: "What verification do I need as a host?",
        a: "Hosts need a verified email, phone, government ID check, and a connected Stripe account for payouts. These are one-time steps completed through the Verification flow in your profile.",
      },
    ],
  },
  {
    title: "Trip Planner",
    items: [
      {
        q: "How does the trip planner work?",
        a: "Enter your origin and destination in the Trip tab. The planner calculates your vehicle's battery usage along the route and recommends VehicleGrid chargers within a 15% detour — ranked by price, power, and availability.",
      },
      {
        q: "My vehicle isn't listed — what do I do?",
        a: "You can manually enter battery capacity and charger compatibility in the Vehicle Profile. If your model is missing from the list, contact support and we'll add it.",
      },
    ],
  },
];

function FaqAccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(250)}>
      <PressableScale
        style={[styles.faqItem, open && styles.faqItemOpen]}
        onPress={() => setOpen((v) => !v)}
      >
        <View style={styles.faqQuestion}>
          <Text style={styles.faqQ}>{item.q}</Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.textMuted}
          />
        </View>
        {open && <Text style={styles.faqA}>{item.a}</Text>}
      </PressableScale>
    </Animated.View>
  );
}

export default function HelpScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Custom header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={[Typography.pageTitle, { flex: 1 }]}>Help & Support</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="help-buoy" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSub}>
            Browse answers below or reach out directly — we usually respond within
            a few hours.
          </Text>
        </Animated.View>

        {/* Contact cards */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(300)}
          style={styles.contactRow}
        >
          <PressableScale
            style={styles.contactCard}
            onPress={() => Linking.openURL("mailto:support@vehiclegrid.app")}
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="mail-outline" size={20} color={Colors.info} />
            </View>
            <Text style={styles.contactLabel}>Email us</Text>
            <Text style={styles.contactSub}>support@vehiclegrid.app</Text>
          </PressableScale>

          <PressableScale
            style={styles.contactCard}
            onPress={() => Linking.openURL("https://vehiclegrid.app/chat")}
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.accentLight }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.contactLabel}>Live chat</Text>
            <Text style={styles.contactSub}>Mon–Fri, 9am–6pm AEST</Text>
          </PressableScale>
        </Animated.View>

        {/* FAQ sections */}
        {FAQ_SECTIONS.map((section, si) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(150 + si * 50).duration(300)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.items.map((item, ii) => (
              <FaqAccordionItem key={item.q} item={item} index={ii} />
            ))}
          </Animated.View>
        ))}

        {/* Footer links */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(300)}
          style={styles.footer}
        >
          <Text style={styles.footerTitle}>Legal</Text>
          <View style={styles.footerLinks}>
            <PressableScale
              onPress={() => Linking.openURL("https://vehiclegrid.app/terms")}
              style={styles.footerLink}
            >
              <Ionicons name="document-text-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.footerLinkText}>Terms of Service</Text>
              <Ionicons name="open-outline" size={12} color={Colors.textMuted} />
            </PressableScale>
            <PressableScale
              onPress={() => Linking.openURL("https://vehiclegrid.app/privacy")}
              style={styles.footerLink}
            >
              <Ionicons name="shield-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={12} color={Colors.textMuted} />
            </PressableScale>
            <PressableScale
              onPress={() => Linking.openURL("https://vehiclegrid.app/cookies")}
              style={styles.footerLink}
            >
              <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.footerLinkText}>Cookie Policy</Text>
              <Ionicons name="open-outline" size={12} color={Colors.textMuted} />
            </PressableScale>
          </View>
        </Animated.View>

        <View style={{ height: Spacing.xxxl + 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  // Hero
  hero: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  heroTitle: {
    ...Typography.sectionTitle,
    fontSize: 22,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },

  // Contact
  contactRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  contactCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.subtle,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  contactLabel: {
    ...Typography.body,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
  },
  contactSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
  },

  // FAQ
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
  },
  faqItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.subtle,
  },
  faqItemOpen: {
    borderColor: Colors.primary + "40",
    ...Shadows.card,
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  faqQ: {
    ...Typography.body,
    flex: 1,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  faqA: {
    ...Typography.label,
    lineHeight: 20,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // Footer links
  footer: {
    marginBottom: Spacing.lg,
  },
  footerTitle: {
    ...Typography.label,
    fontWeight: "600" as const,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  footerLinks: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
    ...Shadows.subtle,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  footerLinkText: {
    ...Typography.body,
    flex: 1,
    color: Colors.textPrimary,
  },
});
