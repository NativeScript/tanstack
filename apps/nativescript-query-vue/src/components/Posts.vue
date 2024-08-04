<script lang="ts" setup>
import { EventData, ItemEventData, ListView, Page } from '@nativescript/core';
import { apiUrl, Post, stateDidVisit, stateVisitedLinks } from '@org/state';
import { computed, $navigateTo } from 'nativescript-vue';
import { useQuery } from '@tanstack/vue-query';
import PostDetail from './Post.vue';

const fetcher = async (): Promise<Post[]> =>
  await fetch(apiUrl).then((response) => response.json());

const { data, refetch } = useQuery({
  queryKey: ['posts'],
  queryFn: fetcher,
});

const items = computed(() => {
  console.log('posts updated!', data)
  return (data.value || []).map(stateDidVisit);
});

function loaded(args: EventData) {
  const page = args.object as Page;
  if (__IOS__) {
    const navigationController: UINavigationController =
      page.frame.ios.controller;
    navigationController.navigationBar.prefersLargeTitles = true;
  }
}

function navigateToDetails(args: ItemEventData) {
  const post = items.value[args.index];
  stateVisitedLinks.set(post.id, true);
  $navigateTo(PostDetail, {
    props: {
      post: {
        ...post,
        body: post.body.replace(/\n/g, ''),
      },
    },
  });
}

function navigatedTo() {
  if (stateVisitedLinks.size) {
    // only when links have been visited
    // for demonstration purposes, allows list to highlight visited posts green
    refetch();
  }
}
</script>

<template>
  <Frame>
    <Page @loaded="loaded" @navigatedTo="navigatedTo">
      <ActionBar title="Tanstack Query"> </ActionBar>

      <GridLayout>
        <ListView :items="items" @itemTap="navigateToDetails">
          <template #default="{ item }">
            <StackLayout class="p-4">
              <Label
                class="text-lg"
                :class="{
                  'text-gray-500': !item.visited,
                  'text-green-500': item.visited,
                }"
                :text="'- ' + item.title"
              />
            </StackLayout>
          </template>
        </ListView>
      </GridLayout>
    </Page>
  </Frame>
</template>
