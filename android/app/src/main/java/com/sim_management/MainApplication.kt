package com.sim_management

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.sim_management.modules.CallLogPackage
import com.sim_management.modules.BackgroundSyncPackage
import com.sim_management.modules.SIMPackage
import com.sim_management.modules.SMSPackage
import com.sim_management.modules.WiFiSpeedPackage
import com.sim_management.modules.CallAutomationPackage // [CALL AUTOMATION]

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here
          add(CallLogPackage())
          add(BackgroundSyncPackage())
          add(SIMPackage())
          add(SMSPackage())
          add(WiFiSpeedPackage())
          add(CallAutomationPackage()) // [CALL AUTOMATION]
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}