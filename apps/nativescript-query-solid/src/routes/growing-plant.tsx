import { useRouter } from "../router";

export const GrowingPlant = () => {
  const router = useRouter();
  return (
    <>
      <actionbar title="TODO: Post Detail" className="bg-[#06070e] text-white">
        <navigationbutton text="Back" />
      </actionbar>
      {/* @ts-ignore */}
      <gridlayout rows="2*,*" className="bg-[#06070e]">
        <button
          rowSpan="2"
          className="rounded-full bg-gray-500 text-white w-[100] p-2 text-lg font-bold h-[45] text-center capitalize"
          iosOverflowSafeArea="false"
          sharedTransitionTag="button2"
          translateY="105"
          text="Back"
          on:tap={() => {
            router.goBack();
          }}
          style={{
            "z-index": 999,
          }}
        />
      </gridlayout>
    </>
  );
};
