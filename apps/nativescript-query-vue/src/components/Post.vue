<script lang="ts" setup>
import { apiDetailUrl, Post } from '@org/state';
import { computed } from 'nativescript-vue';
import { useQuery } from '@tanstack/vue-query';

const props = defineProps<{
  post: Post;
}>();

const fetcher = async (id: number): Promise<Post> =>
  await fetch(apiDetailUrl(id)).then((response) => response.json());

const post = computed(() => props.post);
const postId = computed(() => post?.value?.id);

const { isFetching, error, status } = useQuery({
  queryKey: ['post', post.value.id],
  queryFn: () => fetcher(post.value.id),
});
</script>

<template>
  <Page>
    <ActionBar :title="'Post ' + postId"> </ActionBar>
    <GridLayout rows="auto,auto,*,auto" class="p-6">
      <Label
        v-if="status === 'pending'"
        class="text-black/50 italic text-lg m-2"
        >Loading...</Label
      >
      <Label
        v-if="status === 'error'"
        class="text-red-500 font-bold text-lg m-2"
        >Error: {{ error?.message }}</Label
      >

      <Label row="1" class="text-black text-2xl leading-3" textWrap="true">{{
        post.title
      }}</Label>
      <GridLayout row="2" class="mt-6">
        <Label
          class="text-black/75 text-lg leading-3 align-top"
          textWrap="true"
          >{{ post.body }}</Label
        >
      </GridLayout>

      <Label v-if="isFetching" row="3" class="text-black/50 italic m-2"
        >Background Updating...</Label
      >
    </GridLayout>
  </Page>
</template>
