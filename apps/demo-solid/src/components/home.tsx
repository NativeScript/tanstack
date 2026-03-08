import { Link } from '@nativescript/tanstack-router/solid'
import { getRouteApi } from '@nativescript/tanstack-router/solid'
import {
  createPostAuthorSharedTransitionState,
  getPostAuthorAvatarTag,
} from '../utils/shared-transitions'
import { useStableLoaderData } from '../utils/use-stable-loader-data'

const route = getRouteApi('/')

export default function Home() {
  const loaderData = route.useLoaderData()

  const fallbackFeatured = {
    id: '1',
    authorId: '1',
    title: 'Why The Freelance Life May Get Easier',
    coverUrl: 'https://picsum.photos/seed/ns-router-hero-1/1200/800',
    readSecondsAgo: '25 sec ago',
  }

  const fallbackTrending = {
    id: '2',
    authorId: '2',
    title: 'Native Back Stack Meets Type-Safe URLs',
    readMinutes: '4 min read',
  }

  const fallbackUsers: Record<string, { name: string; avatarUrl: string }> = {
    '1': {
      name: 'Ted Milano',
      avatarUrl: 'https://i.pravatar.cc/400?img=12',
    },
  }

  const fallbackData = {
    users: fallbackUsers,
    featured: fallbackFeatured,
    popular: [fallbackTrending],
  }

  const data = useStableLoaderData(loaderData as any, { fallback: fallbackData })

  const users = () => data()?.users ?? fallbackUsers
  const featured = () => data()?.featured ?? fallbackFeatured
  const popular = () => data()?.popular ?? []
  const featuredAuthorId = () => featured().authorId
  const author = () => users()[featured().authorId] || {
    name: 'Guest Author',
    avatarUrl: 'https://i.pravatar.cc/400?img=12',
  }
  const firstPopular = () => popular()[0] ?? fallbackTrending
  const featuredAvatarTag = () => getPostAuthorAvatarTag(featuredAuthorId())
  const featuredStoryTransitionState = () => createPostAuthorSharedTransitionState(featuredAuthorId())

  return (
    <>
      <actionbar title="TanStack Router" iosLargeTitle={true} />
      <scrollview class="bg-[#edf1f9] dark:bg-[#070d1b]">
        <stacklayout class="px-5 pt-4 pb-8" iosOverflowSafeAreaEnabled={false}>
          <gridlayout columns="*, auto" rows="auto" class="mb-4">
            <stacklayout col="0">
              <label text="Monday 9 March" class="text-[#eb6f43] text-[11px] font-bold tracking-[0.8]" />
              <label text="Native SolidJS News" class="text-[#d35121] dark:text-[#f2f6ff] text-2xl font-extrabold mt-1" />
            </stacklayout>

            <stacklayout col="1" verticalAlignment="center">
              <Link
                to="."
                search={{ ['@modal']: `/users/${featuredAuthorId()}` }}
              >
                <imagecacheit
                  src={author().avatarUrl}
                  class="w-[50] h-[50] rounded-full"
                  stretch="aspectFill"
                />
              </Link>
            </stacklayout>
          </gridlayout>

          <Link to="/posts/$postId" params={{ postId: featured().id }} state={featuredStoryTransitionState}>
            <gridlayout rows="220, auto" class="rounded-[24] bg-white dark:bg-[#0e1628]" style="overflow: hidden;">
              <imagecacheit row="0" src={featured().coverUrl} stretch="aspectFill" />

              <stacklayout row="0" class="bg-black/45 rounded-[24] p-4" verticalAlignment="bottom">
                <label text={featured().title} class="text-white text-2xl font-bold leading-[3]" textWrap={true} />
                <gridlayout columns="auto, *, auto" rows="auto" class="mt-2" verticalAlignment="center">
                  <imagecacheit
                    col="0"
                    src={author().avatarUrl}
                    sharedTransitionTag={featuredAvatarTag()}
                    class="w-[28] h-[28] rounded-full"
                    stretch="aspectFill"
                  />
                  <label col="1" text={author().name} class="text-white text-sm ml-2" />
                  <label col="2" text={featured().readSecondsAgo} class="text-white/75 text-xs" />
                </gridlayout>
              </stacklayout>
            </gridlayout>
          </Link>

          <label text="Router Demo" class="text-[#1b1f28] dark:text-[#f2f6ff] text-2xl font-bold mt-5" />
          <label
            text="A NativeScript app using TanStack Router with type-safe routes, loader data, native back stack sync, and modal routes."
            class="text-[#4b5162] dark:text-[#a8b1c9] text-[16px] mt-2 leading-[3]"
            textWrap={true}
          />

          <gridlayout columns="*, *" rows="auto" class="mt-5">
            <stacklayout col="0" class="mr-2">
              <Link to="/about">
                <label text="Architecture" class="text-[#131722] dark:text-[#e5ebff] text-[16px] font-bold bg-white dark:bg-[#1a2540] rounded-2xl py-4 text-center" />
              </Link>
            </stacklayout>
            <stacklayout col="1" class="ml-2">
              <Link to="/posts">
                <label text="View Posts" class="text-white text-[16px] font-bold bg-[#131722] dark:bg-[#2b3a63] rounded-2xl py-4 text-center" />
              </Link>
            </stacklayout>
          </gridlayout>

          <label text="Quick Routes" class="text-[#1b1f28] dark:text-[#f2f6ff] text-2xl font-bold mt-5" />
          <gridlayout columns="*, auto" rows="auto" class="mt-2 bg-white dark:bg-[#0f182d] rounded-[22] p-4">
            <stacklayout col="0">
              <label text="/posts/2" class="text-lg font-bold text-[#101522] dark:text-[#f2f6ff]" />
              <label text="Route params + loader detail page" class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
            </stacklayout>
            <stacklayout col="1">
              <Link to="/posts/$postId" params={{ postId: '2' }}>
                <label text="Open" class="bg-[#e8eefc] dark:bg-[#223156] text-[#3458c8] dark:text-[#9db5ff] rounded-full px-4 py-2 text-[14px]" />
              </Link>
            </stacklayout>
          </gridlayout>

          <gridlayout columns="*, auto" rows="auto" class="mt-3 bg-white dark:bg-[#0f182d] rounded-[22] p-4">
            <stacklayout col="0">
              <label text="?@modal=/users/3" class="text-lg font-bold text-[#101522] dark:text-[#f2f6ff]" />
              <label text="Search-driven modal route" class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1 leading-[3]" textWrap={true} />
            </stacklayout>
            <stacklayout col="1">
              <Link to="/posts" search={{ ['@modal']: '/users/3' }}>
                <label text="Try" class="bg-[#fdebe4] dark:bg-[#4a2a1e] text-[#dd6236] dark:text-[#ff9b75] rounded-full px-4 py-2 text-[14px]" />
              </Link>
            </stacklayout>
          </gridlayout>

          <label text="Trending" class="text-[#1b1f28] dark:text-[#f2f6ff] text-2xl font-bold mt-5" />
          <stacklayout class="bg-white dark:bg-[#0f182d] rounded-[22] mt-3 p-4">
            <label text={firstPopular().title} class="text-lg font-bold text-[#101522] dark:text-[#f2f6ff] leading-[3]" textWrap={true} />
            <gridlayout columns="auto, *" rows="auto" class="mt-2">
              <imagecacheit col="0" src={users()[firstPopular().authorId]?.avatarUrl || author().avatarUrl} class="w-[28] h-[28] rounded-full" stretch="aspectFill" />
              <label col="1" text={`${users()[firstPopular().authorId]?.name || author().name} • ${firstPopular().readMinutes}`} class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] ml-2 leading-[3]" textWrap={true} />
            </gridlayout>
            <Link to="/posts/$postId" params={{ postId: firstPopular().id }} class="mt-3">
              <label text="Read Trending Story" class="text-[#131722] dark:text-[#e5ebff] text-[16px] font-bold bg-[#f4f6fb] dark:bg-[#1a2540] rounded-2xl py-4 text-center" />
            </Link>
          </stacklayout>
        </stacklayout>
      </scrollview>
    </>
  )
}
