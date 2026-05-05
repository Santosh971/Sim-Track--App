/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { enableScreens } from 'react-native-screens';
import { setupBackgroundSyncListener, registerBackgroundSyncTask } from './src/tasks/SyncHeadlessTask';

enableScreens();

// Register the main app component
AppRegistry.registerComponent(appName, () => App);

// Register headless task for background sync (when app is minimized/screen locked)
registerBackgroundSyncTask();

// Setup background sync listener (when app is in foreground)
setupBackgroundSyncListener();

console.log('[App] Background sync listener and headless task registered');