import { NgModule, Optional, SkipSelf } from '@angular/core';
import { NativeScriptHttpClientModule, NativeScriptModule, throwIfAlreadyLoaded } from '@nativescript/angular';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';

@NgModule({
  imports: [NativeScriptModule, NativeScriptHttpClientModule],
  providers: [ provideAngularQuery(new QueryClient())]
})
export class CoreModule {
  constructor(
    @Optional()
    @SkipSelf()
    parentModule: CoreModule
  ) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule');
  }
}
