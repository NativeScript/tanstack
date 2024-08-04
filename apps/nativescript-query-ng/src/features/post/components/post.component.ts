import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import { fromEvent, lastValueFrom, map, takeUntil } from 'rxjs';
import { PostsService } from '../../../core/services/posts.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'post',
  templateUrl: './post.component.html',
})
export class PostComponent {
  #postsService = inject(PostsService);
  #activeRoute = inject(ActivatedRoute);

  postId = signal(0);

  postQuery = injectQuery(() => ({
    enabled: this.postId() > 0,
    queryKey: ['post', this.postId()],
    queryFn: async (context) => {
      // Cancels the request when component is destroyed before the request finishes
      const abort$ = fromEvent(context.signal, 'abort');
      return lastValueFrom(
        this.#postsService.postById$(this.postId()).pipe(
          takeUntil(abort$),
          map((data) => {
            // cleanse new lines to allow text to wrap naturally
            return {
              ...data,
              body: data.body.replace(/\n/gi, ''),
            };
          })
        )
      );
    },
  }));

  queryClient = injectQueryClient();

  constructor() {
    this.#activeRoute.params.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.postId.set(params.id);
    });
  }
}
