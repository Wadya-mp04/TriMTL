/**
 * Scan / Map / Play / Community, switched with the floating frosted tab bar.
 * Swiping between tabs is off everywhere: on Play a swipe throws the item, and it should feel the same on every tab.
 */
import TopTabs from 'expo-router/js-top-tabs';

import { FrostedTabBar } from '../../components/TabBar';
import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <FrostedTabBar {...props} />}
      screenOptions={{ swipeEnabled: false, sceneStyle: { backgroundColor: colors.mintCanvas } }}
    >
      <TopTabs.Screen name="scan" />
      <TopTabs.Screen name="map" />
      <TopTabs.Screen name="play" />
      <TopTabs.Screen name="community" />
    </TopTabs>
  );
}
