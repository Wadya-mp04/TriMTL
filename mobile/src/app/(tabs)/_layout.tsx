/**
 * Scan / Play / Social tabs with the floating frosted tab bar.
 */
import { Tabs } from 'expo-router/js-tabs';

import { FrostedTabBar } from '../../components/TabBar';
import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FrostedTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.mintCanvas } }}
    >
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="social" />
    </Tabs>
  );
}
