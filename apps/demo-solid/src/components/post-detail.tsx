import {
  Link,
  useParams,
  getRouteApi,
} from "@nativescript/tanstack-router/solid";
import { getPostAuthorAvatarTag } from "../utils/shared-transitions";
import { useStableLoaderData } from "../utils/use-stable-loader-data";

const route = getRouteApi("/posts/$postId");

export default function PostDetail() {
  const params = route.useParams();
  const data = useStableLoaderData(route.useLoaderData(), {
    fallback: {
      post: {
        id: params().postId,
        category: "Loading",
        title: "Loading story...",
        excerpt: "Preparing post details.",
        body: "",
        coverUrl: "https://picsum.photos/seed/ns-router-loading/1200/800",
        likes: 0,
        readSecondsAgo: "",
        readMinutes: "",
        authorId: "1",
      },
      author: {
        id: "1",
        name: "Ted Milano",
        role: "Lead Designer",
        avatarUrl: "https://i.pravatar.cc/400?img=12",
      },
      nextPostId: "1",
    },
  });

  return (
    <>
      <actionbar title={data().post.category} iosLargeTitle={true} />
      <scrollview class="bg-[#edf1f9] dark:bg-[#070d1b]">
        <stacklayout class="px-5 pt-4 pb-8">
          <stacklayout class="bg-white dark:bg-[#0f182d] rounded-[24] p-4" iosOverflowSafeAreaEnabled={false}>
            <gridlayout
              rows="260"
              class="bg-white dark:bg-[#0f182d] rounded-[24]"
              style="overflow: hidden;"
            >
              <imagecacheit src={data().post.coverUrl} stretch="aspectFill" />
              <stacklayout
                class="bg-black/45 rounded-[24] p-4"
                verticalAlignment="bottom"
              >
                <label
                  text={data().post.category}
                  class="text-[#eb6f43] text-[11px] font-bold tracking-[0.8]"
                />
                <label
                  text={data().post.title}
                  class="text-white text-3xl font-bold mt-1 leading-[3]"
                  textWrap={true}
                />
                <label
                  text={`Post #${params().postId} • ${data().post.readMinutes}`}
                  class="text-white text-sm mt-2"
                />
              </stacklayout>
            </gridlayout>

            <gridlayout
              columns="auto, *, auto"
              rows="auto"
              class="mt-4"
              verticalAlignment="center"
            >
              <imagecacheit
                col="0"
                src={data().author.avatarUrl}
                sharedTransitionTag={getPostAuthorAvatarTag(data().post.authorId)}
                class="w-[72] h-[72] rounded-full"
                stretch="aspectFill"
              />
              <stacklayout col="1" class="ml-3">
                <label text={data().author.name} class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
                <label
                  text={`${data().author.role} • ${data().post.likes} likes`}
                  class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1"
                />
              </stacklayout>
              <stacklayout col="2">
                <Link
                  to="."
                  search={{ ["@modal"]: `/users/${data().post.authorId}` }}
                >
                  <label
                    text="Profile"
                    class="bg-[#e8eefc] text-[#3458c8] rounded-full px-4 py-2 text-[14px]"
                  />
                </Link>
              </stacklayout>
            </gridlayout>

            <label
              text={data().post.excerpt}
              class="text-[#1b1f28] dark:text-[#f2f6ff] text-2xl font-bold mt-4 leading-[3]"
              textWrap={true}
            />
            <label
              text={data().post.body}
              class="text-[#4b5162] dark:text-[#a8b1c9] text-[16px] mt-3 leading-[3]"
              textWrap={true}
            />

            <gridlayout columns="*" rows="auto" class="mt-5">
              <stacklayout>
                <Link to={`/posts/${data().nextPostId}`}>
                  <label
                    text="Next Story"
                    class="text-white text-[16px] font-bold bg-[#131722] dark:bg-[#2b3a63] rounded-2xl py-4 text-center"
                  />
                </Link>
              </stacklayout>
            </gridlayout>
          </stacklayout>
        </stacklayout>
      </scrollview>
    </>
  );
}
