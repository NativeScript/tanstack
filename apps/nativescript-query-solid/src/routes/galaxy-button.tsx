import { useRouter } from "../router";

export const GalaxyButton = () => {
  const router = useRouter();
  return (
    <>
      <actionbar title="Testing" className="bg-[#06070e] text-white">
        <navigationbutton text="Back" />
      </actionbar>
      {/* @ts-ignore */}
      <gridlayout rows="2*,*" className="bg-[#06070e]">
        <button
          rowSpan="2"
          className="rounded-full bg-gray-500 text-white w-[100] p-2 text-lg font-bold h-[45] text-center capitalize"
          iosOverflowSafeArea="false"
          sharedTransitionTag="button1"
          translateY="105"
          text="Back"
          style={{
            "z-index": 999,
          }}
          on:tap={() => {
            router.goBack();
          }}
        />
      </gridlayout>
    </>
  );
};
