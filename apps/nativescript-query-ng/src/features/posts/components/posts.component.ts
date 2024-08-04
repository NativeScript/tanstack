import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ItemEventData, Page, Utils } from '@nativescript/core';
import { RouterExtensions } from '@nativescript/angular';
import {
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import { stateDidVisit, stateVisitedLinks } from '@org/state';
import { lastValueFrom, map } from 'rxjs';
import { PostsService } from '../../../core/services/posts.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'posts',
  templateUrl: './posts.component.html',
})
export class PostsComponent {
  #postsService = inject(PostsService);
  #router = inject(RouterExtensions);
  #page = inject(Page);

  postsQuery = injectQuery(() => ({
    queryKey: ['posts'],
    queryFn: () =>
      lastValueFrom(
        this.#postsService.allPosts$().pipe(
          map((data) => {
            return data.map(stateDidVisit);
          })
        )
      ),
  }));

  queryClient = injectQueryClient();

  constructor() {
    this.#page.on('loaded', () => {
      if (__IOS__) {
        const navigationController: UINavigationController =
          this.#page.frame.ios.controller;
        navigationController.navigationBar.prefersLargeTitles = true;
      }
    });

    this.#page.on('navigatedTo', () => {
      if (stateVisitedLinks.size) {
        // only when links have been visited
        // for demonstration purposes, allows list to highlight visited posts green
        this.postsQuery.refetch();
      }
    });
  }

  viewDetail(args: ItemEventData) {
    const post = this.postsQuery.data()[args.index];
    stateVisitedLinks.set(post.id, true);
    this.#router.navigate(['/post', post.id]);
  }
}
