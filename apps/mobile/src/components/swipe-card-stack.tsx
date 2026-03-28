import React, { useCallback } from 'react';
import { View, Text, useWindowDimensions, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SWIPE_VELOCITY_THRESHOLD = 500;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

interface SwipeCardStackProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onSwipeRight: (item: T) => void;
  onSwipeLeft: (item: T) => void;
  onCardPress?: (item: T) => void;
  emptyComponent?: React.ReactNode;
}

export function SwipeCardStack<T>({
  items,
  keyExtractor,
  renderCard,
  onSwipeRight,
  onSwipeLeft,
  onCardPress,
  emptyComponent,
}: SwipeCardStackProps<T>): React.JSX.Element | null {
  const { width } = useWindowDimensions();
  const SWIPE_THRESHOLD = width * 0.4;

  if (items.length === 0) {
    return emptyComponent as React.JSX.Element ?? null;
  }

  const topTwo = items.slice(0, 2).reverse();

  return (
    <View style={{ flex: 1 }}>
      {topTwo.map((item, reversedIdx) => {
        const isTop = reversedIdx === topTwo.length - 1;
        return (
          <SwipeCardInner
            key={keyExtractor(item)}
            isTop={isTop}
            screenWidth={width}
            swipeThreshold={SWIPE_THRESHOLD}
            onSwipeRight={() => onSwipeRight(item)}
            onSwipeLeft={() => onSwipeLeft(item)}
            onCardPress={onCardPress ? () => onCardPress(item) : undefined}
          >
            {renderCard(item)}
          </SwipeCardInner>
        );
      })}
    </View>
  );
}

interface SwipeCardInnerProps {
  children: React.ReactNode;
  isTop: boolean;
  screenWidth: number;
  swipeThreshold: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onCardPress?: () => void;
}

function SwipeCardInner({
  children,
  isTop,
  screenWidth,
  swipeThreshold,
  onSwipeRight,
  onSwipeLeft,
  onCardPress,
}: SwipeCardInnerProps): React.JSX.Element {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.3;

      const past = Math.abs(e.translationX) > swipeThreshold;
      if (past && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(triggerHaptic)();
      } else if (!past) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd((e) => {
      const shouldSwipe =
        Math.abs(e.translationX) > swipeThreshold ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD;

      if (shouldSwipe) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(
          direction * screenWidth * 1.5,
          { duration: 300, easing: Easing.out(Easing.cubic) },
          () => {
            if (direction > 0) {
              runOnJS(onSwipeRight)();
            } else {
              runOnJS(onSwipeLeft)();
            }
          },
        );
        translateY.value = withTiming(e.translationY * 0.5, { duration: 300 });
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        hasTriggeredHaptic.value = false;
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-15, 0, 15],
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: isTop ? 1 : 0.95 },
      ],
    };
  });

  const applyOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, swipeThreshold], [0, 1], 'clamp'),
  }));

  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -swipeThreshold], [0, 1], 'clamp'),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          cardStyle,
        ]}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={isTop ? onCardPress : undefined}
        >
          {children}

          {isTop && (
            <Animated.View
              style={[
                applyOverlayStyle,
                { position: 'absolute', top: 32, left: 24 },
              ]}
            >
              <View
                style={{
                  borderWidth: 2,
                  borderColor: '#22c55e',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  transform: [{ rotate: '-12deg' }],
                }}
              >
                <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: 'bold' }}>APPLY</Text>
              </View>
            </Animated.View>
          )}

          {isTop && (
            <Animated.View
              style={[
                passOverlayStyle,
                { position: 'absolute', top: 32, right: 24 },
              ]}
            >
              <View
                style={{
                  borderWidth: 2,
                  borderColor: '#ef4444',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  transform: [{ rotate: '12deg' }],
                }}
              >
                <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: 'bold' }}>PASS</Text>
              </View>
            </Animated.View>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
