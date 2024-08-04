import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { apiDetailUrl, apiUrl, Post } from '@org/state';

@Injectable({
  providedIn: 'root',
})
export class PostsService {
  #http = inject(HttpClient);

  postById$ = (postId: number) => this.#http.get<Post>(apiDetailUrl(postId));

  allPosts$ = () => this.#http.get<Array<Post>>(apiUrl);
}
