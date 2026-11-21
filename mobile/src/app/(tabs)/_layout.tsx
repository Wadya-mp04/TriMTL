/**
 * Scan / Play / Social: swipe left or right between them, or tap the floating frosted tab bar.
 */
import TopTabs from 'expo-router/js-top-tabs';

import { FrostedTabBar } from '../../components/TabBar';
import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <FrostedTabBar {...props} />}
      screenOptions={{ swipeEnabled: true, sceneStyle: { backgroundColor: colors.mintCanvas } }}
    >
      <TopTabs.Screen name="scan" />
      <TopTabs.Screen name="play" />
      <TopTabs.Screen name="social" />
    </TopTabs>
  );
}
