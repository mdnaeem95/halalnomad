import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track, EVENTS } from '../lib/analytics';
import { spacing, typography, borderRadius } from '../constants/theme';

interface SlideContent {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  isDisclaimer?: boolean;
}

const SLIDES: SlideContent[] = [
  {
    icon: 'compass-outline',
    title: 'Halal food, anywhere you travel.',
    body: 'Verified Halal places across Asia and beyond — from real Muslim travellers, for Muslim travellers.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Trust levels you can rely on.',
    body: 'Every place shows its trust level — Reported, Community-verified, Photo-verified, or Trusted (certified). You see what we know before you commit.',
  },
  {
    icon: 'people-outline',
    title: 'Help fellow travellers.',
    body: 'Add places, verify Halal status, share photos. Earn points and rise through contributor tiers — Explorer, Guide, Ambassador, Legend.',
  },
  {
    icon: 'alert-circle-outline',
    title: 'A note on Halal — please read.',
    body:
      'Halal has many shades. Some places are fully Halal-certified, others serve Halal options or only certain dishes. ' +
      'We do our best to surface this through trust levels, certificate photos, and community verifications, but data has limits.\n\n' +
      'The Prophet ﷺ taught: between the clearly Halal and the clearly Haram are doubtful matters — and whoever leaves what is doubtful protects their faith. ' +
      'If something feels uncertain (waswasa), please verify with the staff or skip the place.\n\n' +
      'HalalNomad is a discovery tool, not a Halal authority. The final call is always yours.',
    isDisclaimer: true,
  },
];

interface Props {
  onComplete: () => void;
}

const SPLASH_BG = '#1B5E20';
const DISCLAIMER_BG = '#0D3B13';

export function Onboarding({ onComplete }: Props) {
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const onLastSlide = currentSlide === SLIDES.length - 1;
  const onDisclaimer = SLIDES[currentSlide]?.isDisclaimer === true;

  useEffect(() => {
    track(EVENTS.ONBOARDING_VIEWED);
  }, []);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const slide = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slide !== currentSlide) setCurrentSlide(slide);
  }

  function goToSlide(index: number) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  }

  function handleSkip() {
    track(EVENTS.ONBOARDING_SKIPPED_TO_DISCLAIMER);
    goToSlide(SLIDES.length - 1);
  }

  function handleNext() {
    if (onDisclaimer) return; // disclaimer dismisses via the explicit ack button
    goToSlide(currentSlide + 1);
  }

  function handleAcknowledge() {
    track(EVENTS.ONBOARDING_DISCLAIMER_ACKNOWLEDGED);
    track(EVENTS.ONBOARDING_COMPLETED);
    onComplete();
  }

  // Disable forward swipe on disclaimer slide so users can't bypass it.
  // Backward swipe (re-read previous slides) stays allowed.
  const scrollEnabled = !onDisclaimer || currentSlide > 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: onDisclaimer ? DISCLAIMER_BG : SPLASH_BG },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {SLIDES.map((slide, idx) => (
          <View
            key={idx}
            style={[
              styles.slide,
              {
                width,
                paddingTop: insets.top + spacing.xl,
                paddingBottom: spacing.xl,
              },
            ]}
          >
            <View style={styles.slideContent}>
              <View
                style={[
                  styles.iconCircle,
                  slide.isDisclaimer && styles.iconCircleDisclaimer,
                ]}
              >
                <Ionicons
                  name={slide.icon}
                  size={56}
                  color={slide.isDisclaimer ? '#FFD54F' : '#FFFFFF'}
                />
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text
                style={[
                  styles.body,
                  slide.isDisclaimer && styles.bodyDisclaimer,
                ]}
              >
                {slide.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, idx) => (
            <Pressable
              key={idx}
              onPress={() => goToSlide(idx)}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${idx + 1}`}
            >
              <View
                style={[
                  styles.dot,
                  currentSlide === idx && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.buttons}>
          {!onDisclaimer && (
            <Pressable
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip to the disclaimer"
              style={styles.skipBtn}
            >
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
          )}

          <View style={{ flex: 1 }} />

          {!onDisclaimer ? (
            <Pressable
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel={onLastSlide ? 'Continue to disclaimer' : 'Next slide'}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#1A1A1A" />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleAcknowledge}
              accessibilityRole="button"
              accessibilityLabel="I understand and will verify before eating"
              style={[styles.primaryBtn, styles.acknowledgeBtn]}
            >
              <Ionicons name="checkmark" size={18} color="#1A1A1A" />
              <Text style={styles.primaryBtnText}>I understand and will verify</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDisclaimer: {
    backgroundColor: 'rgba(255, 213, 79, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 213, 79, 0.4)',
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 16,
    maxWidth: 360,
  },
  bodyDisclaimer: {
    textAlign: 'left',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  skipBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  skipBtnText: {
    ...typography.label,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#F9A825',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  acknowledgeBtn: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#FFD54F',
  },
  primaryBtnText: {
    ...typography.label,
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
});
