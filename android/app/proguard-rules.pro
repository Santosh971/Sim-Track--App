# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep WorkManager Worker classes
-keep class com.sim_management.workers.** { *; }
-keep class com.sim_management.modules.** { *; }
-keep class com.sim_management.services.** { *; }
-keep class com.sim_management.receivers.** { *; }

# Keep all React Native native module methods
-keep class com.facebook.react.bridge.** { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod <methods>;
}