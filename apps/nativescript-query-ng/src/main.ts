import { platformNativeScript, runNativeScriptAngularApp } from '@nativescript/angular';
import { enableProdMode } from '@angular/core';
import { environment } from './environments/environment';
import { AppModule } from './app.module';
import { init } from '@org/nativescript-utils';

if (environment.production) {
  enableProdMode();
}

// init settings
init();

runNativeScriptAngularApp({
  appModuleBootstrap: () => platformNativeScript().bootstrapModule(AppModule),
});
