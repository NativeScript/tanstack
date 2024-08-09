import { createQuery } from '@tanstack/solid-query';
import { apiUrl, Post, stateDidVisit, stateVisitedLinks } from '@org/state';
import { DynamicList, Item } from '../components/collectionview';
import { useRouter } from '../router';

const fetcher = async (): Promise<Post[]> =>
  await fetch(apiUrl).then((response) => response.json());

export const Posts = () => {
  const router = useRouter();
  const query = createQuery(() => ({
    queryKey: ['posts'],
    queryFn: fetcher,
  }));

  const items = () => query.data?.map(stateDidVisit);

  const goToPage = (post: Post, index: any) => {
    stateVisitedLinks.set(post.id, true);
    router.navigate('Post', {
      params: {
        ...post,
        body: post.body.replace(/\n/gi, ''),
      },
    });
  };
  const loaded = (args) => {
    if (__IOS__) {
      const navigationController: UINavigationController =
        args.object.page.frame.ios.controller;
      navigationController.navigationBar.prefersLargeTitles = true;
    }
  };

  return (
    <>
      <actionbar title="TanStack Query" />
      <gridlayout on:loaded={loaded}>
        <DynamicList
          itemTypes={['post']}
          items={items()}
          itemTap={goToPage}
          renderItem={({ item, index, type }) => (
            <Item item={item} index={index} type={type} />
          )}
          onItemType={(item, index) => {
            return 'post';
          }}
        />
      </gridlayout>
    </>
  );
};
