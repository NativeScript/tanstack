import { Post } from './models';

export const stateVisitedLinks = new Map<number, boolean>();

export function stateDidVisit(post: Post) {
  // allow visited posts to highlight items in the list
  return {
    ...post,
    visited: stateVisitedLinks.get(post.id),
  };
}


