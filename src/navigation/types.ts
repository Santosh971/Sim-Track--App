/**
 * Navigation types
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  OTP: { mobileNumber: string };
};

export type MainStackParamList = {
  Dashboard: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Permissions: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

// Screen prop types
export type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export type PermissionsScreenProps = NativeStackScreenProps<RootStackParamList, 'Permissions'>;

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type OTPScreenProps = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

export type DashboardScreenProps = NativeStackScreenProps<MainStackParamList, 'Dashboard'>;
export type SettingsScreenProps = NativeStackScreenProps<MainStackParamList, 'Settings'>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}