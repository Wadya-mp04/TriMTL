/**
 * Scan / Map / Play / Community, switched with the floating frosted tab bar.
 * Tapping a tab slides the pages sideways over the still background; Play's scene slides with its page
 * (components/World). Swiping by hand is off: on Play a swipe throws the item, and the map pans.
 */
import TopTabs from 'expo-router/js-top-tabs';

import { FrostedTabBar } from '../../components/TabBar';
import { TabsWorld } from '../../components/World';

export default function TabsLayout() {
  return (
    <TabsWorld>
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <FrostedTabBar {...props} />}
      screenOptions={{ swipeEnabled: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <TopTabs.Screen name="scan" />
      <TopTabs.Screen name="map" />
      <TopTabs.Screen name="play" />
      <TopTabs.Screen name="community" />
    </TopTabs>
    </TabsWorld>
  );
}
