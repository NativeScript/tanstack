import { useRouter } from '../router';

export const Post = () => {
  const router = useRouter();
  const post = router.current().params;

  return (
    <>
      <actionbar title={'Post ' + post.id}></actionbar>
      <gridlayout rows="auto,auto,*,auto" class="p-6">
        <label
          row="1"
          text={post.title}
          class="text-black text-2xl leading-3"
          textWrap="true"
        />
        <gridlayout row="2" class="mt-6">
          <label
            text={post.body}
            class="text-black/75 text-lg leading-3 align-top"
            textWrap="true"
          />
        </gridlayout>
      </gridlayout>
    </>
  );
};
