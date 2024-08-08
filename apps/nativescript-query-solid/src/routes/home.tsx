import {
  QueryClient,
  QueryClientProvider,
  createQuery,
} from '@tanstack/solid-query';
import { Component, createSignal, For } from 'solid-js';
import { apiUrl, Post } from '@org/state';
import { useRouter } from '../router';
import { DynamicList } from '../components/collectionview';

const fetcher = async (): Promise<Post[]> =>
  await fetch(apiUrl).then((response) => {
    console.log('response:', response);
    return response.json();
  });

const Item: Component<{
  item?: () => any;
  index?: () => number;
  type: () => string;
}> = (props) => {
  console.log('props:', props);
  return props.type() === 'even' ? (
    <stacklayout
      style={{ height: 100, padding: 10, backgroundColor: '#f0f0f0' }}
    >
      <label text={props.index?.() + ' ' + props.type()} className='text-white' />
    </stacklayout>
  ) : (
    <stacklayout
      style={{ height: 50, padding: 10, backgroundColor: '#a9a9a9' }}
    >
      <label text={props.index?.() + ' ' + props.type()} className='text-white' />
    </stacklayout>
  );
};

export const Home = () => {
  const router = useRouter();
  const goToPage = (name: 'GalaxyButton' | 'GrowingPlant') => {
    // just showing ios shared transition with platform spring built in
    router.navigate(name);
  };

  const query = createQuery(() => ({
    queryKey: ['posts'],
    queryFn: fetcher,
  }));

  const [items] = createSignal(query.data);

  return (
    <>
      <actionbar title="Home" className="bg-[#06070e]" />
      <gridlayout rows="*,auto" className="bg-[#06070e]">

        <DynamicList
          itemTypes={['even', 'odd']}
          items={items()}
          renderItem={({ item, index, type }) => (
            <Item item={item} index={index} type={type} />
          )}
          onItemType={(item, index) => {
            return index % 2 === 0 ? 'even' : 'odd';
          }}
        />
        <button
          row="1"
          className="rounded-full bg-green-500 text-white w-[300] mt-4 p-3 text-2xl font-bold h-[60] text-center capitalize"
          iosOverflowSafeArea="false"
          sharedTransitionTag="button2"
          text="Change once working"
          on:tap={() => {
            goToPage('GrowingPlant');
          }}
        />
      </gridlayout>
    </>
  );
};
