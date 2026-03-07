import { Link, getRouteApi } from '@nativescript/tanstack-router/solid'
import { useStableLoaderData } from '../utils/use-stable-loader-data'

const route = getRouteApi('/users/$userId')

export default function UserModal() {
  const params = route.useParams()
  const data = useStableLoaderData(route.useLoaderData(), {
    fallback: {
      user: {
        id: params().userId,
        name: `User ${params().userId}`,
        role: 'Guest Contributor',
        avatarUrl: `https://i.pravatar.cc/400?u=guest-${params().userId}`,
        bio: 'Loading user profile...',
        location: 'Remote',
        followers: '0',
      },
    },
  })

  return (
    <stacklayout class="rounded-t-[26] p-5 bg-white/82 dark:bg-[#0b1020]/82">
      <label text="Author" class="text-[#eb6f43] text-[11px] font-bold tracking-[0.8]" />

      <gridlayout columns="auto, *" rows="auto" class="mt-2" verticalAlignment="center">
        <imagecacheit col="0" src={data().user.avatarUrl} class="w-[72] h-[72] rounded-full" stretch="aspectFill" />
        <stacklayout col="1" class="ml-3">
          <label text={data().user.name} class="text-[#1b1f28] dark:text-[#f2f6ff] text-4xl font-bold leading-[3]" textWrap={true} />
          <label text={data().user.role} class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1" />
          <label text={`${data().user.followers} followers`} class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1" />
        </stacklayout>
      </gridlayout>

      <label text={data().user.bio} class="text-[#4b5162] dark:text-[#a8b1c9] text-[16px] mt-4 leading-[3]" textWrap={true} />

      <stacklayout class="bg-[#f6f8fc] dark:bg-[#1a2540] rounded-[20] mt-4 p-4">
        <label text="Route Context" class="text-lg font-bold text-[#11131a] dark:text-[#f2f6ff]" />
        <label text={`Path param: /users/${params().userId}`} class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-2" />
        <label text={`Location: ${data().user.location}`} class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1" />
        <label text="Opened with ?@modal=/users/:id" class="text-[#8790a2] dark:text-[#9aa7c7] text-[13px] mt-1" />
      </stacklayout>

      <Link closeModal class="mt-5">
        <label text="Close Modal" class="text-white text-[16px] font-bold bg-[#131722] dark:bg-[#2b3a63] rounded-2xl py-4 text-center" />
      </Link>
    </stacklayout>
  )
}
