import { Link } from "@nativescript/tanstack-router/solid";

export default function About() {
  return (
    <>
    <actionbar title="About" iosLargeTitle={true} />
    <scrollview class="bg-[#edf1f9] dark:bg-[#070d1b]">
      <stacklayout class="px-5 pt-4 pb-8">
        <stacklayout class="bg-white dark:bg-[#0f182d] rounded-[24] p-4" iosOverflowSafeAreaEnabled={false}>
          <label
            text="A production-style demo for @nativescript/tanstack-router using SolidJS and native page navigation."
            class="text-[#4b5162] dark:text-[#a8b1c9] text-[16px] mt-2 leading-[3]"
            textWrap={true}
          />

          <label text="What's Here?" class="text-[#1b1f28] dark:text-[#f2f6ff] text-4xl font-bold mt-5" />

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="Type-Safe Route Definitions" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="Code routes with typed params and typed navigation targets." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="Route Loaders + Dynamic Params" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="Each detail page resolves loader data from /posts/$postId and renders native UI." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="Native Back Sync" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="Back buttons and gestures stay synchronized with router history state." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="Modal Routes" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="Search-driven @modal links open and close modal pages with route intent." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="Native Transitions" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="Smooth, native transitions between pages and modals." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="TanStack and SolidJS" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="A powerful combination for building native apps with type-safe routing and reactive UI." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

          <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-3 p-4">
            <label text="NativeScript" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
            <label text="Build truly native mobile apps with TypeScript." class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
          </stacklayout>

        </stacklayout>
      </stacklayout>
    </scrollview>
    </>
  );
}
