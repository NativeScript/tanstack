import { apiUrl, Post } from '@org/state';
import { createQuery } from '@tanstack/solid-query';
import { Component, createSignal } from 'solid-js';
import { DynamicList } from '../components/collectionview';
import { useRouter } from '../router';
import { alert } from '@nativescript/core';

const fetcher = async (): Promise<Post[]> => {
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data;
  } catch (e) {
    console.log(e);
    return [];
  }
};

const Item: Component<{
  item?: () => Post;
  index?: () => number;
  type: () => string;
}> = (props) => {
  return (
    <label
      className="h-50 p-5 bg-[#06070e] text-white border-b border-gray-600"
      text={props.item().title}
      textWrap={true}
      on:tap={() => {
        alert(props.item().body)
      }}
    />
  );
};

export const Home = () => {
  const router = useRouter();
  const query = createQuery(() => ({
    queryKey: ['posts'],
    queryFn: fetcher,
  }));

  const items = () => query.data;

  const goToPage = (name: 'GalaxyButton' | 'GrowingPlant') => {
    // just showing ios shared transition with platform spring built in
    router.navigate(name);
  };

  return (
    <>
      <actionbar title="Home" className="bg-[#06070e]" />
      <gridlayout rows="*,auto" className="bg-[#06070e]">
        <DynamicList
          itemTypes={['post']}
          items={items()}
          renderItem={({ item, index, type }) => (
            <Item item={item} index={index} type={type} />
          )}
          onItemType={(item, index) => {
            return 'post';
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
