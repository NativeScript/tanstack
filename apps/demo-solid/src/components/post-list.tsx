import { For } from "solid-js";
import { Link, getRouteApi } from "@nativescript/tanstack-router/solid";
import { useStableLoaderData } from "../utils/use-stable-loader-data";

const route = getRouteApi("/posts");

export default function PostList() {
  const data = useStableLoaderData(route.useLoaderData(), {
    fallback: {
      posts: [] as Array<any>,
      users: {} as Record<string, { name: string; avatarUrl: string }>,
    },
  });

  return (
    <>
      <actionbar title="Popular" iosLargeTitle={true} />
      <scrollview class="bg-[#edf1f9] dark:bg-[#070d1b]">
        <stacklayout class="px-5 pb-8" iosOverflowSafeAreaEnabled={false}>
          <label
            text="Each card uses route loader data and links into typed detail routes."
            class="text-[#4b5162] dark:text-[#a8b1c9] text-[16px] mt-2 leading-[3]"
            textWrap={true}
          />

          <For each={data().posts}>
            {(post: any) => {
              const author = data().users[post.authorId];
              return (
                <stacklayout class="bg-white dark:bg-[#0f182d] rounded-[24] mt-4 p-4">
                  <gridlayout columns="108, *" rows="auto">
                    <imagecacheit
                      col="0"
                      src={post.coverUrl}
                      stretch="aspectFill"
                      class="w-[96] h-[108] rounded-2xl"
                      verticalAlignment="top"
                    />

                    <stacklayout col="1" class="pl-3" verticalAlignment="top">
                      <label
                        text={post.category}
                        class="text-[#eb6f43] text-[11px] font-bold tracking-[0.8]"
                      />
                      <label
                        text={post.title}
                        class="text-lg text-[#11131a] dark:text-[#f2f6ff] font-extrabold mt-1 leading-[3]"
                        textWrap={true}
                      />
                      <gridlayout columns="auto, *" rows="auto" class="mt-2">
                        <imagecacheit
                          col="0"
                          src={author.avatarUrl}
                          class="w-[28] h-[28] rounded-full"
                          stretch="aspectFill"
                          verticalAlignment="center"
                        />
                        <label
                          col="1"
                          text={`${author.name} • ${post.readMinutes}`}
                          class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] ml-2 leading-[3]"
                          textWrap={true}
                        />
                      </gridlayout>
                    </stacklayout>
                  </gridlayout>

                  <label
                    text={post.excerpt}
                    class="text-[#4b5162] dark:text-[#a8b1c9] text-[16px] mt-3 leading-[3]"
                    textWrap={true}
                  />

                  <gridlayout
                    columns="*, *"
                    rows="auto"
                    class="mt-4"
                    columnGap={10}
                  >
                    <stacklayout col="0">
                      <Link to="/posts/$postId" params={{ postId: post.id }}>
                        <label
                          text="Read Story"
                          class="text-white text-[16px] font-bold bg-[#11172a] rounded-[18] py-4 text-center"
                        />
                      </Link>
                    </stacklayout>

                    <stacklayout col="1">
                      <Link
                        to="/posts"
                        search={{ ["@modal"]: `/users/${post.authorId}` }}
                      >
                        <label
                          text="Author"
                          class="text-[#11172a] dark:text-[#e5ebff] text-[16px] font-bold bg-white dark:bg-[#1a2540] rounded-[18] py-4 text-center"
                        />
                      </Link>
                    </stacklayout>
                  </gridlayout>
                </stacklayout>
              );
            }}
          </For>

          <Link back fallbackTo="/" class="mt-5">
            <label
              text="Back to Home"
              class="text-[#131722] dark:text-[#e5ebff] text-[16px] font-bold bg-white dark:bg-[#1a2540] rounded-2xl py-4 text-center"
            />
          </Link>

          <contentview height="120" />
        </stacklayout>
      </scrollview>
    </>
  );
}
